import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@ferreteria/shared';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void {
  console.error('Unhandled Error:', err);

  res.status(500).json({
    success: false,
    data: null,
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
  });
}
