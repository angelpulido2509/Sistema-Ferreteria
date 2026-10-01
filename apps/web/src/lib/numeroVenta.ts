import type { VentaDTO } from '@ferreteria/shared';

/** Número visible de una venta: el correlativo del servidor (F9) o, si no lo tiene, un id corto. */
export function numeroVenta(v: Pick<VentaDTO, 'id' | 'numero'>): string {
  return v.numero ?? `#${String(v.id).slice(0, 8)}`;
}
