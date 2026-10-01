#!/usr/bin/env node
/**
 * Aplica prisma/migraciones-local/20261001_fase1.sql a una BD SQLite local, con:
 *   1. Respaldo consistente previo (VACUUM INTO) en prisma/backups/ (o BACKUP_DIR).
 *   2. Comprobación de que no esté ya aplicada.
 *   3. Guarda: si hay ventas sin turno, se detiene SIN cambiar nada y las lista.
 *      Las ventas reales nunca se borran (addendum §5); se decide caso por caso.
 *   4. Ejecución del SQL (una transacción) con `prisma db execute`.
 *   5. Verificación: integrity_check, foreign_key_check, esquema == schema.local.prisma
 *      y conteos de filas antes/después.
 *
 * Uso:  node scripts/migrar-fase1.mjs [ruta/a/ferreteria.db] [--historicas-son-prueba]
 *   --historicas-son-prueba  el dueño confirmó que TODAS las ventas existentes son de prueba:
 *                            se migran con esPrueba = true y serie T001 (N001 y F001 quedan en 0).
 *                            Sin el flag: esPrueba = false y serie N001.
 * Detener la API antes de ejecutarlo.
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { PrismaClient } = require(path.join(ROOT, 'node_modules/@prisma/client-local'));

const args = process.argv.slice(2);
const historicasSonPrueba = args.includes('--historicas-son-prueba');
const posicional = args.find((a) => !a.startsWith('--'));
const dbPath = path.resolve(posicional ?? path.join(ROOT, 'prisma/ferreteria.db'));
const SERIE_HISTORICA = historicasSonPrueba ? 'T001' : 'N001';
const sqlPath = path.join(ROOT, 'prisma/migraciones-local/20261001_fase1.sql');
const schemaPath = path.join(ROOT, 'prisma/schema.local.prisma');
const prismaCli = path.join(ROOT, 'node_modules/prisma/build/index.js');
const url = `file:${dbPath.replace(/\\/g, '/')}`;
const TABLAS = ['usuarios', 'productos', 'clientes', 'ventas', 'detalles_venta', 'pagos_venta',
  'movimientos_inventario', 'turnos_caja', 'movimientos_caja', 'configuracion', 'sync_queue'];
const NUEVAS = ['secuencias_documento', 'auditoria_eventos'];

const fallar = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };
if (!fs.existsSync(dbPath)) fallar(`No existe la BD: ${dbPath}`);

const num = (v) => Number(v);
const db = new PrismaClient({ datasourceUrl: url });
const q = (sql) => db.$queryRawUnsafe(sql);

async function conteos() {
  const r = {};
  for (const t of TABLAS) r[t] = num((await q(`SELECT COUNT(*) AS n FROM "${t}"`))[0].n);
  return r;
}

try {
  // 2. ¿Ya aplicada?
  const yaAplicada = await q(`SELECT name FROM sqlite_master WHERE type='table' AND name='secuencias_documento'`);
  if (yaAplicada.length > 0) fallar('La migración Fase 1 ya está aplicada en esta BD (existe secuencias_documento).');

  // 3. Ventas sin turno: detenerse sin tocar nada
  const sinTurno = await q(`SELECT id, fecha, estado, CAST(totalUsd AS TEXT) AS totalUsd FROM ventas WHERE turnoCajaId IS NULL`);
  if (sinTurno.length > 0) {
    console.error(`⚠ Hay ${sinTurno.length} ventas sin turno de caja. No se aplicó nada:`);
    for (const v of sinTurno) console.error(`   - ${v.id}  ${new Date(num(v.fecha)).toISOString()}  ${v.estado}  USD ${v.totalUsd}`);
    fallar('Resuelve estas ventas (asignar turno o anular) antes de migrar. Las ventas reales no se borran.');
  }
  console.log('✔ No hay ventas sin turno.');

  // 1. Respaldo previo
  const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(path.dirname(dbPath), 'backups'));
  fs.mkdirSync(backupDir, { recursive: true });
  const sello = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const backup = path.join(backupDir, `ferreteria-${sello}-000-pre-fase1.db`);
  await db.$executeRawUnsafe(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
  const integridadBackup = new PrismaClient({ datasourceUrl: `file:${backup.replace(/\\/g, '/')}` });
  const okBackup = (await integridadBackup.$queryRawUnsafe('PRAGMA integrity_check'))[0].integrity_check;
  await integridadBackup.$disconnect();
  if (okBackup !== 'ok') fallar(`El respaldo previo no pasó integrity_check: ${okBackup}`);
  console.log(`✔ Respaldo previo verificado: ${backup}`);

  const antes = await conteos();
  await db.$disconnect();

  // 4. Aplicar (sustituyendo los marcadores del SQL)
  const sqlFinal = fs.readFileSync(sqlPath, 'utf8')
    .replaceAll('{{ES_PRUEBA}}', historicasSonPrueba ? '1' : '0')
    .replaceAll('{{SERIE_HISTORICA}}', `'${SERIE_HISTORICA}'`);
  if (sqlFinal.includes('{{')) fallar('Quedaron marcadores sin sustituir en el SQL');
  const sqlTemporal = path.join(os.tmpdir(), `ferrepro-fase1-${process.pid}.sql`);
  fs.writeFileSync(sqlTemporal, sqlFinal);
  console.log(`  ventas históricas: ${historicasSonPrueba ? 'DE PRUEBA (esPrueba = true, serie T001)' : 'reales (serie N001)'}`);
  const r = spawnSync(process.execPath, [prismaCli, 'db', 'execute', '--url', url, '--file', sqlTemporal], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, DATABASE_URL: url },
  });
  fs.rmSync(sqlTemporal, { force: true });
  if (r.status !== 0) {
    fallar(`prisma db execute falló (la transacción se revierte; respaldo en ${backup}):\n${r.stdout}\n${r.stderr}`);
  }
  console.log('✔ SQL aplicado');

  // 5. Verificar
  const db2 = new PrismaClient({ datasourceUrl: url });
  const integridad = (await db2.$queryRawUnsafe('PRAGMA integrity_check'))[0].integrity_check;
  const fks = await db2.$queryRawUnsafe('PRAGMA foreign_key_check');
  const despues = {};
  for (const t of TABLAS) despues[t] = num((await db2.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM "${t}"`))[0].n);
  const secuencia = await db2.$queryRawUnsafe(`SELECT serie, ultimoNumero FROM secuencias_documento ORDER BY serie`);
  const anuladas = num((await db2.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM ventas WHERE estado = 'ANULADA'`))[0].n);
  const eventos = num((await db2.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM auditoria_eventos WHERE accion = 'ANULAR'`))[0].n);
  const marcadasPrueba = num((await db2.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM ventas WHERE esPrueba = 1`))[0].n);
  const fueraDeSerie = num((await db2.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM ventas WHERE numero NOT LIKE '${SERIE_HISTORICA}-%'`))[0].n);
  const stockPruebas = historicasSonPrueba ? await db2.$queryRawUnsafe(`
    SELECT p.codigo, p.nombre, SUM(d.cantidad) AS cantidad
      FROM detalles_venta d JOIN ventas v ON v.id = d.ventaId JOIN productos p ON p.id = d.productoId
     WHERE v.esPrueba = 1 AND v.estado = 'COMPLETADA'
     GROUP BY p.id ORDER BY p.codigo`) : [];
  const nuevas = {};
  for (const t of NUEVAS) nuevas[t] = num((await db2.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM "${t}"`))[0].n);
  const sinNumero = num((await db2.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM ventas WHERE numero IS NULL`))[0].n);
  await db2.$disconnect();

  const diff = spawnSync(process.execPath, [prismaCli, 'migrate', 'diff', '--from-url', url,
    '--to-schema-datamodel', schemaPath, '--exit-code'], { cwd: ROOT, encoding: 'utf8' });

  console.log(`  integrity_check: ${integridad}`);
  console.log(`  foreign_key_check: ${fks.length === 0 ? 'sin violaciones' : JSON.stringify(fks)}`);
  console.log(`  esquema vs schema.local.prisma: ${diff.status === 0 ? 'idéntico' : 'DIFERENTE\n' + diff.stdout}`);
  console.log(`  secuencia: ${JSON.stringify(secuencia.map((s) => ({ serie: s.serie, ultimoNumero: num(s.ultimoNumero) })))}`);
  console.log(`  ventas sin número: ${sinNumero}`);
  console.log(`  eventos de auditoría ANULAR: ${eventos} (ventas anuladas: ${anuladas})`);
  console.log(`  tablas nuevas: ${JSON.stringify(nuevas)}`);
  console.log(`  ventas marcadas de prueba: ${marcadasPrueba}; fuera de la serie ${SERIE_HISTORICA}: ${fueraDeSerie}`);
  if (stockPruebas.length > 0) {
    console.log('  ⚠ Stock real descontado por ventas de PRUEBA completadas (NO revertido; lo hará la purga de pruebas):');
    for (const s of stockPruebas) console.log(`     ${s.codigo}  ${s.nombre}: ${num(s.cantidad)}`);
  }
  console.log('  filas (antes -> después):');
  let conteosOk = true;
  for (const t of TABLAS) {
    const ok = despues[t] === antes[t];
    if (!ok) conteosOk = false;
    console.log(`    ${ok ? ' ' : '✗'} ${t}: ${antes[t]} -> ${despues[t]}`);
  }

  if (integridad !== 'ok' || fks.length > 0 || diff.status !== 0 || sinNumero > 0 || !conteosOk || eventos > anuladas
      || fueraDeSerie > 0 || marcadasPrueba !== (historicasSonPrueba ? despues.ventas : 0)) {
    fallar(`La verificación falló. Restaura el respaldo: ${backup}`);
  }
  console.log('🎉 Migración Fase 1 aplicada y verificada.');
} catch (e) {
  fallar(String(e?.stack ?? e));
}
