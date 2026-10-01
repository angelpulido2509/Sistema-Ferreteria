import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { RolUsuario } from '@ferreteria/shared';
import { tokenPara, usuarioDePrueba } from '../test/authHelpers.js';

const mocks = vi.hoisted(() => ({
  backup: { listar: vi.fn(), crearBackup: vi.fn() },
  usuarioRepo: { findById: vi.fn() },
}));

vi.mock('../services/backup.service.js', () => ({ backupService: mocks.backup }));
vi.mock('../repositories/usuario.repository.js', () => ({
  UsuarioRepository: class {},
  usuarioRepository: mocks.usuarioRepo,
}));

const { createApp } = await import('../app.js');

describe('Rutas /api/backup (D1)', () => {
  const app = createApp({ corsOrigins: ['http://localhost:5173'] });
  const backup = { archivo: 'ferreteria-20261001-090000-000-manual.db', tamanoBytes: 4096, creadoEn: new Date(), motivo: 'manual' };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usuarioRepo.findById.mockImplementation(async (id: string) =>
      usuarioDePrueba(id.includes('admin') ? RolUsuario.ADMIN : RolUsuario.CAJERO, { id })
    );
    mocks.backup.listar.mockResolvedValue([backup]);
    mocks.backup.crearBackup.mockResolvedValue(backup);
  });

  it('GET /api/backup: 401 sin token, 403 CAJERO, 200 ADMIN', async () => {
    expect((await request(app).get('/api/backup')).status).toBe(401);
    expect((await request(app).get('/api/backup').set('Authorization', `Bearer ${tokenPara(RolUsuario.CAJERO)}`)).status).toBe(403);
    const res = await request(app).get('/api/backup').set('Authorization', `Bearer ${tokenPara(RolUsuario.ADMIN)}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].archivo).toBe(backup.archivo);
  });

  it('POST /api/backup/now crea un respaldo manual (solo ADMIN)', async () => {
    expect((await request(app).post('/api/backup/now').set('Authorization', `Bearer ${tokenPara(RolUsuario.CAJERO)}`)).status).toBe(403);
    const res = await request(app).post('/api/backup/now').set('Authorization', `Bearer ${tokenPara(RolUsuario.ADMIN)}`);
    expect(res.status).toBe(201);
    expect(mocks.backup.crearBackup).toHaveBeenCalledWith('manual');
  });
});
