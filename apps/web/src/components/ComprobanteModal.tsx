import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { type VentaDTO } from '@ferreteria/shared';
import { api } from '../lib/api.js';
import { useQuery } from '@tanstack/react-query';

interface ComprobanteModalProps {
  ventaId?: string | null;
  initialVenta?: VentaDTO | null;
  onClose: () => void;
}

export interface PagoComprobante {
  metodoPago: string;
  moneda: string;
  /** Neto aplicado a la venta */
  montoMoneda: number;
  montoRecibido?: number;
  vuelto?: number;
  tasaAplicada: number;
  montoUsd: number;
  referencia?: string;
}

export interface ComprobanteData {
  empresa: {
    nombre: string;
    rif: string;
    direccion: string;
    telefono: string;
  };
  comprobante?: {
    numero: string;
    leyenda?: string;
    fecha: string;
    estado: string;
    monedaFuncional?: string;
  };
  venta?: {
    numero: string;
    fecha: string;
    cliente: string;
    identificacion: string;
    direccion: string;
    telefono: string;
    cajero: string;
    estado: string;
    detalles: Array<{
      codigo: string;
      nombre: string;
      cantidad: number;
      precioUnitario: number;
      subtotalLinea: number;
    }>;
    subtotal: number;
    impuesto: number;
    total: number;
    totalUsd?: number;
    pagos?: PagoComprobante[];
  };
  cliente?: {
    nombre: string;
    identificacion: string;
    telefono?: string;
    direccion?: string;
  };
  cajero?: string;
  items?: Array<{
    codigo: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
  totales?: {
    subtotal: number;
    impuesto: number;
    total: number;
    totalUsd?: number;
  };
  pagos?: PagoComprobante[];
}

export function ComprobanteModal({ ventaId, initialVenta, onClose }: ComprobanteModalProps): React.JSX.Element | null {
  const [data, setData] = useState<ComprobanteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Consulta la configuración de la ferretería guardada en la base de datos
  const { data: config } = useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api.getConfiguracion(),
  });

  useEffect(() => {
    if (initialVenta) {
      const isOfflineId = String(initialVenta.id).startsWith('OFF') || String(initialVenta.id).startsWith('-');
      setData({
        empresa: {
          nombre: 'Ferretería FerrePro C.A.',
          rif: 'J-40892182-0',
          direccion: 'Guasdualito, Apure, Venezuela',
          telefono: '+58 212 994-8800',
        },
        comprobante: {
          numero: (initialVenta as any).numeroComprobanteLocal || (isOfflineId ? 'OFF-LOCAL' : initialVenta.numero ?? 'SIN NÚMERO'),
          fecha: String(initialVenta.fecha || initialVenta.createdAt || new Date().toISOString()),
          estado: initialVenta.estado,
        },
        cliente: initialVenta.cliente || {
          nombre: 'Consumidor Final',
          identificacion: 'V-00000000',
          telefono: 'N/A',
          direccion: 'Mostrador',
        },
        items: initialVenta.detalles?.map((d: any) => ({
          codigo: d.producto?.codigo || 'SKU',
          descripcion: d.producto?.nombre || 'Producto',
          cantidad: d.cantidad,
          precioUnitario: d.precioUnitario,
          subtotal: d.subtotalLinea || (d.cantidad * d.precioUnitario),
        })) || [],
        totales: {
          subtotal: initialVenta.subtotal,
          impuesto: initialVenta.impuesto,
          total: initialVenta.total,
          totalUsd: initialVenta.totalUsd || initialVenta.total,
        },
        pagos: initialVenta.pagos as any,
        venta: {
          numero: (initialVenta as any).numeroComprobanteLocal || (isOfflineId ? 'OFF-LOCAL' : initialVenta.numero ?? 'SIN NÚMERO'),
          fecha: String(initialVenta.fecha || initialVenta.createdAt || new Date().toISOString()),
          cliente: initialVenta.cliente?.nombre || 'Consumidor Final',
          identificacion: initialVenta.cliente?.identificacion || 'V-00000000',
          direccion: initialVenta.cliente?.direccion || 'Mostrador',
          telefono: initialVenta.cliente?.telefono || 'N/A',
          cajero: initialVenta.usuario?.nombre || 'Mostrador 01',
          estado: initialVenta.estado,
          detalles: initialVenta.detalles?.map((d: any) => ({
            codigo: d.producto?.codigo || 'SKU',
            nombre: d.producto?.nombre || 'Producto',
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario,
            subtotalLinea: d.subtotalLinea || (d.cantidad * d.precioUnitario),
          })) || [],
          subtotal: initialVenta.subtotal,
          impuesto: initialVenta.impuesto,
          total: initialVenta.total,
          totalUsd: initialVenta.totalUsd || initialVenta.total,
          pagos: initialVenta.pagos as any,
        },
      });
      setLoading(false);
      return;
    }

    if (!ventaId || ventaId === '-1' || ventaId.startsWith('OFF')) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    api.getComprobante(ventaId)
      .then((res) => {
        if (isMounted) setData(res);
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof Error ? err.message : 'Error al cargar comprobante');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [ventaId, initialVenta]);

  if (!ventaId && !initialVenta) return null;

  const handlePrint = () => {
    window.print();
  };

  // Cargar configuración guardada en el módulo de Gestión
  const savedSettingsRaw = typeof window !== 'undefined' ? localStorage.getItem('ferrepro_system_settings') : null;
  const systemSettings = savedSettingsRaw ? JSON.parse(savedSettingsRaw) : null;

  const empresaNombre = systemSettings?.razonSocial || data?.empresa?.nombre || 'Ferretería y Materiales FerrePro C.A.';
  const empresaRif = systemSettings?.rif || data?.empresa?.rif || 'J-40892182-0';
  const empresaDireccion = systemSettings?.direccion || data?.empresa?.direccion || 'Av. Industrial Los Galpones, Edf. FerrePro, PB';
  const empresaTelefono = systemSettings?.telefono || data?.empresa?.telefono || '+58 212 994-8800';
  const mensajePie = systemSettings?.mensajePieTicket || '¡Gracias por su compra! Conserve este comprobante para reclamos o garantía.';
  const tasaBcv = config?.tasaVes || systemSettings?.tasaBcv || 60.0;
  const tasaCop = config?.tasaCop || systemSettings?.tasaCop || 4100.0;
  const pagosList = data?.pagos || data?.venta?.pagos || [];

  function formatMetodoNombre(metodo: string): string {
    switch (metodo) {
      case 'EFECTIVO_USD': return 'Efectivo Dólares (USD)';
      case 'ZELLE_USD': return 'Zelle Transferencia (USD)';
      case 'PAGO_MOVIL_VES': return 'Pago Móvil (VES)';
      case 'TARJETA_VES': return 'Punto de Venta / Débito (VES)';
      case 'EFECTIVO_COP': return 'Efectivo Pesos (COP)';
      default: return metodo;
    }
  }

  const vDetalles = data?.venta?.detalles || data?.items?.map(i => ({
    codigo: i.codigo || 'SKU',
    nombre: i.descripcion,
    cantidad: i.cantidad,
    precioUnitario: i.precioUnitario,
    subtotalLinea: i.subtotal,
  })) || [];

  const vSubtotal = data?.venta?.subtotal ?? data?.totales?.subtotal ?? 0;
  const vImpuesto = data?.venta?.impuesto ?? data?.totales?.impuesto ?? 0;
  const vTotal = data?.venta?.total ?? data?.totales?.total ?? 0;
  const vNumero = data?.comprobante?.numero || data?.venta?.numero || 'SIN NÚMERO';
  // Hasta que el contador confirme el mecanismo fiscal, ningún documento es factura fiscal (addendum §2)
  const vLeyenda = data?.comprobante?.leyenda || 'COMPROBANTE — NO VÁLIDO COMO FACTURA FISCAL';
  const vFecha = data?.venta?.fecha || data?.comprobante?.fecha || new Date().toISOString();
  const vEstado = data?.venta?.estado || data?.comprobante?.estado || 'COMPLETADA';
  const vCliente = data?.venta?.cliente || data?.cliente?.nombre || 'Consumidor Final';
  const vIdCliente = data?.venta?.identificacion || data?.cliente?.identificacion || 'V-00000000';
  const vTlf = data?.venta?.telefono || data?.cliente?.telefono || 'N/A';
  const vDir = data?.venta?.direccion || data?.cliente?.direccion || 'Mostrador';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      {/* Estilos específicos de impresión para ticket limpio */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #comprobante-ticket, #comprobante-ticket * {
              visibility: visible;
            }
            #comprobante-ticket {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              max-width: 80mm;
              margin: 0 auto;
              padding: 10px;
              color: #000 !important;
              background: #fff !important;
              font-family: monospace;
              font-size: 11px;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div className="relative w-full max-w-lg bg-surface-container-lowest border border-surface-container rounded-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Barra superior de controles (no se imprime) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-surface-container bg-surface-container-low">
          <div className="flex items-center gap-2 text-on-surface font-bold text-sm">
            <span className="material-symbols-outlined text-primary text-xl">receipt</span>
            <span>Comprobante de Venta Fiscal</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !data}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold shadow-sm transition disabled:opacity-50"
              title="Imprimir o guardar como PDF"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-secondary hover:text-on-surface hover:bg-surface-container transition"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Estado de carga / error */}
        {loading && (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs">Generando comprobante...</p>
          </div>
        )}

        {error && (
          <div className="p-8 text-center text-red-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-1.5 bg-slate-800 text-slate-200 text-xs rounded-lg hover:bg-slate-700"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Contenedor del Comprobante / Ticket */}
        {data && !loading && (
          <div className="p-6 max-h-[80vh] overflow-y-auto">
            <div
              id="comprobante-ticket"
              className="bg-white text-slate-900 rounded-xl p-6 shadow-inner font-mono text-xs border border-slate-200"
            >
              {/* Aviso de comprobante offline */}
              {((data?.venta as any)?.numeroComprobanteLocal || vNumero.startsWith('OFF-') || (ventaId && (ventaId.startsWith('OFF') || ventaId === '-1'))) && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-300 rounded text-center text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                  ⚠️ Comprobante Emitido sin Conexión (Offline)
                  <br />
                  <span className="font-normal text-[9px] text-amber-800">Se sincronizará automáticamente con la nube</span>
                </div>
              )}

              {/* Encabezado del Comercio configurado en Gestión */}
              <div className="text-center pb-4 border-b border-dashed border-slate-300">
                <h2 className="text-base font-black tracking-tight uppercase text-slate-950">
                  {empresaNombre}
                </h2>
                <p className="text-[11px] font-semibold text-slate-700">RIF: {empresaRif}</p>
                <p className="text-[10px] text-slate-600 mt-1">{empresaDireccion}</p>
                <p className="text-[10px] text-slate-600">Tlf: {empresaTelefono}</p>
              </div>

              {/* Información del Documento */}
              <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between font-bold">
                  <span>DOCUMENTO:</span>
                  <span className="text-blue-700">{vNumero}</span>
                </div>
                <div className="text-center font-bold text-[10px] text-slate-800 border border-slate-400 rounded py-0.5">
                  {vLeyenda}
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>FECHA:</span>
                  <span>{new Date(vFecha).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>CAJA:</span>
                  <span>Mostrador 01</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span>ESTADO:</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      vEstado === 'COMPLETADA'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {vEstado}
                  </span>
                </div>
              </div>

              {/* Datos del Cliente */}
              <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-1">
                  Datos del Cliente:
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">CLIENTE:</span>
                  <span className="font-semibold text-right max-w-[200px] truncate">{vCliente}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">ID / RIF:</span>
                  <span className="font-semibold">{vIdCliente}</span>
                </div>
                {vTlf && vTlf !== 'N/A' && (
                  <div className="flex justify-between text-slate-600">
                    <span>TELÉFONO:</span>
                    <span>{vTlf}</span>
                  </div>
                )}
                {vDir && vDir !== 'Mostrador' && (
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>DIRECCIÓN:</span>
                    <span className="text-right max-w-[200px] truncate">{vDir}</span>
                  </div>
                )}
              </div>

              {/* Detalle de Artículos */}
              <div className="py-3 border-b border-dashed border-slate-300">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-300 font-bold text-[10px] text-slate-700">
                      <th className="pb-1">CANT</th>
                      <th className="pb-1">DESCRIPCIÓN</th>
                      <th className="pb-1 text-right">P.UNIT</th>
                      <th className="pb-1 text-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vDetalles.map((item, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="py-1 font-bold">{item.cantidad}</td>
                        <td className="py-1 pr-1 font-medium leading-tight">
                          <div>{item.nombre}</div>
                          <div className="text-[9px] text-slate-500">{item.codigo}</div>
                        </td>
                        <td className="py-1 text-right text-slate-700">
                          ${Number(item.precioUnitario).toFixed(2)}
                        </td>
                        <td className="py-1 text-right font-bold">
                          ${Number(item.subtotalLinea).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resumen de Totales */}
              <div className="py-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>SUBTOTAL:</span>
                  <span>${Number(vSubtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>IVA (16%):</span>
                  <span>${Number(vImpuesto).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-950 pt-1 border-t border-slate-300">
                  <span>TOTAL USD:</span>
                  <span className="text-base text-blue-700 font-black">
                    ${Number(vTotal).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600 pt-0.5">
                  <span>REF. BS (TASA {tasaBcv.toFixed(2)} Bs/$):</span>
                  <span className="font-bold text-slate-900">
                    Bs. {(Number(vTotal) * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600 pt-0.5">
                  <span>REF. COP (TASA {tasaCop.toLocaleString()} COP/$):</span>
                  <span className="font-bold text-slate-900">
                    $COP {Math.round(Number(vTotal) * tasaCop).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              {/* Formas de Pago Aplicadas (Tasas Congeladas de la Transacción) */}
              {pagosList.length > 0 && (
                <div className="py-3 border-t border-dashed border-slate-300 space-y-2 text-[11px]">
                  <div className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">
                    Formas de Pago Aplicadas (Tasas Congeladas):
                  </div>
                  {pagosList.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-start bg-slate-50 p-1.5 rounded border border-slate-100">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{formatMetodoNombre(p.metodoPago)}</span>
                        {p.referencia && <span className="text-[9px] text-slate-500 font-mono">Ref: {p.referencia}</span>}
                        {p.moneda !== 'USD' && (
                          <span className="text-[9px] text-slate-500 font-mono">
                            Tasa fija: 1 USD = {p.moneda === 'VES' ? `${Number(p.tasaAplicada).toFixed(2)} Bs` : `${Number(p.tasaAplicada).toLocaleString()} COP`}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">
                          {p.moneda === 'USD' && `$${Number(p.montoMoneda).toFixed(2)} USD`}
                          {p.moneda === 'VES' && `Bs. ${Number(p.montoMoneda).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`}
                          {p.moneda === 'COP' && `$COP ${Number(p.montoMoneda).toLocaleString('es-CO')}`}
                        </span>
                        {p.moneda !== 'USD' && (
                          <div className="text-[9px] text-slate-500 font-mono">
                            (Equiv: ${Number(p.montoUsd).toFixed(2)} USD)
                          </div>
                        )}
                        {Number(p.vuelto ?? 0) > 0 && (
                          <div className="text-[9px] text-slate-600 font-mono">
                            Recibido {Number(p.montoRecibido).toLocaleString('es-VE')} · Vuelto {Number(p.vuelto).toLocaleString('es-VE')} {p.moneda}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pie de Ticket configurado en Gestión */}
              <div className="pt-4 text-center border-t border-dashed border-slate-300 text-[10px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">{mensajePie}</p>
                <p className="text-[9px] text-slate-400">Sistema Ferretería — Guasdualito, Apure</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
