import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getStoredUser, clearStoredAuth, setStoredAuth } from './lib/api.js';
import { LoginModal } from './components/LoginModal.js';
import { DashboardView } from './components/DashboardView.js';
import { PosView } from './components/PosView.js';
import { ProductosView } from './components/ProductosView.js';
import { CategoriasView } from './components/CategoriasView.js';
import { AlertasStockView } from './components/AlertasStockView.js';
import { VentasHistorialView } from './components/VentasHistorialView.js';
import { ContactosView } from './components/ContactosView.js';
import { ReportesView } from './components/ReportesView.js';
import { ComprobanteModal } from './components/ComprobanteModal.js';
import { ConfiguracionView } from './components/ConfiguracionView.js';
import { CajaView } from './components/CajaView.js';
import { RolUsuario, type UsuarioDTO } from '@ferreteria/shared';
import { useSyncStatus } from './lib/syncManager.js';
import { offlineDb } from './lib/offlineDb.js';

export type TabType = 
  | 'dashboard' 
  | 'pos' 
  | 'caja'
  | 'productos' 
  | 'categorias' 
  | 'proveedores' 
  | 'clientes' 
  | 'alertas' 
  | 'ventas' 
  | 'reportes' 
  | 'usuarios'
  | 'configuracion';

export default function App(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UsuarioDTO | null>(getStoredUser());

  // Estado de sincronización offline global
  const { isOnline, isSyncing, pendingCount, sincronizarAhora } = useSyncStatus();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedComprobanteVentaId, setSelectedComprobanteVentaId] = useState<string | null>(null);

  // Atajo de teclado F2 para ir a Punto de Venta
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Manejar expiración o invalidez de token
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Consultas de datos
  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: () => api.getProductos(),
    enabled: !!user,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api.getCategorias(),
    enabled: !!user,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => api.getClientes(),
    enabled: !!user,
  });

  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => api.getProveedores(),
    enabled: !!user,
  });

  const { data: ventas = [] } = useQuery({
    queryKey: ['ventas'],
    queryFn: () => api.getVentas(),
    enabled: !!user,
  });

  const { data: alertas = [] } = useQuery({
    queryKey: ['stockAlerts'],
    queryFn: () => api.getStockAlerts(),
    enabled: !!user,
  });

  const { data: turnoActivo } = useQuery({
    queryKey: ['caja', 'turno-activo'],
    queryFn: () => api.getTurnoActivo(),
    enabled: !!user,
  });

  // Guardar catálogo en caché local de IndexedDB para modo offline
  useEffect(() => {
    if (productos && productos.length > 0) {
      offlineDb.cachearCatalogo(productos);
    }
  }, [productos]);

  // Mutaciones
  const createProductoMutation = useMutation({
    mutationFn: (newProd: any) => api.createProducto(newProd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['stockAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['metricas'] });
    },
  });

  const updateProductoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateProducto(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['stockAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['metricas'] });
    },
  });

  const deleteProductoMutation = useMutation({
    mutationFn: (id: string) => api.deleteProducto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['stockAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['metricas'] });
    },
  });

  const ajustarStockMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.ajustarStock(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['stockAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['metricas'] });
    },
  });

  const createCategoriaMutation = useMutation({
    mutationFn: (nombre: string) => api.createCategoria(nombre),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
    },
  });

  const createClienteMutation = useMutation({
    mutationFn: (data: any) => api.createCliente(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });

  const updateClienteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCliente(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });

  const createProveedorMutation = useMutation({
    mutationFn: (data: any) => api.createProveedor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
    },
  });

  const updateProveedorMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateProveedor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
    },
  });

  const createVentaMutation = useMutation({
    mutationFn: (data: any) => api.crearVenta(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['stockAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['caja'] });
    },
  });

  const anularVentaMutation = useMutation({
    mutationFn: ({ ventaId, motivo }: { ventaId: string; motivo: string }) =>
      api.anularVenta(ventaId, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['stockAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['caja'] });
    },
  });

  const handleLogout = () => {
    clearStoredAuth();
    setUser(null);
  };

  const canManage = user?.rol === RolUsuario.ADMIN;
  const canVoid = user?.rol === RolUsuario.ADMIN;

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      {/* Modal de Login si no hay usuario autenticado */}
      {!user && <LoginModal onSuccess={u => setUser(u)} />}

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 md:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop fijo, Mobile deslizante en drawer) */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-inverse-surface text-inverse-on-surface z-50 flex flex-col justify-between select-none shadow-2xl md:shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          {/* Logo oficial FerrePro ocupando el espacio superior con botón cerrar en móvil */}
          <div className="h-16 px-space-md flex items-center justify-between bg-inverse-surface">
            <div className="w-full bg-surface-container-lowest py-1.5 px-3 rounded-xl shadow-sm flex items-center justify-center border border-white/10">
              <img
                alt="FerrePro Sistema Integral POS"
                className="h-8 w-auto max-w-full object-contain"
                src="/logo.png"
                onError={e => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden ml-2 p-1.5 rounded-lg text-inverse-on-surface/70 hover:text-inverse-on-surface hover:bg-white/10 transition-colors"
              aria-label="Cerrar menú"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Sección Operaciones */}
          <div className="px-space-md py-space-sm">
            <div className="font-label-sm text-label-sm text-secondary-fixed-dim uppercase px-space-sm py-space-xs">
              Operaciones
            </div>
          </div>

          {/* Menú de Navegación idéntico a Stitch: exactamente 5 enlaces */}
          <nav className="flex flex-col gap-space-2xs px-space-md">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
              className={`flex items-center justify-between px-space-md py-space-sm transition-colors rounded ${
                activeTab === 'dashboard'
                  ? 'bg-primary text-on-primary font-label-lg'
                  : 'text-inverse-on-surface hover:bg-surface-container-highest/20 hover:text-surface-container-lowest'
              }`}
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-lg">dashboard</span>
                <span className="font-body-md text-body-md">Tablero</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('pos');
                setMobileMenuOpen(false);
              }}
              className={`flex items-center justify-between px-space-md py-space-sm rounded transition-colors ${
                activeTab === 'pos'
                  ? 'bg-primary text-on-primary font-label-lg'
                  : 'text-inverse-on-surface hover:bg-surface-container-highest/20 hover:text-surface-container-lowest'
              }`}
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-lg">point_of_sale</span>
                <span className="font-body-md text-body-md">Punto de Venta</span>
              </div>
              <span className="font-label-sm text-label-sm bg-tertiary text-on-tertiary px-space-xs py-space-2xs rounded">
                F2
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('caja');
                setMobileMenuOpen(false);
              }}
              className={`flex items-center justify-between px-space-md py-space-sm rounded transition-colors ${
                activeTab === 'caja'
                  ? 'bg-primary text-on-primary font-label-lg'
                  : 'text-inverse-on-surface hover:bg-surface-container-highest/20 hover:text-surface-container-lowest'
              }`}
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-lg">payments</span>
                <span className="font-body-md text-body-md">Caja / Arqueo</span>
              </div>
              <span className={`font-label-sm text-label-sm px-space-xs py-space-2xs rounded font-medium ${
                turnoActivo ? 'bg-emerald-600 text-white' : 'bg-amber-600/80 text-white'
              }`}>
                {turnoActivo ? 'Abierta' : 'Cerrada'}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('productos');
                setMobileMenuOpen(false);
              }}
              className={`flex items-center justify-between px-space-md py-space-sm rounded transition-colors ${
                activeTab === 'productos' || activeTab === 'categorias' || activeTab === 'alertas'
                  ? 'bg-primary text-on-primary font-label-lg'
                  : 'text-inverse-on-surface hover:bg-surface-container-highest/20 hover:text-surface-container-lowest'
              }`}
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-lg">inventory_2</span>
                <span className="font-body-md text-body-md">Inventario</span>
              </div>
              {alertas.length > 0 && (
                <span className="font-label-sm text-label-sm bg-error text-on-error px-space-xs py-space-2xs rounded">
                  {alertas.length} bajo stock
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('ventas');
                setMobileMenuOpen(false);
              }}
              className={`flex items-center justify-between px-space-md py-space-sm rounded transition-colors ${
                activeTab === 'ventas' || activeTab === 'reportes'
                  ? 'bg-primary text-on-primary font-label-lg'
                  : 'text-inverse-on-surface hover:bg-surface-container-highest/20 hover:text-surface-container-lowest'
              }`}
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-lg">receipt_long</span>
                <span className="font-body-md text-body-md">Ventas</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('clientes');
                setMobileMenuOpen(false);
              }}
              className={`flex items-center justify-between px-space-md py-space-sm rounded transition-colors ${
                activeTab === 'clientes' || activeTab === 'proveedores'
                  ? 'bg-primary text-on-primary font-label-lg'
                  : 'text-inverse-on-surface hover:bg-surface-container-highest/20 hover:text-surface-container-lowest'
              }`}
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-lg">group</span>
                <span className="font-body-md text-body-md">Contactos</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('configuracion');
                setMobileMenuOpen(false);
              }}
              className={`flex items-center justify-between px-space-md py-space-sm rounded transition-colors ${
                activeTab === 'configuracion' || activeTab === 'usuarios'
                  ? 'bg-primary text-on-primary font-label-lg'
                  : 'text-inverse-on-surface hover:bg-surface-container-highest/20 hover:text-surface-container-lowest'
              }`}
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-lg">tune</span>
                <span className="font-body-md text-body-md">Gestión</span>
              </div>
              <span className="font-label-sm text-label-sm bg-primary-fixed/30 text-surface-container-lowest px-space-xs py-space-2xs rounded font-bold">
                Admin
              </span>
            </button>
          </nav>
        </div>

        {/* PostgreSQL Cloud Status Pill */}
        <div className="p-space-md m-space-md rounded bg-surface-container-highest/10 flex flex-col gap-space-xs">
          <div className="flex items-center gap-space-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                isOnline ? 'bg-tertiary-fixed opacity-75' : 'bg-error'
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isOnline ? 'bg-tertiary-fixed-dim' : 'bg-error'
              }`} />
            </span>
            <span className="font-label-sm text-label-sm text-inverse-on-surface font-bold">
              DB PostgreSQL
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-secondary-fixed-dim leading-snug">
            {isOnline ? 'Sincronizado con Base de Datos Cloud en tiempo real' : 'Modo fuera de línea'}
          </span>
        </div>
      </aside>

      {/* Contenedor Principal (pl-0 en mobile, pl-64 en desktop) */}
      <div className="pl-0 md:pl-64 flex flex-col min-h-screen">
        {/* Header Superior Fijo */}
        <header className="fixed top-0 left-0 md:left-64 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl z-40 px-3 sm:px-6 md:px-gutter-desktop shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex items-center justify-between gap-2 sm:gap-space-md">
          {/* Botón Hamburguesa en Mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-xl text-on-surface hover:bg-surface-container transition-colors shrink-0"
            aria-label="Abrir Menú"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>

          <div className="flex items-center gap-space-sm flex-1 max-w-xl min-w-0">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-secondary text-lg">
                search
              </span>
              <input
                className="w-full pl-10 pr-space-md py-space-xs h-9 bg-surface-container-low text-on-surface font-body-sm text-body-sm rounded outline-none placeholder:text-secondary focus:bg-surface-container-lowest text-xs sm:text-sm"
                placeholder="Buscar SKU, código o producto..."
                type="text"
              />
            </div>
            <div className="hidden xl:flex items-center gap-space-xs shrink-0 px-space-md py-space-xs bg-surface-container-low rounded">
              <span className="material-symbols-outlined text-secondary text-base">storefront</span>
              <span className="font-label-md text-label-md text-on-surface">Caja Principal - Mostrador 01</span>
            </div>

            {/* Badge Global de Conectividad y Sincronización */}
            {isSyncing ? (
              <div className="hidden sm:flex items-center gap-1.5 px-space-sm py-1 bg-primary/10 text-primary border border-primary/20 rounded font-label-sm text-label-sm font-bold animate-pulse shrink-0">
                <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                <span className="hidden md:inline">Sincronizando ({pendingCount})...</span>
              </div>
            ) : !isOnline ? (
              <button
                type="button"
                onClick={() => sincronizarAhora()}
                title="Clic para verificar conexión y sincronizar"
                className="hidden sm:flex items-center gap-1.5 px-space-sm py-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded font-label-sm text-label-sm font-bold hover:bg-amber-500/20 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-sm text-amber-600">cloud_off</span>
                <span className="hidden md:inline">Modo Offline ({pendingCount})</span>
              </button>
            ) : pendingCount > 0 ? (
              <button
                type="button"
                onClick={() => sincronizarAhora()}
                title="Clic para sincronizar con la nube"
                className="hidden sm:flex items-center gap-1.5 px-space-sm py-1 bg-primary/10 text-primary border border-primary/30 rounded font-label-sm text-label-sm font-bold hover:bg-primary/20 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-sm">cloud_upload</span>
                <span className="hidden md:inline">{pendingCount} por sincronizar</span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1 px-space-xs py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded font-label-sm text-label-sm font-semibold shrink-0">
                <span className="material-symbols-outlined text-sm text-emerald-600">cloud_done</span>
                <span className="hidden md:inline">En Línea</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-space-md shrink-0">
            <button
              onClick={() => setActiveTab('pos')}
              className="flex items-center gap-1 sm:gap-space-xs px-2.5 sm:px-space-md py-space-xs h-9 bg-primary text-on-primary rounded font-label-md text-label-md hover:bg-primary-container transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-base">add_shopping_cart</span>
              <span className="hidden sm:inline">Nueva Venta</span>
              <kbd className="hidden lg:inline font-label-sm text-label-sm bg-on-primary/20 px-space-2xs rounded ml-space-2xs">
                F2
              </kbd>
            </button>

            <div className="relative flex items-center">
              <button
                onClick={() => setActiveTab('alertas')}
                aria-label="Notificaciones"
                className="p-1.5 sm:p-space-xs rounded hover:bg-surface-container-high text-on-surface-variant transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-xl">notifications</span>
                {alertas.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-1 sm:gap-space-md pl-1 sm:pl-space-md">
              <img
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover"
                src="/profile.png"
                onError={e => {
                  (e.target as HTMLImageElement).src = "https://lh3.googleusercontent.com/aida-public/AB6AXuDxZ96QjvspT8k-h3-ER9Kxzn_KFlb_3f9QwWORx8L3VZ4y7h01wETPKv0hyn6X-KNisItQJWWIOebBawgvwYHh2N0twfOlJ7DuIG8CBehySHXgkHEw5_fFosPy7uvu-8L1wTkCUTLcFtmoM5yoqvi76Ivqrf44qEtFWXo3X_Eag6j0c9v2coaxhM_kgde89BKSuuobGzmwI_J1QE6GvHQ2VD1uFLOSPgHo-bitu32YIrGOmbfov_WJ";
                }}
              />
              <div className="hidden md:flex flex-col text-left">
                <span className="font-label-md text-label-md text-on-surface leading-tight font-bold">
                  {user?.nombre || (user?.rol === RolUsuario.ADMIN ? 'Administrador' : 'Cajero')}
                </span>
                <div className="flex items-center gap-space-xs mt-0.5">
                  <span className="font-label-sm text-label-sm text-secondary leading-tight">
                    {user?.rol === RolUsuario.ADMIN ? 'Administrador' : 'Cajero'}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const newRol = user?.rol === RolUsuario.ADMIN ? RolUsuario.CAJERO : RolUsuario.ADMIN;
                      const targetEmail = newRol === RolUsuario.ADMIN ? 'admin@ferreteria.com' : 'cajero@ferreteria.com';
                      const targetPass = newRol === RolUsuario.ADMIN ? 'admin123' : 'cajero123';
                      try {
                        const { token, usuario } = await api.login(targetEmail, targetPass);
                        setStoredAuth(token, usuario);
                        setUser(usuario);
                        queryClient.invalidateQueries();
                      } catch (_err) {
                        setUser(null);
                      }
                    }}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-primary transition-colors cursor-pointer"
                    title="Alternar entre Admin y Cajero para pruebas"
                  >
                    Cambiar rol
                  </button>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-1 sm:p-space-xs text-secondary hover:text-error ml-1 transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area con espacio full-width idéntico a Stitch */}
        <main className="relative pt-16 bg-background w-full px-3 sm:px-6 md:px-gutter-desktop py-4 pb-24 md:pb-space-lg min-h-screen">
          {activeTab === 'dashboard' && (
            <DashboardView
              productos={productos}
              categorias={categorias}
              onNavigate={tab => setActiveTab(tab)}
              onOpenNewProduct={() => setIsProductModalOpen(true)}
              canManage={canManage}
            />
          )}

          {activeTab === 'pos' && (
            <PosView
              productos={productos}
              categorias={categorias}
              clientes={clientes}
              onCrearVenta={async data => {
                return await createVentaMutation.mutateAsync(data);
              }}
              onCrearCliente={async data => {
                return await createClienteMutation.mutateAsync(data);
              }}
              onNavigateToCaja={() => setActiveTab('caja')}
            />
          )}

          {activeTab === 'caja' && (
            <CajaView
              currentUser={user}
              onNavigateToPos={() => setActiveTab('pos')}
            />
          )}

          {activeTab === 'productos' && (
            <ProductosView
              productos={productos}
              categorias={categorias}
              onCrearProducto={async data => {
                await createProductoMutation.mutateAsync(data);
              }}
              onActualizarProducto={async (id, data) => {
                await updateProductoMutation.mutateAsync({ id, data });
              }}
              onEliminarProducto={async id => {
                await deleteProductoMutation.mutateAsync(id);
              }}
              onAjustarStock={async (id, data) => {
                await ajustarStockMutation.mutateAsync({ id, data });
              }}
              canManage={canManage}
              isModalOpen={isProductModalOpen}
              setIsModalOpen={setIsProductModalOpen}
            />
          )}

          {activeTab === 'categorias' && (
            <CategoriasView
              categorias={categorias}
              productos={productos}
              onCrearCategoria={async nombre => {
                await createCategoriaMutation.mutateAsync(nombre);
              }}
              canManage={canManage}
            />
          )}

          {(activeTab === 'clientes' || activeTab === 'proveedores') && (
            <ContactosView
              initialTab={activeTab === 'proveedores' ? 'proveedores' : 'clientes'}
              clientes={clientes}
              proveedores={proveedores}
              ventas={ventas}
              onCrearCliente={async data => {
                await createClienteMutation.mutateAsync(data);
              }}
              onActualizarCliente={async (id, data) => {
                await updateClienteMutation.mutateAsync({ id, data });
              }}
              onCrearProveedor={async data => {
                await createProveedorMutation.mutateAsync(data);
              }}
              onActualizarProveedor={async (id, data) => {
                await updateProveedorMutation.mutateAsync({ id, data });
              }}
              onVerComprobante={ventaId => setSelectedComprobanteVentaId(ventaId)}
              canManage={canManage}
            />
          )}

          {activeTab === 'alertas' && (
            <AlertasStockView
              productosCriticos={alertas}
              onNavigateToProducts={() => setActiveTab('productos')}
            />
          )}

          {activeTab === 'ventas' && (
            <VentasHistorialView
              ventas={ventas}
              onAnularVenta={async (ventaId, motivo) => {
                await anularVentaMutation.mutateAsync({ ventaId, motivo });
              }}
              onVerComprobante={ventaId => setSelectedComprobanteVentaId(ventaId)}
              canVoid={canVoid}
            />
          )}

          {activeTab === 'reportes' && <ReportesView />}

          {(activeTab === 'configuracion' || activeTab === 'usuarios') && (
            user?.rol === RolUsuario.ADMIN ? (
              <ConfiguracionView currentUser={user} />
            ) : (
              <div className="bg-surface-container-lowest p-space-xl rounded shadow-sm border border-surface-container text-center flex flex-col items-center justify-center gap-space-md max-w-lg mx-auto my-space-xl animate-fade-in">
                <span className="material-symbols-outlined text-5xl text-primary">admin_panel_settings</span>
                <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  Módulo de Gestión del Sistema
                </h2>
                <p className="font-body-md text-body-md text-secondary">
                  Este módulo es exclusivo para el <strong>Administrador</strong>. Como actualmente estás con perfil de <strong>Cajero</strong>, puedes cambiar tu rol a continuación:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const adminUser: UsuarioDTO = {
                      id: '1',
                      nombre: 'Administrador',
                      email: 'admin@ferreteria.com',
                      rol: RolUsuario.ADMIN,
                      activo: true,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    setStoredAuth('demo_token_admin', adminUser);
                    setUser(adminUser);
                  }}
                  className="px-space-lg py-space-sm bg-primary text-on-primary font-label-md text-label-md font-bold rounded shadow-sm hover:bg-primary-container transition-colors flex items-center gap-space-xs"
                >
                  <span className="material-symbols-outlined text-lg">switch_account</span>
                  <span>Ingresar como Administrador</span>
                </button>
              </div>
            )
          )}
        </main>

        {/* Modal Global de Comprobante / Ticket */}
        {selectedComprobanteVentaId && (
          <ComprobanteModal
            ventaId={selectedComprobanteVentaId}
            onClose={() => setSelectedComprobanteVentaId(null)}
          />
        )}

        {/* Barra de Navegación Inferior para Teléfonos Móviles */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-lowest/95 backdrop-blur-xl border-t border-surface-container-high/60 z-40 px-2 flex items-center justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              activeTab === 'dashboard'
                ? 'text-primary font-bold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            <span className={`material-symbols-outlined text-2xl ${activeTab === 'dashboard' ? 'scale-110 font-bold' : ''}`}>
              dashboard
            </span>
            <span className="text-[11px] leading-tight mt-0.5">Tablero</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              activeTab === 'pos'
                ? 'text-primary font-bold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            <div className={`p-0.5 rounded-xl transition-all ${activeTab === 'pos' ? 'bg-primary/10' : ''}`}>
              <span className="material-symbols-outlined text-2xl">
                point_of_sale
              </span>
            </div>
            <span className="text-[11px] leading-tight">POS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('productos')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
              activeTab === 'productos' || activeTab === 'categorias' || activeTab === 'alertas'
                ? 'text-primary font-bold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            <div className="relative">
              <span className="material-symbols-outlined text-2xl">
                inventory_2
              </span>
              {alertas.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-error rounded-full animate-pulse" />
              )}
            </div>
            <span className="text-[11px] leading-tight">Stock</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ventas')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              activeTab === 'ventas' || activeTab === 'reportes'
                ? 'text-primary font-bold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">
              receipt_long
            </span>
            <span className="text-[11px] leading-tight">Ventas</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 text-secondary hover:text-on-surface transition-all"
          >
            <span className="material-symbols-outlined text-2xl">
              menu
            </span>
            <span className="text-[11px] leading-tight">Menú</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
