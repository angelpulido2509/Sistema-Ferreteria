import type { Request, Response } from 'express';
import type { ApiResponse, BackupDTO } from '@ferreteria/shared';
import { backupService } from '../services/backup.service.js';

export class BackupController {
  /** GET /api/backup — lista los respaldos disponibles (solo ADMIN). */
  public static async listar(_req: Request, res: Response<ApiResponse<BackupDTO[]>>): Promise<void> {
    try {
      const backups = await backupService.listar();
      res.status(200).json({ success: true, data: backups, error: null });
    } catch (error) {
      res.status(500).json({ success: false, data: null, error: error instanceof Error ? error.message : 'Error al listar respaldos' });
    }
  }

  /** POST /api/backup/now — crea y verifica un respaldo inmediato (solo ADMIN). */
  public static async crearAhora(_req: Request, res: Response<ApiResponse<BackupDTO>>): Promise<void> {
    try {
      const backup = await backupService.crearBackup('manual');
      res.status(201).json({ success: true, data: backup, error: null });
    } catch (error) {
      res.status(500).json({ success: false, data: null, error: error instanceof Error ? error.message : 'Error al crear respaldo' });
    }
  }
}
