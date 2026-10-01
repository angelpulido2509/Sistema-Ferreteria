import {
  VentaRepository,
  ventaRepository as defaultRepo,
  type LineaVentaData,
  type PagoVentaData,
} from '../repositories/venta.repository.js';
import {
  ConfiguracionRepository,
  configuracionRepository as defaultConfigRepo,
} from '../repositories/configuracion.repository.js';
import { configuracionService } from './configuracion.service.js';
import {
  VentaDTO,
  EstadoVenta,
  Moneda,
  MetodoPago,
  RolUsuario,
  TipoDocumento,
  MONEDA_POR_METODO,
  METODOS_EFECTIVO,
} from '@ferreteria/shared';
import {
  ESCALA_TASA,
  TOLERANCIA_PAGO_CENTAVOS_USD,
  aMinimo,
  calcularTotalesVenta,
  decimalAMinimo,
  desdeMinimo,
  minimoADecimal,
  monedaAUsd,
  porcentajeAPuntosBasicos,
  sumarMinimos,
  tasaAEscalada,
  usdAMoneda,
  type CodigoMoneda,
} from '../config/money.js';
import { Prisma } from '@prisma/client-local';

export interface ItemVentaRequest {
  productoId: string;
  cantidad: number;
  /** % de descuento de la línea (0–100). CAJERO tiene tope configurable; ADMIN no. */
  descuentoPorcentaje?: number;
  /** Ignorado: el precio sale siempre de Producto.precioVenta (F1). */
  precioUnitario?: number | null;
}

export interface CrearPagoInput {
  metodoPago: MetodoPago;
  moneda: Moneda;
  /** Monto entregado por el cliente en la moneda del pago. */
  montoRecibido?: number;
  /** Compatibilidad con clientes anteriores (cola offline): equivale a montoRecibido. */
  montoMoneda?: number;
  /** Ignorada: la tasa sale de Configuracion (F1). */
  tasaAplicada?: number;
  referencia?: string | null;
}

export interface CrearVentaInput {
  clienteId: string;
  items: ItemVentaRequest[];
  /** Ignorado: el IVA sale de Configuracion y del producto (F1/F10). */
  porcentajeImpuesto?: number;
  monedaFuncional?: Moneda;
  pagos?: CrearPagoInput[];
  /**
   * Moneda en que se entrega el vuelto. Debe ser una de las monedas recibidas EN EFECTIVO;
   * si solo hubo efectivo en una moneda, se toma esa.
   */
  vueltoMoneda?: Moneda;
}

/** Usuario que registra la operación (de req.user: rol vigente en BD). */
export interface UsuarioOperacion {
  id: string;
  rol: RolUsuario;
}

/** Campos de Configuracion que intervienen en una venta. */
interface ConfigVenta {
  ivaPorcentaje: Prisma.Decimal | number | string;
  tasaVes: Prisma.Decimal | number | string;
  tasaCop: Prisma.Decimal | number | string;
  tasaActualizadaEn: Date | null;
  tasaVigenciaHoras: number;
  descuentoMaxCajeroPct: Prisma.Decimal | number | string;
  metodosHabilitados: unknown;
}

/** metodosHabilitados se guarda como JSON (array o texto según el proveedor). */
function metodosHabilitados(config: ConfigVenta): string[] {
  const valor = typeof config.metodosHabilitados === 'string' ? JSON.parse(config.metodosHabilitados) : config.metodosHabilitados;
  return Array.isArray(valor) ? (valor as string[]) : [];
}

const num = (v: Prisma.Decimal | number | string | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));

export class VentaService {
  constructor(
    private repo: VentaRepository = defaultRepo,
    private configRepo: ConfiguracionRepository = defaultConfigRepo,
    private ahora: () => Date = () => new Date()
  ) {}

