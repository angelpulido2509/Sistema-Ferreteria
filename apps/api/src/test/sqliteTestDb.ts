import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { rutaPlantilla } from './sqliteTemplate.js';

/**
 * Prepara una BD SQLite temporal (copia de la plantilla) y apunta DATABASE_URL a ella.
 * Debe llamarse ANTES de importar dinámicamente cualquier módulo que use lib/prisma.ts.
 */
export async function prepararBdPrueba(): Promise<{ url: string; limpiar: () => Promise<void> }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ferrepro-it-'));
  const archivo = path.join(dir, 'test.db');
  await fs.copyFile(rutaPlantilla(), archivo);
  // connection_limit=1 + busy timeout: las transacciones se serializan como en la app real (SQLite).
  const url = `file:${archivo.replace(/\\/g, '/')}?connection_limit=1&socket_timeout=20`;
  process.env.DATABASE_URL = url;
  // lib/prisma.ts cachea el cliente en globalThis fuera de producción: forzar uno nuevo.
  delete (globalThis as { prisma?: unknown }).prisma;
  return {
    url,
    limpiar: async () => {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}
