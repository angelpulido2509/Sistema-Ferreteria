import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncService } from './sync.service.js';
import { prisma } from '../lib/prisma.js';
import { EstadoSync, OperacionSync } from '@ferreteria/shared';

// Mock de prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    syncQueue: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    cliente: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    proveedor: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    producto: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    venta: {
      upsert: vi.fn(),
    },
    detalleVenta: {
      upsert: vi.fn(),
    },
    pagoVenta: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    configuracion: {
      upsert: vi.fn(),
    },
  },
  isCloudMode: false,
}));

describe('SyncService', () => {
  let service: SyncService;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CLOUD_API_URL: 'https://cloud-api.ferrepro.test',
      SYNC_API_KEY: 'test_sync_key',
    };
    service = new SyncService();
  });

  afterEach(() => {
    process.env = originalEnv;
    service.stopBackgroundWorker();
  });

  describe('verificarConectividadNube', () => {
    it('debe retornar false si CLOUD_API_URL no está configurada', async () => {
      delete process.env.CLOUD_API_URL;
      const result = await service.verificarConectividadNube();
      expect(result).toBe(false);
    });

    it('debe retornar true cuando el endpoint /api/health responde 200 OK', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await service.verificarConectividadNube();
      expect(result).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://cloud-api.ferrepro.test/api/health',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('debe retornar false cuando el endpoint falla o se produce timeout', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await service.verificarConectividadNube();
      expect(result).toBe(false);
    });
  });

  describe('sincronizarPendientes (Outbox Worker)', () => {
    it('no debe procesar nada si no hay conexión con la nube', async () => {
      vi.spyOn(service, 'verificarConectividadNube').mockResolvedValue(false);

      const resultado = await service.sincronizarPendientes();
      expect(resultado).toEqual({ procesados: 0, exitosos: 0, fallidos: 0 });
      expect(prisma.syncQueue.findMany).not.toHaveBeenCalled();
    });

    it('debe enviar cambios pendientes y marcarlos como SINCRONIZADO', async () => {
      vi.spyOn(service, 'verificarConectividadNube').mockResolvedValue(true);

      const mockPendientes = [
        {
          id: 'sync-1',
          entidad: 'Cliente',
          entidadId: 'cli-uuid-1',
          operacion: OperacionSync.CREAR,
          payload: JSON.stringify({ nombre: 'Juan Pérez', identificacion: 'V-12345678' }),
          estado: EstadoSync.PENDIENTE,
          intentos: 0,
        },
      ];

      vi.mocked(prisma.syncQueue.findMany).mockResolvedValue(mockPendientes as any);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { procesados: 1, exitosos: 1, fallidos: 0 } }),
      });

      const resultado = await service.sincronizarPendientes();
      expect(resultado.procesados).toBe(1);
      expect(resultado.exitosos).toBe(1);
      expect(resultado.fallidos).toBe(0);

      expect(prisma.syncQueue.update).toHaveBeenCalledWith({
        where: { id: 'sync-1' },
        data: {
          estado: EstadoSync.SINCRONIZADO,
          sincronizadoEn: expect.any(Date),
          ultimoError: null,
        },
      });
    });

    it('debe incrementar intentos y marcar como ERROR tras 5 fallos', async () => {
      vi.spyOn(service, 'verificarConectividadNube').mockResolvedValue(true);

      const mockPendientes = [
        {
          id: 'sync-error-5',
          entidad: 'Producto',
          entidadId: 'prod-uuid-1',
          operacion: OperacionSync.ACTUALIZAR,
          payload: JSON.stringify({ nombre: 'Martillo', codigo: 'M01' }),
          estado: EstadoSync.PENDIENTE,
          intentos: 4, // Intento actual será el 5º
        },
      ];

      vi.mocked(prisma.syncQueue.findMany).mockResolvedValue(mockPendientes as any);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error en la nube',
      });

      const resultado = await service.sincronizarPendientes();
      expect(resultado.procesados).toBe(1);
      expect(resultado.fallidos).toBe(1);

      expect(prisma.syncQueue.update).toHaveBeenCalledWith({
        where: { id: 'sync-error-5' },
        data: {
          intentos: 5,
          ultimoError: expect.stringContaining('500'),
          estado: EstadoSync.ERROR,
        },
      });
    });
  });

  describe('aplicarSyncPush (Idempotencia con Upsert en la Nube)', () => {
    it('debe usar upsert al sincronizar un cliente para no duplicar datos', async () => {
      const items = [
        {
          entidad: 'Cliente',
          entidadId: 'cli-123',
          operacion: OperacionSync.CREAR,
          payload: {
            nombre: 'Ferretería El Tornillo',
            identificacion: 'J-12345678-0',
            telefono: '0414-1234567',
          },
        },
      ];

      const resultado = await service.aplicarSyncPush(items);
      expect(resultado.aplicados).toBe(1);

      expect(prisma.cliente.upsert).toHaveBeenCalledWith({
        where: { id: 'cli-123' },
        update: expect.objectContaining({ nombre: 'Ferretería El Tornillo' }),
        create: expect.objectContaining({ id: 'cli-123', nombre: 'Ferretería El Tornillo' }),
      });
    });

    it('debe usar upsert al sincronizar configuración del sistema', async () => {
      const items = [
        {
          entidad: 'Configuracion',
          entidadId: 'cfg-1',
          operacion: OperacionSync.ACTUALIZAR,
          payload: {
            nombreFerreteria: 'FerrePro Apure',
            tasaVes: 65.0,
            tasaCop: 4200.0,
          },
        },
      ];

      const resultado = await service.aplicarSyncPush(items);
      expect(resultado.aplicados).toBe(1);

      expect(prisma.configuracion.upsert).toHaveBeenCalledWith({
        where: { id: 'cfg-1' },
        update: expect.objectContaining({ nombreFerreteria: 'FerrePro Apure' }),
        create: expect.objectContaining({ id: 'cfg-1', nombreFerreteria: 'FerrePro Apure' }),
      });
    });
  });

  describe('getStatus', () => {
    it('debe retornar las métricas completas de la cola de sincronización', async () => {
      vi.spyOn(service, 'verificarConectividadNube').mockResolvedValue(true);
      vi.mocked(prisma.syncQueue.count)
        .mockResolvedValueOnce(3)  // pendientes
        .mockResolvedValueOnce(1); // errores

      const mockUltimo = { sincronizadoEn: new Date('2026-09-20T12:00:00Z') };
      vi.mocked(prisma.syncQueue.findFirst).mockResolvedValue(mockUltimo as any);
      vi.mocked(prisma.syncQueue.findMany).mockResolvedValue([
        {
          id: 'err-1',
          entidad: 'Venta',
          entidadId: 'v-1',
          ultimoError: 'Error de red',
          intentos: 5,
        },
      ] as any);

      const status = await service.getStatus();
      expect(status.conectado).toBe(true);
      expect(status.pendientes).toBe(3);
      expect(status.errores).toBe(1);
      expect(status.ultimaSincronizacion).toEqual(mockUltimo.sincronizadoEn);
      expect(status.detallesErrores).toHaveLength(1);
      expect(status.detallesErrores?.[0]?.entidad).toBe('Venta');
    });
  });
});
