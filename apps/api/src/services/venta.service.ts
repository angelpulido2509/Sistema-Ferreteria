import { VentaRepository, ventaRepository as defaultRepo, type ItemVentaInput, type PagoVentaInput } from '../repositories/venta.repository.js';
import { configuracionService } from './configuracion.service.js';
import { prisma } from '../lib/prisma.js';
import { VentaDTO, EstadoVenta, Moneda, MetodoPago } from '@ferreteria/shared';

export interface CrearPagoInput {
  metodoPago: MetodoPago;
  moneda: Moneda;
  montoMoneda: number;
  tasaAplicada: number;
  referencia?: string;
}

export interface CrearVentaInput {
  clienteId: string;
  items: Array<{
    productoId: string;
    cantidad: number;
    precioUnitario: number;
  }>;
  porcentajeImpuesto?: number; // Por defecto 16% (IVA)
  monedaFuncional?: Moneda;
  pagos?: CrearPagoInput[];
}

export class VentaService {
  constructor(private repo: VentaRepository = defaultRepo) {}

  private mapToDTO(v: any): VentaDTO {
    return {
      id: v.id,
      clienteId: v.clienteId,
      usuarioId: v.usuarioId,
      fecha: v.fecha,
      subtotal: Number(v.subtotal),
      impuesto: Number(v.impuesto),
      total: Number(v.total),
      monedaFuncional: (v.monedaFuncional as Moneda) || Moneda.USD,
      totalUsd: v.totalUsd !== undefined ? Number(v.totalUsd) : Number(v.total),
      estado: v.estado as EstadoVenta,
      cliente: v.cliente ? {
        id: v.cliente.id,
        nombre: v.cliente.nombre,
        identificacion: v.cliente.identificacion,
        telefono: v.cliente.telefono || '',
        correo: v.cliente.correo || '',
        direccion: v.cliente.direccion || '',
        createdAt: v.cliente.createdAt,
        updatedAt: v.cliente.updatedAt,
      } : undefined,
      usuario: v.usuario ? {
        id: v.usuario.id,
        nombre: v.usuario.nombre,
        email: v.usuario.email,
        rol: v.usuario.rol,
        activo: true,
        createdAt: v.fecha,
        updatedAt: v.fecha,
      } : undefined,
      detalles: v.detalles ? v.detalles.map((d: any) => ({
        id: d.id,
        ventaId: d.ventaId,
        productoId: d.productoId,
        cantidad: d.cantidad,
        precioUnitario: Number(d.precioUnitario),
        subtotalLinea: Number(d.subtotalLinea),
        producto: d.producto ? {
          id: d.producto.id,
          codigo: d.producto.codigo,
          nombre: d.producto.nombre,
          descripcion: d.producto.descripcion,
          categoriaId: d.producto.categoriaId,
          precioCompra: Number(d.producto.precioCompra),
          precioVenta: Number(d.producto.precioVenta),
          stockActual: d.producto.stockActual,
          stockMinimo: d.producto.stockMinimo,
          unidadMedida: d.producto.unidadMedida,
          activo: d.producto.activo,
          createdAt: d.producto.createdAt,
          updatedAt: d.producto.updatedAt,
        } : undefined,
      })) : undefined,
      pagos: v.pagos ? v.pagos.map((p: any) => ({
        id: p.id,
        ventaId: p.ventaId,
        metodoPago: p.metodoPago as MetodoPago,
        moneda: p.moneda as Moneda,
        montoMoneda: Number(p.montoMoneda),
        tasaAplicada: Number(p.tasaAplicada),
        montoUsd: Number(p.montoUsd),
        referencia: p.referencia,
        createdAt: p.createdAt,
      })) : undefined,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }

  public async getAll(): Promise<VentaDTO[]> {
    const ventas = await this.repo.findAll();
    return ventas.map(v => this.mapToDTO(v));
  }

  public async getById(id: string): Promise<VentaDTO> {
    const venta = await this.repo.findById(id);
    if (!venta) {
      throw new Error(`Venta con ID ${id} no encontrada`);
    }
    return this.mapToDTO(venta);
  }

  public async crearVenta(input: CrearVentaInput, usuarioId: string): Promise<VentaDTO> {
    if (!input.items || input.items.length === 0) {
      throw new Error('La venta debe incluir al menos un producto');
    }

    if (!input.clienteId) {
      throw new Error('El cliente es obligatorio para registrar la venta');
    }

    let subtotalCalculado = 0;
    const itemsValidados: ItemVentaInput[] = [];

    for (const item of input.items) {
      if (item.cantidad <= 0 || !Number.isInteger(item.cantidad)) {
        throw new Error(`Cantidad inválida (${item.cantidad}) para el producto ID ${item.productoId}`);
      }

      let precioUnitario = item.precioUnitario;
      if (precioUnitario === undefined || precioUnitario === null) {
        const prod = await prisma.producto.findUnique({ where: { id: item.productoId } });
        if (!prod) {
          throw new Error(`Producto ${item.productoId} no encontrado`);
        }
        precioUnitario = Number(prod.precioVenta);
      }

      if (precioUnitario < 0) {
        throw new Error(`Precio unitario no puede ser negativo`);
      }

      const lineaTotal = item.cantidad * precioUnitario;
      subtotalCalculado += lineaTotal;

      itemsValidados.push({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario,
      });
    }

    const tasaImpuesto = input.porcentajeImpuesto !== undefined ? input.porcentajeImpuesto : 0.16;
    const impuestoCalculado = subtotalCalculado * tasaImpuesto;
    const totalCalculado = subtotalCalculado + impuestoCalculado;
    const totalUsd = Math.round(totalCalculado * 100) / 100;

    // Procesar y validar pagos si se especifican
    let pagosValidados: PagoVentaInput[] | undefined = undefined;
    if (input.pagos && input.pagos.length > 0) {
      let totalPagadoUsd = 0;
      pagosValidados = [];

      for (const pago of input.pagos) {
        if (pago.montoMoneda <= 0) {
          throw new Error('El monto de cada pago debe ser mayor a 0');
        }

        let tasa = pago.tasaAplicada;
        let montoUsd = 0;

        if (pago.moneda === Moneda.USD) {
          tasa = 1;
          montoUsd = pago.montoMoneda;
        } else {
          if (tasa <= 0) {
            throw new Error(`Tasa inválida para la moneda ${pago.moneda}`);
          }
          montoUsd = pago.montoMoneda / tasa;
        }

        const montoUsdRedondeado = Math.round(montoUsd * 100) / 100;
        totalPagadoUsd += montoUsdRedondeado;

        pagosValidados.push({
          metodoPago: pago.metodoPago,
          moneda: pago.moneda,
          montoMoneda: pago.montoMoneda,
          tasaAplicada: tasa,
          montoUsd: montoUsdRedondeado,
          referencia: pago.referencia,
        });
      }

      // Validar que el total pagado cubra el total en USD (tolerancia de 0.05 por redondeo de centavos)
      if (totalPagadoUsd < totalUsd - 0.05) {
        throw new Error(
          `Monto pagado insuficiente. Total requerido: $${totalUsd.toFixed(2)}, Pagado: $${totalPagadoUsd.toFixed(2)}`
        );
      }
    }

    // Asociar al turno de caja abierto actualmente si existe
    const turnoActivo = await prisma.turnoCaja.findFirst({
      where: { estado: 'ABIERTO' },
      orderBy: { fechaApertura: 'desc' },
    });

    const venta = await this.repo.crearVentaTransaccional({
      clienteId: input.clienteId,
      usuarioId,
      subtotal: Math.round(subtotalCalculado * 100) / 100,
      impuesto: Math.round(impuestoCalculado * 100) / 100,
      total: totalUsd,
      monedaFuncional: input.monedaFuncional ?? Moneda.USD,
      totalUsd,
      turnoCajaId: turnoActivo?.id || null,
      items: itemsValidados,
      pagos: pagosValidados,
    });

    return this.mapToDTO(venta);
  }

  public async anularVenta(ventaId: string, usuarioId: string, motivo: string): Promise<VentaDTO> {
    if (!motivo || !motivo.trim()) {
      throw new Error('El motivo de anulación es obligatorio para efectos de auditoría');
    }

    const ventaAnulada = await this.repo.anularVentaTransaccional(ventaId, usuarioId, motivo.trim());
    return this.mapToDTO(ventaAnulada);
  }

  public async generarComprobante(ventaId: string) {
    const venta = await this.getById(ventaId);
    let config;
    try {
      config = await configuracionService.get();
    } catch {
      config = {
        nombreFerreteria: 'Ferretería El Tornillo Fuerte',
        rif: 'J-12345678-9',
        direccion: 'Guasdualito, Apure, Venezuela',
        telefono: '0414-1234567',
      };
    }

    return {
      empresa: {
        nombre: config.nombreFerreteria,
        rif: config.rif,
        direccion: config.direccion,
        telefono: config.telefono,
      },
      comprobante: {
        numero: `FAC-${venta.id.toString().padStart(6, '0')}`,
        fecha: venta.fecha,
        estado: venta.estado,
        monedaFuncional: venta.monedaFuncional || Moneda.USD,
      },
      cliente: venta.cliente,
      cajero: venta.usuario?.nombre,
      items: venta.detalles?.map(d => ({
        codigo: d.producto?.codigo,
        descripcion: d.producto?.nombre,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        subtotal: d.subtotalLinea,
      })),
      totales: {
        subtotal: venta.subtotal,
        impuesto: venta.impuesto,
        total: venta.total,
        totalUsd: venta.totalUsd ?? venta.total,
      },
      pagos: venta.pagos?.map(p => ({
        metodoPago: p.metodoPago,
        moneda: p.moneda,
        montoMoneda: p.montoMoneda,
        tasaAplicada: p.tasaAplicada,
        montoUsd: p.montoUsd,
        referencia: p.referencia,
      })),
    };
  }
}

export const ventaService = new VentaService();
