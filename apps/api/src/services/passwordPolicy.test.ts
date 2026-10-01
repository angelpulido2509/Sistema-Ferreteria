import { describe, it, expect } from 'vitest';
import { RolUsuario } from '@ferreteria/shared';
import { validarPassword } from './passwordPolicy.js';

describe('validarPassword (S2)', () => {
  it('rechaza las contraseñas por defecto del seed', () => {
    expect(() => validarPassword('admin123', RolUsuario.ADMIN)).toThrow(/al menos 12/);
    expect(() => validarPassword('cajero123', RolUsuario.CAJERO)).toThrow(/al menos 10/);
    expect(() => validarPassword('xadmin123456', RolUsuario.ADMIN)).toThrow(/común/);
  });

  it('exige 12 caracteres para ADMIN y 10 para CAJERO', () => {
    expect(() => validarPassword('Tornillo2026', RolUsuario.ADMIN)).not.toThrow();
    expect(() => validarPassword('Clavo27x9a', RolUsuario.CAJERO)).not.toThrow();
    expect(() => validarPassword('Clavo27x9a', RolUsuario.ADMIN)).toThrow(/al menos 12/);
  });

  it('exige letras y números', () => {
    expect(() => validarPassword('soloLetrasLargas', RolUsuario.ADMIN)).toThrow(/letras y números/);
    expect(() => validarPassword('948372615048', RolUsuario.ADMIN)).toThrow(/letras y números/);
  });

  it('rechaza contraseñas con pocos caracteres distintos', () => {
    expect(() => validarPassword('aaaa1111aaaa', RolUsuario.ADMIN)).toThrow(/distintos/);
  });

  it('rechaza contraseñas que contienen el correo', () => {
    expect(() => validarPassword('maria.lopez2026', RolUsuario.CAJERO, 'maria.lopez@local')).toThrow(/correo/);
  });
});
