import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const repo = vi.hoisted(() => ({
  countAdmins: vi.fn(),
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../repositories/usuario.repository.js', () => ({
  UsuarioRepository: class {},
  usuarioRepository: repo,
}));

const { createApp } = await import('../app.js');

describe('Rutas /api/auth/setup (S2)', () => {
  const app = createApp({ corsOrigins: ['http://localhost:5173'] });

  beforeEach(() => {
    vi.clearAllMocks();
    repo.findByEmail.mockResolvedValue(null);
    repo.create.mockImplementation(async (d: { nombre: string; email: string; rol: string }) => ({
      id: 'u1', nombre: d.nombre, email: d.email, rol: d.rol, activo: true, createdAt: new Date(), updatedAt: new Date(),
    }));
  });

  it('GET /setup-status indica needsSetup sin requerir token', async () => {
    repo.countAdmins.mockResolvedValue(0);
    const res = await request(app).get('/api/auth/setup-status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { needsSetup: true }, error: null });
  });

  it('POST /setup crea el ADMIN cuando no existe ninguno (201) y no devuelve el hash', async () => {
    repo.countAdmins.mockResolvedValue(0);
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ nombre: 'Dueño', email: 'dueno@local.ve', password: 'Tornillo2026x' });
    expect(res.status).toBe(201);
    expect(res.body.data.rol).toBe('ADMIN');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2b\$/);
  });

  it('POST /setup responde 403 si ya existe un ADMIN', async () => {
    repo.countAdmins.mockResolvedValue(1);
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ nombre: 'Intruso', email: 'x@x.com', password: 'Tornillo2026x' });
    expect(res.status).toBe(403);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('POST /setup responde 400 con contraseña débil', async () => {
    repo.countAdmins.mockResolvedValue(0);
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ nombre: 'Dueño', email: 'dueno@local.ve', password: 'admin123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/al menos 12/);
  });
});
