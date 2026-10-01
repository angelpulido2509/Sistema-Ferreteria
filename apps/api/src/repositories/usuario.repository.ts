import { prisma } from '../lib/prisma.js';
import { RolUsuario, OperacionSync } from '@ferreteria/shared';
import { registrarSync } from '../lib/syncQueue.js';

export class UsuarioRepository {
  public async findAll() {
    return prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  public async findById(id: string) {
    return prisma.usuario.findUnique({
      where: { id },
    });
  }

  public async findByEmail(email: string) {
    return prisma.usuario.findUnique({
      where: { email },
    });
  }

  public async create(data: {
    nombre: string;
    email: string;
    passwordHash: string;
    rol?: RolUsuario;
  }) {
    const usuario = await prisma.usuario.create({
      data: {
        nombre: data.nombre,
        email: data.email,
        passwordHash: data.passwordHash,
        rol: data.rol,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await registrarSync('Usuario', usuario.id, OperacionSync.CREAR, usuario as unknown as Record<string, unknown>);
    return usuario;
  }

  public async update(
    id: string,
    data: {
      nombre?: string;
      email?: string;
      rol?: RolUsuario;
      activo?: boolean;
      passwordHash?: string;
    }
  ) {
    const usuario = await prisma.usuario.update({
      where: { id },
      data,
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await registrarSync('Usuario', usuario.id, OperacionSync.ACTUALIZAR, usuario as unknown as Record<string, unknown>);
    return usuario;
  }

  public async delete(id: string): Promise<void> {
    const usuario = await prisma.usuario.update({
      where: { id },
      data: { activo: false },
    });

    await registrarSync('Usuario', usuario.id, OperacionSync.ACTUALIZAR, usuario as unknown as Record<string, unknown>);
  }
}

export const usuarioRepository = new UsuarioRepository();
