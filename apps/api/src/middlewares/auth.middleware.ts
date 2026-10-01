import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RolUsuario, type ApiResponse } from '@ferreteria/shared';
import { getEnv } from '../config/env.js';
import { obtenerUsuarioVigente } from '../lib/authUserCache.js';

export interface AuthUser {
  id: string;
  email: string;
  rol: RolUsuario;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Verifica la firma del JWT y, además, que el usuario siga existiendo y activo en la BD.
 * El rol se toma de la BD (no del token), de modo que desactivar a un usuario o cambiar
 * su rol tiene efecto en la siguiente petición (caché de 30 s invalidada al editar).
 */
export async function authenticateToken(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({
      success: false,
      data: null,
      error: 'Token de autenticación no proporcionado',
    });
    return;
  }

  let decoded: AuthUser;
  try {
    decoded = jwt.verify(token, getEnv().JWT_SECRET) as AuthUser;
  } catch (_error) {
    res.status(401).json({
      success: false,
      data: null,
      error: 'Token de autenticación inválido o expirado',
    });
    return;
  }

  try {
    const usuario = await obtenerUsuarioVigente(decoded.id);
    if (!usuario || !usuario.activo) {
      res.status(401).json({
        success: false,
        data: null,
        error: 'Sesión no válida: usuario inactivo o inexistente',
      });
      return;
    }
    req.user = { id: usuario.id, email: usuario.email, rol: usuario.rol };
    next();
  } catch (error) {
    next(error);
  }
}

export function authorizeRoles(...roles: RolUsuario[]) {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        data: null,
        error: 'Usuario no autenticado',
      });
      return;
    }

    if (!roles.includes(req.user.rol)) {
      res.status(403).json({
        success: false,
        data: null,
        error: `Acceso denegado: Se requiere uno de los siguientes roles: [${roles.join(', ')}]`,
      });
      return;
    }

    next();
  };
}
