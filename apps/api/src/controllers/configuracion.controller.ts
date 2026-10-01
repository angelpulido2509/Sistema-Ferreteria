import type { Request, Response } from 'express';
import { configuracionService } from '../services/configuracion.service.js';
import type { ApiResponse, ConfiguracionDTO } from '@ferreteria/shared';

export class ConfiguracionController {
  public static async get(
    _req: Request,
    res: Response<ApiResponse<ConfiguracionDTO>>
  ): Promise<void> {
    try {
      const config = await configuracionService.get();
      res.status(200).json({
        success: true,
        data: config,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener la configuración',
      });
    }
  }

  public static async update(
    req: Request,
    res: Response<ApiResponse<ConfiguracionDTO>>
  ): Promise<void> {
    try {
      const updated = await configuracionService.update(req.body);
      res.status(200).json({
        success: true,
        data: updated,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al actualizar la configuración',
      });
    }
  }
}
