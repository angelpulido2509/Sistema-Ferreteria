import { z } from 'zod';
import { RolUsuario } from '@ferreteria/shared';

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  password: z.string().max(200),
  rol: z.enum(RolUsuario).optional(),
});

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  email: z.email().max(254).optional(),
  password: z.string().max(200).optional(),
  rol: z.enum(RolUsuario).optional(),
  activo: z.boolean().optional(),
});
