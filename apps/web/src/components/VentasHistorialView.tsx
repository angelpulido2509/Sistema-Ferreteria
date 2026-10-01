import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  EstadoVenta,
  MetodoPago,
  Moneda,
  type VentaDTO,
} from '@ferreteria/shared';
import { api } from '../lib/api';
import { useSyncStatus } from '../lib/syncManager';
import { offlineDb, type VentaOffline } from '../lib/offlineDb';
import { ComprobanteModal } from './ComprobanteModal';

interface VentasHistorialViewProps {
  ventas: VentaDTO[];
  onAnularVenta: (ventaId: string, motivo: string) => Promise<void>;
  onVerComprobante?: (ventaId: string) => void;
  canVoid: boolean;
}

// Tooltip de ayuda contextual simplificada
const HelpTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-space-2xs align-middle">
      <button
        type="button"
        aria-label="Ayuda"
        onClick={e => {
          e.stopPropagation();
          setShow(!show);
        }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-4 h-4 rounded-full bg-surface-container-high text-secondary hover:text-on-surface hover:bg-surface-container-highest flex items-center justify-center text-[10px] font-bold transition-colors cursor-help"
      >
        ?
      </button>
      {show && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-56 p-space-sm bg-inverse-surface text-inverse-on-surface text-label-sm font-normal rounded shadow-lg pointer-events-none animate-in fade-in zoom-in-95 duration-150 block text-left">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-inverse-surface" />
        </span>
      )}
    </span>
  );
};

