import { 
  RolUsuario, 
  Moneda,
  MetodoPago,
  TipoMovimientoInventario,
  type ApiResponse, 
  type CategoriaDTO, 
  type ProductoDTO, 
  type UsuarioDTO,
  type ClienteDTO,
  type ProveedorDTO,
  type VentaDTO,
  type PagoVentaDTO,
  type ConfiguracionDTO,
  type MetricasResumenDTO,
  type VentasDiariasDTO,
  type ProductoMasVendidoDTO,
  type StockCriticoDTO,
  type SyncStatusDTO,
  type MovimientoInventarioDTO,
  type TurnoCajaDTO,
  type AbrirCajaDTO,
  type MovimientoCajaDTO,
  type CrearMovimientoCajaDTO,
  type CerrarCajaDTO,
  type ResumenArqueoDTO
} from '@ferreteria/shared';

const API_BASE = '/api';

// Clave para almacenar el token en localStorage
const TOKEN_KEY = 'ferreteria_token';
const USER_KEY = 'ferreteria_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredAuth(token: string, user: UsuarioDTO): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): UsuarioDTO | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const u = JSON.parse(raw);
    // Si el usuario guardado tiene el rol obsoleto o es 'Encargado de Almacén', migrar a ADMIN
    if (u.rol === 'INVENTARIO' || u.nombre === 'Encargado de Almacén' || u.email?.includes('inventario')) {
      u.rol = RolUsuario.ADMIN;
      u.nombre = 'Administrador';
      u.email = 'admin@ferreteria.com';
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    }
    return u;
  } catch {
    return null;
  }
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    data: null,
    error: `Error HTTP ${response.status}`,
  }));

  if (response.status === 401) {
    clearStoredAuth();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new Error(data.error || 'Token de autenticación inválido o expirado');
  }

  if (!data.success) {
    throw new Error(data.error || 'Error en la petición');
  }
  return data.data as T;
}

