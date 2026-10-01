import { randomBytes } from 'node:crypto';

/**
 * Entorno de tests: secretos aleatorios generados en memoria en cada ejecución
 * (nunca valores fijos en el código). No se carga el .env real.
 */
const randomSecret = (): string => randomBytes(48).toString('base64');

process.env.DATABASE_URL ??= 'file:./test-no-usar.db';
process.env.JWT_SECRET ??= randomSecret();
process.env.JWT_REFRESH_SECRET ??= randomSecret();
process.env.SYNC_API_KEY ??= randomSecret();
