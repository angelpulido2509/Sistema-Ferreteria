import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClienteService } from './cliente.service.js';
import type { ClienteRepository } from '../repositories/cliente.repository.js';

describe('ClienteService', () => {
  let clienteService: ClienteService;
  let mockClienteRepo: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByIdentificacion: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  const mockCliente = {
    id: 'cli-001',
    nombre: 'Juan Pérez',
    identificacion: 'V-18765432',
    telefono: '0414-1234567',
    correo: 'juan.perez@gmail.com',
    direccion: 'Av. Bolívar, Local 3',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockClienteRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByIdentificacion: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    clienteService = new ClienteService(mockClienteRepo as unknown as ClienteRepository);
  });

  it('debe registrar un cliente correctamente con datos válidos', async () => {
    mockClienteRepo.findByIdentificacion.mockResolvedValue(null);
    mockClienteRepo.create.mockResolvedValue(mockCliente);

    const result = await clienteService.create({
      nombre: 'Juan Pérez',
      identificacion: 'V-18765432',
      telefono: '0414-1234567',
      correo: 'juan.perez@gmail.com',
    });

    expect(result.nombre).toBe('Juan Pérez');
    expect(result.identificacion).toBe('V-18765432');
    expect(mockClienteRepo.create).toHaveBeenCalledTimes(1);
  });

  it('debe rechazar si el nombre o la identificación están vacíos', async () => {
    await expect(clienteService.create({
      nombre: '',
      identificacion: 'V-18765432',
    })).rejects.toThrow('El nombre y el número de identificación (cédula/RIF) son obligatorios');

    await expect(clienteService.create({
      nombre: 'Juan Pérez',
      identificacion: '',
    })).rejects.toThrow('El nombre y el número de identificación (cédula/RIF) son obligatorios');
  });

  it('debe rechazar si la identificación ya existe', async () => {
    mockClienteRepo.findByIdentificacion.mockResolvedValue(mockCliente);

    await expect(clienteService.create({
      nombre: 'Otro Cliente',
      identificacion: 'V-18765432',
    })).rejects.toThrow('Ya existe un cliente registrado con la identificación "V-18765432"');
  });

  it('debe lanzar error al consultar un ID que no existe', async () => {
    mockClienteRepo.findById.mockResolvedValue(null);

    await expect(clienteService.getById('999'))
      .rejects.toThrow('Cliente con ID 999 no encontrado');
  });

  it('debe rechazar actualización si la nueva identificación ya pertenece a otro cliente', async () => {
    mockClienteRepo.findById.mockResolvedValue(mockCliente);
    mockClienteRepo.findByIdentificacion.mockResolvedValue({
      ...mockCliente,
      id: 'cli-002',
      identificacion: 'V-99999999',
    });

    await expect(clienteService.update('cli-001', { identificacion: 'V-99999999' }))
      .rejects.toThrow('Ya existe otro cliente con la identificación "V-99999999"');
  });
});
