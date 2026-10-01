import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, EnvValidationError } from './env.js';

const strong = (): string => randomBytes(48).toString('base64');

const baseValida = (): NodeJS.ProcessEnv => ({
  DATABASE_URL: 'file:./x.db',
  JWT_SECRET: strong(),
  JWT_REFRESH_SECRET: strong(),
  SYNC_API_KEY: strong(),
});

function problemas(source: NodeJS.ProcessEnv): string[] {
  try {
    loadEnv(source);
    return [];
  } catch (e) {
    expect(e).toBeInstanceOf(EnvValidationError);
    return (e as EnvValidationError).problemas;
  }
}

describe('loadEnv (S3)', () => {
  it('acepta secretos fuertes y aplica valores por defecto seguros', () => {
    const env = loadEnv(baseValida());
    expect(env.NODE_ENV).toBe('production');
    expect(env.PORT).toBe(4000);
    expect(env.RUNTIME_MODE).toBe('local');
  });

  it('falla si faltan los secretos', () => {
    const p = problemas({ DATABASE_URL: 'file:./x.db' });
    expect(p.join('\n')).toMatch(/JWT_SECRET es obligatorio/);
    expect(p.join('\n')).toMatch(/JWT_REFRESH_SECRET es obligatorio/);
    expect(p.join('\n')).toMatch(/SYNC_API_KEY es obligatorio/);
  });

  it('trata la cadena vacía como ausente', () => {
    expect(problemas({ ...baseValida(), JWT_SECRET: '' }).join()).toMatch(/JWT_SECRET es obligatorio/);
  });

  it('falla si un secreto es corto', () => {
    expect(problemas({ ...baseValida(), SYNC_API_KEY: 'abc123' }).join()).toMatch(/SYNC_API_KEY debe tener al menos 32/);
  });

  it('rechaza los secretos de desarrollo que estaban en el código', () => {
    const p = problemas({
      ...baseValida(),
      JWT_SECRET: 'clave_secreta_super_segura_para_desarrollo_local_123456',
      JWT_REFRESH_SECRET: 'clave_refresh_secreta_super_segura_para_desarrollo_local_654321',
      SYNC_API_KEY: 'ferrepro_local_sync_key_2024_ferrepro_local_sync_key_2024',
    });
    expect(p).toHaveLength(3);
    p.forEach((msg) => expect(msg).toMatch(/comprometido/));
  });

  it('rechaza los placeholders de .env.example', () => {
    const p = problemas({ ...baseValida(), SYNC_API_KEY: '<pegar-valor-generado-igual-en-local-y-nube>' });
    expect(p.join()).toMatch(/SYNC_API_KEY contiene una cadena de desarrollo/);
  });

  it('exige que JWT_SECRET y JWT_REFRESH_SECRET sean distintos', () => {
    const s = strong();
    expect(problemas({ ...baseValida(), JWT_SECRET: s, JWT_REFRESH_SECRET: s }).join()).toMatch(/deben ser distintos/);
  });

  it('nunca incluye el valor del secreto en el mensaje de error', () => {
    const debil = 'clave_secreta_super_segura_para_desarrollo_local_123456';
    try {
      loadEnv({ ...baseValida(), JWT_SECRET: debil });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain(debil);
    }
  });
});

describe('arranque del servidor (S3)', () => {
  const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const tsxCli = path.join(apiDir, 'node_modules/tsx/dist/cli.mjs');

  it('la API no arranca con secretos de desarrollo y sale con código 1', () => {
    const result = spawnSync(process.execPath, [tsxCli, 'src/server.ts'], {
      cwd: apiDir,
      encoding: 'utf8',
      timeout: 30000,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        ENV_FILE: path.join(apiDir, 'no-existe.env'),
        DATABASE_URL: 'file:./x.db',
        JWT_SECRET: 'clave_secreta_super_segura_para_desarrollo_local_123456',
        JWT_REFRESH_SECRET: 'corto',
        SYNC_API_KEY: '',
        PORT: '0',
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/La API no puede arrancar/);
    expect(result.stderr).toMatch(/JWT_SECRET/);
    expect(result.stderr).not.toContain('desarrollo_local_123456');
    expect(result.stdout).not.toMatch(/corriendo/);
  }, 40000);
});
