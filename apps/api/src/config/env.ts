import { z } from 'zod';

/**
 * Configuración de entorno validada al arrancar.
 *
 * Los secretos no tienen valor por defecto: si faltan, son cortos o contienen
 * cadenas de desarrollo conocidas, el proceso NO arranca. Los mensajes de error
 * nombran la variable, nunca su valor.
 */

const MIN_SECRET_LENGTH = 32;

/** Fragmentos presentes en los secretos de desarrollo que estuvieron en el código fuente. */
const FRAGMENTOS_PROHIBIDOS = [
  'desarrollo',
  'development',
  'ferrepro_local_sync_key',
  'clave_secreta',
  'clave_refresh',
  'super_segura',
  'changeme',
  'cambiar',
  'placeholder',
  'example',
  'pegar-valor', // placeholders de .env.example
];

const GENERAR_HINT = 'genera uno nuevo con: node scripts/generate-secrets.mjs';

function secretSchema(nombre: string) {
  return z
    .string({ error: `${nombre} es obligatorio (${GENERAR_HINT})` })
    .min(MIN_SECRET_LENGTH, { error: `${nombre} debe tener al menos ${MIN_SECRET_LENGTH} caracteres (${GENERAR_HINT})` })
    .refine(
      (value) => !FRAGMENTOS_PROHIBIDOS.some((f) => value.toLowerCase().includes(f)),
      { error: `${nombre} contiene una cadena de desarrollo conocida y se considera comprometido (${GENERAR_HINT})` }
    );
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
    PORT: z.coerce.number().int().min(0).max(65535).default(4000),
    RUNTIME_MODE: z.enum(['local', 'cloud']).default('local'),
    DATABASE_URL: z.string({ error: 'DATABASE_URL es obligatorio' }).min(1, { error: 'DATABASE_URL es obligatorio' }),
    JWT_SECRET: secretSchema('JWT_SECRET'),
    JWT_REFRESH_SECRET: secretSchema('JWT_REFRESH_SECRET'),
    SYNC_API_KEY: secretSchema('SYNC_API_KEY'),
    JWT_EXPIRES_IN: z.string().default('8h'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    CORS_ORIGIN: z.string().optional(),
    CLOUD_API_URL: z.string().optional(),
  })
  .refine((e) => e.JWT_SECRET !== e.JWT_REFRESH_SECRET, {
    error: 'JWT_SECRET y JWT_REFRESH_SECRET deben ser distintos',
    path: ['JWT_REFRESH_SECRET'],
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly problemas: string[]) {
    super(
      'Configuración de entorno inválida. La API no puede arrancar:\n' +
        problemas.map((p) => `  - ${p}`).join('\n')
    );
    this.name = 'EnvValidationError';
  }
}

/** Valida un conjunto de variables (por defecto `process.env`). Lanza `EnvValidationError`. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Tratar cadenas vacías como ausentes para que apliquen los mensajes de "obligatorio".
  const limpio = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== '')
  );
  const result = envSchema.safeParse(limpio);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues.map((i) => i.message));
  }
  return result.data;
}

let cached: Env | null = null;

/** Configuración validada (se calcula una vez). */
export function getEnv(): Env {
  if (!cached) {
    cached = loadEnv();
  }
  return cached;
}

/** Solo para tests: fuerza recalcular la configuración. */
export function resetEnvCache(): void {
  cached = null;
}
