import bcrypt from 'bcrypt';
import { usuarioRepository, UsuarioRepository } from '../repositories/usuario.repository.js';
import { RolUsuario, type UsuarioDTO } from '@ferreteria/shared';
import { validarPassword } from './passwordPolicy.js';
import { invalidarUsuarioEnCache } from '../lib/authUserCache.js';

export const BCRYPT_ROUNDS = 10;

type SafeUser = UsuarioDTO;

export class UsuarioService {
  constructor(private readonly repo: UsuarioRepository = usuarioRepository) {}

  public async getAll(): Promise<SafeUser[]> {
    return this.repo.findAll() as unknown as SafeUser[];
  }

  public async create(data: {
    nombre: string;
    email: string;
    password: string;
    rol?: RolUsuario;
  }): Promise<SafeUser> {
    // Validar email único
    const exists = await this.repo.findByEmail(data.email);
    if (exists) {
      throw new Error(`Ya existe un usuario con el correo "${data.email}"`);
    }

    validarPassword(data.password, data.rol ?? RolUsuario.CAJERO, data.email);
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    return this.repo.create({
      nombre: data.nombre.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash,
      rol: data.rol,
    }) as unknown as SafeUser;
  }

  public async update(
    id: string,
    data: {
      nombre?: string;
      email?: string;
      rol?: RolUsuario;
      activo?: boolean;
      password?: string;
    }
  ): Promise<SafeUser> {
    // Verificar que el usuario existe
    const usuario = await this.repo.findById(id);
    if (!usuario) {
      throw new Error(`Usuario #${id} no encontrado`);
    }

    // Si se cambia el email, verificar que no esté en uso por otro usuario
    if (data.email && data.email !== usuario.email) {
      const emailEnUso = await this.repo.findByEmail(data.email);
      if (emailEnUso) {
        throw new Error(`El correo "${data.email}" ya está en uso por otro usuario`);
      }
    }

    // Si se cambia la contraseña, hashearla
    let passwordHash: string | undefined;
    if (data.password) {
      validarPassword(data.password, data.rol ?? (usuario.rol as RolUsuario), data.email ?? usuario.email);
      passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    }

    const actualizado = await this.repo.update(id, {
      ...(data.nombre ? { nombre: data.nombre.trim() } : {}),
      ...(data.email ? { email: data.email.toLowerCase().trim() } : {}),
      ...(data.rol !== undefined ? { rol: data.rol } : {}),
      ...(data.activo !== undefined ? { activo: data.activo } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    });
    // Rol o estado pueden haber cambiado: la sesión activa debe reflejarlo ya.
    invalidarUsuarioEnCache(id);
    return actualizado as unknown as SafeUser;
  }

  public async deactivate(id: string): Promise<void> {
    const usuario = await this.repo.findById(id);
    if (!usuario) {
      throw new Error(`Usuario #${id} no encontrado`);
    }
    await this.repo.delete(id);
    invalidarUsuarioEnCache(id);
  }
}

export const usuarioService = new UsuarioService();
