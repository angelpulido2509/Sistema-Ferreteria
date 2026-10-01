// Tipos y respuestas estándar de la API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// Enums del dominio de negocio
export enum RolUsuario {
  ADMIN = 'ADMIN',
  CAJERO = 'CAJERO',
}

export enum TipoMovimientoInventario {
  ENTRADA = 'ENTRADA',
  SALIDA = 'SALIDA',
  AJUSTE = 'AJUSTE',
}

export enum EstadoVenta {
  COMPLETADA = 'COMPLETADA',
  ANULADA = 'ANULADA',
}

export enum Moneda {
  USD = 'USD',
  VES = 'VES',
  COP = 'COP',
}

export enum MetodoPago {
  EFECTIVO_USD = 'EFECTIVO_USD',
  EFECTIVO_COP = 'EFECTIVO_COP',
  PAGO_MOVIL_VES = 'PAGO_MOVIL_VES',
  TARJETA_VES = 'TARJETA_VES',
  ZELLE_USD = 'ZELLE_USD',
  NEQUI_COP = 'NEQUI_COP',
}

/** Moneda que fija cada método de pago (validada por el servidor). */
export const MONEDA_POR_METODO: Record<MetodoPago, Moneda> = {
  [MetodoPago.EFECTIVO_USD]: Moneda.USD,
  [MetodoPago.ZELLE_USD]: Moneda.USD,
  [MetodoPago.EFECTIVO_COP]: Moneda.COP,
  [MetodoPago.NEQUI_COP]: Moneda.COP,
  [MetodoPago.PAGO_MOVIL_VES]: Moneda.VES,
  [MetodoPago.TARJETA_VES]: Moneda.VES,
};

/** Métodos de efectivo: son los únicos que entran al cuadre físico y pueden generar vuelto. */
export const METODOS_EFECTIVO: readonly MetodoPago[] = [MetodoPago.EFECTIVO_USD, MetodoPago.EFECTIVO_COP];

export enum TipoDocumento {
  FACTURA = 'FACTURA',
  NOTA_ENTREGA = 'NOTA_ENTREGA',
}

// Enums de Control de Caja y Arqueo (Guasdualito)
export enum EstadoTurnoCaja {
  ABIERTO = 'ABIERTO',
  CERRADO = 'CERRADO',
}

export enum TipoMovimientoCaja {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
}

// Enums de Sincronización Híbrida
export enum EstadoSync {
  PENDIENTE = 'PENDIENTE',
  SINCRONIZADO = 'SINCRONIZADO',
  ERROR = 'ERROR',
}

export enum OperacionSync {
  CREAR = 'CREAR',
  ACTUALIZAR = 'ACTUALIZAR',
  ELIMINAR = 'ELIMINAR',
}

