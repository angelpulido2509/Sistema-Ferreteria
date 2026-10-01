import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  AlertOctagon, 
  Calendar, 
  Award, 
  ArrowUpRight, 
  AlertTriangle
} from 'lucide-react';
import { api } from '../lib/api.js';

export function ReportesView(): React.JSX.Element {
  const [dias, setDias] = useState<number>(15);

  // Consultas de datos analíticos
  const { data: metricas } = useQuery({
    queryKey: ['reportes', 'metricas'],
    queryFn: () => api.getMetricasResumen(),
    refetchInterval: 30000,
  });

  const { data: ventasDiarias = [], isLoading: loadingDiarias } = useQuery({
    queryKey: ['reportes', 'ventas-diarias', dias],
    queryFn: () => api.getVentasDiarias(dias),
  });

  const { data: topProductos = [], isLoading: loadingTop } = useQuery({
    queryKey: ['reportes', 'top-productos'],
    queryFn: () => api.getProductosMasVendidos(6),
  });

  const { data: stockCritico = [], isLoading: loadingCritico } = useQuery({
    queryKey: ['reportes', 'stock-critico'],
    queryFn: () => api.getStockCriticoReporte(),
  });

  // Cálculos para gráfico diario
  const maxMonto = Math.max(...ventasDiarias.map(v => v.montoTotal), 1);
  const totalPeriodoIngresos = ventasDiarias.reduce((acc, v) => acc + v.montoTotal, 0);
  const totalPeriodoVentas = ventasDiarias.reduce((acc, v) => acc + v.totalVentas, 0);
  const maxUnidadesTop = Math.max(...topProductos.map(p => p.cantidadVendida), 1);

  return (
    <div className="space-y-6">
      {/* Cabecera y Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-500" />
            Reportes y Analíticas de Gestión
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Métricas de facturación, comportamiento de ventas y rotación de inventario
          </p>
        </div>

        {/* Filtro de Rango de Días */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          {[
            { label: '7 días', val: 7 },
            { label: '15 días', val: 15 },
            { label: '30 días', val: 30 },
          ].map(opt => (
            <button
              key={opt.val}
              onClick={() => setDias(opt.val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                dias === opt.val
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ingresos Totales del Período */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Ingresos ({dias}d)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono">
              ${totalPeriodoIngresos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{totalPeriodoVentas} operaciones cerradas</span>
            </div>
          </div>
        </div>

        {/* Ventas Hoy */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Ventas Hoy</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono">
              {metricas?.ventasHoy ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Ingresos hoy: <strong className="text-white">${metricas?.ingresosHoy?.toFixed(2) ?? '0.00'}</strong>
            </div>
          </div>
        </div>

        {/* Ticket Promedio */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Ticket Promedio</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono">
              ${metricas?.ticketPromedio?.toFixed(2) ?? '0.00'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Por factura completada
            </div>
          </div>
        </div>

        {/* Productos en Alerta */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Stock Crítico</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-400 font-mono">
              {metricas?.productosCriticos ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Requieren reposición inmediata
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Gráfico de Ventas Diarias */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Evolución de Ingresos por Día</h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Mostrando últimos {dias} días
          </span>
        </div>

        {loadingDiarias ? (
          <div className="h-48 flex items-center justify-center text-xs text-slate-500">
            Cargando evolución de ventas...
          </div>
        ) : ventasDiarias.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs">
            <Calendar className="w-8 h-8 mb-2 opacity-40" />
            <p>No se registraron ventas en los últimos {dias} días.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Gráfico de Barras Responsivo */}
            <div className="h-48 flex items-end gap-2 sm:gap-3 pt-6 pb-2 px-2 border-b border-slate-800/80">
              {ventasDiarias.map((item, idx) => {
                const heightPercent = Math.max(8, Math.round((item.montoTotal / maxMonto) * 100));
                const fechaLabel = item.fecha.slice(5); // MM-DD

                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Tooltip Hover */}
                    <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-950 border border-slate-700 px-2 py-1 rounded-lg shadow-xl text-[10px] whitespace-nowrap pointer-events-none">
                      <span className="font-bold text-emerald-400">${item.montoTotal.toFixed(2)}</span>
                      <span className="text-slate-400">{item.totalVentas} ventas &bull; {item.totalArticulos} arts.</span>
                    </div>

                    {/* Barra */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[36px] bg-gradient-to-t from-blue-700 to-blue-500 group-hover:from-blue-600 group-hover:to-cyan-400 rounded-t-lg transition-all duration-300 shadow-sm"
                    />

                    {/* Etiqueta de Fecha */}
                    <span className="text-[10px] text-slate-500 mt-2 font-mono group-hover:text-white transition">
                      {fechaLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Grid Inferior: Productos Más Vendidos y Alertas de Stock Crítico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Productos Más Vendidos */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              Productos Más Vendidos
            </h3>
            <span className="text-[11px] text-slate-400">Por unidades</span>
          </div>

          {loadingTop ? (
            <div className="py-8 text-center text-xs text-slate-500">Cargando ranking...</div>
          ) : topProductos.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No hay ventas registradas aún.</div>
          ) : (
            <div className="space-y-3">
              {topProductos.map((p, idx) => {
                const percent = Math.round((p.cantidadVendida / maxUnidadesTop) * 100);

                return (
                  <div key={p.productoId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate max-w-[240px]">
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          #{idx + 1}
                        </span>
                        <span className="text-white font-medium truncate">{p.nombre}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-slate-400 font-semibold">{p.cantidadVendida} unid.</span>
                        <span className="text-emerald-400 font-mono font-bold">
                          ${p.totalGenerado.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${percent}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumen de Stock Crítico */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Artículos en Nivel Crítico
            </h3>
            <span className="text-[11px] text-amber-400 font-semibold">
              {stockCritico.length} en riesgo
            </span>
          </div>

          {loadingCritico ? (
            <div className="py-8 text-center text-xs text-slate-500">Cargando stock...</div>
          ) : stockCritico.length === 0 ? (
            <div className="py-8 text-center text-xs text-emerald-400">
              ¡Todos los productos tienen niveles adecuados de stock!
            </div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {stockCritico.map(prod => (
                <div
                  key={prod.productoId}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="truncate">
                    <div className="font-semibold text-white truncate">{prod.nombre}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {prod.codigo} &bull; {prod.categoria}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-amber-400">
                      {prod.stockActual} / {prod.stockMinimo} {prod.unidadMedida}
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                      Faltan {prod.deficiencia}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
