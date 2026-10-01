import { z } from 'zod';
import { Moneda, TipoMovimientoCaja } from '@ferreteria/shared';

const montoNoNegativo = z.number().nonnegative().max(1_000_000_000);

export const abrirCajaSchema = z.object({
  cajaNumero: z.string().trim().min(1).max(20).optional(),
  montoInicialUsd: montoNoNegativo,
  montoInicialCop: montoNoNegativo,
  montoInicialVes: montoNoNegativo.optional(),
});

export const movimientoCajaSchema = z.object({
  turnoCajaId: z.string().min(1).max(64),
  tipo: z.enum(TipoMovimientoCaja),
  monto: z.number().positive().max(1_000_000_000),
  moneda: z.enum(Moneda),
  motivo: z.string().trim().min(1).max(500),
});

export const cerrarCajaSchema = z.object({
  turnoCajaId: z.string().min(1).max(64),
  conteoFisicoUsd: montoNoNegativo,
  conteoFisicoCop: montoNoNegativo,
  conteoFisicoVes: montoNoNegativo.optional(),
  observaciones: z.string().trim().max(1000).optional(),
});
