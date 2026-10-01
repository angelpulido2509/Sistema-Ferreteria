import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client-local';
import { EstadoVenta, TipoMovimientoInventario, Moneda, MetodoPago, OperacionSync } from '@ferreteria/shared';
import { registrarSync } from '../lib/syncQueue.js';

/** Línea ya calculada por el servicio (precio de BD, descuento e IVA por línea). */
export interface LineaVentaData {
  productoId: string;
  cantidad: number;
  /** Precio de lista usado en el cálculo; se revalida dentro de la transacción. */
  precioUnitario: Prisma.Decimal;
  descuentoPorcentaje: Prisma.Decimal;
  descuentoMonto: Prisma.Decimal;
  subtotalLinea: Prisma.Decimal;
  porcentajeImpuesto: Prisma.Decimal;
  impuestoLinea: Prisma.Decimal;
}

export interface PagoVentaData {
  metodoPago: MetodoPago;
  moneda: Moneda;
  montoRecibido: Prisma.Decimal;
  vuelto: Prisma.Decimal;
  montoMoneda: Prisma.Decimal;
  tasaAplicada: Prisma.Decimal;
  montoUsd: Prisma.Decimal;
  referencia?: string | null;
}

export interface CrearVentaData {
  clienteId: string;
  usuarioId: string;
  subtotal: Prisma.Decimal;
  impuesto: Prisma.Decimal;
  total: Prisma.Decimal;
  totalUsd: Prisma.Decimal;
  descuentoTotal: Prisma.Decimal;
  descuentoAplicadoPorId: string | null;
  monedaFuncional: Moneda;
  /** Moneda en que se entregó el vuelto (null si no hubo vuelto) */
  vueltoMoneda: Moneda | null;
  turnoCajaId?: string | null;
  lineas: LineaVentaData[];
  pagos: PagoVentaData[];
}

/** Datos de producto necesarios para calcular una venta. */
export interface ProductoParaVenta {
  id: string;
  nombre: string;
  precioVenta: Prisma.Decimal;
  exentoIva: boolean;
  activo: boolean;
}

const INCLUDE_VENTA = {
  cliente: true,
  usuario: { select: { id: true, nombre: true, email: true, rol: true } },
  detalles: { include: { producto: true } },
  pagos: true,
} as const;

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

  public async findProductosParaVenta(ids: string[]): Promise<ProductoParaVenta[]> {
    return prisma.producto.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, nombre: true, precioVenta: true, exentoIva: true, activo: true },
    });
  }

  public async crearVentaTransaccional(data: CrearVentaData) {
    return prisma.$transaction(async (tx) => {
      // 1. Validar existencia, precio vigente y stock (sumando líneas repetidas del mismo producto)
      const cantidadPorProducto = new Map<string, number>();
      for (const linea of data.lineas) {
        cantidadPorProducto.set(linea.productoId, (cantidadPorProducto.get(linea.productoId) ?? 0) + linea.cantidad);
      }

      for (const linea of data.lineas) {
        const prod = await tx.producto.findUnique({ where: { id: linea.productoId } });
        if (!prod) {
          throw new Error(`Producto con ID ${linea.productoId} no encontrado`);
        }
        if (!prod.activo) {
          throw new Error(`El producto "${prod.nombre}" está inactivo`);
        }
        if (!prod.precioVenta.equals(linea.precioUnitario)) {
          throw new Error(`El precio de "${prod.nombre}" cambió mientras se procesaba la venta. Intente de nuevo.`);
        }
        const solicitado = cantidadPorProducto.get(linea.productoId) ?? linea.cantidad;
        if (prod.stockActual < solicitado) {
          throw new Error(
            `Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stockActual}, Solicitado: ${solicitado}`
          );
        }
      }

      // 2. Crear la venta con sus detalles y pagos (montos calculados por el servidor)
      const venta = await tx.venta.create({
        data: {
          clienteId: data.clienteId,
          usuarioId: data.usuarioId,
          subtotal: data.subtotal,
          impuesto: data.impuesto,
          total: data.total,
          totalUsd: data.totalUsd,
          descuentoTotal: data.descuentoTotal,
          descuentoAplicadoPorId: data.descuentoAplicadoPorId,
          monedaFuncional: data.monedaFuncional,
          vueltoMoneda: data.vueltoMoneda,
          estado: EstadoVenta.COMPLETADA,
          turnoCajaId: data.turnoCajaId || null,
          detalles: {
            create: data.lineas.map((l) => ({
              producto: { connect: { id: l.productoId } },
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              descuentoPorcentaje: l.descuentoPorcentaje,
              descuentoMonto: l.descuentoMonto,
              subtotalLinea: l.subtotalLinea,
              porcentajeImpuesto: l.porcentajeImpuesto,
              impuestoLinea: l.impuestoLinea,
            })),
          },
          pagos: data.pagos.length > 0 ? {
            create: data.pagos.map((p) => ({
              metodoPago: p.metodoPago,
              moneda: p.moneda,
              montoRecibido: p.montoRecibido,
              vuelto: p.vuelto,
              montoMoneda: p.montoMoneda,
              tasaAplicada: p.tasaAplicada,
              montoUsd: p.montoUsd,
              referencia: p.referencia || null,
            })),
          } : undefined,
        },
        include: INCLUDE_VENTA,
      });

      // 3. Descontar stock y registrar MovimientoInventario tipo SALIDA
      for (const linea of data.lineas) {
        await tx.producto.update({
          where: { id: linea.productoId },
          data: { stockActual: { decrement: linea.cantidad } },
        });

        await tx.movimientoInventario.create({
          data: {
            productoId: linea.productoId,
            tipo: TipoMovimientoInventario.SALIDA,
            cantidad: linea.cantidad,
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
