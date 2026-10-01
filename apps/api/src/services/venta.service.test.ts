import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VentaService } from './venta.service.js';
import type { VentaRepository } from '../repositories/venta.repository.js';
import { EstadoVenta } from '@ferreteria/shared';
import { Prisma } from '@prisma/client-local';

// Aísla el servicio de la BD real: crearVenta consulta el turno abierto directamente con Prisma.
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    turnoCaja: { findFirst: vi.fn().mockResolvedValue(null) },
    producto: { findUnique: vi.fn().mockResolvedValue(null) },
  },
  isCloudMode: false,
}));

describe('VentaService', () => {
  let ventaService: VentaService;
  let mockVentaRepo: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    crearVentaTransaccional: ReturnType<typeof vi.fn>;
    anularVentaTransaccional: ReturnType<typeof vi.fn>;
  };

  const mockVentaExitosa = {
    id: 'vta-101',
    clienteId: 'cli-001',
    usuarioId: 'usr-002',
    fecha: new Date(),
    subtotal: new Prisma.Decimal('20.00'),
    impuesto: new Prisma.Decimal('3.20'),
    total: new Prisma.Decimal('23.20'),
    estado: EstadoVenta.COMPLETADA,
    cliente: {
      id: 'cli-001',
      nombre: 'Juan Pérez',
      identificacion: 'V-18765432',
      telefono: '0414-1234567',
      correo: 'juan@gmail.com',
      direccion: 'Av. Bolívar',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    usuario: {
      id: 'usr-002',
      nombre: 'Cajero Turno',
      email: 'cajero@ferreteria.com',
      rol: 'CAJERO',
    },
    detalles: [
      {
        id: 'det-001',
        ventaId: 'vta-101',
        productoId: 'prod-005',
        cantidad: 2,
        precioUnitario: new Prisma.Decimal('10.00'),
        subtotalLinea: new Prisma.Decimal('20.00'),
        producto: {
          id: 'prod-005',
          codigo: 'HER-005',
          nombre: 'Martillo',
          descripcion: null,
          categoriaId: 'cat-001',
          precioCompra: new Prisma.Decimal('6.00'),
          precioVenta: new Prisma.Decimal('10.00'),
          stockActual: 8,
          stockMinimo: 5,
          unidadMedida: 'UND',
          activo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockVentaRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      crearVentaTransaccional: vi.fn(),
      anularVentaTransaccional: vi.fn(),
    };

    ventaService = new VentaService(mockVentaRepo as unknown as VentaRepository);
  });

  it('debe procesar una venta exitosa con descuento de stock y cálculo de impuestos correcto', async () => {
    mockVentaRepo.crearVentaTransaccional.mockResolvedValue(mockVentaExitosa);

    const result = await ventaService.crearVenta(
      {
        clienteId: 'cli-001',
        items: [
          {
            productoId: 'prod-005',
            cantidad: 2,
            precioUnitario: 10.00,
          },
        ],
        porcentajeImpuesto: 0.16,
      },
      'usr-002' // usuarioId
    );

    expect(result.id).toBe('vta-101');
    expect(result.subtotal).toBe(20.00);
    expect(result.impuesto).toBe(3.20);
    expect(result.total).toBe(23.20);
    expect(result.estado).toBe(EstadoVenta.COMPLETADA);
    expect(mockVentaRepo.crearVentaTransaccional).toHaveBeenCalledTimes(1);
    expect(mockVentaRepo.crearVentaTransaccional).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 'cli-001',
        usuarioId: 'usr-002',
        subtotal: 20.00,
        impuesto: 3.20,
        total: 23.20,
        monedaFuncional: 'USD',
        totalUsd: 23.20,
        items: [
          {
            productoId: 'prod-005',
            cantidad: 2,
            precioUnitario: 10.00,
          },
        ],
        pagos: undefined,
      })
    );
  });

  it('debe procesar pagos multimoneda y congelar las tasas de cambio de la transacción', async () => {
    mockVentaRepo.crearVentaTransaccional.mockResolvedValue({
      id: 'vta-102',
      clienteId: 'cli-001',
      usuarioId: 'usr-002',
      subtotal: 100.00,
      impuesto: 16.00,
      total: 116.00,
      monedaFuncional: 'USD',
      totalUsd: 116.00,
      estado: EstadoVenta.COMPLETADA,
      fecha: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      pagos: [
        {
          id: 'pago-001',
          ventaId: 'vta-102',
          metodoPago: 'EFECTIVO_USD',
          moneda: 'USD',
          montoMoneda: 50.00,
          tasaAplicada: 1.0000,
          montoUsd: 50.00,
        },
        {
          id: 'pago-002',
          ventaId: 'vta-102',
          metodoPago: 'PAGO_MOVIL_VES',
          moneda: 'VES',
          montoMoneda: 3960.00,
          tasaAplicada: 60.0000,
          montoUsd: 66.00,
          referencia: 'REF-123456',
        },
      ],
    });

    const result = await ventaService.crearVenta(
      {
        clienteId: 'cli-001',
        items: [{ productoId: 'prod-001', cantidad: 1, precioUnitario: 100.00 }],
        porcentajeImpuesto: 0.16,
        pagos: [
          {
            metodoPago: 'EFECTIVO_USD' as any,
            moneda: 'USD' as any,
            montoMoneda: 50.00,
            tasaAplicada: 1.0000,
          },
          {
            metodoPago: 'PAGO_MOVIL_VES' as any,
            moneda: 'VES' as any,
            montoMoneda: 3960.00,
            tasaAplicada: 60.0000,
            referencia: 'REF-123456',
          },
        ],
      },
      'usr-002'
    );

    expect(result.id).toBe('vta-102');
    expect(result.pagos).toHaveLength(2);
    expect(result.pagos?.[0]?.tasaAplicada).toBe(1.0000);
    expect(result.pagos?.[1]?.tasaAplicada).toBe(60.0000);
    expect(mockVentaRepo.crearVentaTransaccional).toHaveBeenCalledWith(
      expect.objectContaining({
        totalUsd: 116.00,
        pagos: expect.arrayContaining([
          expect.objectContaining({
            metodoPago: 'EFECTIVO_USD',
            moneda: 'USD',
            montoMoneda: 50.00,
            tasaAplicada: 1,
            montoUsd: 50.00,
          }),
          expect.objectContaining({
            metodoPago: 'PAGO_MOVIL_VES',
            moneda: 'VES',
            montoMoneda: 3960.00,
            tasaAplicada: 60.0000,
            montoUsd: 66.00,
          }),
        ]),
      })
    );
  });

  it('debe rechazar venta si los pagos multimoneda son insuficientes para cubrir el total en USD', async () => {
    await expect(
      ventaService.crearVenta(
        {
          clienteId: 'cli-001',
          items: [{ productoId: 'prod-001', cantidad: 1, precioUnitario: 100.00 }],
          porcentajeImpuesto: 0.16, // Total: $116.00
          pagos: [
            {
              metodoPago: 'EFECTIVO_USD' as any,
              moneda: 'USD' as any,
              montoMoneda: 50.00, // Solo $50 pagados
              tasaAplicada: 1.0000,
            },
          ],
        },
        'usr-002'
      )
    ).rejects.toThrow('Monto pagado insuficiente');
  });

  it('debe rechazar la venta si el repositorio lanza error por stock insuficiente', async () => {
    mockVentaRepo.crearVentaTransaccional.mockRejectedValue(
      new Error('Stock insuficiente para "Martillo". Disponible: 1, Solicitado: 5')
    );

    await expect(
      ventaService.crearVenta(
        {
          clienteId: 'cli-001',
          items: [{ productoId: 'prod-005', cantidad: 5, precioUnitario: 10.00 }],
        },
        'usr-002'
      )
    ).rejects.toThrow('Stock insuficiente para "Martillo"');
  });

  it('debe anular una venta correctamente revirtiendo stock y registrando auditoría', async () => {
    const mockVentaAnulada = {
      ...mockVentaExitosa,
      estado: EstadoVenta.ANULADA,
    };

    mockVentaRepo.anularVentaTransaccional.mockResolvedValue(mockVentaAnulada);

    const result = await ventaService.anularVenta('vta-101', 'usr-001', 'Cliente canceló el pedido por equivocación');

    expect(result.id).toBe('vta-101');
    expect(result.estado).toBe(EstadoVenta.ANULADA);
    expect(mockVentaRepo.anularVentaTransaccional).toHaveBeenCalledWith(
      'vta-101',
      'usr-001',
      'Cliente canceló el pedido por equivocación'
    );
  });

  it('debe rechazar anulación si no se proporciona un motivo', async () => {
    await expect(ventaService.anularVenta('vta-101', 'usr-001', ''))
      .rejects.toThrow('El motivo de anulación es obligatorio para efectos de auditoría');
  });

  it('debe rechazar la creación de venta sin productos', async () => {
    await expect(
      ventaService.crearVenta(
        {
          clienteId: 'cli-001',
          items: [],
        },
        'usr-002'
      )
    ).rejects.toThrow('La venta debe incluir al menos un producto');
  });
});
