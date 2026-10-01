import type { Request } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

const QUINCE_MINUTOS = 15 * 60 * 1000;

const respuestaLimite = {
  success: false,
  data: null,
  error: 'Demasiados intentos. Intente de nuevo más tarde.',
};

/**
 * Login: máximo 5 intentos FALLIDOS cada 15 minutos por IP + email.
 * Los logins exitosos no cuentan. La respuesta 429 es genérica.
 */
export const loginRateLimiter = rateLimit({
  windowMs: QUINCE_MINUTOS,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return `${ipKeyGenerator(req.ip ?? '')}|${email}`;
  },
  message: respuestaLimite,
});

/** Endpoints de autenticación sin credenciales previas (setup, refresh): por IP. */
export const authPublicRateLimiter = rateLimit({
  windowMs: QUINCE_MINUTOS,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: respuestaLimite,
});
