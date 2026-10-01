import { z } from 'zod';
import { MetodoPago, Moneda } from '@ferreteria/shared';

/**
 * Validación de forma y tipos de la venta. Los montos los decide el servidor (F1):
 * precioUnitario, porcentajeImpuesto y tasaAplicada se aceptan por compatibilidad pero se ignoran.
 */
const itemVentaSchema = z.object({
  productoId: z.string().min(1).max(64),
  cantidad: z.number().positive().max(1_000_000),
  descuentoPorcentaje: z.number().min(0).max(100).optional(),
  precioUnitario: z.number().nonnegative().nullish(),
});

const pagoVentaSchema = z
  .object({
    metodoPago: z.enum(MetodoPago),
    moneda: z.enum(Moneda),
    /** Lo que entregó el cliente. */
    montoRecibido: z.number().positive().optional(),
    /** Alias anterior de montoRecibido (cola offline del POS). */
    montoMoneda: z.number().positive().optional(),
    tasaAplicada: z.number().nonnegative().optional(),
    referencia: z.string().trim().max(100).nullish(),
  })
  .refine((p) => p.montoRecibido !== undefined || p.montoMoneda !== undefined, {
    error: 'Indique el monto recibido',
    path: ['montoRecibido'],
  });

export const crearVentaSchema = z.object({
  clienteId: z.string().min(1).max(64),
  items: z.array(itemVentaSchema).min(1).max(500),
  porcentajeImpuesto: z.number().min(0).max(1).optional(),
  monedaFuncional: z.enum(Moneda).optional(),
  pagos: z.array(pagoVentaSchema).max(20).optional(),
  /** Moneda del vuelto: una de las monedas recibidas en efectivo (F3). */
  vueltoMoneda: z.enum(Moneda).optional(),
});

export const anularVentaSchema = z.object({
  motivo: z.string().trim().min(1).max(500),
});
