import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient as PrismaClientLocal } from '@prisma/client-local';
import { prisma, isCloudMode } from '../lib/prisma.js';
import { getEnv } from '../config/env.js';

export type MotivoBackup = 'arranque' | 'diario' | 'cierre-turno' | 'manual';

export interface BackupInfo {
  archivo: string;
  tamanoBytes: number;
  creadoEn: Date;
  motivo: string;
}

/** Subconjunto del cliente Prisma que usa el servicio (permite tests con una BD temporal). */
export interface SqlClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export interface BackupOptions {
  /** Carpeta destino. Si no se indica: BACKUP_DIR o <carpeta de la BD>/backups. */
  dir?: string;
  retencionDias?: number;
}

const PATRON_ARCHIVO = /^ferreteria-(\d{8}-\d{6}-\d{3})-([a-z-]+)\.db$/;
const UNA_HORA_MS = 60 * 60 * 1000;
const UN_DIA_MS = 24 * UNA_HORA_MS;

function sello(fecha: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return (
    `${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}-` +
    `${p(fecha.getHours())}${p(fecha.getMinutes())}${p(fecha.getSeconds())}-${p(fecha.getMilliseconds(), 3)}`
  );
}

/**
 * Respaldos consistentes de la BD SQLite local (D1):
 * - `VACUUM INTO` produce una copia consistente aun con la app en uso (WAL).
 * - Cada copia se verifica con `PRAGMA integrity_check`; si falla se elimina y se lanza error.
 * - Retención por antigüedad (30 días por defecto).
 * En modo nube (PostgreSQL) no aplica: los respaldos los gestiona el proveedor.
 */
export class BackupService {
  private timer: NodeJS.Timeout | null = null;
  private enCurso: Promise<BackupInfo> | null = null;

  constructor(
    private readonly client: SqlClient = prisma,
    private readonly options: BackupOptions = {}
  ) {}

  /** Activa WAL y synchronous=NORMAL: lecturas concurrentes y menos riesgo de corrupción. */
  public async activarWal(): Promise<string> {
    const filas = await this.client.$queryRawUnsafe<Array<{ journal_mode: string }>>('PRAGMA journal_mode=WAL;');
    await this.client.$queryRawUnsafe('PRAGMA synchronous=NORMAL;');
    return filas[0]?.journal_mode ?? 'desconocido';
  }

  /** Ruta absoluta del archivo principal de la BD abierta. */
  private async rutaBaseDatos(): Promise<string> {
    const filas = await this.client.$queryRawUnsafe<Array<{ name: string; file: string }>>('PRAGMA database_list;');
    const main = filas.find((f) => f.name === 'main');
    if (!main?.file) {
      throw new Error('No se pudo determinar el archivo de la base de datos');
    }
    return main.file;
  }

  public async directorio(): Promise<string> {
    if (this.options.dir) return this.options.dir;
    const configurado = getEnv().BACKUP_DIR;
    if (configurado) return path.resolve(configurado);
    return path.join(path.dirname(await this.rutaBaseDatos()), 'backups');
  }

  private retencionDias(): number {
    return this.options.retencionDias ?? getEnv().BACKUP_RETENTION_DAYS;
  }

  /** Crea, verifica y registra un respaldo. Las llamadas concurrentes se serializan. */
  public async crearBackup(motivo: MotivoBackup): Promise<BackupInfo> {
    const anterior = this.enCurso ?? Promise.resolve();
    const tarea = anterior.catch(() => undefined).then(() => this.ejecutarBackup(motivo));
    this.enCurso = tarea;
    try {
      return await tarea;
    } finally {
      if (this.enCurso === tarea) this.enCurso = null;
    }
  }

  private async ejecutarBackup(motivo: MotivoBackup): Promise<BackupInfo> {
    const dir = await this.directorio();
    await fs.mkdir(dir, { recursive: true });

    const ahora = new Date();
    const archivo = `ferreteria-${sello(ahora)}-${motivo}.db`;
    const destino = path.join(dir, archivo);

    // VACUUM INTO no admite parámetros enlazados en todas las versiones: se escapa la ruta.
    await this.client.$executeRawUnsafe(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);

    const resultado = await BackupService.verificarArchivo(destino);
    if (resultado !== 'ok') {
      await fs.rm(destino, { force: true });
      throw new Error(`El respaldo ${archivo} no pasó la verificación de integridad`);
    }

    await this.aplicarRetencion();
    const stat = await fs.stat(destino);
    console.log(`[Backup] ${archivo} creado y verificado (${stat.size} bytes)`);
    return { archivo, tamanoBytes: stat.size, creadoEn: ahora, motivo };
  }

  /** Abre el archivo como BD independiente y ejecuta PRAGMA integrity_check. */
  public static async verificarArchivo(ruta: string): Promise<string> {
    const verificador = new PrismaClientLocal({ datasourceUrl: `file:${ruta}` });
    try {
      const filas = await verificador.$queryRawUnsafe<Array<{ integrity_check: string }>>('PRAGMA integrity_check;');
      return filas.map((f) => f.integrity_check).join('; ');
    } finally {
      await verificador.$disconnect();
    }
  }

  /** Lista los respaldos del más reciente al más antiguo. */
  public async listar(): Promise<BackupInfo[]> {
    const dir = await this.directorio();
    let nombres: string[];
    try {
      nombres = await fs.readdir(dir);
    } catch {
      return [];
    }

    const backups: BackupInfo[] = [];
    for (const archivo of nombres) {
      const match = PATRON_ARCHIVO.exec(archivo);
      if (!match) continue;
      const stat = await fs.stat(path.join(dir, archivo));
      backups.push({ archivo, tamanoBytes: stat.size, creadoEn: stat.mtime, motivo: match[2]! });
    }
    return backups.sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());
  }

  /** Elimina los respaldos (solo los generados por este servicio) más antiguos que la retención. */
  public async aplicarRetencion(): Promise<number> {
    const limite = Date.now() - this.retencionDias() * UN_DIA_MS;
    const dir = await this.directorio();
    let eliminados = 0;
    for (const b of await this.listar()) {
      if (b.creadoEn.getTime() < limite) {
        await fs.rm(path.join(dir, b.archivo), { force: true });
        eliminados++;
      }
    }
    return eliminados;
  }

  /** Versión que nunca lanza: para disparadores automáticos (arranque, cierre de turno, diario). */
  public async crearBackupSeguro(motivo: MotivoBackup): Promise<BackupInfo | null> {
    try {
      return await this.crearBackup(motivo);
    } catch (error) {
      console.error(`[Backup] Falló el respaldo (${motivo}):`, error);
      return null;
    }
  }

  /**
   * Al arrancar: WAL + respaldo inmediato. Luego revisa cada hora y crea el respaldo
   * diario si el último tiene más de 24 h.
   */
  public async iniciar(): Promise<void> {
    if (isCloudMode) return;
    try {
      const modo = await this.activarWal();
      console.log(`[Backup] SQLite journal_mode=${modo}`);
    } catch (error) {
      console.error('[Backup] No se pudo activar WAL:', error);
    }

    await this.crearBackupSeguro('arranque');

    this.timer = setInterval(async () => {
      const [ultimo] = await this.listar().catch(() => []);
      if (!ultimo || Date.now() - ultimo.creadoEn.getTime() >= UN_DIA_MS) {
        await this.crearBackupSeguro('diario');
      }
    }, UNA_HORA_MS);
    this.timer.unref();
  }

  public detener(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const backupService = new BackupService();
