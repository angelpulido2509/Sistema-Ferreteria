import { usuarioRepository } from '../repositories/usuario.repository.js';
import type { RolUsuario } from '@ferreteria/shared';

/** Estado de autorización vigente de un usuario según la BD. */
export interface UsuarioVigente {
  id: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}

/** TTL del caché: evita una consulta por petición sin retrasar mucho una revocación. */
export const AUTH_CACHE_TTL_MS = 30_000;

const cache = new Map<string, { usuario: UsuarioVigente | null; expira: number }>();

/**
 * Devuelve el usuario vigente (activo y rol actual) con caché en memoria de 30 s.
 * Cambios hechos por usuario.service invalidan la entrada de inmediato.
 */
export async function obtenerUsuarioVigente(id: string): Promise<UsuarioVigente | null> {
  const ahora = Date.now();
  const entrada = cache.get(id);
  if (entrada && entrada.expira > ahora) {
    return entrada.usuario;
  }

  const u = await usuarioRepository.findById(id);
  const usuario = u ? { id: u.id, email: u.email, rol: u.rol as RolUsuario, activo: u.activo } : null;
  cache.set(id, { usuario, expira: ahora + AUTH_CACHE_TTL_MS });
  return usuario;
}

/** Fuerza a releer el usuario de la BD en la siguiente petición. */
export function invalidarUsuarioEnCache(id: string): void {
  cache.delete(id);
}

/** Solo para tests. */
export function limpiarCacheUsuarios(): void {
  cache.clear();
}
