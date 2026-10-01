import {
  aMinimo,
  calcularTotalesVenta,
  desdeMinimo,
  porcentajeAPuntosBasicos,
  type ProductoDTO,
} from '@ferreteria/shared';

export interface ItemCarritoTotales {
  producto: Pick<ProductoDTO, 'precioVenta' | 'exentoIva'>;
  cantidad: number;
}

export interface TotalesCarrito {
  subtotal: number;
  impuesto: number;
  total: number;
}

/**
 * Totales del carrito con el MISMO algoritmo que usa el servidor (F1/F10):
 * IVA de Configuración por línea, 0 para productos exentos, aritmética en centavos.
 * Es solo para mostrar: el servidor recalcula e ignora cualquier total del cliente.
 */
export function calcularTotalesCarrito(items: readonly ItemCarritoTotales[], ivaPorcentaje: number): TotalesCarrito {
  const ivaPb = porcentajeAPuntosBasicos(ivaPorcentaje);
  const validos = items.filter((i) => Number.isSafeInteger(i.cantidad) && i.cantidad > 0);
  const t = calcularTotalesVenta(
    validos.map((i) => ({
      cantidad: i.cantidad,
      precioCentavos: aMinimo(i.producto.precioVenta, 'USD'),
      descuentoPb: 0,
      ivaPb: i.producto.exentoIva ? 0 : ivaPb,
    }))
  );
  return {
    subtotal: desdeMinimo(t.subtotalCentavos, 'USD'),
    impuesto: desdeMinimo(t.impuestoCentavos, 'USD'),
    total: desdeMinimo(t.totalCentavos, 'USD'),
  };
}
