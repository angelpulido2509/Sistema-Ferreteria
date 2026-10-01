import { CategoriaRepository, categoriaRepository as defaultRepo } from '../repositories/categoria.repository.js';
import type { CategoriaDTO } from '@ferreteria/shared';

export class CategoriaService {
  constructor(private repo: CategoriaRepository = defaultRepo) {}

  public async getAll(): Promise<CategoriaDTO[]> {
    const categorias = await this.repo.findAll();
    return categorias.map(c => ({
      id: c.id,
      nombre: c.nombre,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  public async getById(id: string): Promise<CategoriaDTO> {
    const categoria = await this.repo.findById(id);
    if (!categoria) {
      throw new Error(`Categoría con ID ${id} no encontrada`);
    }
    return {
      id: categoria.id,
      nombre: categoria.nombre,
      createdAt: categoria.createdAt,
      updatedAt: categoria.updatedAt,
    };
  }

  public async create(nombre: string): Promise<CategoriaDTO> {
    const cleanNombre = nombre?.trim();
    if (!cleanNombre) {
      throw new Error('El nombre de la categoría es obligatorio');
    }

    const existing = await this.repo.findByNombre(cleanNombre);
    if (existing) {
      throw new Error(`Ya existe una categoría con el nombre "${cleanNombre}"`);
    }

    const created = await this.repo.create({ nombre: cleanNombre });
    return {
      id: created.id,
      nombre: created.nombre,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  public async update(id: string, nombre: string): Promise<CategoriaDTO> {
    const cleanNombre = nombre?.trim();
    if (!cleanNombre) {
      throw new Error('El nombre de la categoría es obligatorio');
    }

    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Categoría con ID ${id} no encontrada`);
    }

    const duplicate = await this.repo.findByNombre(cleanNombre);
    if (duplicate && duplicate.id !== id) {
      throw new Error(`Ya existe otra categoría con el nombre "${cleanNombre}"`);
    }

    const updated = await this.repo.update(id, { nombre: cleanNombre });
    return {
      id: updated.id,
      nombre: updated.nombre,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Categoría con ID ${id} no encontrada`);
    }
    await this.repo.delete(id);
  }
}

export const categoriaService = new CategoriaService();
