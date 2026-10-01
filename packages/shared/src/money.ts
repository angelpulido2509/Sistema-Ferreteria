/**
 * Aritmética monetaria exacta en UNIDADES MÍNIMAS ENTERAS (F7).
 *
 *  - USD: centavos (2 decimales) · VES: céntimos (2 decimales) · COP: pesos (0 decimales).
 *  - Porcentajes en puntos básicos (16 % = 1600) y tasas escaladas ×10 000 (4 decimales).
 *  - Las multiplicaciones y divisiones intermedias se hacen con BigInt y se redondean
 *    "half-up" (0,5 → arriba), nunca con Math.round(x * 100) / 100 sobre flotantes.
 *
 * Lo usan el servidor (fuente de verdad) y el POS (para mostrar el mismo total).
 */

export type CodigoMoneda = 'USD' | 'VES' | 'COP';

export const DECIMALES_MONEDA: Record<CodigoMoneda, number> = { USD: 2, VES: 2, COP: 0 };

/** Escala de las tasas de cambio (4 decimales). */
export const ESCALA_TASA = 10_000;
/** Escala de los porcentajes (2 decimales → puntos básicos). */
export const ESCALA_PORCENTAJE = 100;

const pot10 = (n: number): bigint => 10n ** BigInt(n);

/** División entera redondeando a la unidad más cercana (half-up, simétrico para negativos). */
export function dividirRedondeando(numerador: bigint, denominador: bigint): bigint {
  if (denominador === 0n) throw new Error('División por cero');
  const negativo = numerador < 0n !== denominador < 0n;
  const n = numerador < 0n ? -numerador : numerador;
  const d = denominador < 0n ? -denominador : denominador;
  const q = (n * 2n + d) / (2n * d);
  return negativo ? -q : q;
}

/**
 * Convierte un valor decimal (número o texto) a entero escalado con `decimales`,
 * redondeando half-up sobre los dígitos decimales (sin errores de coma flotante).
 */
export function aEscalado(valor: number | string, decimales: number): number {
  let texto = typeof valor === 'number' ? String(valor) : valor.trim();
  if (/e/i.test(texto)) texto = Number(texto).toFixed(20);
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(texto);
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
    throw new Error(`Monto inválido: ${String(valor)}`);
  }
  const [, signo, enteros = '', fraccion = ''] = match;
  const relleno = fraccion.padEnd(decimales + 1, '0');
  const base = BigInt((enteros || '0') + relleno.slice(0, decimales));
  const siguiente = Number(relleno[decimales]);
  const redondeado = siguiente >= 5 ? base + 1n : base;
  const resultado = Number(redondeado);
  if (!Number.isSafeInteger(resultado)) throw new Error(`Monto fuera de rango: ${String(valor)}`);
  return signo === '-' && resultado !== 0 ? -resultado : resultado;
}

/** Monto decimal → unidades mínimas de la moneda (p. ej. 12.345 USD → 1235 centavos). */
export function aMinimo(valor: number | string, moneda: CodigoMoneda): number {
  return aEscalado(valor, DECIMALES_MONEDA[moneda]);
}

/** Unidades mínimas → número decimal (solo para mostrar o serializar). */
export function desdeMinimo(minimo: number, moneda: CodigoMoneda): number {
  return minimo / 10 ** DECIMALES_MONEDA[moneda];
}

/** Unidades mínimas → texto con los decimales exactos de la moneda (para guardar en Decimal). */
export function minimoATexto(minimo: number, moneda: CodigoMoneda): string {
  const d = DECIMALES_MONEDA[moneda];
  const negativo = minimo < 0;
  const abs = String(Math.abs(minimo)).padStart(d + 1, '0');
  const texto = d === 0 ? abs : `${abs.slice(0, -d)}.${abs.slice(-d)}`;
  return negativo ? `-${texto}` : texto;
}

/** Tasa decimal (unidades de moneda por 1 USD) → entero ×10 000. */
export function tasaAEscalada(tasa: number | string): number {
  const escalada = aEscalado(tasa, 4);
  if (escalada <= 0) throw new Error('La tasa de cambio debe ser mayor a 0');
  return escalada;
}

