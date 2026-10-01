import { Router, type Request, type Response } from 'express';
import { syncService } from '../services/sync.service.js';
import type { ApiResponse, SyncStatusDTO } from '@ferreteria/shared';

const router: Router = Router();

/**
 * POST /api/sync/push
 * Recibe registros de sincronización desde el cliente desktop hacia la nube.
 * Protegido con x-sync-api-key para no depender de la sesión de ningún cajero.
 */
router.post('/push', async (req: Request, res: Response<ApiResponse<any>>) => {
  const apiKey = req.headers['x-sync-api-key'];
  const expectedKey = process.env.SYNC_API_KEY || 'ferrepro_local_sync_key_2024';

  if (!apiKey || apiKey !== expectedKey) {
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
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Error al aplicar sincronización',
    });
  }
});

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
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Error al obtener estado de sincronización',
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
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Error al forzar sincronización',
    });
  }
});

export default router;
