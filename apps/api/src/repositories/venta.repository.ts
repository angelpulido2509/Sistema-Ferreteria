import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client-local';
import { EstadoVenta, TipoMovimientoInventario, Moneda, MetodoPago, OperacionSync } from '@ferreteria/shared';
import { registrarSync } from '../lib/syncQueue.js';

export interface ItemVentaInput {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
}

export interface PagoVentaInput {
  metodoPago: MetodoPago;
  moneda: Moneda;
  montoMoneda: number;
  tasaAplicada: number;
  montoUsd: number;
  referencia?: string | null;
}

export interface CrearVentaData {
  clienteId: string;
  usuarioId: string;
  subtotal: number;
  impuesto: number;
  total: number;
  monedaFuncional?: Moneda;
  totalUsd?: number;
  turnoCajaId?: string | null;
  items: ItemVentaInput[];
  pagos?: PagoVentaInput[];
}

export class VentaRepository {
  public async findAll() {
    return prisma.venta.findMany({
      include: {
        cliente: true,
        usuario: {
          select: { id: true, nombre: true, email: true, rol: true },
        },
        detalles: {
          include: {
            producto: true,
          },
        },
        pagos: true,
      },
      orderBy: { fecha: 'desc' },
    });
  }

  public async findById(id: string) {
    return prisma.venta.findUnique({
      where: { id },
      include: {
        cliente: true,
        usuario: {
          select: { id: true, nombre: true, email: true, rol: true },
        },
        detalles: {
          include: {
            producto: true,
          },
        },
        pagos: true,
      },
    });
  }

  public async crearVentaTransaccional(data: CrearVentaData) {
    return prisma.$transaction(async (tx: any) => {
      // 1. Validar existencia y stock de cada producto
      for (const item of data.items) {
        const prod = await tx.producto.findUnique({
          where: { id: item.productoId },
        });

        if (!prod) {
          throw new Error(`Producto con ID ${item.productoId} no encontrado`);
        }

        if (!prod.activo) {
          throw new Error(`El producto "${prod.nombre}" está inactivo`);
        }

        if (prod.stockActual < item.cantidad) {
          throw new Error(
            `Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stockActual}, Solicitado: ${item.cantidad}`
          );
        }
      }

      // 2. Crear la venta con sus detalles y pagos
      const venta = await tx.venta.create({
        data: {
          clienteId: data.clienteId,
          usuarioId: data.usuarioId,
          subtotal: new Prisma.Decimal(data.subtotal.toFixed(2)),
          impuesto: new Prisma.Decimal(data.impuesto.toFixed(2)),
          total: new Prisma.Decimal(data.total.toFixed(2)),
          monedaFuncional: data.monedaFuncional ?? Moneda.USD,
          totalUsd: new Prisma.Decimal((data.totalUsd ?? data.total).toFixed(2)),
          estado: EstadoVenta.COMPLETADA,
          turnoCajaId: data.turnoCajaId || null,
          detalles: {
            create: data.items.map((item) => ({
              producto: { connect: { id: item.productoId } },
              cantidad: item.cantidad,
              precioUnitario: new Prisma.Decimal(item.precioUnitario.toFixed(2)),
              subtotalLinea: new Prisma.Decimal((item.cantidad * item.precioUnitario).toFixed(2)),
            })),
          },
          pagos: data.pagos && data.pagos.length > 0 ? {
            create: data.pagos.map((p) => ({
              metodoPago: p.metodoPago,
              moneda: p.moneda,
              montoMoneda: new Prisma.Decimal(p.montoMoneda.toFixed(2)),
              tasaAplicada: new Prisma.Decimal(p.tasaAplicada.toFixed(4)),
              montoUsd: new Prisma.Decimal(p.montoUsd.toFixed(2)),
              referencia: p.referencia || null,
            })),
          } : undefined,
        },
        include: {
          cliente: true,
          usuario: {
            select: { id: true, nombre: true, email: true, rol: true },
          },
          detalles: {
            include: {
              producto: true,
            },
          },
          pagos: true,
        },
      });

      // 3. Descontar stock y registrar MovimientoInventario tipo SALIDA
      for (const item of data.items) {
        await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stockActual: { decrement: item.cantidad },
          },
        });

        await tx.movimientoInventario.create({
          data: {
            productoId: item.productoId,
            tipo: TipoMovimientoInventario.SALIDA,
            cantidad: item.cantidad,
            motivo: `Venta #${venta.id}`,
            usuarioId: data.usuarioId,
          },
        });
      }

      // 4. Registrar en SyncQueue para sincronización diferida hacia la nube
      await registrarSync('Venta', venta.id, OperacionSync.CREAR, venta as unknown as Record<string, unknown>, tx);

      return venta;
    });
  }

  public async anularVentaTransaccional(ventaId: string, usuarioId: string, motivo: string) {
    return prisma.$transaction(async (tx: any) => {
      const venta = await tx.venta.findUnique({
        where: { id: ventaId },
        include: {
          detalles: true,
        },
      });

      if (!venta) {
        throw new Error(`Venta con ID ${ventaId} no encontrada`);
      }

      if (venta.estado === EstadoVenta.ANULADA) {
        throw new Error(`La venta #${ventaId} ya ha sido anulada previamente`);
      }

      // 1. Cambiar estado a ANULADA
      const ventaAnulada = await tx.venta.update({
        where: { id: ventaId },
        data: {
          estado: EstadoVenta.ANULADA,
        },
        include: {
          cliente: true,
          usuario: {
            select: { id: true, nombre: true, email: true, rol: true },
          },
          detalles: {
            include: {
              producto: true,
            },
          },
          pagos: true,
        },
      });

      // 2. Revertir el stock y registrar MovimientoInventario tipo ENTRADA
      for (const detalle of venta.detalles) {
        await tx.producto.update({
          where: { id: detalle.productoId },
          data: {
            stockActual: { increment: detalle.cantidad },
          },
        });

        await tx.movimientoInventario.create({
          data: {
            productoId: detalle.productoId,
            tipo: TipoMovimientoInventario.ENTRADA,
            cantidad: detalle.cantidad,
            motivo: `Anulación Venta #${ventaId}: ${motivo.trim()}`,
            usuarioId: usuarioId,
          },
        });
      }

      // 3. Registrar anulación en SyncQueue
      await registrarSync('Venta', ventaId, OperacionSync.ACTUALIZAR, ventaAnulada as unknown as Record<string, unknown>, tx);

      return ventaAnulada;
    });
  }
}

export const ventaRepository = new VentaRepository();
