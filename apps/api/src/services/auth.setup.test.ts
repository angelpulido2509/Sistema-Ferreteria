import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import { RolUsuario } from '@ferreteria/shared';
import { AuthService, SetupNoDisponibleError } from './auth.service.js';
import { PasswordPolicyError } from './passwordPolicy.js';
import type { UsuarioRepository } from '../repositories/usuario.repository.js';

describe('AuthService — asistente de primer arranque (S2)', () => {
  let admins: number;
  let repo: {
    countAdmins: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let service: AuthService;

  const input = { nombre: 'Dueña Ferretería', email: 'Duena@Local.VE', password: 'Tornillo2026x' };

  beforeEach(() => {
    admins = 0;
    repo = {
      countAdmins: vi.fn(async () => admins),
      findByEmail: vi.fn(async () => null),
      create: vi.fn(async (data: { nombre: string; email: string; rol: RolUsuario }) => {
        // Simula latencia de BD para que dos llamadas concurrentes se solapen.
        await new Promise((r) => setTimeout(r, 20));
        admins++;
        return { id: `u${admins}`, nombre: data.nombre, email: data.email, rol: data.rol, activo: true, createdAt: new Date(), updatedAt: new Date() };
      }),
    };
    service = new AuthService(repo as unknown as UsuarioRepository);
  });

  it('needsSetup es true solo si no hay ningún ADMIN', async () => {
    expect(await service.getSetupStatus()).toEqual({ needsSetup: true });
    admins = 1;
    expect(await service.getSetupStatus()).toEqual({ needsSetup: false });
  });

  it('crea el primer ADMIN con la contraseña hasheada y el correo normalizado', async () => {
    const usuario = await service.setupInicial(input);
    expect(usuario.rol).toBe(RolUsuario.ADMIN);
    const data = repo.create.mock.calls[0]![0];
    expect(data.email).toBe('duena@local.ve');
    expect(data.rol).toBe(RolUsuario.ADMIN);
    expect(data.passwordHash).not.toBe(input.password);
    expect(await bcrypt.compare(input.password, data.passwordHash)).toBe(true);
  });

  it('queda cerrado para siempre una vez existe un ADMIN', async () => {
    await service.setupInicial(input);
    await expect(service.setupInicial({ ...input, email: 'otro@local.ve' })).rejects.toBeInstanceOf(SetupNoDisponibleError);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('dos llamadas simultáneas crean un solo ADMIN', async () => {
    const resultados = await Promise.allSettled([
      service.setupInicial(input),
      service.setupInicial({ ...input, email: 'intruso@local.ve' }),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('exige contraseña de al menos 12 caracteres para el ADMIN', async () => {
    await expect(service.setupInicial({ ...input, password: 'admin123' })).rejects.toBeInstanceOf(PasswordPolicyError);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