export const VentasHistorialView: React.FC<VentasHistorialViewProps> = ({
  ventas,
  onAnularVenta,
  onVerComprobante,
  canVoid,
}) => {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'hoy' | 'ayer' | 'semana' | 'mes'>('hoy');
  const [cashierFilter, setCashierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [selectedVentaId, setSelectedVentaId] = useState<string | null>(ventas[0]?.id || null);

  // Modal de anulación
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidMotivo, setVoidMotivo] = useState('1');
  const [voidObservacion, setVoidObservacion] = useState('');
  const [submittingVoid, setSubmittingVoid] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Configuración de tasas multimoneda
  const { data: config } = useQuery({
    queryKey: ['configuracion'],
    queryFn: api.getConfiguracion,
  });
  const tasaVes = config?.tasaVes ?? 60.0;
  const tasaCop = config?.tasaCop ?? 4100.0;

  // Modal de Cierre de Caja (Arqueo)
  const [isCierreModalOpen, setIsCierreModalOpen] = useState(false);
  const [cierrePeriodo, setCierrePeriodo] = useState<'hoy' | 'ayer' | 'semana' | 'mes'>('hoy');

  // Estado de sincronización offline
  const { isOnline: _isOnline, isSyncing, pendingCount, sincronizarAhora } = useSyncStatus();
  const { data: ventasOffline, refetch: refetchOffline } = useQuery({
    queryKey: ['ventasOffline', pendingCount],
    queryFn: () => offlineDb.obtenerVentasPendientes(),
  });
  const [comprobanteOffline, setComprobanteOffline] = useState<VentaOffline | null>(null);

  // Cálculos de KPIs esenciales (máximo 3 tarjetas)
  const ventasCompletadas = ventas.filter(v => v.estado !== EstadoVenta.ANULADA);
  const ventasAnuladas = ventas.filter(v => v.estado === EstadoVenta.ANULADA);
  const totalMontoVentas = ventasCompletadas.reduce((acc, v) => acc + Number(v.total), 0);
  const totalMontoAnulado = ventasAnuladas.reduce((acc, v) => acc + Number(v.total), 0);
  const ticketPromedio = ventasCompletadas.length > 0 ? totalMontoVentas / ventasCompletadas.length : 0;

  // Filtrado de ventas
  const filteredVentas = ventas.filter(v => {
    const q = search.toLowerCase();
    const clienteName = v.cliente?.nombre.toLowerCase() || '';
    const facNum = `vta-2024-${String(v.id).padStart(4, '0')}`.toLowerCase();
    const docId = v.cliente?.identificacion.toLowerCase() || '';
    const matchesSearch = !search || clienteName.includes(q) || facNum.includes(q) || docId.includes(q);

    let matchesStatus = true;
    if (statusFilter === 'completed') matchesStatus = v.estado !== EstadoVenta.ANULADA;
    else if (statusFilter === 'cancelled') matchesStatus = v.estado === EstadoVenta.ANULADA;

    return matchesSearch && matchesStatus;
  });

  const activeVenta = ventas.find(v => v.id === selectedVentaId) || filteredVentas[0] || ventas[0] || null;

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVenta) return;

    setSubmittingVoid(true);
    setVoidError(null);
    try {
      const motivoTexto = [
        voidMotivo === '1' && 'Error en ítem facturado / despacho incorrecto',
        voidMotivo === '2' && 'Devolución de mercancía por garantía o defecto',
        voidMotivo === '3' && 'Error de cajero en método de cobro o moneda',
        voidMotivo === '4' && 'Cancelación de pedido a solicitud del comprador',
      ].filter(Boolean)[0] || 'Anulación solicitada';

      const fullReason = voidObservacion.trim()
        ? `${motivoTexto}: ${voidObservacion.trim()}`
        : String(motivoTexto);

      await onAnularVenta(activeVenta.id, fullReason);
      setIsVoidModalOpen(false);
      setVoidObservacion('');
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : 'Error al anular la venta');
    } finally {
      setSubmittingVoid(false);
    }
  };

  const activeSubtotal = activeVenta ? Number(activeVenta.subtotal || activeVenta.total) : 0;
  const activeImpuesto = activeVenta ? Number(activeVenta.impuesto || (Number(activeVenta.total) * 0.16)) : 0;
  const activeTotal = activeVenta ? Number(activeVenta.total) : 0;
  const activeTotalBs = activeTotal * tasaVes;
  const activeTotalCop = activeTotal * tasaCop;

  return (
    <div className="flex flex-col w-full gap-space-lg animate-fade-in">
      {/* Header Sección con lenguaje simple y sin jerga técnica */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-semibold">
              Historial de Ventas
            </span>
            <span className="text-secondary">•</span>
            <span className="font-label-sm text-label-sm text-secondary">Mostrador 01</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight mt-space-2xs">
            Registro de Ventas y Comprobantes
          </h1>
          <p className="font-body-md text-body-md text-secondary mt-space-2xs">
            Consulta facturas emitidas, reimprime recibos y gestiona anulaciones con devolución automática de stock.
          </p>
        </div>

        <div className="flex items-center gap-space-sm flex-wrap shrink-0">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-space-xs px-space-md py-space-xs h-9 bg-surface-container text-on-surface font-label-md text-label-md rounded shadow-sm hover:bg-surface-container-high transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-lg text-secondary">file_download</span>
            <span>Exportar Ventas</span>
          </button>
          <button
            onClick={() => setIsCierreModalOpen(true)}
            className="flex items-center gap-space-xs px-space-md py-space-xs h-9 bg-inverse-surface text-inverse-on-surface font-label-md text-label-md rounded shadow-sm hover:bg-secondary transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">receipt_long</span>
            <span>Cierre de Caja</span>
          </button>
        </div>
      </div>

      {/* 3 Bento Summary Cards: estructura limpia idéntica a Inventario y Contactos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        {/* Total Facturado */}
        <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
              Total Facturado
            </span>
            <span className="material-symbols-outlined text-primary text-xl">payments</span>
          </div>
          <div className="mt-space-md">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-md text-display-md text-on-surface font-extrabold tracking-tight">
                ${totalMontoVentas.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center gap-space-2xs text-secondary font-body-sm text-body-sm mt-space-2xs">
              <span className="material-symbols-outlined text-sm text-tertiary">check_circle</span>
              <span>{ventasCompletadas.length} transacciones exitosas</span>
            </div>
          </div>
        </div>

        {/* Ventas Anuladas */}
        <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                Ventas Anuladas
              </span>
              <HelpTooltip text="Ventas canceladas que devolvieron automáticamente sus productos al inventario." />
            </div>
            <span className="material-symbols-outlined text-error text-xl">remove_shopping_cart</span>
          </div>
          <div className="mt-space-md">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-md text-display-md text-error font-extrabold tracking-tight">
                {ventasAnuladas.length}
              </span>
            </div>
            <div className="flex items-center gap-space-2xs text-secondary font-body-sm text-body-sm mt-space-2xs">
              <span className="material-symbols-outlined text-sm text-error">assignment_return</span>
              <span>${totalMontoAnulado.toFixed(2)} devueltos a inventario</span>
            </div>
          </div>
        </div>

        {/* Ticket Promedio */}
        <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
              Ticket Promedio
            </span>
            <span className="material-symbols-outlined text-secondary text-xl">calculate</span>
          </div>
          <div className="mt-space-md">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-md text-display-md text-on-surface font-extrabold tracking-tight">
                ${ticketPromedio.toFixed(2)}
              </span>
              <span className="font-label-sm text-label-sm text-secondary font-medium">USD / venta</span>
            </div>
            <div className="flex items-center gap-space-2xs text-secondary font-body-sm text-body-sm mt-space-2xs">
              <span className="material-symbols-outlined text-sm">trending_flat</span>
              <span>Promedio calculado en tiempo real</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros de Facturas */}
      <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col gap-space-md">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-secondary text-lg">
              search
            </span>
            <input
              className="w-full pl-10 pr-space-md py-space-xs h-10 bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none placeholder:text-secondary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
              id="invoiceSearchInput"
              placeholder="Buscar por N° comprobante (#VTA-...), cliente o documento..."
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-space-xs overflow-x-auto pb-space-2xs lg:pb-0 shrink-0">
            {/* Filtros de Fecha */}
            <div className="flex items-center bg-surface-container-low p-space-2xs rounded">
              <button
                onClick={() => setDateFilter('hoy')}
                className={`px-space-sm py-space-xs font-label-sm text-label-sm rounded transition-all ${
                  dateFilter === 'hoy'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm font-bold'
                    : 'text-secondary hover:text-on-surface'
                }`}
                type="button"
              >
                Hoy
              </button>
              <button
                onClick={() => setDateFilter('ayer')}
                className={`px-space-sm py-space-xs font-label-sm text-label-sm rounded transition-all ${
                  dateFilter === 'ayer'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm font-bold'
                    : 'text-secondary hover:text-on-surface'
                }`}
                type="button"
              >
                Ayer
              </button>
              <button
                onClick={() => setDateFilter('semana')}
                className={`px-space-sm py-space-xs font-label-sm text-label-sm rounded transition-all ${
                  dateFilter === 'semana'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm font-bold'
                    : 'text-secondary hover:text-on-surface'
                }`}
                type="button"
              >
                Esta Semana
              </button>
              <button
                onClick={() => setDateFilter('mes')}
                className={`px-space-sm py-space-xs font-label-sm text-label-sm rounded transition-all ${
                  dateFilter === 'mes'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm font-bold'
                    : 'text-secondary hover:text-on-surface'
                }`}
                type="button"
              >
                Mes Actual
              </button>
            </div>

            {/* Filtro de Cajero */}
            <div className="flex items-center bg-surface-container-low px-space-sm py-space-xs rounded h-10 gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-base">support_agent</span>
              <select
                className="bg-transparent text-on-surface font-body-md text-body-md outline-none cursor-pointer"
                value={cashierFilter}
                onChange={e => setCashierFilter(e.target.value)}
              >
                <option value="all">Cajero: Todos</option>
                <option value="carlos">Carlos Méndez</option>
                <option value="ana">Ana Rodríguez</option>
              </select>
            </div>

            {/* Filtro de Estado */}
            <div className="flex items-center bg-surface-container-low px-space-sm py-space-xs rounded h-10 gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-base">filter_alt</span>
              <select
                className="bg-transparent text-on-surface font-body-md text-body-md outline-none cursor-pointer"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
              >
                <option value="all">Estado: Todos</option>
                <option value="completed">Completadas</option>
                <option value="cancelled">Anuladas</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Ventas Pendientes de Sincronización (Modo Offline) */}
      {ventasOffline && ventasOffline.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-space-md flex flex-col gap-space-sm shadow-xs animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-2xl text-amber-600">cloud_upload</span>
              <div>
                <h3 className="font-label-lg text-label-lg font-bold text-amber-900 dark:text-amber-300">
                  {ventasOffline.length} Venta(s) Registrada(s) sin Conexión (Offline)
                </h3>
                <p className="font-body-sm text-body-sm text-amber-800/80 dark:text-amber-400">
                  Estas ventas se guardaron en la memoria local del equipo en Guasdualito y se sincronizarán con el servidor automáticamente.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isSyncing}
              onClick={async () => {
                await sincronizarAhora();
                refetchOffline();
              }}
              className="px-space-md py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 self-start sm:self-auto"
            >
              <span className={`material-symbols-outlined text-sm ${isSyncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
            </button>
          </div>

          {/* Lista de ventas pendientes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-xs pt-space-xs">
            {ventasOffline.map(v => (
              <div
                key={v.idLocal}
                className="bg-surface-container-lowest p-space-sm rounded-lg border border-amber-500/20 flex flex-col justify-between gap-1 text-xs shadow-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-700">{v.idLocal}</span>
                  <span className="font-bold text-on-surface">${Number(v.totalUsd || v.total).toFixed(2)} USD</span>
                </div>
                <div className="text-secondary text-[11px] truncate">
                  Cliente: {v.clienteNombre || 'Consumidor Final'}
                </div>
                <div className="flex justify-between items-center text-[10px] text-secondary pt-0.5">
                  <span>{new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <button
                    type="button"
                    onClick={() => setComprobanteOffline(v)}
                    className="text-primary hover:underline font-bold"
                  >
                    Ver Comprobante
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid Principal: Listado (7 cols) + Comprobante (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Columna Izquierda: Tabla de Ventas */}
        <div className="xl:col-span-7 flex flex-col bg-surface-container-lowest rounded shadow-sm overflow-hidden">
          <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between border-b border-surface-container">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-lg">receipt_long</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Comprobantes de Venta
              </h2>
            </div>
            <span className="font-label-sm text-label-sm text-secondary bg-surface-container px-space-xs py-space-2xs rounded">
              {filteredVentas.length} registros
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high/60 text-secondary font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-space-sm px-space-md">N° Comprobante</th>
                  <th className="py-space-sm px-space-sm">Fecha</th>
                  <th className="py-space-sm px-space-md">Cliente</th>
                  <th className="py-space-sm px-space-sm">Pago</th>
                  <th className="py-space-sm px-space-md text-right">Total</th>
                  <th className="py-space-sm px-space-md text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low text-on-surface font-body-md text-body-md">
                {filteredVentas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-space-xl text-center text-secondary">
                      <div className="flex flex-col items-center justify-center gap-space-xs py-space-md">
                        <span className="material-symbols-outlined text-4xl text-secondary">receipt</span>
                        <p className="font-body-md text-body-md font-medium text-on-surface">
                          No se encontraron ventas
                        </p>
                        <p className="font-body-sm text-body-sm text-secondary">
                          {search ? 'Intenta con otro término de búsqueda o filtro.' : 'Las ventas que registres aparecerán aquí automáticamente.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVentas.map(v => {
                    const isSelected = activeVenta?.id === v.id;
                    const isAnulada = v.estado === EstadoVenta.ANULADA;
                    const facIdStr = `#VTA-2024-${String(v.id).padStart(4, '0')}`;
                    const fechaStr = new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr
                        key={v.id}
                        onClick={() => setSelectedVentaId(v.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary-fixed/25 font-medium'
                            : isAnulada
                            ? 'bg-error-container/10 hover:bg-error-container/20'
                            : 'hover:bg-surface-container-low'
                        }`}
                      >
                        <td className={`py-space-md px-space-md font-label-md text-label-md font-bold ${
                          isAnulada ? 'text-error' : isSelected ? 'text-primary' : 'text-on-surface'
                        }`}>
                          <div className="flex items-center gap-space-2xs">
                            <span className="material-symbols-outlined text-base">
                              {isAnulada ? 'block' : 'receipt'}
                            </span>
                            <span>{facIdStr}</span>
                          </div>
                        </td>
                        <td className="py-space-md px-space-sm text-secondary whitespace-nowrap font-body-sm text-body-sm">
                          {fechaStr}
                        </td>
                        <td className="py-space-md px-space-md">
                          <div className="flex flex-col">
                            <span className="font-label-md text-label-md font-medium text-on-surface">
                              {v.cliente?.nombre || 'Cliente Mostrador'}
                            </span>
                            <span className="font-body-sm text-body-sm text-secondary">
                              {v.cliente?.identificacion || 'Consumidor Final'}
                            </span>
                          </div>
                        </td>
                        <td className="py-space-md px-space-sm">
                          {v.pagos && v.pagos.length > 1 ? (
                            <span
                              title={v.pagos.map(p => {
                                const symbol = p.moneda === Moneda.USD ? '$' : p.moneda === Moneda.COP ? '$' : 'Bs.';
                                return `${p.metodoPago.replace('_', ' ')}: ${symbol}${Number(p.montoMoneda).toLocaleString('es-VE', { maximumFractionDigits: 2 })} ${p.moneda} (≈$${Number(p.montoUsd).toFixed(2)})`;
                              }).join('\n')}
                              className="font-label-sm text-label-sm bg-primary/10 text-primary border border-primary/20 font-bold px-space-xs py-space-2xs rounded whitespace-nowrap inline-flex items-center gap-1 cursor-help hover:bg-primary/20 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">call_split</span>
                              Pago Mixto ({v.pagos.length})
                            </span>
                          ) : v.pagos && v.pagos.length === 1 ? (
                            (() => {
                              const p = v.pagos[0];
                              const badgeColor =
                                p.moneda === Moneda.USD
                                  ? 'bg-primary/10 text-primary'
                                  : p.moneda === Moneda.VES
                                  ? 'bg-amber-500/10 text-amber-700'
                                  : 'bg-emerald-500/10 text-emerald-700';
                              const label =
                                p.metodoPago === MetodoPago.EFECTIVO_USD
                                  ? 'Efectivo USD'
                                  : p.metodoPago === MetodoPago.EFECTIVO_COP
                                  ? 'Efectivo COP'
                                  : p.metodoPago === MetodoPago.PAGO_MOVIL_VES
                                  ? 'Pago Móvil Bs'
                                  : p.metodoPago === MetodoPago.TARJETA_VES
                                  ? 'Tarjeta Bs'
                                  : p.metodoPago === MetodoPago.ZELLE_USD
                                  ? 'Zelle USD'
                                  : p.metodoPago;
                              return (
                                <span className={`font-label-sm text-label-sm ${badgeColor} font-medium px-space-xs py-space-2xs rounded whitespace-nowrap`}>
                                  {label}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="font-label-sm text-label-sm bg-surface-container px-space-xs py-space-2xs rounded whitespace-nowrap text-secondary">
                              {(v as any).metodoPago || 'Efectivo USD'}
                            </span>
                          )}
                        </td>
                        <td className={`py-space-md px-space-md text-right font-label-lg text-label-lg font-bold whitespace-nowrap ${
                          isAnulada ? 'text-secondary line-through' : 'text-on-surface'
                        }`}>
                          ${Number(v.total).toFixed(2)}
                        </td>
                        <td className="py-space-md px-space-md text-center">
                          {isAnulada ? (
                            <span className="font-label-sm text-label-sm bg-error-container text-on-error-container font-bold px-space-xs py-space-2xs rounded whitespace-nowrap">
                              Anulada
                            </span>
                          ) : (
                            <span className="font-label-sm text-label-sm bg-tertiary-fixed text-on-tertiary-fixed font-bold px-space-xs py-space-2xs rounded whitespace-nowrap inline-flex items-center gap-space-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                              Completada
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Columna Derecha: Detalle de Comprobante & Acciones */}
        <div className="xl:col-span-5 flex flex-col gap-space-md">
          {activeVenta ? (
            <div className="bg-surface-container-lowest rounded shadow-sm overflow-hidden border border-surface-container">
              {/* Header Comprobante */}
              <div className="bg-inverse-surface text-inverse-on-surface p-space-md flex items-center justify-between">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-primary-fixed-dim text-2xl">receipt</span>
                  <div className="flex flex-col">
                    <span className="font-label-lg text-label-lg font-bold leading-tight">
                      Comprobante #VTA-2024-{String(activeVenta.id).padStart(4, '0')}
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary-fixed-dim">
                      {new Date(activeVenta.createdAt).toLocaleDateString()} • {new Date(activeVenta.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                {activeVenta.estado === EstadoVenta.ANULADA ? (
                  <span className="font-label-sm text-label-sm bg-error text-on-error px-space-xs py-space-2xs rounded font-bold">
                    ANULADA
                  </span>
                ) : (
                  <span className="font-label-sm text-label-sm bg-tertiary text-on-tertiary px-space-xs py-space-2xs rounded font-bold">
                    Completada
                  </span>
                )}
              </div>

              {/* Cuerpo del Recibo */}
              <div className="p-space-lg bg-surface-container-lowest flex flex-col gap-space-md">
                {/* Auditoría de la anulación (F5) */}
                {activeVenta.estado === EstadoVenta.ANULADA && activeVenta.motivoAnulacion && (
                  <div className="p-space-sm rounded border border-error/30 bg-error-container text-error text-xs">
                    <span className="font-bold">Anulada</span>
                    {activeVenta.fechaAnulacion && ` el ${new Date(activeVenta.fechaAnulacion).toLocaleString('es-VE')}`}
                    {`. Motivo: ${activeVenta.motivoAnulacion}`}
                  </div>
                )}
                {/* Datos del Cliente */}
                <div className="bg-surface-container-low p-space-md rounded flex flex-col gap-space-xs">
                  <span className="font-label-sm text-label-sm text-secondary uppercase font-bold">
                    Cliente
                  </span>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md text-on-surface font-bold">
                        {activeVenta.cliente?.nombre || 'Cliente Mostrador'}
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">
                        Documento: {activeVenta.cliente?.identificacion || 'Consumidor Final'}
                      </span>
                      {activeVenta.cliente?.telefono && (
                        <span className="font-body-sm text-body-sm text-secondary">
                          Teléfono: {activeVenta.cliente.telefono}
                        </span>
                      )}
                    </div>
                    <span className="font-label-sm text-label-sm bg-surface-container px-space-xs py-space-2xs rounded text-secondary font-medium">
                      {activeVenta.pagos && activeVenta.pagos.length > 1
                        ? `Pago Mixto (${activeVenta.pagos.length} métodos)`
                        : activeVenta.pagos && activeVenta.pagos.length === 1
                        ? activeVenta.pagos[0].metodoPago.replace('_', ' ')
                        : (activeVenta as any).metodoPago || 'Efectivo USD'}
                    </span>
                  </div>
                </div>

                {/* Desglose de Pagos y Monedas con Tasa Congelada */}
                {activeVenta.pagos && activeVenta.pagos.length > 0 && (
                  <div className="bg-surface-container-low p-space-md rounded flex flex-col gap-space-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-label-sm text-secondary uppercase font-bold">
                        Pagos Recibidos
                      </span>
                      <span className="text-[11px] text-tertiary font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">lock_clock</span>
                        Tasa congelada
                      </span>
                    </div>
                    <div className="flex flex-col gap-space-xs mt-1">
                      {activeVenta.pagos.map((p, pIdx) => {
                        const isUsd = p.moneda === Moneda.USD;
                        const isVes = p.moneda === Moneda.VES;
                        const symbol = isVes ? 'Bs.' : '$';
                        const methodName =
                          p.metodoPago === MetodoPago.EFECTIVO_USD
                            ? 'Efectivo USD'
                            : p.metodoPago === MetodoPago.EFECTIVO_COP
                            ? 'Efectivo COP'
                            : p.metodoPago === MetodoPago.PAGO_MOVIL_VES
                            ? 'Pago Móvil'
                            : p.metodoPago === MetodoPago.TARJETA_VES
                            ? 'Tarjeta / POS'
                            : p.metodoPago === MetodoPago.ZELLE_USD
                            ? 'Zelle'
                            : p.metodoPago;

                        return (
                          <div
                            key={pIdx}
                            className="p-space-sm bg-surface-container-lowest rounded border border-surface-container flex flex-col gap-0.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    isUsd
                                      ? 'bg-primary/10 text-primary'
                                      : isVes
                                      ? 'bg-amber-500/10 text-amber-700'
                                      : 'bg-emerald-500/10 text-emerald-700'
                                  }`}
                                >
                                  {p.moneda}
                                </span>
                                <span className="font-label-md text-label-md font-bold text-on-surface">
                                  {methodName}
                                </span>
                                {p.referencia && (
                                  <span className="text-[11px] text-secondary">
                                    (Ref: {p.referencia})
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="font-label-md text-label-md font-extrabold text-on-surface">
                                  {symbol} {Number(p.montoMoneda).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-secondary">
                              <span>
                                {!isUsd && p.tasaAplicada ? (
                                  <span>Tasa: 1 USD = {Number(p.tasaAplicada).toLocaleString()} {p.moneda}</span>
                                ) : (
                                  <span>Moneda ancla (1:1)</span>
                                )}
                              </span>
                              <span className="font-semibold text-primary">
                                ≈ ${Number(p.montoUsd).toFixed(2)} USD
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Detalle de Renglones */}
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider py-space-2xs">
                    Productos Comprados
                  </span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-body-sm text-body-sm">
                      <thead>
                        <tr className="bg-surface-container text-secondary font-label-sm text-label-sm">
                          <th className="py-space-2xs px-space-xs">Cant</th>
                          <th className="py-space-2xs px-space-xs">Producto</th>
                          <th className="py-space-2xs px-space-xs text-right">P. Unit</th>
                          <th className="py-space-2xs px-space-xs text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="text-on-surface divide-y divide-surface-container-low">
                        {activeVenta.detalles && activeVenta.detalles.length > 0 ? (
                          activeVenta.detalles.map((d: any, idx: number) => (
                            <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                              <td className="py-space-xs px-space-xs font-bold text-primary">
                                {d.cantidad}
                              </td>
                              <td className="py-space-xs px-space-xs">
                                <div className="flex flex-col">
                                  <span className="font-label-md text-label-md font-medium text-on-surface">
                                    {d.producto?.nombre || 'Producto'}
                                  </span>
                                  {d.producto?.codigo && (
                                    <span className="text-secondary text-label-sm">
                                      SKU: {d.producto.codigo}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-space-xs px-space-xs text-right">
                                ${Number(d.precioUnitario).toFixed(2)}
                              </td>
                              <td className="py-space-xs px-space-xs text-right font-bold">
                                ${(Number(d.cantidad) * Number(d.precioUnitario)).toFixed(2)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr className="hover:bg-surface-container-low transition-colors">
                            <td className="py-space-xs px-space-xs font-bold text-primary">1</td>
                            <td className="py-space-xs px-space-xs">
                              <span className="font-label-md text-label-md font-medium text-on-surface">
                                Venta General
                              </span>
                            </td>
                            <td className="py-space-xs px-space-xs text-right">
                              ${activeTotal.toFixed(2)}
                            </td>
                            <td className="py-space-xs px-space-xs text-right font-bold">
                              ${activeTotal.toFixed(2)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Resumen de Montos */}
                <div className="bg-surface-container-low p-space-md rounded flex flex-col gap-space-xs">
                  <div className="flex justify-between items-center text-secondary font-body-md text-body-md">
                    <span>Subtotal:</span>
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      ${activeSubtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-secondary font-body-md text-body-md">
                    <span>Impuesto (IVA 16%):</span>
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      ${activeImpuesto.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-space-xs bg-inverse-surface text-inverse-on-surface px-space-md py-space-sm rounded mt-space-xs shadow-sm">
                    <span className="font-label-lg text-label-lg uppercase tracking-wider font-bold">
                      Total:
                    </span>
                    <span className="font-display-md text-display-md font-extrabold text-primary-fixed-dim">
                      ${activeTotal.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 px-space-xs pt-space-2xs text-secondary font-body-sm text-body-sm">
                    <div className="flex justify-between items-center">
                      <span>Ref. Bolívares (Tasa: {tasaVes} Bs/$):</span>
                      <span className="font-label-sm text-label-sm text-on-surface font-semibold">
                        Bs. {activeTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Ref. Pesos (Tasa: {tasaCop.toLocaleString()} COP/$):</span>
                      <span className="font-label-sm text-label-sm text-on-surface font-semibold">
                        $ {activeTotalCop.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nota de Auditoría con Tooltip Kárdex */}
                <div className="bg-surface-container-high/40 p-space-sm rounded flex items-start gap-space-sm">
                  <span className="material-symbols-outlined text-tertiary text-lg shrink-0 mt-0.5">verified</span>
                  <div className="flex flex-col">
                    <div className="flex items-center">
                      <span className="font-label-sm text-label-sm text-on-surface font-bold">
                        Auditoría de Kárdex
                      </span>
                      <HelpTooltip text="El historial de entradas y salidas de este producto: cada venta, compra o ajuste que afectó su cantidad disponible." />
                    </div>
                    <span className="font-body-sm text-body-sm text-secondary leading-tight mt-0.5">
                      Stock descontado automáticamente tras confirmar el pago.
                    </span>
                  </div>
                </div>

                {/* Botonera de Acciones */}
                <div className="flex flex-col gap-space-xs pt-space-xs">
                  <div className="grid grid-cols-2 gap-space-sm">
                    <button
                      onClick={() => onVerComprobante ? onVerComprobante(activeVenta.id) : window.print()}
                      className="flex items-center justify-center gap-space-xs px-space-md py-space-sm bg-primary text-on-primary rounded font-label-md text-label-md hover:bg-primary-container shadow-sm transition-colors"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-lg">print</span>
                      <span>Imprimir Recibo</span>
                    </button>
                    <button
                      onClick={() => onVerComprobante ? onVerComprobante(activeVenta.id) : window.print()}
                      className="flex items-center justify-center gap-space-xs px-space-md py-space-sm bg-surface-container-high text-on-surface rounded font-label-md text-label-md hover:bg-surface-container-highest transition-colors shadow-sm"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                      <span>Descargar PDF</span>
                    </button>
                  </div>

                  {canVoid && activeVenta.estado !== EstadoVenta.ANULADA && (
                    <button
                      onClick={() => setIsVoidModalOpen(true)}
                      className="w-full mt-space-xs flex items-center justify-center gap-space-xs px-space-md py-space-xs bg-error-container text-on-error-container rounded font-label-md text-label-md hover:bg-error hover:text-on-error transition-colors"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-base">cancel</span>
                      <span>Anular Venta y Devolver Stock</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest p-space-xl rounded text-center text-secondary border border-surface-container">
              Selecciona una venta de la lista para ver su detalle.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Anulación con lenguaje humano y advertencia clara */}
      {isVoidModalOpen && activeVenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 backdrop-blur-xs">
          <div className="bg-surface-container-lowest max-w-lg w-full mx-space-md rounded shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-error text-on-error px-space-lg py-space-md flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-2xl">warning</span>
                <h3 className="font-headline-sm text-headline-sm font-bold">
                  ¿Anular esta venta?
                </h3>
              </div>
              <button
                onClick={() => setIsVoidModalOpen(false)}
                className="text-on-error hover:opacity-80"
                type="button"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmVoid} className="p-space-lg flex flex-col gap-space-md">
              <div className="flex flex-col bg-surface-container-low p-space-md rounded gap-space-2xs">
                <span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">
                  Venta a Anular:
                </span>
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  #VTA-2024-{String(activeVenta.id).padStart(4, '0')} — ${Number(activeVenta.total).toFixed(2)} USD
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  Cliente: {activeVenta.cliente?.nombre || 'Cliente Mostrador'}
                </span>
              </div>

              <div className="bg-error-container/30 p-space-md rounded flex items-start gap-space-sm">
                <span className="material-symbols-outlined text-error text-xl shrink-0">info</span>
                <p className="font-body-sm text-body-sm text-on-surface">
                  <strong>Esta acción no se puede deshacer.</strong> Los productos de esta venta se sumarán
                  nuevamente al stock disponible de tu inventario y quedará registrado el motivo.
                </p>
              </div>

              {voidError && (
                <div className="p-space-sm bg-error-container text-on-error-container rounded text-body-sm font-medium">
                  {voidError}
                </div>
              )}

              <div className="flex flex-col gap-space-xs">
                <label className="font-label-md text-label-md text-on-surface font-bold" htmlFor="motivoAnulacion">
                  Indica el motivo de la anulación:
                </label>
                <select
                  id="motivoAnulacion"
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none focus:ring-2 focus:ring-error"
                  value={voidMotivo}
                  onChange={e => setVoidMotivo(e.target.value)}
                >
                  <option value="1">Error en producto despachado o cobrado</option>
                  <option value="2">Devolución de mercancía por garantía</option>
                  <option value="3">Error de cajero en método de pago</option>
                  <option value="4">Cancelación solicitada por el cliente</option>
                </select>
              </div>

              <div className="flex flex-col gap-space-xs">
                <label className="font-label-md text-label-md text-on-surface font-bold" htmlFor="observacionAuditoria">
                  Nota adicional (opcional):
                </label>
                <textarea
                  id="observacionAuditoria"
                  rows={2}
                  className="p-space-sm bg-surface-container-low text-on-surface font-body-sm text-body-sm rounded outline-none focus:ring-2 focus:ring-error resize-none"
                  placeholder="Detalles sobre por qué se anula esta venta..."
                  value={voidObservacion}
                  onChange={e => setVoidObservacion(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-space-sm pt-space-xs">
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  className="px-space-md py-space-xs bg-surface-container text-on-surface font-label-md text-label-md rounded hover:bg-surface-container-high transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingVoid}
                  className="px-space-md py-space-xs bg-error text-on-error font-label-md text-label-md rounded hover:opacity-90 shadow-sm flex items-center gap-space-xs transition-colors disabled:opacity-50 font-bold"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>{submittingVoid ? 'Anulando...' : 'Anular Venta y Devolver Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Cierre de Caja Diario (Arqueo Multimoneda) */}
      {isCierreModalOpen && (() => {
        // Filtrar según periodo del modal
        const ventasParaCierre = ventas.filter(v => {
          if (v.estado === EstadoVenta.ANULADA) return false;
          const vDate = new Date(v.createdAt);
          const now = new Date();
          if (cierrePeriodo === 'hoy') {
            return vDate.toDateString() === now.toDateString();
          } else if (cierrePeriodo === 'ayer') {
            const ayer = new Date(now);
            ayer.setDate(ayer.getDate() - 1);
            return vDate.toDateString() === ayer.toDateString();
          } else if (cierrePeriodo === 'semana') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
            return vDate >= weekAgo;
          } else {
            return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
          }
        });

        const anuladasParaCierre = ventas.filter(v => {
          if (v.estado !== EstadoVenta.ANULADA) return false;
          const vDate = new Date(v.createdAt);
          const now = new Date();
          if (cierrePeriodo === 'hoy') return vDate.toDateString() === now.toDateString();
          if (cierrePeriodo === 'ayer') {
            const ayer = new Date(now);
            ayer.setDate(ayer.getDate() - 1);
            return vDate.toDateString() === ayer.toDateString();
          }
          return true;
        });

        let totalFisicoUsd = 0;
        let countFisicoUsd = 0;
        let totalFisicoCop = 0;
        let countFisicoCop = 0;

        let totalBancoPagoMovilVes = 0;
        let countPagoMovil = 0;
        let totalBancoTarjetaVes = 0;
        let countTarjeta = 0;

        let totalDigitalZelleUsd = 0;
        let countZelle = 0;

        let totalConsolidadoUsd = 0;

        for (const v of ventasParaCierre) {
          totalConsolidadoUsd += Number(v.totalUsd ?? v.total);
          if (v.pagos && v.pagos.length > 0) {
            for (const p of v.pagos) {
              if (p.metodoPago === MetodoPago.EFECTIVO_USD) {
                totalFisicoUsd += Number(p.montoMoneda);
                countFisicoUsd++;
              } else if (p.metodoPago === MetodoPago.EFECTIVO_COP) {
                totalFisicoCop += Number(p.montoMoneda);
                countFisicoCop++;
              } else if (p.metodoPago === MetodoPago.PAGO_MOVIL_VES) {
                totalBancoPagoMovilVes += Number(p.montoMoneda);
                countPagoMovil++;
              } else if (p.metodoPago === MetodoPago.TARJETA_VES) {
                totalBancoTarjetaVes += Number(p.montoMoneda);
                countTarjeta++;
              } else if (p.metodoPago === MetodoPago.ZELLE_USD) {
                totalDigitalZelleUsd += Number(p.montoMoneda);
                countZelle++;
              } else {
                totalFisicoUsd += Number(p.montoUsd);
                countFisicoUsd++;
              }
            }
          } else {
            totalFisicoUsd += Number(v.total);
            countFisicoUsd++;
          }
        }

        const montoAnuladoUsd = anuladasParaCierre.reduce((acc, v) => acc + Number(v.totalUsd ?? v.total), 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 backdrop-blur-xs p-space-md">
            <div className="bg-surface-container-lowest max-w-2xl w-full rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-inverse-surface text-inverse-on-surface px-space-lg py-space-md flex items-center justify-between">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-2xl text-primary-fixed-dim">point_of_sale</span>
                  <div className="flex flex-col">
                    <h3 className="font-headline-sm text-headline-sm font-bold">
                      Cierre de Caja y Arqueo Multimoneda
                    </h3>
                    <span className="font-body-sm text-body-sm text-secondary-fixed-dim">
                      Cuadre discriminado por efectivo físico y bancos digitales (Guasdualito)
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsCierreModalOpen(false)}
                  className="text-inverse-on-surface hover:opacity-80 transition-opacity"
                  type="button"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Contenido Scrollable */}
              <div className="p-space-lg overflow-y-auto flex flex-col gap-space-md">
                {/* Selector de Período */}
                <div className="flex items-center justify-between bg-surface-container-low p-space-sm rounded">
                  <span className="font-label-sm text-label-sm text-secondary uppercase font-bold">
                    Período a Cuadrar:
                  </span>
                  <div className="flex items-center bg-surface-container-lowest p-0.5 rounded shadow-xs">
                    {(['hoy', 'ayer', 'semana', 'mes'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCierrePeriodo(p)}
                        className={`px-space-sm py-1 rounded text-label-sm capitalize font-bold transition-all ${
                          cierrePeriodo === p
                            ? 'bg-primary text-on-primary shadow-xs'
                            : 'text-secondary hover:text-on-surface'
                        }`}
                      >
                        {p === 'hoy' ? 'Hoy' : p === 'ayer' ? 'Ayer' : p === 'semana' ? 'Esta Semana' : 'Mes Actual'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sección 1: Dinero Físico en Caja */}
                <div className="flex flex-col gap-space-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-lg">payments</span>
                      <h4 className="font-label-lg text-label-lg font-bold text-on-surface uppercase tracking-wider">
                        1. Dinero Físico en Caja (Gaveta)
                      </h4>
                    </div>
                    <span className="text-[11px] text-secondary font-medium">
                      Conteo manual obligatorio
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                    {/* Billetes USD */}
                    <div className="p-space-md bg-surface-container-low rounded border border-primary/20 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm font-bold text-primary flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-primary"></span>
                          Efectivo Dólares (USD)
                        </span>
                        <span className="font-label-sm text-label-sm text-secondary bg-surface-container-lowest px-1.5 py-0.5 rounded font-medium">
                          {countFisicoUsd} pagos
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="font-display-md text-display-md font-black text-on-surface">
                          ${totalFisicoUsd.toFixed(2)}
                        </span>
                        <span className="font-label-sm text-label-sm text-secondary block mt-0.5">
                          Total en billetes USD a contar
                        </span>
                      </div>
                    </div>

                    {/* Billetes COP */}
                    <div className="p-space-md bg-surface-container-low rounded border border-emerald-500/20 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm font-bold text-emerald-700 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          Efectivo Pesos (COP)
                        </span>
                        <span className="font-label-sm text-label-sm text-secondary bg-surface-container-lowest px-1.5 py-0.5 rounded font-medium">
                          {countFisicoCop} pagos
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="font-display-md text-display-md font-black text-on-surface">
                          ${totalFisicoCop.toLocaleString('es-CO')}
                        </span>
                        <span className="font-label-sm text-label-sm text-secondary block mt-0.5">
                          Total en billetes COP a contar
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-space-xs bg-surface-container-high/40 rounded flex items-center gap-2 text-secondary text-[11px]">
                    <span className="material-symbols-outlined text-xs text-primary">info</span>
                    <span>No mezclar billetes de USD y COP en el conteo físico de la gaveta. Ambos son valores independientes.</span>
                  </div>
                </div>

                {/* Sección 2: Dinero Digital / Bancos */}
                <div className="flex flex-col gap-space-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-tertiary text-lg">account_balance</span>
                      <h4 className="font-label-lg text-label-lg font-bold text-on-surface uppercase tracking-wider">
                        2. Dinero Digital y Bancos (Cuentas)
                      </h4>
                    </div>
                    <span className="text-[11px] text-secondary font-medium">
                      Conciliación bancaria
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                    {/* Bancos VES */}
                    <div className="p-space-md bg-surface-container-low rounded border border-amber-500/20 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm font-bold text-amber-700 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                          Bolívares (VES)
                        </span>
                        <span className="font-label-sm text-label-sm text-secondary bg-surface-container-lowest px-1.5 py-0.5 rounded font-medium">
                          {countPagoMovil + countTarjeta} tx
                        </span>
                      </div>
                      <div>
                        <span className="font-display-md text-display-md font-black text-on-surface">
                          Bs. {(totalBancoPagoMovilVes + totalBancoTarjetaVes).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 pt-1 border-t border-surface-container text-body-sm text-secondary">
                        <div className="flex justify-between">
                          <span>Pago Móvil:</span>
                          <span className="font-semibold text-on-surface">
                            Bs. {totalBancoPagoMovilVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ({countPagoMovil} tx)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tarjeta / POS:</span>
                          <span className="font-semibold text-on-surface">
                            Bs. {totalBancoTarjetaVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ({countTarjeta} tx)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Zelle USD */}
                    <div className="p-space-md bg-surface-container-low rounded border border-purple-500/20 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm font-bold text-purple-700 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                          Zelle / Transferencia (USD)
                        </span>
                        <span className="font-label-sm text-label-sm text-secondary bg-surface-container-lowest px-1.5 py-0.5 rounded font-medium">
                          {countZelle} pagos
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="font-display-md text-display-md font-black text-on-surface">
                          ${totalDigitalZelleUsd.toFixed(2)}
                        </span>
                        <span className="font-label-sm text-label-sm text-secondary block mt-0.5">
                          Total en transferencias Zelle recibidas
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sección 3: Consolidado General en Moneda Ancla USD */}
                <div className="p-space-md bg-inverse-surface text-inverse-on-surface rounded flex flex-col sm:flex-row items-center justify-between gap-space-md shadow-md">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-secondary-fixed-dim uppercase tracking-wider font-bold">
                      Total Consolidado en Moneda Ancla (USD)
                    </span>
                    <span className="font-display-lg text-display-lg font-black text-primary-fixed-dim">
                      ${totalConsolidadoUsd.toFixed(2)} USD
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary-fixed-dim">
                      {ventasParaCierre.length} ventas completadas en el período
                    </span>
                  </div>

                  {anuladasParaCierre.length > 0 && (
                    <div className="bg-error/20 border border-error/40 px-space-md py-space-xs rounded text-center sm:text-right">
                      <span className="text-[11px] uppercase font-bold text-error block">
                        {anuladasParaCierre.length} Venta(s) Anulada(s)
                      </span>
                      <span className="font-label-md text-label-md font-bold text-inverse-on-surface">
                        -${montoAnuladoUsd.toFixed(2)} USD devueltos
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Acciones */}
              <div className="bg-surface-container-low px-space-lg py-space-md flex items-center justify-between border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container text-on-surface font-label-md text-label-md rounded hover:bg-surface-container-high transition-colors shadow-xs"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  <span>Imprimir Arqueo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCierreModalOpen(false)}
                  className="px-space-lg py-space-xs bg-primary text-on-primary font-label-md text-label-md rounded hover:bg-primary/90 transition-colors shadow-sm font-bold"
                >
                  Entendido / Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Comprobante Offline */}
      {comprobanteOffline && (
        <ComprobanteModal
          initialVenta={{
            id: -1,
            clienteId: comprobanteOffline.clienteId,
            usuarioId: 1,
            fecha: comprobanteOffline.fecha,
            subtotal: comprobanteOffline.subtotal,
            impuesto: comprobanteOffline.impuesto,
            total: comprobanteOffline.total,
            totalUsd: comprobanteOffline.totalUsd,
            monedaFuncional: comprobanteOffline.monedaFuncional,
            estado: EstadoVenta.COMPLETADA,
            cliente: {
              id: comprobanteOffline.clienteId,
              nombre: comprobanteOffline.clienteNombre || 'Consumidor Final',
              identificacion: comprobanteOffline.clienteIdentificacion || 'V-00000000',
              telefono: 'N/A',
              correo: '',
              direccion: 'Mostrador',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            detalles: comprobanteOffline.items.map((i, idx) => ({
              id: idx + 1,
              ventaId: -1,
              productoId: i.productoId,
              cantidad: i.cantidad,
              precioUnitario: i.precioUnitario,
              subtotalLinea: i.cantidad * i.precioUnitario,
              producto: {
                id: i.productoId,
                codigo: 'SKU',
                nombre: i.productoNombre || 'Producto',
                descripcion: null,
                categoriaId: 1,
                precioCompra: 0,
                precioVenta: i.precioUnitario,
                stockActual: 10,
                stockMinimo: 1,
                unidadMedida: 'UND',
                activo: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            })),
            pagos: comprobanteOffline.pagos,
            createdAt: comprobanteOffline.createdAt,
            updatedAt: comprobanteOffline.createdAt,
            numeroComprobanteLocal: comprobanteOffline.idLocal,
          } as any}
          onClose={() => setComprobanteOffline(null)}
        />
      )}
    </div>
  );
};
