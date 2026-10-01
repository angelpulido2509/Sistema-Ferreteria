import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Moneda, 
  MetodoPago, 
  EstadoVenta,
  type ProductoDTO, 
  type ClienteDTO, 
  type VentaDTO, 
  type CategoriaDTO, 
  type PagoVentaDTO 
} from '@ferreteria/shared';
import { api } from '../lib/api.js';
import { calcularTotalesCarrito } from '../lib/totalesCarrito.js';
import { calcularCobro } from '../lib/cobroPos.js';
import { ComprobanteModal } from './ComprobanteModal.js';
import { useSyncStatus, syncManager } from '../lib/syncManager.js';
import { offlineDb, type VentaOffline } from '../lib/offlineDb.js';

interface PosViewProps {
  productos: ProductoDTO[];
  categorias?: CategoriaDTO[];
  clientes: ClienteDTO[];
  onCrearVenta: (data: any) => Promise<VentaDTO>;
  onCrearCliente: (data: any) => Promise<ClienteDTO>;
  onNavigateToCaja?: () => void;
}

interface CartItem {
  producto: ProductoDTO;
  cantidad: number;
}

export interface LineaPagoForm {
  id: string;
  metodoPago: MetodoPago;
  moneda: Moneda;
  montoMoneda: number;
  tasaAplicada: number;
  referencia: string;
}

