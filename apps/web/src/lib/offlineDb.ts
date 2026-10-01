import {
  type ProductoDTO,
  type ConfiguracionDTO,
  type PagoVentaDTO,
  Moneda,
} from '@ferreteria/shared';

export interface VentaOffline {
  idLocal: string; // ej: 'OFF-1726789ABC'
  clienteId: string;
  clienteNombre?: string;
  clienteIdentificacion?: string;
  items: Array<{
    productoId: string;
    cantidad: number;
    precioUnitario: number;
    productoNombre?: string;
  }>;
  porcentajeImpuesto: number;
  monedaFuncional: Moneda;
  subtotal: number;
  impuesto: number;
  total: number;
  totalUsd: number;
  pagos: PagoVentaDTO[];
  fecha: string;
  intentos: number;
  errorSincronizacion?: string;
  createdAt: string;
}

const DB_NAME = 'FerrePro_OfflineDB_v1';
const DB_VERSION = 1;

const STORES = {
  VENTAS_PENDIENTES: 'ventas_pendientes',
  CATALOGO_CACHE: 'catalogo_cache',
  CONFIG_CACHE: 'config_cache',
} as const;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no está soportado en este entorno'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.VENTAS_PENDIENTES)) {
        db.createObjectStore(STORES.VENTAS_PENDIENTES, { keyPath: 'idLocal' });
      }

      if (!db.objectStoreNames.contains(STORES.CATALOGO_CACHE)) {
        db.createObjectStore(STORES.CATALOGO_CACHE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.CONFIG_CACHE)) {
        db.createObjectStore(STORES.CONFIG_CACHE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Error al abrir IndexedDB'));
  });
}

export const offlineDb = {
  // === VENTAS PENDIENTES (COLA OFFLINE) ===
  async guardarVentaOffline(venta: VentaOffline): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.VENTAS_PENDIENTES, 'readwrite');
      const store = tx.objectStore(STORES.VENTAS_PENDIENTES);
      const req = store.put(venta);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async obtenerVentasPendientes(): Promise<VentaOffline[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.VENTAS_PENDIENTES, 'readonly');
      const store = tx.objectStore(STORES.VENTAS_PENDIENTES);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result as VentaOffline[]) || [];
        // Orden cronológico (FIFO)
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async eliminarVentaPendiente(idLocal: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.VENTAS_PENDIENTES, 'readwrite');
      const store = tx.objectStore(STORES.VENTAS_PENDIENTES);
      const req = store.delete(idLocal);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async registrarFalloSincronizacion(idLocal: string, error: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.VENTAS_PENDIENTES, 'readwrite');
      const store = tx.objectStore(STORES.VENTAS_PENDIENTES);
      const getReq = store.get(idLocal);

      getReq.onsuccess = () => {
        const venta = getReq.result as VentaOffline | undefined;
        if (!venta) {
          resolve();
          return;
        }
        venta.intentos = (venta.intentos || 0) + 1;
        venta.errorSincronizacion = error;
        const putReq = store.put(venta);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  // === CACHÉ DE CATÁLOGO & STOCK LOCAL ===
  async cachearCatalogo(productos: ProductoDTO[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CATALOGO_CACHE, 'readwrite');
      const store = tx.objectStore(STORES.CATALOGO_CACHE);

      for (const prod of productos) {
        store.put(prod);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async obtenerCatalogoLocal(): Promise<ProductoDTO[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CATALOGO_CACHE, 'readonly');
      const store = tx.objectStore(STORES.CATALOGO_CACHE);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result as ProductoDTO[]) || []);
      req.onerror = () => reject(req.error);
    });
  },

  // Descuento pesimista de stock local cuando se vende sin internet
  async descontarStockLocal(items: Array<{ productoId: string; cantidad: number }>): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CATALOGO_CACHE, 'readwrite');
      const store = tx.objectStore(STORES.CATALOGO_CACHE);

      for (const item of items) {
        const getReq = store.get(item.productoId);
        getReq.onsuccess = () => {
          const prod = getReq.result as ProductoDTO | undefined;
          if (prod) {
            prod.stockActual = Math.max(0, prod.stockActual - item.cantidad);
            store.put(prod);
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // === CACHÉ DE CONFIGURACIÓN & TASAS ===
  async cachearConfig(config: ConfiguracionDTO): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CONFIG_CACHE, 'readwrite');
      const store = tx.objectStore(STORES.CONFIG_CACHE);
      const req = store.put({ id: 'current', ...config });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async obtenerConfigLocal(): Promise<ConfiguracionDTO | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CONFIG_CACHE, 'readonly');
      const store = tx.objectStore(STORES.CONFIG_CACHE);
      const req = store.get('current');

      req.onsuccess = () => {
        const res = req.result;
        if (!res) {
          resolve(null);
          return;
        }
        const { id: _id, ...config } = res;
        resolve(config as ConfiguracionDTO);
      };
      req.onerror = () => reject(req.error);
    });
  },
};
