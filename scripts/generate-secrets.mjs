#!/usr/bin/env node
/**
 * Genera secretos nuevos para el .env de FerrePro.
 *
 * Uso:  node scripts/generate-secrets.mjs
 *
 * - Solo IMPRIME los valores en la terminal para que los copies al .env raíz.
 *   No escribe ningún archivo.
 * - Se niega a correr en CI para que los valores no queden en logs.
 * - SYNC_API_KEY debe ser el MISMO en la PC local y en la API de la nube.
 * - Rotar JWT_SECRET / JWT_REFRESH_SECRET cierra todas las sesiones abiertas.
 */
import { randomBytes } from 'node:crypto';

if (process.env.CI) {
  console.error('generate-secrets: no se ejecuta en CI (los secretos quedarían en los logs).');
  process.exit(1);
}

const secret = () => randomBytes(48).toString('base64');

console.log('# Copia estas líneas en el .env de la raíz (reemplazando las anteriores):');
console.log(`JWT_SECRET="${secret()}"`);
console.log(`JWT_REFRESH_SECRET="${secret()}"`);
console.log(`SYNC_API_KEY="${secret()}"`);
console.log('# SYNC_API_KEY debe configurarse con el mismo valor en la API de la nube.');
