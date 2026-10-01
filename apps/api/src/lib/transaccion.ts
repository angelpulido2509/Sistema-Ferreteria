import type { Prisma } from '@prisma/client-local';
import { prisma, isCloudMode } from './prisma.js';

/** Esperas de las transacciones de escritura bajo contención. */
export const OPCIONES_TX = { maxWait: 10_000, timeout: 20_000 } as const;

let cola: Promise<unknown> = Promise.resolve();

/**
 * Ejecuta una transacción interactiva de ESCRITURA.
 *
 * En modo local (SQLite) las transacciones de escritura se encolan dentro del proceso:
 * SQLite admite un solo escritor, y varias transacciones interactivas simultáneas agotan los
 * hilos del motor de Prisma mientras esperan el bloqueo (la que lo tiene no puede ejecutar su
 * siguiente consulta hasta que vence socket_timeout). Encolarlas evita esa inanición y da un
 * orden estricto: p. ej. una venta que llega durante un cierre de turno espera a que el cierre
 * termine y luego encuentra el turno CERRADO.
 *
 * En modo nube (PostgreSQL) se ejecuta directamente: los bloqueos de fila bastan.
 */
export function transaccionEscritura<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const ejecutar = () => prisma.$transaction(fn, OPCIONES_TX);
  if (isCloudMode) {
    return ejecutar();
  }
  const resultado = cola.then(ejecutar, ejecutar);
  cola = resultado.catch(() => undefined);
  return resultado;
}
