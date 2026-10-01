import { useEffect, useState } from 'react';
import { offlineDb, type VentaOffline } from './offlineDb';
import { api } from './api';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  lastError: string | null;
}

type SyncListener = (status: SyncStatus) => void;

class SyncManager {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private pendingCount: number = 0;
  private lastSyncTime: Date | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private checkIntervalId: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));

      // Inicializar conteo de pendientes
      this.refreshPendingCount();

      // Intervalo de health check cada 30 segundos si se cree online
      this.checkIntervalId = window.setInterval(() => {
        if (navigator.onLine) {
          this.verificarConectividadReal();
        }
      }, 30000);
    }
  }

  public getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
    };
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((l) => l(status));
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      const pending = await offlineDb.obtenerVentasPendientes();
      this.pendingCount = pending.length;
      this.notify();
      return this.pendingCount;
    } catch (_err) {
      return this.pendingCount;
    }
  }

  private async handleNetworkChange(online: boolean) {
    this.isOnline = online;
    this.notify();

    if (online) {
      // Verificar conectividad real antes de sincronizar
      const real = await this.verificarConectividadReal();
      if (real) {
        await this.sincronizarVentasPendientes();
      }
    }
  }

  public async verificarConectividadReal(): Promise<boolean> {
    try {
      // Ping ligero al backend
      const res = await fetch('/api/configuracion', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const actuallyOnline = res.status < 500;
      if (this.isOnline !== actuallyOnline) {
        this.isOnline = actuallyOnline;
        this.notify();
      }
      return actuallyOnline;
    } catch (_err) {
      if (this.isOnline) {
        this.isOnline = false;
        this.notify();
      }
      return false;
    }
  }

  public async sincronizarVentasPendientes(): Promise<{
    exitosas: number;
    fallidas: number;
  }> {
    if (this.isSyncing) {
      return { exitosas: 0, fallidas: 0 };
    }

    const ventas: VentaOffline[] = await offlineDb.obtenerVentasPendientes();
    if (ventas.length === 0) {
      this.pendingCount = 0;
      this.notify();
      return { exitosas: 0, fallidas: 0 };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    let exitosas = 0;
    let fallidas = 0;

    for (const v of ventas) {
      try {
        await api.crearVenta({
          clienteId: v.clienteId,
          items: v.items.map((i) => ({
            productoId: i.productoId,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
          })),
          porcentajeImpuesto: v.porcentajeImpuesto,
          monedaFuncional: v.monedaFuncional,
          pagos: v.pagos,
        });

        // Venta creada exitosamente en backend: remover de la cola local
        await offlineDb.eliminarVentaPendiente(v.idLocal);
        exitosas++;
      } catch (err) {
        fallidas++;
        const msg = err instanceof Error ? err.message : 'Error desconocido de red';
        this.lastError = msg;
        await offlineDb.registrarFalloSincronizacion(v.idLocal, msg);
        // Si hay error de red, abortamos el resto de la cola para reintentar luego
        break;
      }
    }

    this.isSyncing = false;
    this.lastSyncTime = new Date();
    await this.refreshPendingCount();

    return { exitosas, fallidas };
  }

  public destroy() {
    if (this.checkIntervalId !== null) {
      clearInterval(this.checkIntervalId);
    }
  }
}

export const syncManager = new SyncManager();

/**
 * Hook de React para escuchar el estado de sincronización y conectividad
 */
export function useSyncStatus(): SyncStatus & {
  sincronizarAhora: () => Promise<{ exitosas: number; fallidas: number }>;
} {
  const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());

  useEffect(() => {
    return syncManager.subscribe((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  return {
    ...status,
    sincronizarAhora: () => syncManager.sincronizarVentasPendientes(),
  };
}
