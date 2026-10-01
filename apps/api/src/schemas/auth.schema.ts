import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(2000).optional(),
});

export const setupSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  password: z.string().max(200),
});