  private mapToDTO(v: any): VentaDTO {
    return {
      id: v.id,
      numero: v.numero ?? null,
      clienteId: v.clienteId,
      usuarioId: v.usuarioId,
      fecha: v.fecha,
      subtotal: Number(v.subtotal),
      impuesto: Number(v.impuesto),
      total: Number(v.total),
      descuentoTotal: num(v.descuentoTotal),
      monedaFuncional: (v.monedaFuncional as Moneda) || Moneda.USD,
      totalUsd: v.totalUsd !== undefined ? Number(v.totalUsd) : Number(v.total),
      tipoDocumento: (v.tipoDocumento as TipoDocumento) ?? TipoDocumento.NOTA_ENTREGA,
      esPrueba: v.esPrueba ?? false,
      vueltoMoneda: (v.vueltoMoneda as Moneda) ?? null,
      turnoCajaId: v.turnoCajaId ?? null,
      motivoAnulacion: v.motivoAnulacion ?? null,
      anuladaPorId: v.anuladaPorId ?? null,
      fechaAnulacion: v.fechaAnulacion ?? null,
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
        descuentoPorcentaje: num(d.descuentoPorcentaje),
        descuentoMonto: num(d.descuentoMonto),
        subtotalLinea: Number(d.subtotalLinea),
        porcentajeImpuesto: num(d.porcentajeImpuesto),
        impuestoLinea: num(d.impuestoLinea),
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
          exentoIva: d.producto.exentoIva ?? false,
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
        montoRecibido: num(p.montoRecibido ?? p.montoMoneda),
        vuelto: num(p.vuelto),
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

  /**
   * Tasa vigente (×10 000) de Configuracion para cobrar en `moneda` (F1).
   * Rechaza la operación si la tasa nunca se confirmó o superó la vigencia configurada.
   */
  private tasaVigente(config: ConfigVenta, moneda: Moneda): number {
    if (moneda === Moneda.USD) return ESCALA_TASA;

    if (!config.tasaActualizadaEn) {
      throw new Error(
        `La tasa de ${moneda} no ha sido confirmada. Un administrador debe actualizarla en Configuración antes de cobrar en ${moneda}.`
      );
    }
    const horas = (this.ahora().getTime() - new Date(config.tasaActualizadaEn).getTime()) / 3_600_000;
    if (horas > config.tasaVigenciaHoras) {
      throw new Error(
        `La tasa de ${moneda} está desactualizada (confirmada hace ${Math.floor(horas)} h; vigencia ${config.tasaVigenciaHoras} h). ` +
          `Actualícela en Configuración antes de cobrar en ${moneda}.`
      );
    }
    return tasaAEscalada(String(moneda === Moneda.VES ? config.tasaVes : config.tasaCop));
  }

  /**
   * Valida y calcula los pagos (F2, F3). Reglas:
   *  - al menos un pago; método habilitado y moneda del método;
   *  - tasa de Configuracion vigente (la del request se ignora);
   *  - Σ recibido (en USD) ≥ total − TOLERANCIA_PAGO_CENTAVOS_USD;
   *  - el excedente es VUELTO y solo sale de pagos en EFECTIVO, en la moneda elegida
   *    (vueltoMoneda) y sin superar el efectivo recibido en esa moneda; los métodos
   *    electrónicos se cobran exactos;
   *  - montoMoneda = montoRecibido − vuelto (neto aplicado); tras el vuelto Σ montoUsd = total.
   */
  private procesarPagos(
    input: CrearVentaInput,
    config: ConfigVenta,
    totalCentavos: number
  ): { pagos: PagoVentaData[]; vueltoMoneda: Moneda | null } {
    if (!input.pagos || input.pagos.length === 0) {
      throw new Error('La venta debe incluir al menos un pago');
    }
    const habilitados = metodosHabilitados(config);

    const lineas = input.pagos.map((pago) => {
      if (!habilitados.includes(pago.metodoPago)) {
        throw new Error(`El método de pago ${pago.metodoPago} no está habilitado en Configuración`);
      }
      const monedaMetodo = MONEDA_POR_METODO[pago.metodoPago];
      if (!monedaMetodo) {
        throw new Error(`Método de pago desconocido: ${pago.metodoPago}`);
      }
      if (pago.moneda !== monedaMetodo) {
        throw new Error(`El método ${pago.metodoPago} se cobra en ${monedaMetodo}, no en ${pago.moneda}`);
      }
      const moneda = pago.moneda as CodigoMoneda;
      const recibido = aMinimo(pago.montoRecibido ?? pago.montoMoneda ?? 0, moneda);
      if (recibido <= 0) {
        throw new Error('El monto de cada pago debe ser mayor a 0');
      }
      const tasa = this.tasaVigente(config, pago.moneda);
      return {
        pago,
        moneda,
        tasa,
        recibido,
        recibidoUsd: monedaAUsd(recibido, moneda, tasa),
        vuelto: 0,
        esEfectivo: METODOS_EFECTIVO.includes(pago.metodoPago),
      };
    });

    const pagadoUsd = sumarMinimos(lineas.map((l) => l.recibidoUsd));
    if (pagadoUsd < totalCentavos - TOLERANCIA_PAGO_CENTAVOS_USD) {
      throw new Error(
        `Monto pagado insuficiente. Total requerido: ${desdeMinimo(totalCentavos, 'USD').toFixed(2)}, ` +
          `Pagado: ${desdeMinimo(pagadoUsd, 'USD').toFixed(2)}`
      );
    }

    // Excedente dentro de la tolerancia de redondeo = pago exacto (sin vuelto)
    const excedenteUsd = pagadoUsd - totalCentavos;
    let vueltoMoneda: Moneda | null = null;
    const usdPorLinea = lineas.map((l) => l.recibidoUsd);

    if (excedenteUsd > TOLERANCIA_PAGO_CENTAVOS_USD) {
      const monedasEfectivo = [...new Set(lineas.filter((l) => l.esEfectivo).map((l) => l.pago.moneda))];
      if (monedasEfectivo.length === 0) {
        throw new Error(
          'El pago excede el total y el vuelto solo se entrega de pagos en efectivo. ' +
            'Zelle, Nequi, pago móvil y punto de venta deben cobrarse por el monto exacto.'
        );
      }
      if (input.vueltoMoneda) {
        if (!monedasEfectivo.includes(input.vueltoMoneda)) {
          throw new Error(
            `La moneda del vuelto (${input.vueltoMoneda}) debe ser una de las recibidas en efectivo: ${monedasEfectivo.join(', ')}`
          );
        }
        vueltoMoneda = input.vueltoMoneda;
      } else if (monedasEfectivo.length === 1) {
        vueltoMoneda = monedasEfectivo[0]!;
      } else {
        throw new Error(`Indique la moneda del vuelto (${monedasEfectivo.join(' o ')})`);
      }

      const monedaVuelto = vueltoMoneda as CodigoMoneda;
      const lineasVuelto = lineas.filter((l) => l.esEfectivo && l.pago.moneda === vueltoMoneda);
      const tasaVuelto = lineasVuelto[0]!.tasa;
      const vueltoTotal = usdAMoneda(excedenteUsd, monedaVuelto, tasaVuelto);
      const efectivoDisponible = sumarMinimos(lineasVuelto.map((l) => l.recibido));
      if (vueltoTotal > efectivoDisponible) {
        throw new Error(
          `El vuelto (${desdeMinimo(vueltoTotal, monedaVuelto)} ${monedaVuelto}) supera el efectivo recibido en ${monedaVuelto} ` +
            `(${desdeMinimo(efectivoDisponible, monedaVuelto)}). Revise los montos de los pagos.`
        );
      }

      // Repartir el vuelto empezando por el último pago en efectivo de esa moneda
      let pendiente = vueltoTotal;
      for (const l of [...lineasVuelto].reverse()) {
        l.vuelto = Math.min(pendiente, l.recibido);
        pendiente -= l.vuelto;
      }

      // Neto en USD de cada línea; la última línea con vuelto absorbe el residuo de redondeo
      lineas.forEach((l, i) => {
        usdPorLinea[i] = monedaAUsd(l.recibido - l.vuelto, l.moneda, l.tasa);
      });
      const ultimaConVuelto = lineas.map((l) => l.vuelto > 0).lastIndexOf(true);
      usdPorLinea[ultimaConVuelto]! += totalCentavos - sumarMinimos(usdPorLinea);
    }

    const pagos = lineas.map((l, i): PagoVentaData => ({
      metodoPago: l.pago.metodoPago,
      moneda: l.pago.moneda,
      montoRecibido: minimoADecimal(l.recibido, l.moneda),
      vuelto: minimoADecimal(l.vuelto, l.moneda),
      montoMoneda: minimoADecimal(l.recibido - l.vuelto, l.moneda),
      tasaAplicada: new Prisma.Decimal(l.tasa).div(ESCALA_TASA),
      montoUsd: minimoADecimal(usdPorLinea[i]!, 'USD'),
      referencia: l.pago.referencia,
    }));

    return { pagos, vueltoMoneda };
  }

  /**
   * Registra una venta. El servidor es la única fuente de verdad de los montos (F1/F10):
   * precio de Producto.precioVenta, IVA de Configuracion por línea (0 si exentoIva),
   * descuentos explícitos con tope por rol y tasas de Configuracion vigentes.
   * Se ignoran precioUnitario, porcentajeImpuesto y tasaAplicada del request.
   */
  public async crearVenta(input: CrearVentaInput, usuario: UsuarioOperacion): Promise<VentaDTO> {
    if (!input.items || input.items.length === 0) {
      throw new Error('La venta debe incluir al menos un producto');
    }

    if (!input.clienteId) {
      throw new Error('El cliente es obligatorio para registrar la venta');
    }

    const config = (await this.configRepo.get()) as ConfigVenta;
    const ivaPb = porcentajeAPuntosBasicos(String(config.ivaPorcentaje));
    const topeDescuentoPb = porcentajeAPuntosBasicos(String(config.descuentoMaxCajeroPct));

    const productos = new Map(
      (await this.repo.findProductosParaVenta(input.items.map((i) => i.productoId))).map((p) => [p.id, p])
    );

    const lineasCalculo = input.items.map((item) => {
      if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
        throw new Error(`Cantidad inválida (${item.cantidad}) para el producto ID ${item.productoId}`);
      }
      const producto = productos.get(item.productoId);
      if (!producto) {
        throw new Error(`Producto ${item.productoId} no encontrado`);
      }
      if (!producto.activo) {
        throw new Error(`El producto "${producto.nombre}" está inactivo`);
      }

      const descuentoPb = porcentajeAPuntosBasicos(item.descuentoPorcentaje ?? 0);
      if (descuentoPb < 0 || descuentoPb > 10_000) {
        throw new Error(`El descuento de "${producto.nombre}" debe estar entre 0 % y 100 %`);
      }
      if (usuario.rol !== RolUsuario.ADMIN && descuentoPb > topeDescuentoPb) {
        throw new Error(
          `El descuento de "${producto.nombre}" (${desdeMinimo(descuentoPb, 'USD')} %) supera el tope de descuento ` +
            `para cajero (${desdeMinimo(topeDescuentoPb, 'USD')} %). Solicite autorización a un administrador.`
        );
      }

      return {
        producto,
        cantidad: item.cantidad,
        precioCentavos: decimalAMinimo(producto.precioVenta, 'USD'),
        descuentoPb,
        ivaPb: producto.exentoIva ? 0 : ivaPb,
      };
    });

    const totales = calcularTotalesVenta(lineasCalculo);
    const lineas: LineaVentaData[] = totales.lineas.map((l, i) => ({
      productoId: lineasCalculo[i]!.producto.id,
      cantidad: l.cantidad,
      precioUnitario: lineasCalculo[i]!.producto.precioVenta,
      descuentoPorcentaje: minimoADecimal(l.descuentoPb, 'USD'),
      descuentoMonto: minimoADecimal(l.descuentoCentavos, 'USD'),
      subtotalLinea: minimoADecimal(l.netoCentavos, 'USD'),
      porcentajeImpuesto: minimoADecimal(l.ivaPb, 'USD'),
      impuestoLinea: minimoADecimal(l.ivaCentavos, 'USD'),
    }));

    const { pagos, vueltoMoneda } = this.procesarPagos(input, config, totales.totalCentavos);

    const total = minimoADecimal(totales.totalCentavos, 'USD');
    const venta = await this.repo.crearVentaTransaccional({
      clienteId: input.clienteId,
      usuarioId: usuario.id,
      subtotal: minimoADecimal(totales.subtotalCentavos, 'USD'),
      impuesto: minimoADecimal(totales.impuestoCentavos, 'USD'),
      total,
      totalUsd: total,
      descuentoTotal: minimoADecimal(totales.descuentoCentavos, 'USD'),
      descuentoAplicadoPorId: totales.descuentoCentavos > 0 ? usuario.id : null,
      monedaFuncional: input.monedaFuncional ?? Moneda.USD,
      vueltoMoneda,
      lineas,
      pagos,
    });

    return this.mapToDTO(venta);
  }

  /** Anula una venta con auditoría (F5). Ver VentaRepository.anularVentaTransaccional. */
  public async anularVenta(ventaId: string, usuario: UsuarioOperacion, motivo: string): Promise<VentaDTO> {
    if (!motivo || !motivo.trim()) {
      throw new Error('El motivo de anulación es obligatorio para efectos de auditoría');
    }

    const ventaAnulada = await this.repo.anularVentaTransaccional(ventaId, usuario, motivo.trim());
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
        montoRecibido: p.montoRecibido,
        vuelto: p.vuelto,
        montoMoneda: p.montoMoneda,
        tasaAplicada: p.tasaAplicada,
        montoUsd: p.montoUsd,
        referencia: p.referencia,
      })),
    };
  }
}

export const ventaService = new VentaService();
