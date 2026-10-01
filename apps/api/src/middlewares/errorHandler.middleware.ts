import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import type { ApiResponse } from '@ferreteria/shared';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/** Asigna un identificador a cada petición (cabecera X-Request-Id) para correlacionar logs. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

/**
 * Varios controllers capturan sus errores y responden 500 con `error.message`
 * (p. ej. mensajes de Prisma con rutas y SQL). Este middleware intercepta cualquier
 * respuesta 5xx con formato ApiResponse y sustituye el mensaje por uno genérico,
 * dejando el original en el log con el requestId.
 */
export function sanitizeServerErrors(req: Request, res: Response, next: NextFunction): void {
  const jsonOriginal = res.json.bind(res);
  res.json = (body?: unknown) => {
    if (res.statusCode >= 500 && body && typeof body === 'object' && 'error' in body) {
      const original = (body as { error: unknown }).error;
      console.error(`[Error ${req.requestId}] ${req.method} ${req.originalUrl}: ${res.statusCode}`, original);
      return jsonOriginal({ ...body, error: `Error interno del servidor (ref: ${req.requestId})` });
    }
    return jsonOriginal(body);
  };
  next();
}

/** Errores 4xx conocidos del parser de Express, con mensaje propio y seguro. */
const MENSAJES_CLIENTE: Record<string, string> = {
  'entity.too.large': 'La solicitud excede el tamaño máximo permitido',
  'entity.parse.failed': 'El cuerpo de la solicitud no es JSON válido',
};

/**
 * Manejador centralizado: nunca devuelve el mensaje interno del error.
 * El detalle se registra en el log junto al requestId que recibe el cliente.
 */
export function errorHandler(
  err: Error & { status?: number; type?: string },
  req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void {
  const id = req.requestId ?? randomUUID();
  const status = typeof err.status === 'number' && err.status >= 400 && err.status < 500 ? err.status : 500;

  if (status === 500) {
    console.error(`[Error ${id}] ${req.method} ${req.originalUrl}:`, err);
  } else {
    console.warn(`[Error ${id}] ${req.method} ${req.originalUrl}: ${status} ${err.type ?? err.name}`);
  }

  const mensaje =
    status === 500
      ? 'Error interno del servidor'
      : MENSAJES_CLIENTE[err.type ?? ''] ?? 'Solicitud inválida';

  res.status(status).json({
    success: false,
    data: null,
    error: `${mensaje} (ref: ${id})`,
  });
}
