import type { Request, Response } from 'express';
import { usuarioService } from '../services/usuario.service.js';
import { PasswordPolicyError } from '../services/passwordPolicy.js';
import { RolUsuario } from '@ferreteria/shared';
import type { ApiResponse, UsuarioDTO } from '@ferreteria/shared';

export class UsuarioController {
  /** GET /api/usuarios — Lista todos los usuarios (solo ADMIN) */
  public static async getAll(
    _req: Request,
    res: Response<ApiResponse<UsuarioDTO[]>>
  ): Promise<void> {
    try {
      const usuarios = await usuarioService.getAll();
      res.status(200).json({ success: true, data: usuarios as UsuarioDTO[], error: null });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener usuarios',
      });
    }
  }

  /** POST /api/usuarios — Crear nuevo usuario (solo ADMIN) */
  public static async create(
    req: Request,
    res: Response<ApiResponse<UsuarioDTO>>
  ): Promise<void> {
    try {
      const { nombre, email, password, rol } = req.body as {
        nombre?: string;
        email?: string;
        password?: string;
        rol?: string;
      };

      if (!nombre || !email || !password) {
        res.status(400).json({
          success: false,
          data: null,
          error: 'Los campos nombre, email y password son obligatorios',
        });
        return;
      }

      // Validar rol
      const rolesValidos = Object.values(RolUsuario) as string[];
      const rolValidado = rol && rolesValidos.includes(rol) ? (rol as RolUsuario) : RolUsuario.CAJERO;

      const usuario = await usuarioService.create({
        nombre,
        email,
        password,
        rol: rolValidado,
      });

      res.status(201).json({ success: true, data: usuario as UsuarioDTO, error: null });
    } catch (error) {
      const statusCode =
        error instanceof PasswordPolicyError ? 400 : error instanceof Error && error.message.includes('existe') ? 409 : 500;
      res.status(statusCode).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al crear usuario',
      });
    }
  }

  /** PUT /api/usuarios/:id — Actualizar usuario (solo ADMIN) */
  public static async update(
    req: Request,
    res: Response<ApiResponse<UsuarioDTO>>
  ): Promise<void> {
    try {
      const id = req.params['id'] ?? '';
      if (!id) {
        res.status(400).json({ success: false, data: null, error: 'ID inválido' });
        return;
      }

      const { nombre, email, rol, activo, password } = req.body as {
        nombre?: string;
        email?: string;
        rol?: string;
        activo?: boolean;
        password?: string;
      };

      // Validar rol si se envía
      const rolesValidos = Object.values(RolUsuario) as string[];
      const rolValidado =
        rol !== undefined && rolesValidos.includes(rol) ? (rol as RolUsuario) : undefined;

      const usuario = await usuarioService.update(id, {
        nombre,
        email,
        rol: rolValidado,
        activo,
        password,
      });

      res.status(200).json({ success: true, data: usuario as UsuarioDTO, error: null });
    } catch (error) {
      const statusCode =
        error instanceof PasswordPolicyError
          ? 400
          : error instanceof Error && error.message.includes('no encontrado') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al actualizar usuario',
      });
    }
  }

  /** DELETE /api/usuarios/:id — Baja lógica (solo ADMIN) */
  public static async deactivate(
    req: Request,
    res: Response<ApiResponse<null>>
  ): Promise<void> {
    try {
      const id = req.params['id'] ?? '';
      if (!id) {
        res.status(400).json({ success: false, data: null, error: 'ID inválido' });
        return;
      }
      await usuarioService.deactivate(id);
      res.status(200).json({ success: true, data: null, error: null });
    } catch (error) {
      const statusCode =
        error instanceof Error && error.message.includes('no encontrado') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al desactivar usuario',
      });
    }
  }
}
