import { Router, type Request, type Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { syncService } from '../services/sync.service.js';
import { RolUsuario, type ApiResponse, type SyncStatusDTO } from '@ferreteria/shared';
import { getEnv } from '../config/env.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router: Router = Router();

/** Comparación en tiempo constante (se comparan digests para no filtrar la longitud). */
function apiKeyValida(recibida: unknown, esperada: string): boolean {
  if (typeof recibida !== 'string' || recibida.length === 0) {
    return false;
  }
  const a = createHash('sha256').update(recibida).digest();
  const b = createHash('sha256').update(esperada).digest();
  return timingSafeEqual(a, b);
}

/**
 * POST /api/sync/push
 * Recibe registros de sincronización desde el cliente desktop hacia la nube.
 * Protegido con x-sync-api-key para no depender de la sesión de ningún cajero.
 */
router.post('/push', async (req: Request, res: Response<ApiResponse<any>>) => {
  if (!apiKeyValida(req.headers['x-sync-api-key'], getEnv().SYNC_API_KEY)) {
    res.status(401).json({
      success: false,
      data: null,
      error: 'Acceso no autorizado: API key de sincronización inválida o ausente',
    });
    return;
  }

  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({
        success: false,
        data: null,
        error: 'El campo "items" debe ser un array de cambios',
      });
      return;
    }

    const resultado = await syncService.aplicarSyncPush(items);
    res.status(200).json({
      success: true,
      data: resultado,
      error: null,
    });
  } catch (error) {
    console.error('[SyncReceiver] Error aplicando lote:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Error al aplicar sincronización',
    });
  }
});

// Panel de sincronización: solo ADMIN autenticado.
router.use(['/status', '/retry'], authenticateToken, authorizeRoles(RolUsuario.ADMIN));

/**
 * GET /api/sync/status
 * Devuelve el estado de la cola local para el panel de Gestión
 */
router.get('/status', async (_req: Request, res: Response<ApiResponse<SyncStatusDTO>>) => {
  try {
    const status = await syncService.getStatus();
    res.status(200).json({
      success: true,
      data: status,
      error: null,
    });
  } catch (error) {
    console.error('[Sync] Error al obtener estado:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Error al obtener estado de sincronización',
    });
  }
});

/**
 * POST /api/sync/retry
 * Fuerza un ciclo de sincronización manual de la cola local
 */
router.post('/retry', async (_req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const resultado = await syncService.sincronizarPendientes();
    res.status(200).json({
      success: true,
      data: resultado,
      error: null,
    });
  } catch (error) {
    console.error('[Sync] Error al forzar sincronización:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Error al forzar sincronización',
    });
  }
});

export default router;
