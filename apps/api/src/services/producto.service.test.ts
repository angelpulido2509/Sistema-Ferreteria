import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductoService } from './producto.service.js';
import type { ProductoRepository } from '../repositories/producto.repository.js';
import type { CategoriaRepository } from '../repositories/categoria.repository.js';
import { Prisma } from '@prisma/client-local';

describe('ProductoService', () => {
  let productoService: ProductoService;
  let mockProductoRepo: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByCodigo: ReturnType<typeof vi.fn>;
    findStockAlerts: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let mockCategoriaRepo: {
    findById: ReturnType<typeof vi.fn>;
  };

  const mockCategoria = {
    id: 'cat-001',
    nombre: 'Herramientas Manuales',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProducto = {
    id: 'prod-001',
    codigo: 'MART-001',
    nombre: 'Martillo de Uña',
    descripcion: 'Martillo de 16oz',
    categoriaId: 'cat-001',
    precioCompra: new Prisma.Decimal('10.50'),
    precioVenta: new Prisma.Decimal('15.00'),
    stockActual: 10,
    stockMinimo: 5,
    unidadMedida: 'UND',
    activo: true,
    categoria: mockCategoria,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockProductoRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByCodigo: vi.fn(),
      findStockAlerts: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };

    mockCategoriaRepo = {
      findById: vi.fn(),
    };

    productoService = new ProductoService(
      mockProductoRepo as unknown as ProductoRepository,
      mockCategoriaRepo as unknown as CategoriaRepository
    );
  });

  it('debe crear un producto correctamente con datos válidos', async () => {
    mockCategoriaRepo.findById.mockResolvedValue(mockCategoria);
    mockProductoRepo.findByCodigo.mockResolvedValue(null);
    mockProductoRepo.create.mockResolvedValue(mockProducto as any);

    const result = await productoService.create({
      codigo: 'MART-001',
      nombre: 'Martillo de Uña',
      descripcion: 'Martillo de 16oz',
      categoriaId: 'cat-001',
      precioCompra: 10.50,
      precioVenta: 15.00,
      stockActual: 10,
      stockMinimo: 5,
      unidadMedida: 'UND',
    });

    expect(result.codigo).toBe('MART-001');
    expect(result.precioVenta).toBe(15.00);
    expect(result.categoria?.nombre).toBe('Herramientas Manuales');
  });

  it('debe rechazar si el precio de venta es menor al precio de compra', async () => {
    await expect(productoService.create({
      codigo: 'MART-002',
      nombre: 'Martillo Barato',
      categoriaId: 'cat-001',
      precioCompra: 20.00,
      precioVenta: 15.00,
    })).rejects.toThrow('El precio de venta no puede ser menor al precio de compra');
  });

  it('debe rechazar si la categoría especificada no existe', async () => {
    mockCategoriaRepo.findById.mockResolvedValue(null);

    await expect(productoService.create({
      codigo: 'MART-003',
      nombre: 'Martillo Inexistente',
      categoriaId: 'cat-999',
      precioCompra: 10.00,
      precioVenta: 15.00,
    })).rejects.toThrow('La categoría con ID cat-999 no existe');
  });

  it('debe rechazar si el código de producto ya existe', async () => {
    mockCategoriaRepo.findById.mockResolvedValue(mockCategoria);
    mockProductoRepo.findByCodigo.mockResolvedValue(mockProducto as any);

    await expect(productoService.create({
      codigo: 'MART-001',
      nombre: 'Martillo Duplicado',
      categoriaId: 'cat-001',
      precioCompra: 10.00,
      precioVenta: 15.00,
    })).rejects.toThrow('Ya existe un producto registrado con el código "MART-001"');
  });

  it('debe retornar solo los productos con stock menor o igual al mínimo en getStockAlerts', async () => {
    const alertProducto = {
      ...mockProducto,
      id: 'prod-002',
      codigo: 'CLAV-001',
      nombre: 'Clavos 2 pulgadas',
      stockActual: 3,
      stockMinimo: 10,
    };

    mockProductoRepo.findStockAlerts.mockResolvedValue([alertProducto as any]);

    const result = await productoService.getStockAlerts();

    expect(result).toHaveLength(1);
    expect(result[0]!.codigo).toBe('CLAV-001');
    expect(result[0]!.stockActual).toBe(3);
    expect(result[0]!.stockMinimo).toBe(10);
  });
});