export const PosView: React.FC<PosViewProps> = ({
  productos,
  categorias = [],
  clientes,
  onCrearVenta,
  onCrearCliente,
  onNavigateToCaja,
}) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string | 'todas'>('todas');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mobileTab, setMobileTab] = useState<'catalogo' | 'carrito'>('catalogo');
  const [clienteId, setClienteId] = useState<string>(clientes[0]?.id || '1');

  // Consulta de turno de caja activo
  const { data: turnoActivo } = useQuery({
    queryKey: ['caja', 'turno-activo'],
    queryFn: () => api.getTurnoActivo(),
  });
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientNombre, setNewClientNombre] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newClientTelefono, setNewClientTelefono] = useState('');

  // Drawer de Cobro Multimoneda (Guasdualito)
  const [isCheckoutDrawerOpen, setIsCheckoutDrawerOpen] = useState(false);
  const [lineasPago, setLineasPago] = useState<LineaPagoForm[]>([]);
  const [vueltoMonedaElegida, setVueltoMonedaElegida] = useState<Moneda | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptVenta, setReceiptVenta] = useState<VentaDTO | null>(null);

  // Estado de sincronización y conectividad de red
  const { isOnline, isSyncing, pendingCount, sincronizarAhora } = useSyncStatus();

  // Consulta de configuración y tasas vigentes de la base de datos
  const { data: config } = useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api.getConfiguracion(),
  });

  const tasaVes = config?.tasaVes || 60.0;
  const tasaCop = config?.tasaCop || 4100.0;

  // Totales con el mismo cálculo del servidor (IVA de Configuración por línea, exentos)
  const { subtotal, impuesto, total } = calcularTotalesCarrito(cart, config?.ivaPorcentaje ?? 16);

  // Helper para convertir línea de pago a USD
  const getMontoUsd = (linea: LineaPagoForm): number => {
    if (linea.moneda === Moneda.USD) return linea.montoMoneda || 0;
    if (linea.tasaAplicada <= 0) return 0;
    return Math.round(((linea.montoMoneda || 0) / linea.tasaAplicada) * 100) / 100;
  };

  const totalPagadoUsd = lineasPago.reduce((sum, l) => sum + getMontoUsd(l), 0);
  const diferenciaUsd = Math.round((totalPagadoUsd - total) * 100) / 100;

  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleNuevaVenta = () => {
    setCart([]);
    setSearch('');
    if (clientes.length > 0) {
      setClienteId(clientes[0].id);
    }
    setError(null);
    setIsCheckoutDrawerOpen(false);
    setIsNewClientModalOpen(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleFocusBuscar = () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setError(null);
    setLineasPago([
      {
        id: '1',
        metodoPago: MetodoPago.EFECTIVO_USD,
        moneda: Moneda.USD,
        montoMoneda: Math.round(total * 100) / 100,
        tasaAplicada: 1.0,
        referencia: '',
      },
    ]);
    setVueltoMonedaElegida(null);
    setIsCheckoutDrawerOpen(true);
  };

  // Atajos de teclado del POS: F2 (Nueva Venta), F4 (Buscar), F8 (Cliente), F12 (Cobro Rápido)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Si el drawer o modal de cliente están abiertos
      if (isNewClientModalOpen || isCheckoutDrawerOpen) {
        if (e.key === 'Escape') {
          setIsNewClientModalOpen(false);
          setIsCheckoutDrawerOpen(false);
        }
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        handleNuevaVenta();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleFocusBuscar();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setIsNewClientModalOpen(true);
      } else if (e.key === 'F12') {
        e.preventDefault();
        handleOpenCheckout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, clienteId, total, tasaVes, tasaCop, isNewClientModalOpen, isCheckoutDrawerOpen, clientes]);

  // Filter products
  const filteredProductos = productos.filter(p => {
    const matchesSearch =
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategoria === 'todas' || p.categoriaId === selectedCategoria;
    return matchesSearch && matchesCat && p.activo;
  });

  // Add to cart
  const addToCart = (producto: ProductoDTO) => {
    if (producto.stockActual <= 0) return;

    setCart(prev => {
      const existing = prev.find(item => item.producto.id === producto.id);
      if (existing) {
        if (existing.cantidad >= producto.stockActual) return prev;
        return prev.map(item =>
          item.producto.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  const updateQuantity = (productoId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.producto.id === productoId) {
            const newQty = item.cantidad + delta;
            if (newQty <= 0) return null;
            if (newQty > item.producto.stockActual) return item;
            return { ...item, cantidad: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productoId: string) => {
    setCart(prev => prev.filter(item => item.producto.id !== productoId));
  };

  const clearCart = () => {
    setCart([]);
  };



  const METODOS_OPCIONES: Array<{
    id: MetodoPago;
    label: string;
    moneda: Moneda;
    icon: string;
    badgeClass: string;
  }> = [
    { id: MetodoPago.EFECTIVO_USD, label: 'Efectivo USD ($)', moneda: Moneda.USD, icon: 'payments', badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    { id: MetodoPago.ZELLE_USD, label: 'Zelle USD', moneda: Moneda.USD, icon: 'send_to_mobile', badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    { id: MetodoPago.PAGO_MOVIL_VES, label: 'Pago Móvil (VES)', moneda: Moneda.VES, icon: 'smartphone', badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    { id: MetodoPago.TARJETA_VES, label: 'Tarjeta / Punto (VES)', moneda: Moneda.VES, icon: 'credit_card', badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    { id: MetodoPago.EFECTIVO_COP, label: 'Efectivo Pesos (COP)', moneda: Moneda.COP, icon: 'local_atm', badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  ];

  const handleAddPaymentLine = () => {
    const remainingUsd = Math.max(0, -diferenciaUsd);
    const newLine: LineaPagoForm = {
      id: Date.now().toString(),
      metodoPago: MetodoPago.EFECTIVO_USD,
      moneda: Moneda.USD,
      montoMoneda: remainingUsd > 0 ? remainingUsd : 0,
      tasaAplicada: 1.0,
      referencia: '',
    };
    setLineasPago(prev => [...prev, newLine]);
  };

  const handleUpdatePaymentLine = (id: string, updates: Partial<LineaPagoForm>) => {
    setLineasPago(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, ...updates };
      if (updates.metodoPago) {
        const info = METODOS_OPCIONES.find(m => m.id === updates.metodoPago);
        if (info) {
          updated.moneda = info.moneda;
          if (info.moneda === Moneda.USD) {
            updated.tasaAplicada = 1.0;
          } else if (info.moneda === Moneda.VES) {
            updated.tasaAplicada = tasaVes;
          } else if (info.moneda === Moneda.COP) {
            updated.tasaAplicada = tasaCop;
          }
        }
      }
      return updated;
    }));
  };

  const handleRemovePaymentLine = (id: string) => {
    if (lineasPago.length <= 1) return;
    setLineasPago(prev => prev.filter(l => l.id !== id));
  };

  const handleQuickFill = (metodo: MetodoPago) => {
    const info = METODOS_OPCIONES.find(m => m.id === metodo);
    if (!info) return;

    let monto = total;
    let tasa = 1.0;

    if (info.moneda === Moneda.VES) {
      tasa = tasaVes;
      monto = Math.round(total * tasaVes * 100) / 100;
    } else if (info.moneda === Moneda.COP) {
      tasa = tasaCop;
      monto = Math.round(total * tasaCop);
    }

    setLineasPago([
      {
        id: Date.now().toString(),
        metodoPago: metodo,
        moneda: info.moneda,
        montoMoneda: monto,
        tasaAplicada: tasa,
        referencia: '',
      },
    ]);
  };

  // Vuelto (F3): solo sale de pagos en efectivo, en la moneda elegida entre las recibidas en efectivo
  const cobro = calcularCobro(lineasPago, total, { ves: tasaVes, cop: tasaCop }, vueltoMonedaElegida);
  const monedaVuelto = cobro.vueltoMoneda ?? Moneda.USD;
  const vueltoMonto = cobro.vueltoMonto;
  const faltaDinero = cobro.faltanteUsd > 0;

  const handleConfirmSale = async () => {
    if (cart.length === 0) return;
    if (faltaDinero) {
      setError(`Monto insuficiente. Falta por cubrir ${cobro.faltanteUsd.toFixed(2)} USD`);
      return;
    }
    if (cobro.bloqueo) {
      setError(cobro.bloqueo);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const pagosDTO: PagoVentaDTO[] = lineasPago.map(l => ({
        metodoPago: l.metodoPago,
        moneda: l.moneda,
        montoRecibido: l.montoMoneda,
        montoMoneda: l.montoMoneda,
        tasaAplicada: l.tasaAplicada,
        montoUsd: getMontoUsd(l),
        referencia: l.referencia.trim() || undefined,
      }));

      const ventaPayload = {
        clienteId,
        items: cart.map(i => ({
          productoId: i.producto.id,
          cantidad: i.cantidad,
          precioUnitario: i.producto.precioVenta,
        })),
        porcentajeImpuesto: 0.16,
        monedaFuncional: Moneda.USD,
        totalUsd: total,
        pagos: pagosDTO,
        vueltoMoneda: cobro.vueltoMoneda ?? undefined,
      };

      let ventaRealizada: VentaDTO;

      // Si estamos sin conexión declarada: guardar en cola local de inmediato
      if (!isOnline) {
        const idLocal = `OFF-${Date.now().toString(36).toUpperCase()}`;
        const ventaOffline: VentaOffline = {
          idLocal,
          clienteId,
          clienteNombre: selectedClientObj?.nombre,
          clienteIdentificacion: selectedClientObj?.identificacion,
          items: cart.map(i => ({
            productoId: i.producto.id,
            cantidad: i.cantidad,
            precioUnitario: i.producto.precioVenta,
            productoNombre: i.producto.nombre,
          })),
          porcentajeImpuesto: 0.16,
          monedaFuncional: Moneda.USD,
          subtotal,
          impuesto,
          total,
          totalUsd: total,
          pagos: pagosDTO,
          vueltoMoneda: cobro.vueltoMoneda ?? undefined,
          fecha: new Date().toISOString(),
          intentos: 0,
          createdAt: new Date().toISOString(),
        };

        await offlineDb.guardarVentaOffline(ventaOffline);
        await offlineDb.descontarStockLocal(cart.map(i => ({ productoId: i.producto.id, cantidad: i.cantidad })));
        await syncManager.refreshPendingCount();

        ventaRealizada = {
          id: '-1',
          clienteId,
          usuarioId: '1',
          fecha: new Date().toISOString(),
          subtotal,
          impuesto,
          total,
          monedaFuncional: Moneda.USD,
          totalUsd: total,
          estado: EstadoVenta.COMPLETADA,
          cliente: selectedClientObj,
          detalles: cart.map((i, idx) => ({
            id: String(idx + 1),
            ventaId: '-1',
            productoId: i.producto.id,
            cantidad: i.cantidad,
            precioUnitario: i.producto.precioVenta,
            subtotalLinea: i.cantidad * i.producto.precioVenta,
            producto: i.producto,
          })),
          pagos: pagosDTO,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          numeroComprobanteLocal: idLocal,
        } as any;
      } else {
        // Modo online con fallback transparente a offline si hay falla de red
        try {
          ventaRealizada = await onCrearVenta(ventaPayload);
        } catch (apiErr) {
          const isNetworkError =
            !navigator.onLine ||
            (apiErr instanceof Error &&
              (apiErr.message.toLowerCase().includes('fetch') ||
                apiErr.message.toLowerCase().includes('network') ||
                apiErr.message.toLowerCase().includes('failed to fetch') ||
                apiErr.message.toLowerCase().includes('conexión')));

          if (isNetworkError) {
            const idLocal = `OFF-${Date.now().toString(36).toUpperCase()}`;
            const ventaOffline: VentaOffline = {
              idLocal,
              clienteId,
              clienteNombre: selectedClientObj?.nombre,
              clienteIdentificacion: selectedClientObj?.identificacion,
              items: cart.map(i => ({
                productoId: i.producto.id,
                cantidad: i.cantidad,
                precioUnitario: i.producto.precioVenta,
                productoNombre: i.producto.nombre,
              })),
              porcentajeImpuesto: 0.16,
              monedaFuncional: Moneda.USD,
              subtotal,
              impuesto,
              total,
              totalUsd: total,
              pagos: pagosDTO,
              vueltoMoneda: cobro.vueltoMoneda ?? undefined,
              fecha: new Date().toISOString(),
              intentos: 0,
              createdAt: new Date().toISOString(),
            };

            await offlineDb.guardarVentaOffline(ventaOffline);
            await offlineDb.descontarStockLocal(cart.map(i => ({ productoId: i.producto.id, cantidad: i.cantidad })));
            await syncManager.refreshPendingCount();

            ventaRealizada = {
              id: '-1',
              clienteId,
              usuarioId: '1',
              fecha: new Date().toISOString(),
              subtotal,
              impuesto,
              total,
              monedaFuncional: Moneda.USD,
              totalUsd: total,
              estado: EstadoVenta.COMPLETADA,
              cliente: selectedClientObj,
              detalles: cart.map((i, idx) => ({
                id: String(idx + 1),
                ventaId: '-1',
                productoId: i.producto.id,
                cantidad: i.cantidad,
                precioUnitario: i.producto.precioVenta,
                subtotalLinea: i.cantidad * i.producto.precioVenta,
                producto: i.producto,
              })),
              pagos: pagosDTO,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              numeroComprobanteLocal: idLocal,
            } as any;
          } else {
            throw apiErr;
          }
        }
      }

      setIsCheckoutDrawerOpen(false);
      setReceiptVenta(ventaRealizada);
      setCart([]);
      queryClient.invalidateQueries({ queryKey: ['caja'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la venta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientNombre || !newClientId) return;

    try {
      const nuevo = await onCrearCliente({
        nombre: newClientNombre.trim(),
        identificacion: newClientId.trim().toUpperCase(),
        telefono: newClientTelefono.trim() || undefined,
      });
      setClienteId(nuevo.id);
      setIsNewClientModalOpen(false);
      setNewClientNombre('');
      setNewClientId('');
      setNewClientTelefono('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar cliente');
    }
  };

  const selectedClientObj = clientes.find(c => c.id === clienteId) || clientes[0];

  return (
    <div className="flex flex-col w-full gap-space-md animate-fade-in">
      {/* Header Caja / POS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm pb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${turnoActivo ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface">
              Caja #01 - Ventas Mostrador
            </h1>
            <span className={`font-label-sm text-label-sm px-space-xs py-space-2xs rounded font-semibold ${
              turnoActivo 
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' 
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            }`}>
              {turnoActivo ? `TURNO #${turnoActivo.id.slice(-6).toUpperCase()} ACTIVO` : 'SIN TURNO ABIERTO'}
            </span>
          </div>
          <div className="flex items-center gap-space-xs text-secondary font-body-sm text-body-sm mt-space-2xs flex-wrap">
            <span>
              {turnoActivo 
                ? `Cajero: ${turnoActivo.usuarioApertura?.nombre || 'Usuario'} • Iniciado: ${new Date(turnoActivo.fechaApertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Caja cerrada temporalmente para arqueo'}
            </span>
            {isSyncing ? (
              <span className="inline-flex items-center gap-1.5 px-space-xs py-space-2xs bg-primary/10 text-primary rounded font-label-sm text-label-sm font-bold animate-pulse">
                <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                Sincronizando {pendingCount} venta(s)...
              </span>
            ) : !isOnline ? (
              <button
                type="button"
                onClick={() => sincronizarAhora()}
                title="Clic para verificar conexión y reintentar sincronización"
                className="inline-flex items-center gap-1.5 px-space-xs py-space-2xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded font-label-sm text-label-sm font-bold hover:bg-amber-500/20 transition-colors"
              >
                <span className="material-symbols-outlined text-xs text-amber-600">cloud_off</span>
                Modo Offline ({pendingCount} ventas en cola)
              </button>
            ) : pendingCount > 0 ? (
              <button
                type="button"
                onClick={() => sincronizarAhora()}
                title="Clic para sincronizar ventas pendientes con el servidor"
                className="inline-flex items-center gap-1.5 px-space-xs py-space-2xs bg-primary/10 text-primary border border-primary/30 rounded font-label-sm text-label-sm font-bold hover:bg-primary/20 transition-colors"
              >
                <span className="material-symbols-outlined text-xs">cloud_upload</span>
                {pendingCount} por sincronizar (Sincronizar ahora)
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-space-xs py-space-2xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded font-label-sm text-label-sm font-semibold">
                <span className="material-symbols-outlined text-xs text-emerald-600">cloud_done</span>
                En Línea • Sincronizado
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-space-xs flex-wrap">
          {onNavigateToCaja && (
            <button
              type="button"
              onClick={onNavigateToCaja}
              className={`font-label-sm text-label-sm px-space-sm py-space-xs rounded font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 ${
                turnoActivo 
                  ? 'bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface' 
                  : 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
              }`}
              title="Ir al módulo de Caja y Arqueo"
            >
              <span className="material-symbols-outlined text-base">point_of_sale</span>
              {turnoActivo ? 'Caja / Arqueo' : '¡Abrir Caja!'}
            </button>
          )}

          <button
            type="button"
            onClick={handleNuevaVenta}
            className="font-label-sm text-label-sm bg-surface-container hover:bg-surface-container-high px-space-sm py-space-xs rounded text-secondary hover:text-on-surface transition-colors cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
            title="Iniciar nueva venta y limpiar carrito (F2)"
          >
            <strong className="text-on-surface font-bold">F2</strong> Nueva Venta
          </button>

          <button
            type="button"
            onClick={handleFocusBuscar}
            className="font-label-sm text-label-sm bg-surface-container hover:bg-surface-container-high px-space-sm py-space-xs rounded text-secondary hover:text-on-surface transition-colors cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
            title="Buscar producto o código de barras (F4)"
          >
            <strong className="text-on-surface font-bold">F4</strong> Buscar
          </button>

          <button
            type="button"
            onClick={() => setIsNewClientModalOpen(true)}
            className="font-label-sm text-label-sm bg-surface-container hover:bg-surface-container-high px-space-sm py-space-xs rounded text-secondary hover:text-on-surface transition-colors cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
            title="Seleccionar o registrar cliente (F8)"
          >
            <strong className="text-on-surface font-bold">F8</strong> Cliente
          </button>

          <button
            type="button"
            onClick={handleOpenCheckout}
            disabled={cart.length === 0}
            className="font-label-sm text-label-sm bg-primary hover:bg-primary-container text-on-primary px-space-sm py-space-xs rounded font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-sm disabled:opacity-50 active:scale-95"
            title="Abrir drawer de cobro multimoneda (F12)"
          >
            F12 Cobro Rápido
          </button>
        </div>
      </div>

      {/* Banner de aviso si no hay turno abierto */}
      {!turnoActivo && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-space-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-2xl text-amber-600">lock_clock</span>
            <div>
              <h4 className="font-label-lg font-bold">No hay un turno de caja abierto</h4>
              <p className="font-body-sm text-secondary">
                Abre un turno con el fondo de caja inicial en USD y Pesos COP para que tus ventas y movimientos queden cuadrados en el arqueo diario.
              </p>
            </div>
          </div>
          {onNavigateToCaja && (
            <button
              type="button"
              onClick={onNavigateToCaja}
              className="px-space-md py-space-xs bg-amber-600 hover:bg-amber-700 text-white rounded font-label-md font-bold transition-colors shrink-0 flex items-center gap-1 shadow-sm"
            >
              <span className="material-symbols-outlined text-base">payments</span>
              Abrir Turno de Caja
            </button>
          )}
        </div>
      )}

      {/* Selector móvil de pestaña Catálogo / Carrito */}
      <div className="flex lg:hidden bg-surface-container p-1 rounded-xl w-full select-none shadow-sm mb-space-xs">
        <button
          type="button"
          onClick={() => setMobileTab('catalogo')}
          className={`flex-1 py-2.5 px-3 rounded-lg font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'catalogo'
              ? 'bg-surface-container-lowest text-on-surface shadow-sm font-bold'
              : 'text-secondary hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">grid_view</span>
          <span>Catálogo ({filteredProductos.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('carrito')}
          className={`flex-1 py-2.5 px-3 rounded-lg font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all relative ${
            mobileTab === 'carrito'
              ? 'bg-surface-container-lowest text-on-surface shadow-sm font-bold'
              : 'text-secondary hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">shopping_cart</span>
          <span>Carrito</span>
          {cart.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-primary text-on-primary ml-1">
              {cart.reduce((a, b) => a + b.cantidad, 0)} (${total.toFixed(2)})
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* LEFT PANEL (60%): Search, Categories & Quick-Touch Product Grid */}
        <section className={`lg:col-span-7 xl:col-span-7 flex flex-col gap-space-md ${mobileTab === 'carrito' ? 'hidden lg:flex' : 'flex'}`}>
          {/* Barcode / SKU Multifunctional Omnibar */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-sm">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-space-md text-primary text-2xl animate-pulse">
              barcode_scanner
            </span>
            <input
              ref={searchInputRef}
              autoFocus
              className="w-full pl-12 pr-28 py-space-md bg-surface-container-low rounded font-body-lg text-body-lg text-on-surface placeholder:text-secondary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-inner"
              placeholder="Escanear código de barras o escribir nombre/SKU (ej: CLAVO, TALADRO, PVC)..."
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="absolute right-space-sm flex items-center gap-space-xs">
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="p-space-xs text-secondary hover:text-on-surface"
                  title="Limpiar"
                  type="button"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
              <button
                className="flex items-center gap-space-2xs px-space-sm py-space-xs bg-surface-container hover:bg-surface-container-high rounded text-on-surface font-label-sm text-label-sm"
                type="button"
              >
                <span className="material-symbols-outlined text-sm">tune</span>
                <span>Filtro</span>
              </button>
            </div>
          </div>

          {/* Quick Categories Rail */}
          <div className="flex items-center gap-space-xs overflow-x-auto pb-space-2xs scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategoria('todas')}
              className={`shrink-0 px-space-md py-space-xs rounded font-label-md text-label-md shadow-sm transition-colors ${
                selectedCategoria === 'todas'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface'
              }`}
            >
              Todos ({productos.length})
            </button>
            {categorias.map(cat => {
              const isSelected = selectedCategoria === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoria(cat.id)}
                  className={`shrink-0 px-space-md py-space-xs rounded font-label-md text-label-md transition-colors ${
                    isSelected
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface'
                  }`}
                >
                  {cat.nombre}
                </button>
              );
            })}
          </div>
        </div>

        {/* High Rotation Product Touch-Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-space-md">
          {filteredProductos.map(prod => {
            const inCart = cart.find(i => i.producto.id === prod.id);
            const availableStock = prod.stockActual - (inCart?.cantidad || 0);
            const isCritico = prod.stockActual <= prod.stockMinimo;
            const isAgotado = prod.stockActual <= 0 || availableStock <= 0;

            return (
              <div
                key={prod.id}
                onClick={() => !isAgotado && addToCart(prod)}
                className={`group cursor-pointer bg-surface-container-lowest rounded-xl p-space-sm shadow-sm hover:shadow-md hover:bg-surface-container-low/80 transition-all flex flex-col justify-between select-none relative ${
                  isAgotado ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isCritico && (
                  <span className="absolute top-3 right-3 z-10 font-label-sm text-label-sm px-space-xs py-space-2xs rounded bg-error-container text-on-error-container font-bold shadow-sm">
                    Bajo Stock ({prod.stockActual})
                  </span>
                )}
                <div className="relative w-full aspect-square rounded bg-surface-container overflow-hidden mb-space-xs flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-4xl group-hover:scale-110 transition-transform duration-300">
                    construction
                  </span>
                  <span className="absolute top-1 left-1 font-label-sm text-label-sm px-space-xs py-space-2xs rounded bg-surface-container-lowest/90 text-on-surface backdrop-blur-sm">
                    {prod.codigo}
                  </span>
                </div>
                <div className="flex flex-col">
                  <h3 className="font-label-lg text-label-lg text-on-surface leading-snug line-clamp-2 font-bold">
                    {prod.nombre}
                  </h3>
                  <span className="font-body-sm text-body-sm text-secondary">
                    {prod.categoria?.nombre || 'General'}
                  </span>
                </div>
                <div className="flex items-end justify-between mt-space-sm pt-space-xs">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-secondary">
                      Stock: <strong className={isCritico ? 'text-error font-bold' : 'text-on-surface'}>
                        {availableStock} {prod.unidadMedida}
                      </strong>
                    </span>
                    <span className="font-headline-sm text-headline-sm font-bold text-primary">
                      ${Number(prod.precioVenta).toFixed(2)}
                    </span>
                  </div>
                  <button
                    disabled={isAgotado}
                    className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center group-hover:bg-primary-container transition-colors shadow-sm disabled:opacity-40"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

          {/* Barra Flotante de Carrito en Móvil (Visible solo en Catálogo cuando hay productos) */}
          {cart.length > 0 && mobileTab === 'catalogo' && (
            <div className="lg:hidden fixed bottom-20 left-3 right-3 z-30 animate-in slide-in-from-bottom duration-200">
              <button
                type="button"
                onClick={() => setMobileTab('carrito')}
                className="w-full py-3.5 px-4 rounded-2xl bg-primary text-on-primary font-label-lg font-bold flex items-center justify-between shadow-2xl active:scale-[0.98] transition-transform border border-white/20"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-on-primary/20 flex items-center justify-center text-xs font-bold">
                    {cart.reduce((a, b) => a + b.cantidad, 0)}
                  </span>
                  <span>Ver Carrito de Compra</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-extrabold">${total.toFixed(2)}</span>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </div>
              </button>
            </div>
          )}
        </section>

        {/* RIGHT PANEL (40%): Cart, Customer Selector & Checkout (Sticky) */}
        <section className={`lg:col-span-5 xl:col-span-5 flex flex-col gap-space-md sticky top-20 ${mobileTab === 'catalogo' ? 'hidden lg:flex' : 'flex'}`}>
          {/* Botón Volver al Catálogo en Móvil */}
          <div className="lg:hidden pb-1">
            <button
              type="button"
              onClick={() => setMobileTab('catalogo')}
              className="flex items-center gap-1 text-xs text-primary font-bold hover:underline"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>← Seguir agregando productos del catálogo</span>
            </button>
          </div>

          {/* Ticket Box Container */}
          <div className="bg-surface-container-lowest rounded-xl shadow-md p-space-md flex flex-col gap-space-md">
          {/* Header Info / Ticket # */}
          <div className="flex items-center justify-between pb-space-sm border-b-0">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary text-2xl">receipt_long</span>
              <div>
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface tracking-tight">
                  Comprobante Actual
                </span>
                <div className="font-label-sm text-label-sm text-secondary">
                  Nueva venta • El número se asigna al confirmar
                </div>
              </div>
            </div>
            <div className="flex items-center gap-space-xs">
              <button
                onClick={clearCart}
                className="p-space-xs rounded text-secondary hover:bg-error-container hover:text-error transition-colors"
                title="Limpiar Carrito"
                type="button"
              >
                <span className="material-symbols-outlined text-xl">delete_sweep</span>
              </button>
            </div>
          </div>

          {/* Customer Selector / Quick Lookup (RF11) */}
          <div className="bg-surface-container-low rounded-xl p-space-sm flex items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-sm min-w-0">
              <div className="w-9 h-9 rounded bg-surface-container-high flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-lg">corporate_fare</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-space-xs">
                  <span className="font-label-md text-label-md font-bold text-on-surface truncate">
                    {selectedClientObj?.nombre || 'Consorcio Constructor Norte C.A.'}
                  </span>
                  <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-space-2xs rounded">
                    Crédito Aprobado
                  </span>
                </div>
                <span className="font-body-sm text-body-sm text-secondary truncate">
                  RIF/CI: {selectedClientObj?.identificacion || 'J-30894102-1'} • Tasa Especial Mayorista
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsNewClientModalOpen(true)}
              className="shrink-0 flex items-center gap-space-2xs px-space-sm py-space-xs bg-surface-container-lowest hover:bg-surface-container text-on-surface rounded font-label-sm text-label-sm shadow-sm transition-colors"
              type="button"
            >
              <kbd className="font-label-sm text-label-sm bg-surface-container-highest px-space-2xs rounded">F8</kbd>
              <span>Cambiar</span>
            </button>
          </div>

          {error && (
            <div className="p-space-sm rounded bg-error-container text-error font-body-sm text-body-sm flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Cart Table Items */}
          <div className="flex flex-col">
            <div className="grid grid-cols-12 text-secondary font-label-sm text-label-sm uppercase py-space-xs px-space-2xs">
              <span className="col-span-6">Descripción</span>
              <span className="col-span-3 text-center">Cant.</span>
              <span className="col-span-3 text-right">Subtotal</span>
            </div>
            <div className="flex flex-col max-h-[300px] overflow-y-auto divide-y-0" id="cart-container">
              {cart.length === 0 ? (
                <div className="py-space-2xl text-center text-secondary font-body-sm text-body-sm">
                  El carrito está vacío. Haz clic en los artículos de la izquierda.
                </div>
              ) : (
                cart.map(item => (
                  <div
                    key={item.producto.id}
                    className="grid grid-cols-12 items-center py-space-sm px-space-2xs hover:bg-surface-container-low/50 rounded transition-colors group"
                  >
                    <div className="col-span-6 flex flex-col pr-space-xs">
                      <span className="font-label-md text-label-md font-bold text-on-surface truncate">
                        {item.producto.nombre}
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">
                        {item.producto.codigo} • ${Number(item.producto.precioVenta).toFixed(2)} c/u
                      </span>
                    </div>
                    <div className="col-span-3 flex items-center justify-center gap-space-2xs">
                      <button
                        onClick={() => updateQuantity(item.producto.id, -1)}
                        className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center font-bold"
                        type="button"
                      >
                        -
                      </button>
                      <input
                        readOnly
                        className="w-8 text-center font-label-md text-label-md bg-transparent border-none focus:outline-none text-on-surface font-bold"
                        type="text"
                        value={item.cantidad}
                      />
                      <button
                        onClick={() => updateQuantity(item.producto.id, 1)}
                        disabled={item.cantidad >= item.producto.stockActual}
                        className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center font-bold disabled:opacity-40"
                        type="button"
                      >
                        +
                      </button>
                    </div>
                    <div className="col-span-3 flex items-center justify-end gap-space-xs">
                      <span className="font-label-lg text-label-lg font-bold text-on-surface">
                        ${(item.cantidad * item.producto.precioVenta).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.producto.id)}
                        className="opacity-0 group-hover:opacity-100 text-secondary hover:text-error transition-opacity"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Métodos de Pago Multimoneda (Guasdualito, Apure) */}
          <div className="flex flex-col gap-space-xs pt-space-xs">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase text-secondary font-bold">
                Métodos de Cobro (3 Monedas)
              </span>
              <span className="font-label-xs text-label-xs bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                Guasdualito
              </span>
            </div>

            {/* Agrupados por moneda como exige la especificación */}
            <div className="flex flex-col gap-1.5" id="payment-methods">
              {/* Dólares (USD) */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 w-16 shrink-0">USD ($):</span>
                <div className="grid grid-cols-2 gap-1.5 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (cart.length > 0) {
                        handleQuickFill(MetodoPago.EFECTIVO_USD);
                        setIsCheckoutDrawerOpen(true);
                      }
                    }}
                    disabled={cart.length === 0}
                    className="py-1.5 px-2 rounded-lg bg-surface-container-low hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-surface-container text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm text-emerald-600">payments</span>
                    <span>Efectivo USD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (cart.length > 0) {
                        handleQuickFill(MetodoPago.ZELLE_USD);
                        setIsCheckoutDrawerOpen(true);
                      }
                    }}
                    disabled={cart.length === 0}
                    className="py-1.5 px-2 rounded-lg bg-surface-container-low hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-surface-container text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm text-emerald-600">send_to_mobile</span>
                    <span>Zelle</span>
                  </button>
                </div>
              </div>

              {/* Bolívares (VES) */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 w-16 shrink-0">Bs. (VES):</span>
                <div className="grid grid-cols-2 gap-1.5 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (cart.length > 0) {
                        handleQuickFill(MetodoPago.PAGO_MOVIL_VES);
                        setIsCheckoutDrawerOpen(true);
                      }
                    }}
                    disabled={cart.length === 0}
                    className="py-1.5 px-2 rounded-lg bg-surface-container-low hover:bg-blue-500/10 hover:border-blue-500/30 border border-surface-container text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm text-blue-600">smartphone</span>
                    <span>Pago Móvil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (cart.length > 0) {
                        handleQuickFill(MetodoPago.TARJETA_VES);
                        setIsCheckoutDrawerOpen(true);
                      }
                    }}
                    disabled={cart.length === 0}
                    className="py-1.5 px-2 rounded-lg bg-surface-container-low hover:bg-blue-500/10 hover:border-blue-500/30 border border-surface-container text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm text-blue-600">credit_card</span>
                    <span>Tarjeta</span>
                  </button>
                </div>
              </div>

              {/* Pesos (COP) */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 w-16 shrink-0">COP ($):</span>
                <div className="grid grid-cols-1 gap-1.5 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (cart.length > 0) {
                        handleQuickFill(MetodoPago.EFECTIVO_COP);
                        setIsCheckoutDrawerOpen(true);
                      }
                    }}
                    disabled={cart.length === 0}
                    className="py-1.5 px-2 rounded-lg bg-surface-container-low hover:bg-amber-500/10 hover:border-amber-500/30 border border-surface-container text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm text-amber-600">local_atm</span>
                    <span>Efectivo Pesos (COP)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown & Totalizer Banner */}
          <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col gap-space-xs">
            <div className="flex justify-between items-center text-secondary font-body-md text-body-md">
              <span>Subtotal Gravable</span>
              <span className="text-on-surface font-bold">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-secondary font-body-md text-body-md">
              <span>Descuento Comercial (0%)</span>
              <span className="text-on-surface">$0.00</span>
            </div>
            <div className="flex justify-between items-center text-secondary font-body-md text-body-md">
              <span>Impuesto IVA (16.0%)</span>
              <span className="text-on-surface font-bold">${impuesto.toFixed(2)}</span>
            </div>

            {/* Prominent High-Contrast Total Due */}
            <div className="mt-space-xs pt-space-sm bg-inverse-surface text-inverse-on-surface p-space-md rounded flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed-dim">
                  Total a Cobrar
                </span>
                <span className="font-body-sm text-body-sm text-tertiary-fixed-dim">
                  Incluye todos los tributos
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-headline-sm text-headline-sm text-primary-fixed-dim font-bold">$</span>
                <span className="font-display-lg text-display-lg font-bold text-primary-fixed tracking-tight">
                  {total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom POS Action Trigger Buttons */}
          <div className="flex flex-col sm:flex-row gap-space-sm pt-space-2xs">
            <button
              className="flex-1 py-space-md px-space-md rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-lg text-label-lg flex items-center justify-center gap-space-xs transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-base">pause_circle</span>
              <span>En Espera</span>
            </button>
            <button
              disabled={cart.length === 0 || submitting}
              onClick={handleOpenCheckout}
              className="flex-[2] py-space-md px-space-md rounded bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm font-bold flex items-center justify-center gap-space-sm shadow-md transition-transform active:scale-[0.98] disabled:opacity-50"
              type="button"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">print</span>
                  <span>COBRAR E IMPRIMIR</span>
                  <kbd className="font-label-sm text-label-sm bg-on-primary/20 px-space-2xs rounded ml-space-2xs text-on-primary">
                    F12
                  </kbd>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Drawer / Daily Sales Micro Metric */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-space-md">
            <div className="w-10 h-10 rounded bg-tertiary/10 text-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined">point_of_sale</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md font-bold text-on-surface">Ventas del Turno Mañana</span>
              <span className="font-body-sm text-body-sm text-secondary">42 tickets emitidos sin incidentes</span>
            </div>
          </div>
          <div className="text-right">
            <span className="font-headline-sm text-headline-sm font-bold text-tertiary">$3,840.50</span>
          </div>
        </div>
      </section>
      </div>

      {/* DRAWER DE COBRO MULTIMONEDA (GUASDUALITO, APURE) */}
      {isCheckoutDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => !submitting && setIsCheckoutDrawerOpen(false)} />

          <div className="relative w-full max-w-2xl h-full bg-surface-container-lowest border-l border-surface-container shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-space-lg border-b border-surface-container bg-surface-container-low flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-2xl">point_of_sale</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Cobro de Venta Multimoneda
                  </h2>
                  <p className="font-body-sm text-body-sm text-secondary">
                    Cliente: <span className="font-bold text-on-surface">{selectedClientObj?.nombre}</span> ({selectedClientObj?.identificacion})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setIsCheckoutDrawerOpen(false)}
                className="p-2 rounded-xl text-secondary hover:text-on-surface hover:bg-surface-container transition"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-space-md sm:p-space-lg flex flex-col gap-space-md sm:gap-space-lg">
              {/* 3 Bento Cards de Totales Equivalentes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
                {/* USD ($) */}
                <div className="p-space-md rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-label-xs text-label-xs uppercase font-bold text-emerald-700 dark:text-emerald-300">
                      Total USD ($)
                    </span>
                    <span className="material-symbols-outlined text-emerald-600 text-lg">attach_money</span>
                  </div>
                  <div className="mt-space-xs">
                    <span className="font-display-sm text-display-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-600/80 mt-1">Moneda ancla</span>
                </div>

                {/* VES (Bs.) */}
                <div className="p-space-md rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-label-xs text-label-xs uppercase font-bold text-blue-700 dark:text-blue-300">
                      Total VES (Bs.)
                    </span>
                    <span className="material-symbols-outlined text-blue-600 text-lg">trending_up</span>
                  </div>
                  <div className="mt-space-xs">
                    <span className="font-display-sm text-display-sm font-extrabold text-blue-700 dark:text-blue-300">
                      Bs. {(total * tasaVes).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <span className="text-[10px] text-blue-600/80 mt-1">Tasa: {tasaVes.toFixed(2)} Bs/$</span>
                </div>

                {/* COP ($COP) */}
                <div className="p-space-md rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-label-xs text-label-xs uppercase font-bold text-amber-700 dark:text-amber-300">
                      Total COP ($COP)
                    </span>
                    <span className="material-symbols-outlined text-amber-600 text-lg">payments</span>
                  </div>
                  <div className="mt-space-xs">
                    <span className="font-display-sm text-display-sm font-extrabold text-amber-700 dark:text-amber-300">
                      {Math.round(total * tasaCop).toLocaleString('es-CO')}
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-600/80 mt-1">Tasa: {tasaCop.toLocaleString()} COP/$</span>
                </div>
              </div>

              {/* Botones de Llenado Rápido (Pago Completo) */}
              <div className="flex flex-col gap-space-2xs">
                <span className="font-label-sm text-label-sm text-secondary uppercase font-bold tracking-wider">
                  Cobro Rápido (1 Clic):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs">
                  <button
                    type="button"
                    onClick={() => handleQuickFill(MetodoPago.EFECTIVO_USD)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container border border-surface-container text-xs font-semibold text-on-surface transition"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Todo en USD ($)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill(MetodoPago.PAGO_MOVIL_VES)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container border border-surface-container text-xs font-semibold text-on-surface transition"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Todo en VES (Bs.)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill(MetodoPago.EFECTIVO_COP)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container border border-surface-container text-xs font-semibold text-on-surface transition"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Todo en COP ($COP)</span>
                  </button>
                </div>
              </div>

              {/* Desglose de Líneas de Pago (Pagos Mixtos) */}
              <div className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md font-bold text-on-surface">
                    Líneas de Pago ({lineasPago.length}):
                  </span>
                  <button
                    type="button"
                    onClick={handleAddPaymentLine}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-container px-2 py-1 rounded bg-primary/10 transition"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span>Agregar otra moneda / método</span>
                  </button>
                </div>

                <div className="flex flex-col gap-space-sm">
                  {lineasPago.map((linea, index) => {
                    const equivUsd = getMontoUsd(linea);
                    return (
                      <div
                        key={linea.id}
                        className="p-space-md rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-space-sm relative"
                      >
                        <div className="flex items-center justify-between gap-space-xs">
                          <div className="flex items-center gap-space-xs">
                            <span className="w-5 h-5 rounded-full bg-surface-container-high text-secondary flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </span>
                            <select
                              value={linea.metodoPago}
                              onChange={e => handleUpdatePaymentLine(linea.id, { metodoPago: e.target.value as MetodoPago })}
                              className="px-2.5 py-1.5 bg-surface-container-lowest border border-surface-container rounded-lg text-xs font-bold text-on-surface outline-none focus:ring-1 focus:ring-primary"
                            >
                              {METODOS_OPCIONES.map(opt => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${METODOS_OPCIONES.find(m => m.id === linea.metodoPago)?.badgeClass || ''}`}>
                              {linea.moneda}
                            </span>
                          </div>

                          {lineasPago.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePaymentLine(linea.id)}
                              className="p-1 rounded text-red-500 hover:bg-red-500/10 transition"
                              title="Eliminar línea"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm items-center">
                          {/* Monto Recibido en la moneda */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-secondary">
                              Monto Recibido ({linea.moneda}):
                            </label>
                            <div className="relative flex items-center">
                              <span className="absolute left-2.5 text-xs text-secondary font-bold">
                                {linea.moneda === Moneda.USD ? '$' : linea.moneda === Moneda.VES ? 'Bs.' : '$COP'}
                              </span>
                              <input
                                type="number"
                                step={linea.moneda === Moneda.COP ? '100' : '0.01'}
                                min="0"
                                value={linea.montoMoneda || ''}
                                onChange={e => handleUpdatePaymentLine(linea.id, { montoMoneda: parseFloat(e.target.value) || 0 })}
                                placeholder="0.00"
                                className="w-full pl-8 pr-2.5 py-1.5 bg-surface-container-lowest border border-surface-container rounded-lg text-sm font-bold text-on-surface outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                          </div>

                          {/* Tasa Aplicada (Informativa / Congelada) */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-secondary">
                              Tasa Congelada:
                            </label>
                            <div className="px-2.5 py-1.5 bg-surface-container rounded-lg text-xs font-mono text-secondary flex items-center justify-between">
                              <span>1 USD =</span>
                              <span className="font-bold text-on-surface">
                                {linea.moneda === Moneda.USD ? '1.00' : linea.moneda === Moneda.VES ? `${linea.tasaAplicada.toFixed(2)} Bs` : `${linea.tasaAplicada.toLocaleString()} COP`}
                              </span>
                            </div>
                          </div>

                          {/* Equivalente USD */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-secondary">
                              Equivalente USD:
                            </label>
                            <div className="px-2.5 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-xs font-bold text-primary flex items-center justify-between">
                              <span>Valor:</span>
                              <span className="font-extrabold text-sm">${equivUsd.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Referencia bancaria */}
                        {(linea.metodoPago === MetodoPago.PAGO_MOVIL_VES || linea.metodoPago === MetodoPago.TARJETA_VES || linea.metodoPago === MetodoPago.ZELLE_USD) && (
                          <div className="flex items-center gap-space-xs pt-1 border-t border-surface-container/60">
                            <span className="material-symbols-outlined text-secondary text-sm">tag</span>
                            <input
                              type="text"
                              value={linea.referencia}
                              onChange={e => handleUpdatePaymentLine(linea.id, { referencia: e.target.value })}
                              placeholder="Número de Referencia / Aprobación bancaria..."
                              className="w-full px-2 py-1 bg-surface-container-lowest border border-surface-container rounded text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Balance y Vuelto en Tiempo Real */}
              <div className="p-space-md rounded-2xl bg-surface-container-low border border-surface-container flex flex-col gap-space-sm">
                <div className="flex justify-between items-center text-sm font-semibold text-secondary">
                  <span>Total Venta Requerido:</span>
                  <span className="font-bold text-on-surface">${total.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-secondary">
                  <span>Total Pagos Recibidos:</span>
                  <span className="font-bold text-primary">${totalPagadoUsd.toFixed(2)} USD</span>
                </div>

                <div className="pt-space-xs border-t border-surface-container">
                  {faltaDinero && (
                    <div className="p-space-sm rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 flex items-start gap-space-xs">
                      <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">error</span>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs">Falta por pagar:</span>
                        <span className="font-extrabold text-base">
                          ${Math.abs(diferenciaUsd).toFixed(2)} USD
                        </span>
                        <span className="text-[11px] text-red-600/80">
                          Equivale a Bs. {(Math.abs(diferenciaUsd) * tasaVes).toFixed(2)} ó {Math.round(Math.abs(diferenciaUsd) * tasaCop).toLocaleString()} COP
                        </span>
                      </div>
                    </div>
                  )}

                  {!faltaDinero && !cobro.vueltoMoneda && !cobro.bloqueo && (
                    <div className="p-space-sm rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-lg">check_circle</span>
                      <span className="font-bold text-xs">¡Pago Completo! Monto cubierto exactamente.</span>
                    </div>
                  )}

                  {!faltaDinero && cobro.bloqueo && (
                    <div className="p-space-sm rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 flex items-start gap-space-xs">
                      <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">block</span>
                      <span className="font-bold text-xs">{cobro.bloqueo}</span>
                    </div>
                  )}

                  {!faltaDinero && cobro.vueltoMoneda && (
                    <div className="p-space-sm rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 flex items-start gap-space-xs">
                      <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">currency_exchange</span>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs">Vuelto / Cambio a entregar al cliente:</span>
                        <span className="font-extrabold text-base">
                          {monedaVuelto === Moneda.USD && `$${vueltoMonto.toFixed(2)} USD`}
                          {monedaVuelto === Moneda.VES && `Bs. ${vueltoMonto.toFixed(2)}`}
                          {monedaVuelto === Moneda.COP && `${vueltoMonto.toLocaleString()} COP`}
                        </span>
                        {cobro.monedasEfectivo.length > 1 ? (
                          <label className="text-[11px] text-blue-600/80 flex items-center gap-1 mt-1">
                            Entregar vuelto en:
                            <select
                              value={monedaVuelto}
                              onChange={e => setVueltoMonedaElegida(e.target.value as Moneda)}
                              className="bg-transparent border border-blue-500/30 rounded px-1 font-bold"
                            >
                              {cobro.monedasEfectivo.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <span className="text-[11px] text-blue-600/80">
                            (Se entrega en {monedaVuelto}, la moneda del efectivo recibido)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-space-sm rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">warning</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-space-lg border-t border-surface-container bg-surface-container-low flex items-center justify-end gap-space-sm">
              <button
                type="button"
                onClick={() => !submitting && setIsCheckoutDrawerOpen(false)}
                className="py-2.5 px-space-md rounded-xl text-secondary hover:bg-surface-container text-xs font-bold transition"
              >
                Cancelar / Volver
              </button>
              <button
                type="button"
                disabled={faltaDinero || !!cobro.bloqueo || submitting}
                onClick={handleConfirmSale}
                className="py-2.5 px-space-lg rounded-xl bg-primary hover:bg-primary-container text-on-primary font-bold text-sm shadow-md transition disabled:opacity-40 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Procesando Venta...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                    <span>Confirmar Venta y Emitir Comprobante</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ticket / Comprobante */}
      {receiptVenta && (
        <ComprobanteModal
          ventaId={receiptVenta.id}
          initialVenta={receiptVenta}
          onClose={() => setReceiptVenta(null)}
        />
      )}

      {/* Modal para Crear Cliente Rápido */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-surface-container-lowest border border-surface-container rounded-xl shadow-2xl p-space-md relative">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-space-sm flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary text-xl">person_add</span>
              <span>Registrar Cliente Rápido</span>
            </h3>

            <form onSubmit={handleCreateNewClient} className="space-y-space-sm font-body-sm text-body-sm">
              <div>
                <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={newClientNombre}
                  onChange={e => setNewClientNombre(e.target.value)}
                  placeholder="Ej: Pedro Martínez"
                  className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Cédula / RIF *</label>
                <input
                  type="text"
                  required
                  value={newClientId}
                  onChange={e => setNewClientId(e.target.value)}
                  placeholder="V-12345678"
                  className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary uppercase font-mono"
                />
              </div>

              <div>
                <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Teléfono</label>
                <input
                  type="text"
                  value={newClientTelefono}
                  onChange={e => setNewClientTelefono(e.target.value)}
                  placeholder="0414-1234567"
                  className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-space-xs pt-space-xs border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsNewClientModalOpen(false)}
                  className="py-space-xs px-space-sm rounded text-secondary hover:bg-surface-container transition-colors font-label-md text-label-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-space-xs px-space-md bg-primary hover:bg-primary-container text-on-primary font-bold rounded shadow-sm transition-colors font-label-md text-label-md"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
