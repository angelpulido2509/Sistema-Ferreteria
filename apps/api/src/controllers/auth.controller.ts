import type { Request, Response } from 'express';
import { authService, type LoginResult } from '../services/auth.service.js';
import type { ApiResponse, UsuarioDTO } from '@ferreteria/shared';

export class AuthController {
  public static async login(
    req: Request,
    res: Response<ApiResponse<LoginResult>>
  ): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      res.status(200).json({
        success: true,
        data: result,
        error: null,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error en la autenticación',
      });
    }
  }

  public static async refresh(
    req: Request,
    res: Response<ApiResponse<{ token: string }>>
  ): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        data: result,
        error: null,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al renovar token',
      });
    }
  }

  public static async getProfile(
    req: Request,
    res: Response<ApiResponse<UsuarioDTO>>
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          data: null,
          error: 'Usuario no autenticado',
        });
        return;
      }

      const usuario = await authService.getProfile(req.user.id);
      res.status(200).json({
        success: true,
        data: usuario,
        error: null,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Usuario no encontrado',
      });
    }
  }
}
