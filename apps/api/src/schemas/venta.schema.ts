import { z } from 'zod';
import { MetodoPago, Moneda } from '@ferreteria/shared';

/**
 * Validación de forma y tipos de la venta. Las reglas de negocio (precio/IVA/tasa
 * decididos por el servidor, pagos obligatorios) se endurecen en la Fase 1.
 */
const itemVentaSchema = z.object({
  productoId: z.string().min(1).max(64),
  cantidad: z.number().positive().max(1_000_000),
  precioUnitario: z.number().nonnegative().nullish(),
});

const pagoVentaSchema = z.object({
  metodoPago: z.enum(MetodoPago),
  moneda: z.enum(Moneda),
  montoMoneda: z.number().positive(),
  tasaAplicada: z.number().nonnegative(),
  referencia: z.string().trim().max(100).nullish(),
});

export const crearVentaSchema = z.object({
  clienteId: z.string().min(1).max(64),
  items: z.array(itemVentaSchema).min(1).max(500),
  porcentajeImpuesto: z.number().min(0).max(1).optional(),
  monedaFuncional: z.enum(Moneda).optional(),
  pagos: z.array(pagoVentaSchema).max(20).optional(),
});

export const anularVentaSchema = z.object({
  motivo: z.string().trim().min(1).max(500),
});