export const api = {
  // Autenticación
  async login(email: string, password: string): Promise<{ token: string; usuario: UsuarioDTO }> {
    return await apiRequest<{ token: string; usuario: UsuarioDTO }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Asistente de primer arranque (crear el primer ADMIN)
  async getSetupStatus(): Promise<{ needsSetup: boolean }> {
    return await apiRequest<{ needsSetup: boolean }>('/auth/setup-status');
  },

  async setupInicial(data: { nombre: string; email: string; password: string }): Promise<UsuarioDTO> {
    return await apiRequest<UsuarioDTO>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMe(): Promise<UsuarioDTO> {
    try {
      return await apiRequest<UsuarioDTO>('/auth/me');
    } catch (_err) {
      const user = getStoredUser();
      if (!user) throw new Error('No hay sesión activa');
      return user;
    }
  },

  // Categorías
  async getCategorias(): Promise<CategoriaDTO[]> {
    return await apiRequest<CategoriaDTO[]>('/categorias');
  },

  async createCategoria(nombre: string): Promise<CategoriaDTO> {
    return await apiRequest<CategoriaDTO>('/categorias', {
      method: 'POST',
      body: JSON.stringify({ nombre }),
    });
  },

  // Productos
  async getProductos(filters?: { categoriaId?: string; search?: string }): Promise<ProductoDTO[]> {
    const params = new URLSearchParams();
    if (filters?.categoriaId) params.append('categoriaId', filters.categoriaId);
    if (filters?.search) params.append('search', filters.search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await apiRequest<ProductoDTO[]>(`/productos${query}`);
  },

  async getStockAlerts(): Promise<ProductoDTO[]> {
    return await apiRequest<ProductoDTO[]>('/productos/alertas-stock');
  },

  async createProducto(data: {
    codigo: string;
    nombre: string;
    descripcion?: string;
    imagenUrl?: string | null;
    categoriaId: string;
    precioCompra: number;
    precioVenta: number;
    stockActual: number;
    stockMinimo: number;
    unidadMedida: string;
  }): Promise<ProductoDTO> {
    return await apiRequest<ProductoDTO>('/productos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProducto(id: string, data: Partial<ProductoDTO>): Promise<ProductoDTO> {
    return await apiRequest<ProductoDTO>(`/productos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteProducto(id: string): Promise<void> {
    await apiRequest<void>(`/productos/${id}`, {
      method: 'DELETE',
    });
  },

  async ajustarStock(
    id: string,
    data: {
      tipo: TipoMovimientoInventario | 'ENTRADA' | 'SALIDA' | 'AJUSTE';
      cantidad: number;
      motivo: string;
    }
  ): Promise<ProductoDTO> {
    return await apiRequest<ProductoDTO>(`/productos/${id}/ajuste`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMovimientosProducto(id: string): Promise<MovimientoInventarioDTO[]> {
    return await apiRequest<MovimientoInventarioDTO[]>(`/productos/${id}/movimientos`);
  },

  // Clientes
  async getClientes(search?: string): Promise<ClienteDTO[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return await apiRequest<ClienteDTO[]>(`/clientes${query}`);
  },

  async createCliente(data: {
    nombre: string;
    identificacion: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
  }): Promise<ClienteDTO> {
    return await apiRequest<ClienteDTO>('/clientes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCliente(id: string, data: Partial<ClienteDTO>): Promise<ClienteDTO> {
    return await apiRequest<ClienteDTO>(`/clientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteCliente(id: string): Promise<void> {
    await apiRequest<void>(`/clientes/${id}`, {
      method: 'DELETE',
    });
  },

  // Proveedores
  async getProveedores(search?: string): Promise<ProveedorDTO[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return await apiRequest<ProveedorDTO[]>(`/proveedores${query}`);
  },

  async createProveedor(data: {
    nombre: string;
    rif: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
  }): Promise<ProveedorDTO> {
    return await apiRequest<ProveedorDTO>('/proveedores', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProveedor(id: string, data: Partial<ProveedorDTO>): Promise<ProveedorDTO> {
    return await apiRequest<ProveedorDTO>(`/proveedores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteProveedor(id: string): Promise<void> {
    await apiRequest<void>(`/proveedores/${id}`, {
      method: 'DELETE',
    });
  },

  // Ventas & Facturación
  async getVentas(): Promise<VentaDTO[]> {
    return await apiRequest<VentaDTO[]>('/ventas');
  },

  async crearVenta(data: {
    clienteId: string;
    items: Array<{
      productoId: string;
      cantidad: number;
      precioUnitario: number;
    }>;
    porcentajeImpuesto?: number;
    monedaFuncional?: Moneda;
    pagos?: PagoVentaDTO[];
  }): Promise<VentaDTO> {
    return await apiRequest<VentaDTO>('/ventas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async anularVenta(ventaId: string, motivo: string): Promise<VentaDTO> {
    return await apiRequest<VentaDTO>(`/ventas/${ventaId}/anular`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    });
  },

  async getComprobante(ventaId: string): Promise<any> {
    return await apiRequest<any>(`/ventas/${ventaId}/comprobante`);
  },

  // Reportes & Analíticas
  async getMetricasResumen(): Promise<MetricasResumenDTO> {
    return await apiRequest<MetricasResumenDTO>('/reportes/metricas');
  },

  async getVentasDiarias(dias: number = 30): Promise<VentasDiariasDTO[]> {
    return await apiRequest<VentasDiariasDTO[]>(`/reportes/ventas-diarias?dias=${dias}`);
  },

  async getProductosMasVendidos(limite: number = 10): Promise<ProductoMasVendidoDTO[]> {
    return await apiRequest<ProductoMasVendidoDTO[]>(`/reportes/productos-mas-vendidos?limite=${limite}`);
  },

  async getStockCriticoReporte(): Promise<StockCriticoDTO[]> {
    return await apiRequest<StockCriticoDTO[]>('/reportes/stock-critico');
  },

  // Gestión de Usuarios (solo ADMIN)
  async getUsuarios(): Promise<UsuarioDTO[]> {
    return await apiRequest<UsuarioDTO[]>('/usuarios');
  },

  async createUsuario(data: {
    nombre: string;
    email: string;
    password: string;
    rol?: RolUsuario;
  }): Promise<UsuarioDTO> {
    return await apiRequest<UsuarioDTO>('/usuarios', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUsuario(id: string, data: {
    nombre?: string;
    email?: string;
    rol?: RolUsuario;
    activo?: boolean;
    password?: string;
  }): Promise<UsuarioDTO> {
    return await apiRequest<UsuarioDTO>(`/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deactivateUsuario(id: string): Promise<void> {
    await apiRequest<void>(`/usuarios/${id}`, { method: 'DELETE' });
  },

  // Configuración del Sistema y Tasas de Cambio
  async getConfiguracion(): Promise<ConfiguracionDTO> {
    try {
      const config = await apiRequest<ConfiguracionDTO>('/configuracion');
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ferreteria_config_cache', JSON.stringify(config));
      }
      return config;
    } catch (_err) {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem('ferreteria_config_cache');
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch {}
        }
      }
      return {
        nombreFerreteria: 'Ferretería El Tornillo Fuerte',
        rif: 'J-12345678-9',
        direccion: 'Guasdualito, Apure, Venezuela',
        telefono: '0414-1234567',
        ivaPorcentaje: 16.0,
        stockMinimoAlerta: 5,
        monedaFuncional: Moneda.USD,
        tasaVes: 60.0,
        tasaCop: 4100.0,
        metodosHabilitados: [
          MetodoPago.EFECTIVO_USD,
          MetodoPago.EFECTIVO_COP,
          MetodoPago.PAGO_MOVIL_VES,
          MetodoPago.TARJETA_VES,
          MetodoPago.ZELLE_USD,
        ],
      };
    }
  },

  async updateConfiguracion(data: Partial<ConfiguracionDTO>): Promise<ConfiguracionDTO> {
    const res = await apiRequest<ConfiguracionDTO>('/configuracion', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ferreteria_config_cache', JSON.stringify(res));
    }
    return res;
  },

  // Sincronización Híbrida (Outbox a la Nube)
  async getSyncStatus(): Promise<SyncStatusDTO> {
    return await apiRequest<SyncStatusDTO>('/sync/status');
  },

  async retrySync(): Promise<{ procesados: number; exitosos: number; fallidos: number }> {
    return await apiRequest<{ procesados: number; exitosos: number; fallidos: number }>('/sync/retry', {
      method: 'POST',
    });
  },

  // Control de Caja, Turnos y Arqueos (Guasdualito)
  async getTurnoActivo(): Promise<TurnoCajaDTO | null> {
    return await apiRequest<TurnoCajaDTO | null>('/caja/turno-activo');
  },

  async abrirCaja(data: AbrirCajaDTO): Promise<TurnoCajaDTO> {
    return await apiRequest<TurnoCajaDTO>('/caja/abrir', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async registrarMovimientoCaja(data: CrearMovimientoCajaDTO): Promise<MovimientoCajaDTO> {
    return await apiRequest<MovimientoCajaDTO>('/caja/movimiento', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getResumenArqueo(turnoCajaId: string): Promise<ResumenArqueoDTO> {
    return await apiRequest<ResumenArqueoDTO>(`/caja/resumen/${turnoCajaId}`);
  },

  async cerrarCaja(data: CerrarCajaDTO): Promise<ResumenArqueoDTO> {
    return await apiRequest<ResumenArqueoDTO>('/caja/cerrar', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getHistorialCajas(limite: number = 30): Promise<TurnoCajaDTO[]> {
    return await apiRequest<TurnoCajaDTO[]>(`/caja/historial?limite=${limite}`);
  },

  async getTurnoById(id: string): Promise<TurnoCajaDTO> {
    return await apiRequest<TurnoCajaDTO>(`/caja/${id}`);
  },
};
