import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { rutaPlantilla, PRISMA_CLI, SCHEMA_LOCAL, ROOT_DIR } from './sqliteTemplate.js';

/**
 * Crea (una vez por versión del esquema) una BD SQLite vacía con el esquema local,
 * que los tests de integración copian a una carpeta temporal. Nunca toca prisma/ferreteria.db.
 */
export default function setup(): void {
  const plantilla = rutaPlantilla();
  if (fs.existsSync(plantilla)) return;

  const temporal = `${plantilla}.${process.pid}.tmp`;
  const url = `file:${temporal.replace(/\\/g, '/')}`;
  const r = spawnSync(process.execPath, [PRISMA_CLI, 'db', 'push', '--schema', SCHEMA_LOCAL, '--skip-generate'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  });
  if (r.status !== 0) {
    throw new Error(`No se pudo crear la BD plantilla de tests:\n${r.stdout}\n${r.stderr}`);
  }
  fs.renameSync(temporal, plantilla);
}
