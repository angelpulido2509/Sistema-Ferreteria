import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ROOT_DIR = path.resolve(API_DIR, '../..');
export const SCHEMA_LOCAL = path.join(ROOT_DIR, 'prisma/schema.local.prisma');
export const PRISMA_CLI = path.join(ROOT_DIR, 'node_modules/prisma/build/index.js');

/**
 * Ruta de la BD plantilla para tests de integración. Depende del contenido del esquema:
 * si el esquema cambia, se crea una plantilla nueva.
 */
export function rutaPlantilla(): string {
  const hash = createHash('sha256').update(fs.readFileSync(SCHEMA_LOCAL)).digest('hex').slice(0, 12);
  return path.join(os.tmpdir(), `ferrepro-test-plantilla-${hash}.db`);
}
