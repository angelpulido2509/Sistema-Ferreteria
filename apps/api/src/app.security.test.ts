import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { RolUsuario } from '@ferreteria/shared';
import { tokenPara, usuarioDePrueba } from './test/authHelpers.js';

const usuarioRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findAll: vi.fn(),
  countAdmins: vi.fn(),
}));

vi.mock('./repositories/usuario.repository.js', () => ({
  UsuarioRepository: class {},
  usuarioRepository: usuarioRepo,
}));

const { createApp } = await import('./app.js');

describe('Endurecimiento HTTP (S6, S8, S9)', () => {
  const app = createApp({ corsOrigins: ['http://localhost:5173'] });
  const admin = `Bearer ${tokenPara(RolUsuario.ADMIN)}`;
  const cajero = `Bearer ${tokenPara(RolUsuario.CAJERO)}`;

  beforeEach(() => {
    vi.clearAllMocks();
    usuarioRepo.findByEmail.mockResolvedValue(null);
    usuarioRepo.findById.mockImplementation(async (id: string) =>
      usuarioDePrueba(id.includes('admin') ? RolUsuario.ADMIN : RolUsuario.CAJERO, { id })
    );
  });

  describe('rate-limit de login (S6)', () => {
    it('6 logins fallidos seguidos -> 429 con mensaje genérico', async () => {
      const intento = () => request(app).post('/api/auth/login').send({ email: 'victima@local.ve', password: 'incorrecta' });
      for (let i = 0; i < 5; i++) {
        expect((await intento()).status).toBe(401);
      }
      const res = await intento();
      expect(res.status).toBe(429);
      expect(res.body).toEqual({ success: false, data: null, error: 'Demasiados intentos. Intente de nuevo más tarde.' });
    });

    it('el bloqueo es por IP + email: otro email sigue pudiendo intentar', async () => {
      for (let i = 0; i < 6; i++) {
        await request(app).post('/api/auth/login').send({ email: 'bloqueado@local.ve', password: 'x' });
      }
      const res = await request(app).post('/api/auth/login').send({ email: 'otro@local.ve', password: 'x' });
      expect(res.status).toBe(401);
    });
  });

  it('helmet añade cabeceras de seguridad y oculta x-powered-by (S9)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  describe('validación de esquema (S9)', () => {
    it('rechaza una venta sin items con 400 y mensaje en español', async () => {
      const res = await request(app).post('/api/ventas').set('Authorization', cajero).send({ clienteId: 'c1', items: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/^items: /);
    });

    it('rechaza tipos incorrectos en pagos', async () => {
      const res = await request(app)
        .post('/api/ventas')
        .set('Authorization', cajero)
        .send({
          clienteId: 'c1',
          items: [{ productoId: 'p1', cantidad: 1 }],
          pagos: [{ metodoPago: 'BITCOIN', moneda: 'USD', montoMoneda: 10, tasaAplicada: 1 }],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/pagos\.0\.metodoPago/);
    });

    it('rechaza montos negativos al abrir caja', async () => {
      const res = await request(app)
        .post('/api/caja/abrir')
        .set('Authorization', cajero)
        .send({ montoInicialUsd: -5, montoInicialCop: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/montoInicialUsd/);
    });

    it('rechaza un rol inexistente al crear usuario', async () => {
      const res = await request(app)
        .post('/api/usuarios')
        .set('Authorization', admin)
        .send({ nombre: 'X', email: 'x@local.ve', password: 'Tornillo2026x', rol: 'SUPERADMIN' });
      expect(res.status).toBe(400);
    });

    it('rechaza anular sin motivo', async () => {
      const res = await request(app).post('/api/ventas/v1/anular').set('Authorization', admin).send({ motivo: '   ' });
      expect(res.status).toBe(400);
    });
  });

  describe('errores sin detalle interno (S8)', () => {
    it('una respuesta 500 de un controller no expone el mensaje original', async () => {
      usuarioRepo.findAll.mockRejectedValueOnce(
        new Error('Invalid `prisma.usuario.findMany()` invocation in C:\\ferreteria\\apps\\api\\src\\repo.ts')
      );
      const res = await request(app).get('/api/usuarios').set('Authorization', admin);
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/^Error interno del servidor \(ref: [0-9a-f-]{36}\)$/);
      expect(JSON.stringify(res.body)).not.toMatch(/prisma|C:\\\\/);
    });

    it('JSON malformado -> 400 genérico', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": ');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no es JSON válido/);
    });

    it('body mayor al límite explícito -> 413', async () => {
      const enorme = 'a'.repeat(9 * 1024 * 1024);
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ email: 'x@x', password: enorme }));
      expect(res.status).toBe(413);
      expect(res.body.error).toMatch(/tamaño máximo/);
    });
  });
});
