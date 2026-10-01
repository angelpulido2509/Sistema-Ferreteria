import type { Request, Response, CookieOptions } from 'express';
import { getEnv } from '../config/env.js';

/**
 * El refresh token viaja solo en una cookie httpOnly + SameSite=Strict limitada a /api/auth:
 * el JavaScript del navegador no puede leerla (mitiga XSS) y no se envía desde otros sitios (CSRF).
 */
export const REFRESH_COOKIE = 'ferrepro_rt';
const COOKIE_PATH = '/api/auth';

function opciones(): CookieOptions {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
    path: COOKIE_PATH,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, { ...opciones(), maxAge: getEnv().JWT_REFRESH_EXPIRES_IN * 1000 });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, opciones());
}

/** Lee la cookie del refresh token sin depender de cookie-parser. */
export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const parte of header.split(';')) {
    const [nombre, ...valor] = parte.trim().split('=');
    if (nombre === REFRESH_COOKIE) {
      return decodeURIComponent(valor.join('='));
    }
  }
  return undefined;
}
