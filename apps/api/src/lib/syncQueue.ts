import { prisma, isCloudMode } from './prisma.js';
import { OperacionSync } from '@ferreteria/shared';

/**
 * Registra un cambio en la tabla local SyncQueue (patrón Outbox).
 * Si la app se ejecuta en modo 'cloud', esta función no hace nada.
 */
export async function registrarSync(
  entidad: string,
  entidadId: string,
  operacion: OperacionSync,
  payload: Record<string, unknown>,
  tx?: any
): Promise<void> {
  if (isCloudMode) {
    return;
  }

  const client = tx ?? prisma;
  if (!client.syncQueue) {
    return;
  }

  try {
    await client.syncQueue.create({
      data: {
        entidad,
        entidadId,
        operacion,
        payload: JSON.stringify(payload),
      },
    });
  } catch (error) {
    console.error(`[SyncQueue] Error al registrar ${operacion} de ${entidad} (${entidadId}):`, error);
  }
}
