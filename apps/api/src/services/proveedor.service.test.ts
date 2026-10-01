import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProveedorService } from './proveedor.service.js';
import type { ProveedorRepository } from '../repositories/proveedor.repository.js';

describe('ProveedorService', () => {
  let proveedorService: ProveedorService;
  let mockProveedorRepo: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByRif: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };

  const mockProveedor = {
    id: 'prov-001',
    nombre: 'Ferre-Distribuidora C.A.',
    rif: 'J-12345678-9',
    telefono: '0212-5551234',
    correo: 'ventas@ferredist.com',
    direccion: 'Zona Industrial 1',
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockProveedorRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByRif: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };

    proveedorService = new ProveedorService(mockProveedorRepo as unknown as ProveedorRepository);
  });

  it('debe registrar un proveedor correctamente con datos válidos', async () => {
    mockProveedorRepo.findByRif.mockResolvedValue(null);
    mockProveedorRepo.create.mockResolvedValue(mockProveedor);

    const result = await proveedorService.create({
      nombre: 'Ferre-Distribuidora C.A.',
      rif: 'J-12345678-9',
      telefono: '0212-5551234',
      correo: 'ventas@ferredist.com',
    });

    expect(result.nombre).toBe('Ferre-Distribuidora C.A.');
    expect(result.rif).toBe('J-12345678-9');
    expect(mockProveedorRepo.create).toHaveBeenCalledTimes(1);
  });

  it('debe rechazar si el RIF o el nombre están vacíos', async () => {
    await expect(proveedorService.create({
      nombre: '',
      rif: 'J-12345678-9',
    })).rejects.toThrow('El nombre y el RIF del proveedor son obligatorios');

    await expect(proveedorService.create({
      nombre: 'Proveedor',
      rif: '',
    })).rejects.toThrow('El nombre y el RIF del proveedor son obligatorios');
  });

  it('debe rechazar si el RIF ya existe', async () => {
    mockProveedorRepo.findByRif.mockResolvedValue(mockProveedor);

    await expect(proveedorService.create({
      nombre: 'Otro Proveedor',
      rif: 'J-12345678-9',
    })).rejects.toThrow('Ya existe un proveedor registrado con el RIF "J-12345678-9"');
  });

  it('debe lanzar error al consultar un ID que no existe', async () => {
    mockProveedorRepo.findById.mockResolvedValue(null);

    await expect(proveedorService.getById('999'))
      .rejects.toThrow('Proveedor con ID 999 no encontrado');
  });

  it('debe rechazar actualización si el nuevo RIF ya pertenece a otro proveedor', async () => {
    mockProveedorRepo.findById.mockResolvedValue(mockProveedor);
    mockProveedorRepo.findByRif.mockResolvedValue({
      ...mockProveedor,
      id: 'prov-002',
      rif: 'J-99999999-0',
    });

    await expect(proveedorService.update('prov-001', { rif: 'J-99999999-0' }))
      .rejects.toThrow('Ya existe otro proveedor con el RIF "J-99999999-0"');
  });
});
