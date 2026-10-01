import { prisma, isCloudMode } from '../lib/prisma.js';
import { EstadoSync, OperacionSync, type SyncStatusDTO, type SyncPushItemDTO } from '@ferreteria/shared';
import { Prisma } from '@prisma/client-local';

export class SyncService {
  private isSyncing = false;
  private syncTimer: NodeJS.Timeout | null = null;

  public startBackgroundWorker(intervalMs = 15000): void {
    if (isCloudMode) {
      // En la nube no corre el worker de salida (la nube es receptora)
      return;
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    console.log(`[SyncWorker] Iniciado worker de sincronización cada ${intervalMs / 1000}s`);

    this.syncTimer = setInterval(async () => {
      try {
        await this.sincronizarPendientes();
      } catch (error) {
        console.error('[SyncWorker] Error en ciclo de sincronización:', error);
      }
    }, intervalMs);
  }

  public stopBackgroundWorker(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Verifica conectividad real contra la API en la nube
   */
  public async verificarConectividadNube(): Promise<boolean> {
    const cloudUrl = process.env.CLOUD_API_URL;

    if (!cloudUrl) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${cloudUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Procesa la cola local de SyncQueue y envía los cambios pendientes a la nube
   */
  public async sincronizarPendientes(): Promise<{ procesados: number; exitosos: number; fallidos: number }> {
    if (isCloudMode || this.isSyncing) {
      return { procesados: 0, exitosos: 0, fallidos: 0 };
    }

    const cloudUrl = process.env.CLOUD_API_URL;
    const syncApiKey = process.env.SYNC_API_KEY || 'ferrepro_local_sync_key_2024';

    if (!cloudUrl) {
      return { procesados: 0, exitosos: 0, fallidos: 0 };
    }

    // 1. Verificar conectividad real
    const online = await this.verificarConectividadNube();
    if (!online) {
      return { procesados: 0, exitosos: 0, fallidos: 0 };
    }

    this.isSyncing = true;
    let procesados = 0;
    let exitosos = 0;
    let fallidos = 0;

    try {
      // 2. Obtener elementos pendientes ordenados cronológicamente
      const pendientes = await prisma.syncQueue.findMany({
        where: { estado: EstadoSync.PENDIENTE },
        orderBy: { creadoEn: 'asc' },
        take: 50,
      });

      if (pendientes.length === 0) {
        return { procesados: 0, exitosos: 0, fallidos: 0 };
      }

      procesados = pendientes.length;

      // 3. Preparar lote
      const itemsPayload: SyncPushItemDTO[] = pendientes.map((p) => ({
        entidad: p.entidad,
        entidadId: p.entidadId,
        operacion: p.operacion as OperacionSync,
        payload: JSON.parse(p.payload),
      }));

      // 4. Enviar a la nube
      const response = await fetch(`${cloudUrl}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-api-key': syncApiKey,
        },
        body: JSON.stringify({ items: itemsPayload }),
      });

      if (response.ok) {
        // Marcar todos como sincronizados
        const now = new Date();
        for (const item of pendientes) {
          await prisma.syncQueue.update({
            where: { id: item.id },
            data: {
              estado: EstadoSync.SINCRONIZADO,
              sincronizadoEn: now,
              ultimoError: null,
            },
          });
          exitosos++;
        }
      } else {
        const errorText = await response.text();
        for (const item of pendientes) {
          const nuevosIntentos = item.intentos + 1;
          const nuevoEstado = nuevosIntentos >= 5 ? EstadoSync.ERROR : EstadoSync.PENDIENTE;

          await prisma.syncQueue.update({
            where: { id: item.id },
            data: {
              intentos: nuevosIntentos,
              estado: nuevoEstado,
              ultimoError: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
            },
          });
          fallidos++;
        }
      }
    } catch (error) {
      console.error('[SyncWorker] Error enviando lote a la nube:', error);
    } finally {
      this.isSyncing = false;
    }

    return { procesados, exitosos, fallidos };
  }

  /**
   * Endpoint receptor en la nube (idempotente vía upsert)
   */
  public async aplicarSyncPush(items: SyncPushItemDTO[]): Promise<{ aplicados: number }> {
    let aplicados = 0;

    for (const item of items) {
      try {
        await this.aplicarItem(item);
        aplicados++;
      } catch (error) {
        console.error(`[SyncReceiver] Error aplicando ${item.operacion} en ${item.entidad} (${item.entidadId}):`, error);
        throw error;
      }
    }

    return { aplicados };
  }

  private async aplicarItem(item: SyncPushItemDTO): Promise<void> {
    const { entidad, entidadId, operacion, payload } = item;

    switch (entidad) {
      case 'Categoria': {
        if (operacion === OperacionSync.ELIMINAR) {
          await prisma.categoria.deleteMany({ where: { id: entidadId } });
        } else {
          const nombre = (payload.nombre as string) || '';
          await prisma.categoria.upsert({
            where: { id: entidadId },
            update: { nombre },
            create: { id: entidadId, nombre },
          });
        }
        break;
      }

      case 'Cliente': {
        if (operacion === OperacionSync.ELIMINAR) {
          await prisma.cliente.deleteMany({ where: { id: entidadId } });
        } else {
          const data = {
            nombre: payload.nombre as string,
            identificacion: payload.identificacion as string,
            telefono: (payload.telefono as string) || null,
            correo: (payload.correo as string) || null,
            direccion: (payload.direccion as string) || null,
          };
          await prisma.cliente.upsert({
            where: { id: entidadId },
            update: data,
            create: { id: entidadId, ...data },
          });
        }
        break;
      }

      case 'Proveedor': {
        if (operacion === OperacionSync.ELIMINAR) {
          await prisma.proveedor.deleteMany({ where: { id: entidadId } });
        } else {
          const data = {
            nombre: payload.nombre as string,
            rif: payload.rif as string,
            telefono: (payload.telefono as string) || null,
            correo: (payload.correo as string) || null,
            direccion: (payload.direccion as string) || null,
            activo: payload.activo !== false,
          };
          await prisma.proveedor.upsert({
            where: { id: entidadId },
            update: data,
            create: { id: entidadId, ...data },
          });
        }
        break;
      }

      case 'Producto': {
        if (operacion === OperacionSync.ELIMINAR) {
          await prisma.producto.updateMany({
            where: { id: entidadId },
            data: { activo: false },
          });
        } else {
          const data = {
            codigo: payload.codigo as string,
            nombre: payload.nombre as string,
            descripcion: (payload.descripcion as string) || null,
            categoriaId: payload.categoriaId as string,
            precioCompra: new Prisma.Decimal(payload.precioCompra as any),
            precioVenta: new Prisma.Decimal(payload.precioVenta as any),
            stockActual: Number(payload.stockActual ?? 0),
            stockMinimo: Number(payload.stockMinimo ?? 5),
            unidadMedida: (payload.unidadMedida as string) || 'UND',
            activo: payload.activo !== false,
          };
          await prisma.producto.upsert({
            where: { id: entidadId },
            update: data,
            create: { id: entidadId, ...data },
          });
        }
        break;
      }

      case 'Usuario': {
        const data = {
          nombre: payload.nombre as string,
          email: payload.email as string,
          passwordHash: payload.passwordHash as string,
          rol: payload.rol as any,
          activo: payload.activo !== false,
        };
        await prisma.usuario.upsert({
          where: { id: entidadId },
          update: data,
          create: { id: entidadId, ...data },
        });
        break;
      }

      case 'Venta': {
        const subtotal = new Prisma.Decimal(payload.subtotal as any);
        const impuesto = new Prisma.Decimal(payload.impuesto as any);
        const total = new Prisma.Decimal(payload.total as any);
        const totalUsd = new Prisma.Decimal((payload.totalUsd ?? payload.total) as any);

        const ventaData = {
          clienteId: payload.clienteId as string,
          usuarioId: payload.usuarioId as string,
          fecha: new Date(payload.fecha as string),
          subtotal,
          impuesto,
          total,
          monedaFuncional: (payload.monedaFuncional as any) || 'USD',
          totalUsd,
          estado: payload.estado as any,
        };

        const venta = await prisma.venta.upsert({
          where: { id: entidadId },
          update: ventaData,
          create: { id: entidadId, ...ventaData },
        });

        // Sincronizar detalles si vienen en el payload
        if (Array.isArray(payload.detalles)) {
          for (const det of payload.detalles) {
            const detId = det.id || `${entidadId}_${det.productoId}`;
            await prisma.detalleVenta.upsert({
              where: { id: detId },
              update: {
                cantidad: det.cantidad,
                precioUnitario: new Prisma.Decimal(det.precioUnitario),
                subtotalLinea: new Prisma.Decimal(det.subtotalLinea),
              },
              create: {
                id: detId,
                ventaId: venta.id,
                productoId: det.productoId,
                cantidad: det.cantidad,
                precioUnitario: new Prisma.Decimal(det.precioUnitario),
                subtotalLinea: new Prisma.Decimal(det.subtotalLinea),
              },
            });
          }
        }

        // Sincronizar pagos si vienen en el payload
        if (Array.isArray(payload.pagos)) {
          for (const pago of payload.pagos) {
            const pagoId = pago.id || `${entidadId}_pago_${pago.metodoPago}`;
            await prisma.pagoVenta.upsert({
              where: { id: pagoId },
              update: {
                metodoPago: pago.metodoPago,
                moneda: pago.moneda,
                montoMoneda: new Prisma.Decimal(pago.montoMoneda),
                tasaAplicada: new Prisma.Decimal(pago.tasaAplicada),
                montoUsd: new Prisma.Decimal(pago.montoUsd),
                referencia: pago.referencia || null,
              },
              create: {
                id: pagoId,
                ventaId: venta.id,
                metodoPago: pago.metodoPago,
                moneda: pago.moneda,
                montoMoneda: new Prisma.Decimal(pago.montoMoneda),
                tasaAplicada: new Prisma.Decimal(pago.tasaAplicada),
                montoUsd: new Prisma.Decimal(pago.montoUsd),
                referencia: pago.referencia || null,
              },
            });
          }
        }
        break;
      }

      case 'Configuracion': {
        const configData: any = {
          nombreFerreteria: payload.nombreFerreteria as string,
          rif: payload.rif as string,
          direccion: payload.direccion as string,
          telefono: payload.telefono as string,
          ivaPorcentaje: new Prisma.Decimal((payload.ivaPorcentaje as any) ?? 16.0),
          stockMinimoAlerta: Number(payload.stockMinimoAlerta ?? 5),
          monedaFuncional: (payload.monedaFuncional as any) || 'USD',
          tasaVes: new Prisma.Decimal((payload.tasaVes as any) ?? 60.0),
          tasaCop: new Prisma.Decimal((payload.tasaCop as any) ?? 4100.0),
          metodosHabilitados: payload.metodosHabilitados as any,
        };
        await prisma.configuracion.upsert({
          where: { id: entidadId },
          update: configData,
          create: { id: entidadId, ...configData },
        });
        break;
      }
    }
  }

  /**
   * Obtiene el estado actual de sincronización para el panel de Gestión
   */
  public async getStatus(): Promise<SyncStatusDTO> {
    if (isCloudMode) {
      return {
        conectado: true,
        pendientes: 0,
        errores: 0,
        ultimaSincronizacion: new Date(),
      };
    }

    const conectado = await this.verificarConectividadNube();
    const pendientes = await prisma.syncQueue.count({
      where: { estado: EstadoSync.PENDIENTE },
    });
    const errores = await prisma.syncQueue.count({
      where: { estado: EstadoSync.ERROR },
    });

    const ultimoSincronizado = await prisma.syncQueue.findFirst({
      where: { estado: EstadoSync.SINCRONIZADO },
      orderBy: { sincronizadoEn: 'desc' },
      select: { sincronizadoEn: true },
    });

    const erroresDetallados = await prisma.syncQueue.findMany({
      where: { estado: EstadoSync.ERROR },
      select: {
        id: true,
        entidad: true,
        entidadId: true,
        ultimoError: true,
        intentos: true,
      },
      take: 10,
    });

    return {
      conectado,
      pendientes,
      errores,
      ultimaSincronizacion: ultimoSincronizado?.sincronizadoEn ?? null,
      detallesErrores: erroresDetallados,
    };
  }
}

export const syncService = new SyncService();