/** Porcentaje decimal (16, 7.5) → puntos básicos (1600, 750). */
export function porcentajeAPuntosBasicos(porcentaje: number | string): number {
  return aEscalado(porcentaje, 2);
}

/** Aplica un porcentaje (en puntos básicos) a un monto en unidades mínimas. */
export function aplicarPorcentaje(minimo: number, puntosBasicos: number): number {
  return Number(dividirRedondeando(BigInt(minimo) * BigInt(puntosBasicos), 10_000n));
}

/** Suma de enteros con verificación (detecta cualquier valor no entero colado). */
export function sumarMinimos(valores: readonly number[]): number {
  let total = 0;
  for (const v of valores) {
    if (!Number.isSafeInteger(v)) throw new Error(`Valor no entero en suma monetaria: ${v}`);
    total += v;
  }
  return total;
}

/** Centavos de USD → unidades mínimas de `moneda` con la tasa escalada (×10 000). */
export function usdAMoneda(centavosUsd: number, moneda: CodigoMoneda, tasaEscalada: number): number {
  if (moneda === 'USD') return centavosUsd;
  // centavos/100 × tasa/10^4 × 10^d  =  centavos × tasa × 10^d / 10^6
  const num = BigInt(centavosUsd) * BigInt(tasaEscalada) * pot10(DECIMALES_MONEDA[moneda]);
  return Number(dividirRedondeando(num, 100n * BigInt(ESCALA_TASA)));
}

/** Unidades mínimas de `moneda` → centavos de USD con la tasa escalada (×10 000). */
export function monedaAUsd(minimo: number, moneda: CodigoMoneda, tasaEscalada: number): number {
  if (moneda === 'USD') return minimo;
  // minimo/10^d ÷ (tasa/10^4) × 100  =  minimo × 10^6 / (10^d × tasa)
  const num = BigInt(minimo) * 100n * BigInt(ESCALA_TASA);
  return Number(dividirRedondeando(num, pot10(DECIMALES_MONEDA[moneda]) * BigInt(tasaEscalada)));
}

export interface LineaParaTotales {
  cantidad: number;
  /** Precio unitario en centavos de USD. */
  precioCentavos: number;
  /** Descuento de la línea en puntos básicos (0 = sin descuento). */
  descuentoPb: number;
  /** IVA de la línea en puntos básicos (0 si el producto es exento). */
  ivaPb: number;
}

export interface LineaCalculada extends LineaParaTotales {
  brutoCentavos: number;
  descuentoCentavos: number;
  /** Neto antes de IVA: bruto − descuento. */
  netoCentavos: number;
  ivaCentavos: number;
}

export interface TotalesVenta {
  lineas: LineaCalculada[];
  subtotalCentavos: number;
  descuentoCentavos: number;
  impuestoCentavos: number;
  totalCentavos: number;
}

/**
 * Totales de una venta. El IVA se redondea POR LÍNEA y luego se suma, de modo que
 * Σ líneas = subtotal e impuesto exactamente (lo que se guarda en BD cuadra siempre).
 */
export function calcularTotalesVenta(lineas: readonly LineaParaTotales[]): TotalesVenta {
  const calculadas = lineas.map((l): LineaCalculada => {
    if (!Number.isSafeInteger(l.cantidad) || l.cantidad <= 0) throw new Error(`Cantidad inválida: ${l.cantidad}`);
    const bruto = Number(BigInt(l.cantidad) * BigInt(l.precioCentavos));
    const descuento = aplicarPorcentaje(bruto, l.descuentoPb);
    const neto = bruto - descuento;
    return { ...l, brutoCentavos: bruto, descuentoCentavos: descuento, netoCentavos: neto, ivaCentavos: aplicarPorcentaje(neto, l.ivaPb) };
  });
  const subtotal = sumarMinimos(calculadas.map((l) => l.netoCentavos));
  const impuesto = sumarMinimos(calculadas.map((l) => l.ivaCentavos));
  return {
    lineas: calculadas,
    subtotalCentavos: subtotal,
    descuentoCentavos: sumarMinimos(calculadas.map((l) => l.descuentoCentavos)),
    impuestoCentavos: impuesto,
    totalCentavos: subtotal + impuesto,
  };
}
