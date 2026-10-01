import { Prisma } from '@prisma/client-local';
import { aMinimo, minimoATexto, type CodigoMoneda } from '@ferreteria/shared';

/**
 * Punto único de cálculo monetario del servidor (F7). Reexporta la aritmética exacta
 * de @ferreteria/shared (unidades mínimas enteras) y agrega la conversión a/desde Decimal.
 * Ningún servicio debe usar Math.round(x * 100) / 100 para dinero.
 */
export * from '@ferreteria/shared';

/**
 * Diferencia máxima tolerada entre lo pagado y el total, en centavos de USD.
 * Cubre el redondeo al convertir pagos en VES/COP; antes era $0,05 fijo en el código.
 */
export const TOLERANCIA_PAGO_CENTAVOS_USD = 1;

/** Decimal/number/string de la BD → unidades mínimas. */
export function decimalAMinimo(valor: Prisma.Decimal | number | string | null | undefined, moneda: CodigoMoneda): number {
  if (valor === null || valor === undefined) return 0;
  return aMinimo(valor instanceof Prisma.Decimal ? valor.toFixed() : valor, moneda);
}

/** Unidades mínimas → Prisma.Decimal exacto para guardar. */
export function minimoADecimal(minimo: number, moneda: CodigoMoneda): Prisma.Decimal {
  return new Prisma.Decimal(minimoATexto(minimo, moneda));
}
