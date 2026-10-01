import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RolUsuario } from '@ferreteria/shared';
import { usuarioDePrueba } from '../test/authHelpers.js';

const repo = vi.hoisted(() => ({ findById: vi.fn() }));
vi.mock('../repositories/usuario.repository.js', () => ({ usuarioRepository: repo }));

const { obtenerUsuarioVigente, invalidarUsuarioEnCache, limpiarCacheUsuarios, AUTH_CACHE_TTL_MS } = await import(
  './authUserCache.js'
);

describe('authUserCache (S7)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    limpiarCacheUsuarios();
    repo.findById.mockReset().mockResolvedValue(usuarioDePrueba(RolUsuario.CAJERO, { id: 'u1' }));
  });
  afterEach(() => vi.useRealTimers());

  it('consulta la BD una sola vez dentro del TTL', async () => {
    await obtenerUsuarioVigente('u1');
    await obtenerUsuarioVigente('u1');
    expect(repo.findById).toHaveBeenCalledTimes(1);
  });

  it('vuelve a consultar al vencer el TTL', async () => {
    await obtenerUsuarioVigente('u1');
    vi.advanceTimersByTime(AUTH_CACHE_TTL_MS + 1);
    await obtenerUsuarioVigente('u1');
    expect(repo.findById).toHaveBeenCalledTimes(2);
  });

  it('invalidar fuerza la relectura inmediata', async () => {
    await obtenerUsuarioVigente('u1');
    invalidarUsuarioEnCache('u1');
    repo.findById.mockResolvedValue(usuarioDePrueba(RolUsuario.CAJERO, { id: 'u1', activo: false }));
    expect((await obtenerUsuarioVigente('u1'))?.activo).toBe(false);
  });

  it('el TTL está entre 30 y 60 segundos', () => {
    expect(AUTH_CACHE_TTL_MS).toBeGreaterThanOrEqual(30_000);
    expect(AUTH_CACHE_TTL_MS).toBeLessThanOrEqual(60_000);
  });
});
