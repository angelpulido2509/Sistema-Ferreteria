import { ClienteRepository, clienteRepository as defaultRepo } from '../repositories/cliente.repository.js';
import type { ClienteDTO } from '@ferreteria/shared';

export interface CreateClienteInput {
  nombre: string;
  identificacion: string;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
}

export interface UpdateClienteInput {
  nombre?: string;
  identificacion?: string;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
}

export class ClienteService {
  constructor(private repo: ClienteRepository = defaultRepo) {}

  private mapToDTO(c: any): ClienteDTO {
    return {
      id: c.id,
      nombre: c.nombre,
      identificacion: c.identificacion,
      telefono: c.telefono || '',
      correo: c.correo || '',
      direccion: c.direccion || '',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  public async getAll(search?: string): Promise<ClienteDTO[]> {
    const clientes = await this.repo.findAll(search);
    return clientes.map(c => this.mapToDTO(c));
  }

  public async getById(id: string): Promise<ClienteDTO> {
    const cliente = await this.repo.findById(id);
    if (!cliente) {
      throw new Error(`Cliente con ID ${id} no encontrado`);
    }
    return this.mapToDTO(cliente);
  }

  public async create(data: CreateClienteInput): Promise<ClienteDTO> {
    if (!data.nombre || !data.identificacion) {
      throw new Error('El nombre y el número de identificación (cédula/RIF) son obligatorios');
    }

    const cleanId = data.identificacion.trim().toUpperCase();
    const existing = await this.repo.findByIdentificacion(cleanId);
    if (existing) {
      throw new Error(`Ya existe un cliente registrado con la identificación "${cleanId}"`);
    }

    const created = await this.repo.create(data);
    return this.mapToDTO(created);
  }

  public async update(id: string, data: UpdateClienteInput): Promise<ClienteDTO> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Cliente con ID ${id} no encontrado`);
    }

    if (data.identificacion !== undefined) {
      const cleanId = data.identificacion.trim().toUpperCase();
      const duplicate = await this.repo.findByIdentificacion(cleanId);
      if (duplicate && duplicate.id !== id) {
        throw new Error(`Ya existe otro cliente con la identificación "${cleanId}"`);
      }
    }

    const updated = await this.repo.update(id, data);
    return this.mapToDTO(updated);
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Cliente con ID ${id} no encontrado`);
    }
    await this.repo.delete(id);
  }
}

export const clienteService = new ClienteService();
