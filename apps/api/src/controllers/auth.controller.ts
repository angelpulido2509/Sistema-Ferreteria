import type { Request, Response } from 'express';
import {
  authService,
  SetupNoDisponibleError,
  type LoginResult,
  type SetupInicialInput,
} from '../services/auth.service.js';
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

  /** GET /api/auth/setup-status — indica si falta crear el primer ADMIN. */
  public static async setupStatus(
    _req: Request,
    res: Response<ApiResponse<{ needsSetup: boolean }>>
  ): Promise<void> {
    try {
      const status = await authService.getSetupStatus();
      res.status(200).json({ success: true, data: status, error: null });
    } catch (_error) {
      res.status(500).json({ success: false, data: null, error: 'No se pudo consultar el estado de configuración' });
    }
  }

  /** POST /api/auth/setup — crea el primer ADMIN (solo mientras no exista ninguno). */
  public static async setup(
    req: Request,
    res: Response<ApiResponse<UsuarioDTO>>
  ): Promise<void> {
    try {
      const { nombre, email, password } = req.body as Partial<SetupInicialInput>;
      const usuario = await authService.setupInicial({
        nombre: nombre ?? '',
        email: email ?? '',
        password: password ?? '',
      });
      res.status(201).json({ success: true, data: usuario, error: null });
    } catch (error) {
      if (error instanceof SetupNoDisponibleError) {
        res.status(403).json({ success: false, data: null, error: error.message });
        return;
      }
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error en la configuración inicial',
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
