import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client-local';
import {
  EstadoVenta,
  EstadoTurnoCaja,
  TipoMovimientoCaja,
  RolUsuario,
  METODOS_EFECTIVO,
  TipoMovimientoInventario,
  Moneda,
  MetodoPago,
  OperacionSync,
} from '@ferreteria/shared';
import { registrarSync } from '../lib/syncQueue.js';
import { transaccionEscritura } from '../lib/transaccion.js';

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
    return transaccionEscritura(async (tx) => {
      // 0. Turno obligatorio (F4): el del propio vendedor, tomado DENTRO de la transacción.
      //    La primera sentencia es una ESCRITURA condicional sobre el turno: en SQLite adquiere el
      //    bloqueo de escritura de inmediato, así la venta y el cierre (que también empieza
      //    escribiendo el turno) se serializan. Si el cierre ganó, el turno ya no está ABIERTO.
      const bloqueo = await tx.turnoCaja.updateMany({
        where: { usuarioAperturaId: data.usuarioId, estado: EstadoTurnoCaja.ABIERTO },
        data: { updatedAt: new Date() },
      });
      const turno = bloqueo.count === 1
        ? await tx.turnoCaja.findFirst({ where: { usuarioAperturaId: data.usuarioId, estado: EstadoTurnoCaja.ABIERTO } })
        : null;
      if (!turno) {
        throw new Error('No tiene un turno de caja abierto (o se está cerrando). Abra un turno en Caja para poder vender.');
      }

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
          turnoCajaId: turno.id,
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

  /**
   * Anula una venta (F5): revierte stock y kárdex, guarda motivo/autor/fecha en la venta y deja
   * un AuditoriaEvento. Si la venta pertenece a un turno que ya no está ABIERTO (o no tiene turno):
   *  - solo ADMIN puede anularla;
   *  - el efectivo neto devuelto se registra como EGRESO de ajuste en el turno vigente (el del
   *    usuario que anula o, si no tiene, el abierto en la misma caja); el Z cerrado no se toca.
   * Los pagos electrónicos no generan ajuste (no salen de la gaveta).
   */
  public async anularVentaTransaccional(ventaId: string, usuario: { id: string; rol: RolUsuario }, motivo: string) {
    return transaccionEscritura(async (tx) => {
      const venta = await tx.venta.findUnique({
        where: { id: ventaId },
        include: { detalles: true, pagos: true, turnoCaja: true },
      });

      if (!venta) {
        throw new Error(`Venta con ID ${ventaId} no encontrada`);
      }

      if (venta.estado === EstadoVenta.ANULADA) {
        throw new Error(`La venta ${venta.numero ?? '#' + ventaId} ya ha sido anulada previamente`);
      }

      const turnoCerrado = !venta.turnoCaja || venta.turnoCaja.estado !== EstadoTurnoCaja.ABIERTO;
      if (turnoCerrado && usuario.rol !== RolUsuario.ADMIN) {
        throw new Error('Solo un administrador puede anular ventas de un turno cerrado.');
      }

      // Efectivo neto a devolver, por moneda (solo pagos en efectivo)
      const efectivo = new Map<Moneda, Prisma.Decimal>();
      for (const p of venta.pagos) {
        if (METODOS_EFECTIVO.includes(p.metodoPago as MetodoPago) && p.montoMoneda.gt(0)) {
          const moneda = p.moneda as Moneda;
          efectivo.set(moneda, (efectivo.get(moneda) ?? new Prisma.Decimal(0)).plus(p.montoMoneda));
        }
      }

      const ajustes: Array<{ turnoCajaId: string; moneda: Moneda; monto: number }> = [];
      if (turnoCerrado && efectivo.size > 0) {
        const vigente =
          (await tx.turnoCaja.findFirst({ where: { usuarioAperturaId: usuario.id, estado: EstadoTurnoCaja.ABIERTO } })) ??
          (venta.turnoCaja
            ? await tx.turnoCaja.findFirst({ where: { cajaNumero: venta.turnoCaja.cajaNumero, estado: EstadoTurnoCaja.ABIERTO } })
            : null);
        if (!vigente) {
          throw new Error(
            'La venta pertenece a un turno cerrado y se pagó en efectivo: Abra un turno de caja para registrar el ajuste de la devolución.'
          );
        }
        for (const [moneda, monto] of efectivo) {
          await tx.movimientoCaja.create({
            data: {
              turnoCajaId: vigente.id,
              usuarioId: usuario.id,
              tipo: TipoMovimientoCaja.EGRESO,
              monto,
              moneda,
              motivo: `Ajuste por anulación de ${venta.numero ?? 'venta #' + venta.id}: ${motivo}`,
              ventaId: venta.id,
            },
          });
          ajustes.push({ turnoCajaId: vigente.id, moneda, monto: monto.toNumber() });
        }
      }

      // 1. Estado y auditoría en la propia venta
      const ventaAnulada = await tx.venta.update({
        where: { id: ventaId },
        data: {
          estado: EstadoVenta.ANULADA,
          motivoAnulacion: motivo,
          anuladaPorId: usuario.id,
          fechaAnulacion: new Date(),
        },
        include: INCLUDE_VENTA,
      });

      // 2. Revertir el stock y registrar MovimientoInventario tipo ENTRADA
      for (const detalle of venta.detalles) {
        await tx.producto.update({
          where: { id: detalle.productoId },
          data: { stockActual: { increment: detalle.cantidad } },
        });

        await tx.movimientoInventario.create({
          data: {
            productoId: detalle.productoId,
            tipo: TipoMovimientoInventario.ENTRADA,
            cantidad: detalle.cantidad,
            motivo: `Anulación Venta #${ventaId}: ${motivo}`,
            usuarioId: usuario.id,
          },
        });
      }

      // 3. Evento de auditoría consultable
      await tx.auditoriaEvento.create({
        data: {
          entidad: 'Venta',
          entidadId: ventaId,
          accion: 'ANULAR',
          usuarioId: usuario.id,
          motivo,
          detalle: JSON.stringify({ numero: venta.numero, turnoCajaId: venta.turnoCajaId, turnoCerrado, ajustes }),
        },
      });

      // 4. Registrar anulación en SyncQueue
      await registrarSync('Venta', ventaId, OperacionSync.ACTUALIZAR, ventaAnulada as unknown as Record<string, unknown>, tx);

      return ventaAnulada;
    });
  }
}

export const ventaRepository = new VentaRepository();
