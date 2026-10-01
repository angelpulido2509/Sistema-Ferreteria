import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RolUsuario } from '@ferreteria/shared';
import { getEnv } from '../config/env.js';
import { tokenPara, usuarioDePrueba } from '../test/authHelpers.js';

const usuarioRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findAll: vi.fn(),
  countAdmins: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../repositories/usuario.repository.js', () => ({
  UsuarioRepository: class {},
  usuarioRepository: usuarioRepo,
}));

const { createApp } = await import('../app.js');
const { usuarioService } = await import('../services/usuario.service.js');
const { limpiarCacheUsuarios } = await import('../lib/authUserCache.js');

/** Base de datos simulada de usuarios. */
let usuarios: Map<string, ReturnType<typeof usuarioDePrueba>>;

describe('Sesiones revocables (S7)', () => {
  const app = createApp({ corsOrigins: ['http://localhost:5173'] });

  beforeEach(() => {
    vi.clearAllMocks();
    limpiarCacheUsuarios();
    usuarios = new Map([
      ['usr-cajero', usuarioDePrueba(RolUsuario.CAJERO, { id: 'usr-cajero' })],
      ['usr-admin', usuarioDePrueba(RolUsuario.ADMIN, { id: 'usr-admin' })],
    ]);
    usuarioRepo.findById.mockImplementation(async (id: string) => (usuarios.has(id) ? { ...usuarios.get(id)! } : null));
    usuarioRepo.delete.mockImplementation(async (id: string) => {
      usuarios.get(id)!.activo = false;
    });
    usuarioRepo.findAll.mockResolvedValue([]);
  });

  it('un usuario desactivado pierde acceso en la siguiente petición', async () => {
    const token = `Bearer ${tokenPara(RolUsuario.CAJERO, 'usr-cajero')}`;
    expect((await request(app).get('/api/auth/me').set('Authorization', token)).status).toBe(200);

    await usuarioService.deactivate('usr-cajero');

    const res = await request(app).get('/api/auth/me').set('Authorization', token);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inactivo/);
  });

  it('el rol se toma de la BD: un token que dice ADMIN no sirve si el usuario es CAJERO', async () => {
    const tokenFalsoAdmin = `Bearer ${tokenPara(RolUsuario.ADMIN, 'usr-cajero')}`;
    const res = await request(app).get('/api/usuarios').set('Authorization', tokenFalsoAdmin);
    expect(res.status).toBe(403);
  });

  it('un cambio de rol hecho por usuario.service aplica de inmediato', async () => {
    const token = `Bearer ${tokenPara(RolUsuario.ADMIN, 'usr-admin')}`;
    expect((await request(app).get('/api/usuarios').set('Authorization', token)).status).toBe(200);

    usuarioRepo.update.mockImplementation(async (id: string, data: { rol?: RolUsuario }) => {
      Object.assign(usuarios.get(id)!, data);
      return usuarios.get(id);
    });
    await usuarioService.update('usr-admin', { rol: RolUsuario.CAJERO });

    expect((await request(app).get('/api/usuarios').set('Authorization', token)).status).toBe(403);
  });

  it('un usuario borrado de la BD pierde acceso', async () => {
    const token = `Bearer ${tokenPara(RolUsuario.CAJERO, 'usr-fantasma')}`;
    expect((await request(app).get('/api/auth/me').set('Authorization', token)).status).toBe(401);
  });

  it('el access token dura como máximo 30 minutos', async () => {
    usuarioRepo.findByEmail.mockResolvedValue({
      ...usuarios.get('usr-cajero')!,
      passwordHash: await bcrypt.hash('Clavo27x9a', 4),
    });
    const res = await request(app).post('/api/auth/login').send({ email: 'usr-cajero@test.local', password: 'Clavo27x9a' });
    const { iat, exp } = jwt.decode(res.body.data.token) as { iat: number; exp: number };
    expect(exp - iat).toBeLessThanOrEqual(30 * 60);
  });
});

describe('Refresh token en cookie httpOnly (S7)', () => {
  const app = createApp({ corsOrigins: ['http://localhost:5173'] });

  beforeEach(async () => {
    vi.clearAllMocks();
    limpiarCacheUsuarios();
    usuarios = new Map([['usr-cajero', usuarioDePrueba(RolUsuario.CAJERO, { id: 'usr-cajero' })]]);
    usuarioRepo.findById.mockImplementation(async (id: string) => (usuarios.has(id) ? { ...usuarios.get(id)! } : null));
    usuarioRepo.findByEmail.mockResolvedValue({
      ...usuarios.get('usr-cajero')!,
      passwordHash: await bcrypt.hash('Clavo27x9a', 4),
    });
  });

  async function login() {
    return request(app).post('/api/auth/login').send({ email: 'usr-cajero@test.local', password: 'Clavo27x9a' });
  }

  function cookieDe(res: request.Response): string {
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    return setCookie.find((c) => c.startsWith('ferrepro_rt='))!;
  }

  it('login entrega el refresh token solo en cookie httpOnly SameSite=Strict', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTypeOf('string');
    expect(res.body.data).not.toHaveProperty('refreshToken');
    const cookie = cookieDe(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it('refresh con la cookie devuelve un access token nuevo', async () => {
    const cookie = cookieDe(await login()).split(';')[0]!;
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie).send({});
    expect(res.status).toBe(200);
    expect(jwt.verify(res.body.data.token, getEnv().JWT_SECRET)).toMatchObject({ id: 'usr-cajero' });
  });

  it('refresh sin cookie -> 401', async () => {
    expect((await request(app).post('/api/auth/refresh').send({})).status).toBe(401);
  });

  it('refresh de un usuario desactivado -> 401', async () => {
    const cookie = cookieDe(await login()).split(';')[0]!;
    usuarios.get('usr-cajero')!.activo = false;
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie).send({})).status).toBe(401);
  });

  it('logout borra la cookie aunque no haya access token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(cookieDe(res)).toMatch(/ferrepro_rt=;.*Expires=Thu, 01 Jan 1970/);
  });
});
