import { prisma } from '../lib/prisma.js';
import { registrarSync } from '../lib/syncQueue.js';
import { OperacionSync } from '@ferreteria/shared';

export class ProveedorRepository {
  public async findAll(soloActivos = true) {
    return prisma.proveedor.findMany({
      where: soloActivos ? { activo: true } : undefined,
      orderBy: { nombre: 'asc' },
    });
  }

  public async findById(id: string) {
    return prisma.proveedor.findUnique({
      where: { id },
    });
  }

  public async findByRif(rif: string) {
    return prisma.proveedor.findUnique({
      where: { rif },
    });
  }

  public async create(data: {
    nombre: string;
    rif: string;
    telefono?: string | null;
    correo?: string | null;
    direccion?: string | null;
  }) {
    const proveedor = await prisma.proveedor.create({
      data: {
        nombre: data.nombre.trim(),
        rif: data.rif.trim().toUpperCase(),
        telefono: data.telefono ? data.telefono.trim() : null,
        correo: data.correo ? data.correo.trim().toLowerCase() : null,
        direccion: data.direccion ? data.direccion.trim() : null,
      },
    });

    await registrarSync('Proveedor', proveedor.id, OperacionSync.CREAR, proveedor as unknown as Record<string, unknown>);
    return proveedor;
  }

  public async update(
    id: string,
    data: {
      nombre?: string;
      rif?: string;
      telefono?: string | null;
      correo?: string | null;
      direccion?: string | null;
      activo?: boolean;
    }
  ) {
    const proveedor = await prisma.proveedor.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined ? { nombre: data.nombre.trim() } : {}),
        ...(data.rif !== undefined ? { rif: data.rif.trim().toUpperCase() } : {}),
        ...(data.telefono !== undefined ? { telefono: data.telefono ? data.telefono.trim() : null } : {}),
        ...(data.correo !== undefined ? { correo: data.correo ? data.correo.trim().toLowerCase() : null } : {}),
        ...(data.direccion !== undefined ? { direccion: data.direccion ? data.direccion.trim() : null } : {}),
        ...(data.activo !== undefined ? { activo: data.activo } : {}),
      },
    });

    await registrarSync('Proveedor', proveedor.id, OperacionSync.ACTUALIZAR, proveedor as unknown as Record<string, unknown>);
    return proveedor;
  }

  public async softDelete(id: string) {
    const proveedor = await prisma.proveedor.update({
      where: { id },
      data: { activo: false },
    });

    await registrarSync('Proveedor', proveedor.id, OperacionSync.ACTUALIZAR, proveedor as unknown as Record<string, unknown>);
    return proveedor;
  }
}

export const proveedorRepository = new ProveedorRepository();
