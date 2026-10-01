import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { ApiResponse } from '@ferreteria/shared';
import routes from './routes/index.js';
import { errorHandler, requestId, sanitizeServerErrors } from './middlewares/errorHandler.middleware.js';

export interface AppOptions {
  /** Orígenes permitidos por CORS (lista blanca exacta). */
  corsOrigins: string[];
}

const DEFAULT_CORS_ORIGINS = ['http://localhost:5173'];

/**
 * Límite explícito del body JSON. Las imágenes de producto viajan como data URL
 * base64 dentro del JSON (≈ +33 % sobre el archivo): 8 MB admite fotos de hasta ~5,5 MB.
 * Por encima se responde 413. Ver docs/DEUDA-TECNICA.md (pasar imágenes a disco).
 */
export const JSON_BODY_LIMIT = '8mb';

/** Convierte `CORS_ORIGIN` (separado por comas) en lista blanca. */
export function parseCorsOrigins(raw: string | undefined): string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter((o) => o.length > 0);
  return origins.length > 0 ? origins : DEFAULT_CORS_ORIGINS;
}

export function createApp(
  options: AppOptions = { corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN) }
): Application {
  const app = express();
  const allowedOrigins = new Set(options.corsOrigins);

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(sanitizeServerErrors);
  app.use(helmet());

  // Rechazar explícitamente cualquier origen de navegador fuera de la lista blanca.
  // Las peticiones sin cabecera Origin (curl, servidor a servidor, mismo origen) no se ven afectadas.
  app.use((req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      res.status(403).json({ success: false, data: null, error: 'Origen no permitido' });
      return;
    }
    next();
  });

  app.use(cors({
    origin: [...allowedOrigins],
    credentials: true,
  }));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

  // Rutas de la API
  app.use('/api', routes);

  // Manejador centralizado de errores
  app.use(errorHandler);

  return app;
}
