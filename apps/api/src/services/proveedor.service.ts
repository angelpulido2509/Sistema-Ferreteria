import { ProveedorRepository, proveedorRepository as defaultRepo } from '../repositories/proveedor.repository.js';
import type { ProveedorDTO } from '@ferreteria/shared';

export interface CreateProveedorInput {
  nombre: string;
  rif: string;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
}

export interface UpdateProveedorInput {
  nombre?: string;
  rif?: string;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  activo?: boolean;
}

export class ProveedorService {
  constructor(private repo: ProveedorRepository = defaultRepo) {}

  private mapToDTO(p: any): ProveedorDTO {
    return {
      id: p.id,
      nombre: p.nombre,
      rif: p.rif,
      telefono: p.telefono || '',
      correo: p.correo || '',
      direccion: p.direccion || '',
      activo: p.activo,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  public async getAll(soloActivos = true): Promise<ProveedorDTO[]> {
    const proveedores = await this.repo.findAll(soloActivos);
    return proveedores.map(p => this.mapToDTO(p));
  }

  public async getById(id: string): Promise<ProveedorDTO> {
    const proveedor = await this.repo.findById(id);
    if (!proveedor) {
      throw new Error(`Proveedor con ID ${id} no encontrado`);
    }
    return this.mapToDTO(proveedor);
  }

  public async create(data: CreateProveedorInput): Promise<ProveedorDTO> {
    if (!data.nombre || !data.rif) {
      throw new Error('El nombre y el RIF del proveedor son obligatorios');
    }

    const cleanRif = data.rif.trim().toUpperCase();
    const existing = await this.repo.findByRif(cleanRif);
    if (existing) {
      throw new Error(`Ya existe un proveedor registrado con el RIF "${cleanRif}"`);
    }

    const created = await this.repo.create(data);
    return this.mapToDTO(created);
  }

  public async update(id: string, data: UpdateProveedorInput): Promise<ProveedorDTO> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Proveedor con ID ${id} no encontrado`);
    }

    if (data.rif !== undefined) {
      const cleanRif = data.rif.trim().toUpperCase();
      const duplicate = await this.repo.findByRif(cleanRif);
      if (duplicate && duplicate.id !== id) {
        throw new Error(`Ya existe otro proveedor con el RIF "${cleanRif}"`);
      }
    }

    const updated = await this.repo.update(id, data);
    return this.mapToDTO(updated);
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Proveedor con ID ${id} no encontrado`);
    }
    await this.repo.softDelete(id);
  }
}

export const proveedorService = new ProveedorService();
