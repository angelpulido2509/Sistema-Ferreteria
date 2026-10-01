import { RolUsuario } from '@ferreteria/shared';

/** Longitud mínima por rol: los administradores requieren más. */
export const MIN_PASSWORD_LENGTH: Record<RolUsuario, number> = {
  [RolUsuario.ADMIN]: 12,
  [RolUsuario.CAJERO]: 10,
};

/** Error de validación de contraseña (se responde con 400). */
export class PasswordPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordPolicyError';
  }
}

/** Fragmentos que vuelven trivial una contraseña (comparación sin mayúsculas). */
const FRAGMENTOS_TRIVIALES = [
  'password',
  'contraseña',
  'contrasena',
  'admin123',
  'cajero123',
  '123456',
  'qwerty',
  'abc123',
  'ferreteria',
  'ferrepro',
];

/**
 * Valida la política de contraseñas. Lanza PasswordPolicyError con mensaje en español si no cumple.
 * Reglas: longitud mínima por rol, letras y números, sin fragmentos triviales,
 * sin repetir un solo carácter y sin contener la parte local del correo.
 */
export function validarPassword(password: string, rol: RolUsuario, email?: string): void {
  const min = MIN_PASSWORD_LENGTH[rol] ?? MIN_PASSWORD_LENGTH[RolUsuario.ADMIN];

  if (typeof password !== 'string' || password.length < min) {
    throw new PasswordPolicyError(`La contraseña debe tener al menos ${min} caracteres`);
  }

  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(password) || !/\d/.test(password)) {
    throw new PasswordPolicyError('La contraseña debe combinar letras y números');
  }

  const lower = password.toLowerCase();
  if (FRAGMENTOS_TRIVIALES.some((f) => lower.includes(f))) {
    throw new PasswordPolicyError('La contraseña es demasiado común; elige otra');
  }

  if (new Set(lower).size < 4) {
    throw new PasswordPolicyError('La contraseña tiene muy pocos caracteres distintos');
  }

  const localPart = email?.split('@')[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && lower.includes(localPart)) {
    throw new PasswordPolicyError('La contraseña no puede contener el correo del usuario');
  }
}
