import { prisma } from '../lib/prisma.js';
import { registrarSync } from '../lib/syncQueue.js';
import { OperacionSync } from '@ferreteria/shared';

export class CategoriaRepository {
  public async findAll() {
    return prisma.categoria.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  public async findById(id: string) {
    return prisma.categoria.findUnique({
      where: { id },
    });
  }

  public async findByNombre(nombre: string) {
    return prisma.categoria.findUnique({
      where: { nombre },
    });
  }

  public async create(data: { nombre: string }) {
    const categoria = await prisma.categoria.create({
      data: {
        nombre: data.nombre.trim(),
      },
    });

    await registrarSync('Categoria', categoria.id, OperacionSync.CREAR, categoria as unknown as Record<string, unknown>);
    return categoria;
  }

  public async update(id: string, data: { nombre: string }) {
    const categoria = await prisma.categoria.update({
      where: { id },
      data: {
        nombre: data.nombre.trim(),
      },
    });

    await registrarSync('Categoria', categoria.id, OperacionSync.ACTUALIZAR, categoria as unknown as Record<string, unknown>);
    return categoria;
  }

  public async delete(id: string) {
    const categoria = await prisma.categoria.delete({
      where: { id },
    });

    await registrarSync('Categoria', categoria.id, OperacionSync.ELIMINAR, { id });
    return categoria;
  }
}

export const categoriaRepository = new CategoriaRepository();
