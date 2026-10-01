import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UsuarioRepository, usuarioRepository as defaultUsuarioRepo } from '../repositories/usuario.repository.js';
import { RolUsuario, type UsuarioDTO } from '@ferreteria/shared';

export interface LoginResult {
  token: string;
  refreshToken: string;
  usuario: UsuarioDTO;
}

export class AuthService {
  constructor(private usuarioRepo: UsuarioRepository = defaultUsuarioRepo) {}

  public async login(email: string, password: string): Promise<LoginResult> {
    if (!email || !password) {
      throw new Error('Email y contraseña son obligatorios');
    }

    const usuario = await this.usuarioRepo.findByEmail(email.toLowerCase().trim());
    if (!usuario) {
      throw new Error('Credenciales inválidas');
    }

    if (!usuario.activo) {
      throw new Error('Usuario inactivo. Contacte al administrador.');
    }

    const isValidPassword = await bcrypt.compare(password, usuario.passwordHash);
    if (!isValidPassword) {
      throw new Error('Credenciales inválidas');
    }

    const secret = process.env.JWT_SECRET || 'clave_secreta_super_segura_para_desarrollo_local_123456';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'clave_refresh_secreta_super_segura_para_desarrollo_local_654321';
    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    const payload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol as RolUsuario,
    };

    const token = jwt.sign(payload, secret, { expiresIn: expiresIn as any });
    const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: refreshExpiresIn as any });

    const usuarioDTO: UsuarioDTO = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol as RolUsuario,
      activo: usuario.activo,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    };

    return { token, refreshToken, usuario: usuarioDTO };
  }

  public async refreshToken(refreshToken: string): Promise<{ token: string }> {
    if (!refreshToken) {
      throw new Error('Refresh token requerido');
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'clave_refresh_secreta_super_segura_para_desarrollo_local_654321';
    const secret = process.env.JWT_SECRET || 'clave_secreta_super_segura_para_desarrollo_local_123456';
    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

    try {
      const decoded = jwt.verify(refreshToken, refreshSecret) as { id: string; email: string; rol: RolUsuario };
      const usuario = await this.usuarioRepo.findById(decoded.id);

      if (!usuario || !usuario.activo) {
        throw new Error('Usuario no válido o inactivo');
      }

      const newToken = jwt.sign(
        { id: usuario.id, email: usuario.email, rol: usuario.rol as RolUsuario },
        secret,
        { expiresIn: expiresIn as any }
      );

      return { token: newToken };
    } catch (_error) {
      throw new Error('Refresh token inválido o expirado');
    }
  }

  public async getProfile(userId: string): Promise<UsuarioDTO> {
    const usuario = await this.usuarioRepo.findById(userId);
    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol as RolUsuario,
      activo: usuario.activo,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    };
  }
}

export const authService = new AuthService();
