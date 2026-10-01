import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client-local';
import { BackupService } from './backup.service.js';

/**
 * Prueba de integración contra SQLite real en una carpeta temporal:
 * nunca toca prisma/ferreteria.db.
 */
describe('BackupService (D1)', () => {
  let tmp: string;
  let origen: PrismaClient;
  let service: BackupService;
  let backupsDir: string;

  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ferrepro-backup-test-'));
    backupsDir = path.join(tmp, 'respaldos');
    origen = new PrismaClient({ datasourceUrl: `file:${path.join(tmp, 'origen.db')}` });
    await origen.$executeRawUnsafe('CREATE TABLE ventas_prueba (id INTEGER PRIMARY KEY, total TEXT NOT NULL)');
    for (let i = 1; i <= 25; i++) {
      await origen.$executeRawUnsafe(`INSERT INTO ventas_prueba (total) VALUES ('${i}.50')`);
    }
    service = new BackupService(origen, { dir: backupsDir, retencionDias: 30 });
  });

  afterAll(async () => {
    await origen.$disconnect();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('activa WAL en la BD', async () => {
    expect(await service.activarWal()).toBe('wal');
  });

  it('crea un respaldo verificado y se puede restaurar en una BD temporal', async () => {
    const info = await service.crearBackup('manual');
    expect(info.archivo).toMatch(/^ferreteria-\d{8}-\d{6}-\d{3}-manual\.db$/);
    expect(info.tamanoBytes).toBeGreaterThan(0);

    const rutaBackup = path.join(backupsDir, info.archivo);
    expect(await BackupService.verificarArchivo(rutaBackup)).toBe('ok');

    // Restauración: copiar el respaldo a otra ubicación y abrirlo como BD independiente.
    const restaurada = path.join(tmp, 'restaurada.db');
    await fs.copyFile(rutaBackup, restaurada);
    const cliente = new PrismaClient({ datasourceUrl: `file:${restaurada}` });
    try {
      const filas = await cliente.$queryRawUnsafe<Array<{ n: bigint; suma: number }>>(
        'SELECT COUNT(*) AS n, SUM(CAST(total AS REAL)) AS suma FROM ventas_prueba'
      );
      expect(Number(filas[0]!.n)).toBe(25);
      expect(filas[0]!.suma).toBeCloseTo(337.5);
    } finally {
      await cliente.$disconnect();
    }
  });

  it('el respaldo refleja los datos escritos en WAL antes de copiar', async () => {
    await origen.$executeRawUnsafe("INSERT INTO ventas_prueba (total) VALUES ('99.99')");
    const info = await service.crearBackup('cierre-turno');
    const cliente = new PrismaClient({ datasourceUrl: `file:${path.join(backupsDir, info.archivo)}` });
    try {
      const filas = await cliente.$queryRawUnsafe<Array<{ n: bigint }>>('SELECT COUNT(*) AS n FROM ventas_prueba');
      expect(Number(filas[0]!.n)).toBe(26);
    } finally {
      await cliente.$disconnect();
    }
  });

  it('lista los respaldos del más reciente al más antiguo', async () => {
    const lista = await service.listar();
    expect(lista.length).toBeGreaterThanOrEqual(2);
    expect(lista[0]!.motivo).toBe('cierre-turno');
    expect(lista[0]!.creadoEn.getTime()).toBeGreaterThanOrEqual(lista[1]!.creadoEn.getTime());
  });

  it('detecta un archivo corrupto', async () => {
    const corrupto = path.join(tmp, 'corrupto.db');
    const [ultimo] = await service.listar();
    const bytes = await fs.readFile(path.join(backupsDir, ultimo!.archivo));
    bytes.fill(0x41, 4096, Math.min(bytes.length, 8192)); // pisa la página de la tabla
    await fs.writeFile(corrupto, bytes);
    let resultado: string;
    try {
      resultado = await BackupService.verificarArchivo(corrupto);
    } catch {
      resultado = 'error al abrir';
    }
    expect(resultado).not.toBe('ok');
  });

  it('si la verificación falla, elimina la copia y lanza error', async () => {
    const spy = vi.spyOn(BackupService, 'verificarArchivo').mockResolvedValueOnce('*** in database main *** Page 2: corrupto');
    const antes = (await service.listar()).length;
    await expect(service.crearBackup('manual')).rejects.toThrow(/no pasó la verificación/);
    expect((await service.listar()).length).toBe(antes);
    spy.mockRestore();
  });

  it('aplica la retención de 30 días solo a los archivos del servicio', async () => {
    const viejo = path.join(backupsDir, 'ferreteria-20200101-000000-000-diario.db');
    const ajeno = path.join(backupsDir, 'no-es-un-backup.db');
    await fs.writeFile(viejo, 'x');
    await fs.writeFile(ajeno, 'x');
    const hace31Dias = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await fs.utimes(viejo, hace31Dias, hace31Dias);
    await fs.utimes(ajeno, hace31Dias, hace31Dias);

    expect(await service.aplicarRetencion()).toBe(1);
    await expect(fs.access(viejo)).rejects.toThrow();
    await expect(fs.access(ajeno)).resolves.toBeUndefined();
    expect((await service.listar()).length).toBeGreaterThanOrEqual(2);
  });
});
