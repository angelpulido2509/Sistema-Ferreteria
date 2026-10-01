import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UsuarioRepository, usuarioRepository as defaultUsuarioRepo } from '../repositories/usuario.repository.js';
import { RolUsuario, type UsuarioDTO } from '@ferreteria/shared';
import { getEnv } from '../config/env.js';
import { validarPassword } from './passwordPolicy.js';
import { BCRYPT_ROUNDS } from './usuario.service.js';

export interface LoginResult {
  token: string;
  refreshToken: string;
  usuario: UsuarioDTO;
}

export interface SetupInicialInput {
  nombre: string;
  email: string;
  password: string;
}

/** El asistente de primer arranque ya no está disponible (existe un ADMIN). Se responde con 403. */
export class SetupNoDisponibleError extends Error {
  constructor() {
    super('La configuración inicial ya fue realizada');
    this.name = 'SetupNoDisponibleError';
  }
}

export class AuthService {
  /** Serializa las llamadas a setupInicial dentro del proceso para que no se creen dos ADMIN. */
  private setupLock: Promise<unknown> = Promise.resolve();

  constructor(private usuarioRepo: UsuarioRepository = defaultUsuarioRepo) {}

  public async getSetupStatus(): Promise<{ needsSetup: boolean }> {
    const admins = await this.usuarioRepo.countAdmins();
    return { needsSetup: admins === 0 };
  }

  /**
   * Crea el primer ADMIN con contraseña propia. Solo funciona mientras no exista
   * ningún usuario ADMIN; después lanza SetupNoDisponibleError para siempre.
   */
  public async setupInicial(input: SetupInicialInput): Promise<UsuarioDTO> {
    const run = async (): Promise<UsuarioDTO> => {
      if ((await this.usuarioRepo.countAdmins()) > 0) {
        throw new SetupNoDisponibleError();
      }

      const nombre = input.nombre?.trim();
      const email = input.email?.toLowerCase().trim();
      if (!nombre || !email) {
        throw new Error('Nombre y correo son obligatorios');
      }
      validarPassword(input.password, RolUsuario.ADMIN, email);

      if (await this.usuarioRepo.findByEmail(email)) {
        throw new Error(`Ya existe un usuario con el correo "${email}"`);
      }

      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      const creado = await this.usuarioRepo.create({ nombre, email, passwordHash, rol: RolUsuario.ADMIN });
      return { ...creado, rol: creado.rol as RolUsuario };
    };

    const resultado = this.setupLock.then(run, run);
    this.setupLock = resultado.catch(() => undefined);
    return resultado;
  }

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

    const {
      JWT_SECRET: secret,
      JWT_REFRESH_SECRET: refreshSecret,
      JWT_EXPIRES_IN: expiresIn,
      JWT_REFRESH_EXPIRES_IN: refreshExpiresIn,
    } = getEnv();

    const payload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol as RolUsuario,
    };

    const token = jwt.sign(payload, secret, { expiresIn });
    const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: refreshExpiresIn });

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

    const { JWT_SECRET: secret, JWT_REFRESH_SECRET: refreshSecret, JWT_EXPIRES_IN: expiresIn } = getEnv();

    try {
      const decoded = jwt.verify(refreshToken, refreshSecret) as { id: string; email: string; rol: RolUsuario };
      const usuario = await this.usuarioRepo.findById(decoded.id);

      if (!usuario || !usuario.activo) {
        throw new Error('Usuario no válido o inactivo');
      }

      const newToken = jwt.sign(
        { id: usuario.id, email: usuario.email, rol: usuario.rol as RolUsuario },
        secret,
        { expiresIn }
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
