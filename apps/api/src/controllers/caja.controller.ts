import type { Request, Response } from 'express';
import { cajaService } from '../services/caja.service.js';
import type {
  ApiResponse,
  TurnoCajaDTO,
  MovimientoCajaDTO,
  ResumenArqueoDTO,
} from '@ferreteria/shared';

export class CajaController {
  public static async getTurnoActivo(
    req: Request,
    res: Response<ApiResponse<TurnoCajaDTO | null>>
  ): Promise<void> {
    try {
      const usuarioId = (req as any).user?.id;
      const turno = await cajaService.getTurnoActivo(usuarioId);
      res.status(200).json({
        success: true,
        data: turno,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al consultar turno de caja',
      });
    }
  }

  public static async abrirTurno(
    req: Request,
    res: Response<ApiResponse<TurnoCajaDTO>>
  ): Promise<void> {
    try {
      const usuarioId = (req as any).user?.id || '1';
      const turno = await cajaService.abrirTurno(usuarioId, req.body);
      res.status(201).json({
        success: true,
        data: turno,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al abrir turno de caja',
      });
    }
  }

  public static async registrarMovimiento(
    req: Request,
    res: Response<ApiResponse<MovimientoCajaDTO>>
  ): Promise<void> {
    try {
      const usuarioId = (req as any).user?.id || '1';
      const mov = await cajaService.registrarMovimiento(usuarioId, req.body);
      res.status(201).json({
        success: true,
        data: mov,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al registrar movimiento de caja',
      });
    }
  }

  public static async calcularResumen(
    req: Request,
    res: Response<ApiResponse<ResumenArqueoDTO>>
  ): Promise<void> {
    try {
      const turnoId = req.params.id as string;
      if (!turnoId) {
        res.status(400).json({
          success: false,
          data: null,
          error: 'ID de turno de caja inválido',
        });
        return;
      }

      const resumen = await cajaService.calcularResumenTurno(turnoId);
      res.status(200).json({
        success: true,
        data: resumen,
        error: null,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al calcular resumen de arqueo',
      });
    }
  }

  public static async cerrarTurno(
    req: Request,
    res: Response<ApiResponse<ResumenArqueoDTO>>
  ): Promise<void> {
    try {
      const usuarioId = (req as any).user?.id || '1';
      const resumen = await cajaService.cerrarTurno(usuarioId, req.body);
      res.status(200).json({
        success: true,
        data: resumen,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al cerrar turno de caja',
      });
    }
  }

  public static async getHistorial(
    req: Request,
    res: Response<ApiResponse<TurnoCajaDTO[]>>
  ): Promise<void> {
    try {
      const limite = req.query.limite ? parseInt(req.query.limite as string, 10) : 30;
      const turnos = await cajaService.getHistorialTurnos(limite);
      res.status(200).json({
        success: true,
        data: turnos,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al consultar historial de turnos',
      });
    }
  }

  public static async getById(
    req: Request,
    res: Response<ApiResponse<TurnoCajaDTO>>
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const turno = await cajaService.getTurnoById(id);
      res.status(200).json({
        success: true,
        data: turno,
        error: null,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Turno no encontrado',
      });
    }
  }
}
