import { prisma } from '../lib/prisma.js';
import { registrarSync } from '../lib/syncQueue.js';
import { OperacionSync } from '@ferreteria/shared';

export class ClienteRepository {
  public async findAll(search?: string) {
    const where: any = {};

    if (search) {
      where.OR = [
        { nombre: { contains: search } },
        { identificacion: { contains: search } },
      ];
    }

    return prisma.cliente.findMany({
      where,
      orderBy: { nombre: 'asc' },
    });
  }

  public async findById(id: string) {
    return prisma.cliente.findUnique({
      where: { id },
    });
  }

  public async findByIdentificacion(identificacion: string) {
    return prisma.cliente.findUnique({
      where: { identificacion },
    });
  }

  public async create(data: {
    nombre: string;
    identificacion: string;
    telefono?: string | null;
    correo?: string | null;
    direccion?: string | null;
  }) {
    const cliente = await prisma.cliente.create({
      data: {
        nombre: data.nombre.trim(),
        identificacion: data.identificacion.trim().toUpperCase(),
        telefono: data.telefono ? data.telefono.trim() : null,
        correo: data.correo ? data.correo.trim().toLowerCase() : null,
        direccion: data.direccion ? data.direccion.trim() : null,
      },
    });

    await registrarSync('Cliente', cliente.id, OperacionSync.CREAR, cliente as unknown as Record<string, unknown>);
    return cliente;
  }

  public async update(
    id: string,
    data: {
      nombre?: string;
      identificacion?: string;
      telefono?: string | null;
      correo?: string | null;
      direccion?: string | null;
    }
  ) {
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined ? { nombre: data.nombre.trim() } : {}),
        ...(data.identificacion !== undefined ? { identificacion: data.identificacion.trim().toUpperCase() } : {}),
        ...(data.telefono !== undefined ? { telefono: data.telefono ? data.telefono.trim() : null } : {}),
        ...(data.correo !== undefined ? { correo: data.correo ? data.correo.trim().toLowerCase() : null } : {}),
        ...(data.direccion !== undefined ? { direccion: data.direccion ? data.direccion.trim() : null } : {}),
      },
    });

    await registrarSync('Cliente', cliente.id, OperacionSync.ACTUALIZAR, cliente as unknown as Record<string, unknown>);
    return cliente;
  }

  public async delete(id: string) {
    const cliente = await prisma.cliente.delete({
      where: { id },
    });

    await registrarSync('Cliente', cliente.id, OperacionSync.ELIMINAR, { id });
    return cliente;
  }
}

export const clienteRepository = new ClienteRepository();
