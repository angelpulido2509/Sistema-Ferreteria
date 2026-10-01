import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@ferreteria/shared';

// Mensajes de validación de zod en español.
z.config(z.locales.es());

/** Formatea el primer problema de validación como mensaje legible para el usuario. */
function formatearProblema(issue: z.core.$ZodIssue): string {
  const campo = issue.path.join('.');
  return campo ? `${campo}: ${issue.message}` : issue.message;
}

/**
 * Valida `req.body` contra un esquema zod. Si no cumple responde 400;
 * si cumple, reemplaza `req.body` por los datos parseados (sin campos extra).
 */
export function validateBody(schema: z.ZodType) {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: formatearProblema(result.error.issues[0]!),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
