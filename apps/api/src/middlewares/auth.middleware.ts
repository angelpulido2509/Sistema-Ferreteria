import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RolUsuario, type ApiResponse } from '@ferreteria/shared';
import { getEnv } from '../config/env.js';

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

export function authenticateToken(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void {
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

  try {
    const decoded = jwt.verify(token, getEnv().JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (_error) {
    res.status(401).json({
      success: false,
      data: null,
      error: 'Token de autenticación inválido o expirado',
    });
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
