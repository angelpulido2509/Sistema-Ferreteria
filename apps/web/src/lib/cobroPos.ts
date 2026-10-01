import {
  METODOS_EFECTIVO,
  Moneda,
  aMinimo,
  desdeMinimo,
  monedaAUsd,
  tasaAEscalada,
  usdAMoneda,
  type CodigoMoneda,
  type MetodoPago,
} from '@ferreteria/shared';

/** Mismo valor que TOLERANCIA_PAGO_CENTAVOS_USD del servidor. */
const TOLERANCIA_CENTAVOS = 1;

export interface LineaCobro {
  metodoPago: MetodoPago;
  moneda: Moneda;
  /** Lo que entrega el cliente */
  montoMoneda: number;
}

export interface EstadoCobro {
  pagadoUsd: number;
  /** > 0 si falta dinero */
  faltanteUsd: number;
  /** Monedas recibidas en efectivo (posibles monedas del vuelto) */
  monedasEfectivo: Moneda[];
  vueltoMoneda: Moneda | null;
  vueltoMonto: number;
  /** Motivo por el que no se puede confirmar (además de faltar dinero) */
  bloqueo: string | null;
}

/**
 * Estado del cobro en el POS con la regla del servidor (F3): el vuelto solo sale de pagos
 * en EFECTIVO, en la moneda elegida, sin superar el efectivo recibido en esa moneda.
 * Es solo para la pantalla: el servidor recalcula todo.
 */
export function calcularCobro(
  lineas: readonly LineaCobro[],
  totalUsd: number,
  tasas: { ves: number; cop: number },
  vueltoMonedaElegida: Moneda | null
): EstadoCobro {
  const tasa = (m: Moneda) => (m === Moneda.USD ? 10_000 : tasaAEscalada(m === Moneda.VES ? tasas.ves : tasas.cop));
  const recibidos = lineas.map((l) => {
    const minimo = l.montoMoneda > 0 ? aMinimo(l.montoMoneda, l.moneda as CodigoMoneda) : 0;
    return { ...l, minimo, usd: monedaAUsd(minimo, l.moneda as CodigoMoneda, tasa(l.moneda)) };
  });
  const total = aMinimo(totalUsd, 'USD');
  const pagado = recibidos.reduce((s, r) => s + r.usd, 0);
  const monedasEfectivo = [...new Set(recibidos.filter((r) => r.minimo > 0 && METODOS_EFECTIVO.includes(r.metodoPago)).map((r) => r.moneda))];

  const estado: EstadoCobro = {
    pagadoUsd: desdeMinimo(pagado, 'USD'),
    faltanteUsd: pagado < total - TOLERANCIA_CENTAVOS ? desdeMinimo(total - pagado, 'USD') : 0,
    monedasEfectivo,
    vueltoMoneda: null,
    vueltoMonto: 0,
    bloqueo: null,
  };

  const excedente = pagado - total;
  if (excedente <= TOLERANCIA_CENTAVOS) return estado;

  if (monedasEfectivo.length === 0) {
    estado.bloqueo = 'El pago excede el total. Zelle, Nequi, pago móvil y punto de venta se cobran por el monto exacto: el vuelto solo sale del efectivo.';
    return estado;
  }
  const moneda =
    vueltoMonedaElegida && monedasEfectivo.includes(vueltoMonedaElegida) ? vueltoMonedaElegida : monedasEfectivo[monedasEfectivo.length - 1]!;
  const vuelto = usdAMoneda(excedente, moneda as CodigoMoneda, tasa(moneda));
  const disponible = recibidos
    .filter((r) => r.moneda === moneda && METODOS_EFECTIVO.includes(r.metodoPago))
    .reduce((s, r) => s + r.minimo, 0);

  estado.vueltoMoneda = moneda;
  estado.vueltoMonto = desdeMinimo(vuelto, moneda as CodigoMoneda);
  if (vuelto > disponible) {
    estado.bloqueo = `El vuelto supera el efectivo recibido en ${moneda}. Ajuste los montos de los pagos.`;
  }
  return estado;
}