// Entidades del dominio (IDs UUID de tipo string)
export interface UsuarioDTO {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CategoriaDTO {
  id: string;
  nombre: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ProveedorDTO {
  id: string;
  nombre: string;
  rif: string;
  telefono: string;
  correo: string;
  direccion: string;
  activo: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ProductoDTO {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  imagenUrl?: string | null;
  categoriaId: string;
  precioCompra: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  unidadMedida: string;
  /** F10: el producto no lleva IVA */
  exentoIva?: boolean;
  activo: boolean;
  categoria?: CategoriaDTO;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ClienteDTO {
  id: string;
  nombre: string;
  identificacion: string;
  telefono: string;
  correo: string;
  direccion: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DetalleVentaDTO {
  id: string;
  ventaId: string;
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  descuentoPorcentaje?: number;
  descuentoMonto?: number;
  /** Neto de la línea antes de IVA */
  subtotalLinea: number;
  porcentajeImpuesto?: number;
  impuestoLinea?: number;
  producto?: ProductoDTO;
}

export interface PagoVentaDTO {
  id?: string;
  ventaId?: string;
  metodoPago: MetodoPago;
  moneda: Moneda;
  /** Lo entregado por el cliente (F3) */
  montoRecibido?: number;
  /** Vuelto entregado en la moneda del pago (F3) */
  vuelto?: number;
  /** Neto aplicado a la venta */
  montoMoneda: number;
  tasaAplicada: number;
  montoUsd: number;
  referencia?: string | null;
  createdAt?: string | Date;
}

export interface TasaCambioDTO {
  id?: string;
  moneda: Moneda;
  tasaRespectoUsd: number;
  fechaActualizacion: string | Date;
}

export interface ConfiguracionDTO {
  id?: string;
  nombreFerreteria: string;
  rif: string;
  direccion: string;
  telefono: string;
  ivaPorcentaje: number;
  stockMinimoAlerta: number;
  monedaFuncional: Moneda; // 'USD' por defecto
  tasaVes: number;        // Tasa VES por 1 USD
  tasaCop: number;        // Tasa COP por 1 USD
  metodosHabilitados: string[]; // MetodoPago[] en JSON o array
  /** Última confirmación de las tasas VES/COP (null = nunca) */
  tasaActualizadaEn?: string | Date | null;
  /** Horas de vigencia de la tasa antes de bloquear cobros en VES/COP */
  tasaVigenciaHoras?: number;
  /** Tope de descuento por línea para CAJERO (%) */
  descuentoMaxCajeroPct?: number;
  updatedAt?: string | Date;
}

export interface VentaDTO {
  id: string;
  clienteId: string;
  usuarioId: string;
  fecha: string | Date;
  subtotal: number;
  impuesto: number;
  total: number;
  monedaFuncional?: Moneda;
  totalUsd?: number;
  /** Correlativo, p. ej. N001-000123 (F9) */
  numero?: string | null;
  descuentoTotal?: number;
  tipoDocumento?: TipoDocumento;
  esPrueba?: boolean;
  vueltoMoneda?: Moneda | null;
  turnoCajaId?: string | null;
  motivoAnulacion?: string | null;
  anuladaPorId?: string | null;
  fechaAnulacion?: string | Date | null;
  estado: EstadoVenta;
  cliente?: ClienteDTO;
  usuario?: UsuarioDTO;
  detalles?: DetalleVentaDTO[];
  pagos?: PagoVentaDTO[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface MovimientoInventarioDTO {
  id: string;
  productoId: string;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  fecha: string | Date;
  motivo: string;
  usuarioId: string;
  producto?: ProductoDTO;
  usuario?: UsuarioDTO;
}

// DTOs de Sincronización Outbox
export interface SyncItemDTO {
  id: string;
  entidad: string;
  entidadId: string;
  operacion: OperacionSync;
  payload: string;
  estado: EstadoSync;
  intentos: number;
  ultimoError?: string | null;
  creadoEn: string | Date;
  sincronizadoEn?: string | Date | null;
}

export interface SyncPushItemDTO {
  entidad: string;
  entidadId: string;
  operacion: OperacionSync;
  payload: Record<string, unknown>;
}

export interface SyncPushPayloadDTO {
  items: SyncPushItemDTO[];
}

export interface SyncStatusDTO {
  conectado: boolean;
  pendientes: number;
  errores: number;
  ultimaSincronizacion: string | Date | null;
  detallesErrores?: {
    id: string;
    entidad: string;
    entidadId: string;
    ultimoError: string | null;
    intentos: number;
  }[];
}

// DTOs de Reportes y Analíticas
export interface VentasDiariasDTO {
  fecha: string;
  totalVentas: number;
  montoTotal: number;
  totalArticulos: number;
}

export interface ProductoMasVendidoDTO {
  productoId: string;
  codigo: string;
  nombre: string;
  cantidadVendida: number;
  totalGenerado: number;
}

export interface StockCriticoDTO {
  productoId: string;
  codigo: string;
  nombre: string;
  categoria: string;
  stockActual: number;
  stockMinimo: number;
  unidadMedida: string;
  deficiencia: number;
}

export interface MetricasResumenDTO {
  ventasHoy: number;
  ingresosHoy: number;
  ventasMes: number;
  ingresosMes: number;
  ticketPromedio: number;
  productosCriticos: number;
  totalClientes: number;
}

// DTOs de Caja y Arqueo (Guasdualito)
export interface AbrirCajaDTO {
  cajaNumero?: string;
  montoInicialUsd: number;
  montoInicialCop: number;
  montoInicialVes?: number;
}

export interface CrearMovimientoCajaDTO {
  turnoCajaId: string;
  tipo: TipoMovimientoCaja;
  monto: number;
  moneda: Moneda;
  motivo: string;
}

export interface MovimientoCajaDTO {
  id: string;
  turnoCajaId: string;
  usuarioId: string;
  tipo: TipoMovimientoCaja;
  monto: number;
  moneda: Moneda;
  motivo: string;
  fecha: string | Date;
  usuario?: {
    id: string;
    nombre: string;
  };
}

export interface CerrarCajaDTO {
  turnoCajaId: string;
  conteoFisicoUsd: number;
  conteoFisicoCop: number;
  conteoFisicoVes?: number;
  observaciones?: string;
}

export interface TurnoCajaDTO {
  id: string;
  cajaNumero: string;
  usuarioAperturaId: string;
  usuarioApertura?: UsuarioDTO;
  usuarioCierreId?: string | null;
  usuarioCierre?: UsuarioDTO | null;
  estado: EstadoTurnoCaja;
  fechaApertura: string | Date;
  fechaCierre?: string | Date | null;
  montoInicialUsd: number;
  montoInicialCop: number;
  montoInicialVes: number;
  conteoFisicoUsd?: number | null;
  conteoFisicoCop?: number | null;
  conteoFisicoVes?: number | null;
  ventasTotalesUsd?: number | null;
  ventasEfectivoUsd?: number | null;
  ventasEfectivoCop?: number | null;
  ventasPagoMovilVes?: number | null;
  ventasTarjetaVes?: number | null;
  ventasZelleUsd?: number | null;
  vueltoUsd?: number | null;
  vueltoCop?: number | null;
  vueltoVes?: number | null;
  ingresosManualesUsd?: number | null;
  egresosManualesUsd?: number | null;
  ingresosManualesCop?: number | null;
  egresosManualesCop?: number | null;
  ingresosManualesVes?: number | null;
  egresosManualesVes?: number | null;
  diferenciaUsd?: number | null;
  diferenciaCop?: number | null;
  diferenciaVes?: number | null;
  observaciones?: string | null;
  movimientos?: MovimientoCajaDTO[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ResumenArqueoDTO {
  turnoCaja: TurnoCajaDTO;
  fondosIniciales: {
    usd: number;
    cop: number;
    ves: number;
  };
  ventasPorMetodo: {
    efectivoUsd: { monto: number; transacciones: number };
    efectivoCop: { monto: number; transacciones: number };
    pagoMovilVes: { monto: number; transacciones: number };
    tarjetaVes: { monto: number; transacciones: number };
    zelleUsd: { monto: number; transacciones: number };
    /** Billetera en pesos: no es efectivo, no entra al cuadre físico */
    nequiCop: { monto: number; transacciones: number };
    totalVentasUsd: number;
    totalTransacciones: number;
  };
  movimientosManuales: {
    ingresosUsd: number;
    egresosUsd: number;
    ingresosCop: number;
    egresosCop: number;
    ingresosVes: number;
    egresosVes: number;
    lista: MovimientoCajaDTO[];
  };
  /** Vuelto entregado en el turno, por moneda (F3) */
  vueltoEntregado: {
    usd: number;
    cop: number;
    ves: number;
  };
  esperadoEnCaja: {
    efectivoUsd: number;
    efectivoCop: number;
    efectivoVes: number;
  };
  conteoFisico?: {
    usd: number;
    cop: number;
    ves: number;
  };
  diferencias?: {
    usd: number;
    cop: number;
    ves: number;
  };
}

// Respaldos de la base de datos local (SQLite)
export interface BackupDTO {
  archivo: string;
  tamanoBytes: number;
  creadoEn: string | Date;
  /** arranque | diario | cierre-turno | manual */
  motivo: string;
}

// Aritmética monetaria exacta (F7)
export * from './money.js';
