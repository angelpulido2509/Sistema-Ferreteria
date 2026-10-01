import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { RolUsuario } from '@ferreteria/shared';
import { getEnv } from '../config/env.js';
import { tokenPara, usuarioDePrueba } from '../test/authHelpers.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    usuario: { upsert: vi.fn() },
    cliente: { upsert: vi.fn() },
    syncQueue: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  },
  usuarioRepo: { findById: vi.fn(), findByEmail: vi.fn(), countAdmins: vi.fn() },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mocks.prisma, isCloudMode: false }));
vi.mock('../repositories/usuario.repository.js', () => ({
  UsuarioRepository: class {},
  usuarioRepository: mocks.usuarioRepo,
}));

const { createApp } = await import('../app.js');

describe('Rutas /api/sync (S4, S5)', () => {
  const app = createApp({ corsOrigins: ['http://localhost:5173'] });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usuarioRepo.findById.mockImplementation(async (id: string) =>
      usuarioDePrueba(id.includes('admin') ? RolUsuario.ADMIN : RolUsuario.CAJERO, { id })
    );
    mocks.prisma.syncQueue.count.mockResolvedValue(0);
    mocks.prisma.syncQueue.findFirst.mockResolvedValue(null);
    mocks.prisma.syncQueue.findMany.mockResolvedValue([]);
  });

  describe.each([
    ['get', '/api/sync/status'],
    ['post', '/api/sync/retry'],
  ] as const)('%s %s', (method, url) => {
    it('responde 401 sin token', async () => {
      const res = await request(app)[method](url);
      expect(res.status).toBe(401);
    });

    it('responde 403 con rol CAJERO', async () => {
      const res = await request(app)[method](url).set('Authorization', `Bearer ${tokenPara(RolUsuario.CAJERO)}`);
      expect(res.status).toBe(403);
    });

    it('responde 200 con rol ADMIN', async () => {
      const res = await request(app)[method](url).set('Authorization', `Bearer ${tokenPara(RolUsuario.ADMIN)}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/sync/push', () => {
    const cliente = { entidad: 'Cliente', entidadId: 'c1', operacion: 'CREAR', payload: { nombre: 'Ana', identificacion: 'V-1' } };
    const usuarioMalicioso = {
      entidad: 'Usuario',
      entidadId: 'evil',
      operacion: 'CREAR',
      payload: { nombre: 'x', email: 'x@x', passwordHash: '$2b$10$abc', rol: 'ADMIN' },
    };

    it('rechaza con 401 sin API key o con una incorrecta', async () => {
      expect((await request(app).post('/api/sync/push').send({ items: [] })).status).toBe(401);
      const res = await request(app).post('/api/sync/push').set('x-sync-api-key', 'ferrepro_local_sync_key_2024').send({ items: [] });
      expect(res.status).toBe(401);
    });

    it('ignora la entidad Usuario y aplica el resto del lote', async () => {
      const res = await request(app)
        .post('/api/sync/push')
        .set('x-sync-api-key', getEnv().SYNC_API_KEY)
        .send({ items: [usuarioMalicioso, cliente] });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ aplicados: 1, ignorados: 1 });
      expect(mocks.prisma.usuario.upsert).not.toHaveBeenCalled();
      expect(mocks.prisma.cliente.upsert).toHaveBeenCalledTimes(1);
    });

    it('no expone el mensaje interno si falla la aplicación del lote', async () => {
      mocks.prisma.cliente.upsert.mockRejectedValueOnce(new Error('SQLITE_CONSTRAINT detalle interno'));
      const res = await request(app)
        .post('/api/sync/push')
        .set('x-sync-api-key', getEnv().SYNC_API_KEY)
        .send({ items: [cliente] });
      expect(res.status).toBe(500);
      expect(res.body.error).not.toMatch(/SQLITE/);
    });
  });
});
