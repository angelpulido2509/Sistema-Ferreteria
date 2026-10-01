import jwt from 'jsonwebtoken';
import { RolUsuario } from '@ferreteria/shared';
import { getEnv } from '../config/env.js';

/** Usuario de prueba con la forma que devuelve UsuarioRepository.findById. */
export function usuarioDePrueba(rol: RolUsuario, overrides: Partial<{ id: string; activo: boolean }> = {}) {
  const id = overrides.id ?? `usr-${rol.toLowerCase()}`;
  return {
    id,
    nombre: `Usuario ${rol}`,
    email: `${id}@test.local`,
    passwordHash: 'x',
    rol,
    activo: overrides.activo ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Firma un access token válido con el secreto de test. */
export function tokenPara(rol: RolUsuario, id = `usr-${rol.toLowerCase()}`): string {
  return jwt.sign({ id, email: `${id}@test.local`, rol }, getEnv().JWT_SECRET, { expiresIn: '5m' });
}
