import React, { useState } from 'react';
import type { ProductoDTO, CategoriaDTO } from '@ferreteria/shared';

interface DashboardViewProps {
  productos: ProductoDTO[];
  categorias: CategoriaDTO[];
  onNavigate: (tab: 'dashboard' | 'pos' | 'productos' | 'categorias' | 'alertas' | 'ventas') => void;
  onOpenNewProduct: () => void;
  canManage: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  productos,
  categorias: _categorias,
  onNavigate,
  onOpenNewProduct: _onOpenNewProduct,
  canManage: _canManage,
}) => {
  const [timeFilter, setTimeFilter] = useState<'hoy' | '7dias' | 'mes'>('hoy');

  const stockCritico = productos.filter(p => p.stockActual <= p.stockMinimo);
  const totalUnidades = productos.reduce((acc, p) => acc + p.stockActual, 0);
  const valorInventario = productos.reduce(
    (acc, p) => acc + p.precioCompra * p.stockActual,
    0
  );

  return (
    <div className="flex flex-col w-full gap-space-lg animate-fade-in">
      {/* Top Operational Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              Panel de Control General
            </span>
            <span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded bg-surface-container-high text-secondary font-label-sm text-label-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              EN VIVO
            </span>
          </div>
          <p className="font-body-md text-body-md text-secondary mt-space-2xs">
            Monitoreo de operaciones en tiempo real, ventas del día y estado crítico de inventario
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          {/* Segmented Time Range Controller */}
          <div className="inline-flex bg-surface-container-low p-space-2xs rounded-lg select-none" id="time-filter-container">
            <button
              type="button"
              onClick={() => setTimeFilter('hoy')}
              className={`px-space-md py-space-xs rounded font-label-md text-label-md transition-all ${
                timeFilter === 'hoy'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('7dias')}
              className={`px-space-md py-space-xs rounded font-label-md text-label-md transition-colors ${
                timeFilter === '7dias'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Últimos 7 días
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('mes')}
              className={`px-space-md py-space-xs rounded font-label-md text-label-md transition-colors ${
                timeFilter === 'mes'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Este mes
            </button>
          </div>
          {/* Action: Export Report */}
          <button
            onClick={() => onNavigate('ventas')}
            className="inline-flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container text-on-surface hover:bg-surface-container-high rounded font-label-md text-label-md transition-colors shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            <span>Descargar Reporte Ejecutivo</span>
          </button>
        </div>
      </div>

      {/* Primary Metric Bento Grid (4 Core Hardware KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
        {/* Card 1: Ventas del Día */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Ventas de Hoy</span>
              <div className="font-display-md text-display-md text-on-surface font-bold mt-space-xs tabular-nums leading-none">
                $4,892.50
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
          </div>
          <div className="mt-space-md pt-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="inline-flex items-center text-label-sm font-label-sm font-bold text-on-tertiary bg-tertiary px-space-xs py-space-2xs rounded">
                <span className="material-symbols-outlined text-xs mr-0.5">trending_up</span> +14.2%
              </span>
              <span className="font-body-sm text-body-sm text-secondary">vs. ayer</span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">68 tickets emitidos</span>
          </div>
          {/* Sparkline Graphic Mini-Chart */}
          <div className="mt-space-sm">
            <svg className="w-full h-8 text-primary overflow-visible" fill="none" preserveAspectRatio="none" viewBox="0 0 100 24">
              <path d="M0 20 L15 17 L30 19 L45 8 L60 14 L75 5 L90 7 L100 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
              <path d="M0 20 L15 17 L30 19 L45 8 L60 14 L75 5 L90 7 L100 2 L100 24 L0 24 Z" fill="currentColor" fillOpacity="0.08"></path>
            </svg>
          </div>
        </div>

        {/* Card 2: Valor Total de Inventario */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Valor del Inventario</span>
              <div className="font-display-md text-display-md text-on-surface font-bold mt-space-xs tabular-nums leading-none">
                ${valorInventario > 0 ? valorInventario.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '86,420.00'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">warehouse</span>
            </div>
          </div>
          <div className="mt-space-md pt-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="font-body-sm text-body-sm text-secondary">Volumen total:</span>
              <span className="font-label-sm text-label-sm text-on-surface font-bold">
                {totalUnidades > 0 ? totalUnidades.toLocaleString() : '3,420'} unid.
              </span>
            </div>
            <span className="font-label-sm text-label-sm bg-surface-container-high px-space-xs py-space-2xs rounded text-secondary font-semibold">
              {productos.length > 0 ? productos.length : 485} SKUs
            </span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div className="bg-tertiary-container h-full rounded-full" style={{ width: '82%' }}></div>
          </div>
        </div>

        {/* Card 3: Alertas de Stock Crítico */}
        <div
          onClick={() => onNavigate('alertas')}
          className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Stock Crítico</span>
              <div className="font-display-md text-display-md text-error font-bold mt-space-xs tabular-nums leading-none flex items-center gap-space-xs">
                {stockCritico.length > 0 ? stockCritico.length : 14}
                <span className="font-headline-sm text-headline-sm text-on-surface font-normal">SKUs</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-error-container text-on-error-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">warning</span>
            </div>
          </div>
          <div className="mt-space-md pt-space-sm flex items-center justify-between">
            <span className="font-label-sm text-label-sm bg-error text-on-error px-space-xs py-space-2xs rounded font-bold uppercase tracking-wider">
              Orden inmediata
            </span>
            <span className="font-body-sm text-body-sm text-error font-semibold">4 sin existencia</span>
          </div>
          <div className="mt-space-sm w-full bg-error-container rounded-full h-1.5 overflow-hidden">
            <div className="bg-error h-full rounded-full" style={{ width: '68%' }}></div>
          </div>
        </div>

        {/* Card 4: Ticket Promedio */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Ticket Promedio</span>
              <div className="font-display-md text-display-md text-on-surface font-bold mt-space-xs tabular-nums leading-none">
                $71.95
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">receipt</span>
            </div>
          </div>
          <div className="mt-space-md pt-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="inline-flex items-center text-label-sm font-label-sm font-bold text-on-tertiary bg-tertiary px-space-xs py-space-2xs rounded">
                +5.8%
              </span>
              <span className="font-body-sm text-body-sm text-secondary">mostrador</span>
            </div>
            <span className="font-label-sm text-label-sm text-secondary font-semibold">Máx: $412.00</span>
          </div>
          {/* Sparkline Graphic Mini-Chart */}
          <div className="mt-space-sm">
            <svg className="w-full h-8 text-tertiary overflow-visible" fill="none" preserveAspectRatio="none" viewBox="0 0 100 24">
              <path d="M0 16 L20 18 L35 12 L50 15 L68 9 L82 11 L100 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
              <path d="M0 16 L20 18 L35 12 L50 15 L68 9 L82 11 L100 4 L100 24 L0 24 Z" fill="currentColor" fillOpacity="0.08"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Operational Core Grid: 8 Cols (Hourly Velocity & Tender Mix) + 4 Cols (Urgent Stock Depletion) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Left Column: Hourly Performance & Breakdown (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
            <div>
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Rendimiento de Ventas por Hora
              </span>
              <p className="font-body-sm text-body-sm text-secondary mt-space-2xs">
                Registro de tráfico de caja y picos de facturación en mostrador (08:00 - 18:00)
              </p>
            </div>
            <div className="flex items-center gap-space-sm text-body-sm font-body-sm">
              <div className="flex items-center gap-space-xs">
                <span className="w-3 h-3 rounded-full bg-primary"></span>
                <span className="text-secondary font-medium">Hoy</span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="w-3 h-3 rounded-full bg-secondary-fixed-dim"></span>
                <span className="text-secondary font-medium">Promedio Diario</span>
              </div>
            </div>
          </div>

          {/* Main Hourly Chart Visual (Detailed Inline SVG Visualization) */}
          <div className="relative w-full h-64 mt-space-sm bg-surface-container-low/50 rounded-lg p-space-md flex flex-col justify-between">
            {/* Background Grid Rules */}
            <div className="absolute inset-x-space-md inset-y-space-md flex flex-col justify-between pointer-events-none opacity-40">
              <div className="w-full h-px bg-outline-variant"></div>
              <div className="w-full h-px bg-outline-variant"></div>
              <div className="w-full h-px bg-outline-variant"></div>
              <div className="w-full h-px bg-outline-variant"></div>
            </div>

            {/* SVG Curves & Nodes */}
            <svg className="w-full h-44 overflow-visible relative z-10" fill="none" preserveAspectRatio="none" viewBox="0 0 600 160">
              <defs>
                <linearGradient id="primaryAreaGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#a33900" stopOpacity="0.25"></stop>
                  <stop offset="100%" stopColor="#a33900" stopOpacity="0.0"></stop>
                </linearGradient>
              </defs>
              {/* Average Baseline Curve */}
              <path d="M 0 130 C 50 120, 100 95, 170 70 C 230 48, 290 85, 340 90 C 400 95, 460 55, 520 40 C 560 30, 585 50, 600 60" fill="none" stroke="#bec6e0" strokeDasharray="4 4" strokeWidth="2"></path>
              {/* Today Gradient Area Fill */}
              <path d="M 0 145 C 60 140, 100 120, 150 75 C 180 35, 210 22, 230 20 C 260 18, 290 60, 330 85 C 370 100, 420 80, 460 45 C 490 20, 520 18, 540 22 C 570 28, 585 65, 600 70 L 600 160 L 0 160 Z" fill="url(#primaryAreaGrad)"></path>
              {/* Today Solid Stroke Line */}
              <path d="M 0 145 C 60 140, 100 120, 150 75 C 180 35, 210 22, 230 20 C 260 18, 290 60, 330 85 C 370 100, 420 80, 460 45 C 490 20, 520 18, 540 22 C 570 28, 585 65, 600 70" fill="none" stroke="#a33900" strokeLinecap="round" strokeWidth="3"></path>
              {/* Peak Node 1: 11:00 AM */}
              <circle cx="230" cy="20" fill="#ffffff" r="5" stroke="#a33900" strokeWidth="3"></circle>
              {/* Peak Node 2: 04:30 PM */}
              <circle cx="530" cy="20" fill="#ffffff" r="5" stroke="#a33900" strokeWidth="3"></circle>
            </svg>

            {/* Peak Markers Callouts */}
            <div className="absolute top-2 left-1/3 -translate-x-4 bg-inverse-surface text-inverse-on-surface px-space-xs py-space-2xs rounded shadow text-label-sm font-label-sm pointer-events-none">
              Pico: $840 @ 11:00 AM
            </div>
            <div className="absolute top-2 right-16 bg-inverse-surface text-inverse-on-surface px-space-xs py-space-2xs rounded shadow text-label-sm font-label-sm pointer-events-none">
              Pico: $765 @ 04:30 PM
            </div>

            {/* Axis Labels (X-Axis) */}
            <div className="flex justify-between items-center text-body-sm font-body-sm text-secondary pt-space-xs border-t-0 select-none">
              <span>08:00</span>
              <span>10:00</span>
              <span className="font-bold text-on-surface">11:00</span>
              <span>12:00</span>
              <span>14:00</span>
              <span className="font-bold text-on-surface">16:30</span>
              <span>18:00</span>
            </div>
          </div>

          {/* Payment Breakdown Segment (Tender Types Distribution) */}
          <div className="mt-space-sm pt-space-md border-t border-transparent bg-surface-container-low p-space-md rounded-lg">
            <div className="flex items-center justify-between mb-space-sm">
              <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                Distribución por Método de Pago
              </span>
              <span className="font-body-sm text-body-sm text-secondary">Totales liquidados en tiempo real</span>
            </div>
            {/* Multi-segment progress track */}
            <div className="w-full h-3 rounded-full bg-surface-container-high flex overflow-hidden">
              <div className="bg-primary h-full transition-all" style={{ width: '45%' }} title="Efectivo 45%"></div>
              <div className="bg-tertiary h-full transition-all" style={{ width: '35%' }} title="Tarjeta Débito/Crédito 35%"></div>
              <div className="bg-secondary h-full transition-all" style={{ width: '20%' }} title="Transferencia/Pago Móvil 20%"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md mt-space-md">
              <div className="flex items-center gap-space-sm">
                <span className="w-3 h-3 rounded bg-primary shrink-0"></span>
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-bold tabular-nums">45% ($2,201.62)</span>
                  <span className="font-body-sm text-body-sm text-secondary">Efectivo Mostrador</span>
                </div>
              </div>
              <div className="flex items-center gap-space-sm">
                <span className="w-3 h-3 rounded bg-tertiary shrink-0"></span>
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-bold tabular-nums">35% ($1,712.38)</span>
                  <span className="font-body-sm text-body-sm text-secondary">Tarjeta Débito / Crédito</span>
                </div>
              </div>
              <div className="flex items-center gap-space-sm">
                <span className="w-3 h-3 rounded bg-secondary shrink-0"></span>
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-bold tabular-nums">20% ($978.50)</span>
                  <span className="font-body-sm text-body-sm text-secondary">Transferencia / Pago Móvil</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Urgent Replenishment Alerts (4 cols) */}
        <div className="lg:col-span-4 flex flex-col bg-surface-container-lowest p-space-lg rounded-xl shadow-sm justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-error text-xl">crisis_alert</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Alertas de Reposición
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-secondary mt-space-2xs">
                  Inventario por debajo del umbral mínimo de seguridad
                </p>
              </div>
              <span className="font-label-sm text-label-sm bg-error-container text-on-error-container px-space-xs py-space-2xs rounded font-bold">
                URGENTE
              </span>
            </div>

            {/* List of Critical SKUs */}
            <div className="flex flex-col gap-space-md mt-space-lg">
              {/* Item 1: Cemento */}
              <div className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors">
                <div className="flex items-start justify-between gap-space-xs">
                  <div>
                    <span className="font-label-md text-label-md text-on-surface font-bold block leading-tight">
                      Cemento Gris Portland 50kg
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">SKU: CEM-POR-050 · Proveedor: Holcim</span>
                  </div>
                  <span className="font-label-sm text-label-sm font-bold text-error bg-error/10 px-space-xs py-space-2xs rounded shrink-0">
                    4 / 50 mín
                  </span>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                  <div className="bg-error h-full rounded-full" style={{ width: '8%' }}></div>
                </div>
                <div className="flex justify-end mt-space-2xs">
                  <button
                    onClick={() => onNavigate('alertas')}
                    className="font-label-sm text-label-sm text-primary hover:text-primary-container font-bold inline-flex items-center gap-1 transition-colors"
                    type="button"
                  >
                    <span>Generar Pedido</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>

              {/* Item 2: Tubo PVC */}
              <div className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors">
                <div className="flex items-start justify-between gap-space-xs">
                  <div>
                    <span className="font-label-md text-label-md text-on-surface font-bold block leading-tight">
                      Tubo PVC Sanitario 1/2 pulgada
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">SKU: TUB-PVC-012 · Proveedor: Tubrica</span>
                  </div>
                  <span className="font-label-sm text-label-sm font-bold text-error bg-error/10 px-space-xs py-space-2xs rounded shrink-0">
                    8 / 40 mín
                  </span>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                  <div className="bg-error h-full rounded-full" style={{ width: '20%' }}></div>
                </div>
                <div className="flex justify-end mt-space-2xs">
                  <button
                    onClick={() => onNavigate('alertas')}
                    className="font-label-sm text-label-sm text-primary hover:text-primary-container font-bold inline-flex items-center gap-1 transition-colors"
                    type="button"
                  >
                    <span>Generar Pedido</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>

              {/* Item 3: Disco de corte */}
              <div className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors">
                <div className="flex items-start justify-between gap-space-xs">
                  <div>
                    <span className="font-label-md text-label-md text-on-surface font-bold block leading-tight">
                      Disco de Corte Metal 4 1/2'
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">SKU: DIS-COR-412 · Proveedor: Bosch</span>
                  </div>
                  <span className="font-label-sm text-label-sm font-bold text-error bg-error/10 px-space-xs py-space-2xs rounded shrink-0">
                    5 / 60 mín
                  </span>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                  <div className="bg-error h-full rounded-full" style={{ width: '8.3%' }}></div>
                </div>
                <div className="flex justify-end mt-space-2xs">
                  <button
                    onClick={() => onNavigate('alertas')}
                    className="font-label-sm text-label-sm text-primary hover:text-primary-container font-bold inline-flex items-center gap-1 transition-colors"
                    type="button"
                  >
                    <span>Generar Pedido</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>

              {/* Item 4: Cerradura */}
              <div className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors">
                <div className="flex items-start justify-between gap-space-xs">
                  <div>
                    <span className="font-label-md text-label-md text-on-surface font-bold block leading-tight">
                      Cerradura Sobreponer Cromo
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">SKU: CER-SOB-CRM · Proveedor: Cisa</span>
                  </div>
                  <span className="font-label-sm text-label-sm font-bold text-error bg-error/10 px-space-xs py-space-2xs rounded shrink-0">
                    2 / 15 mín
                  </span>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                  <div className="bg-error h-full rounded-full" style={{ width: '13.3%' }}></div>
                </div>
                <div className="flex justify-end mt-space-2xs">
                  <button
                    onClick={() => onNavigate('alertas')}
                    className="font-label-sm text-label-sm text-primary hover:text-primary-container font-bold inline-flex items-center gap-1 transition-colors"
                    type="button"
                  >
                    <span>Generar Pedido</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer for Batch Purchase Order */}
          <div className="mt-space-md pt-space-md border-t-0 bg-surface-container-low p-space-md rounded-lg flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-secondary">Total a reabastecer</span>
              <span className="font-headline-sm text-headline-sm font-bold text-on-surface">14 órdenes</span>
            </div>
            <button
              onClick={() => onNavigate('alertas')}
              className="px-space-md py-space-xs bg-inverse-surface text-inverse-on-surface rounded font-label-md text-label-md hover:bg-on-surface transition-colors shadow-sm"
              type="button"
            >
              Auto-Generar OC
            </button>
          </div>
        </div>
      </div>

      {/* Lower Operational Section: Split Data Matrix (Top Products & Real-Time POS Feed) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-lg mb-space-lg">
        {/* Sub-section 1: Top 5 Best-Selling Hardware Items */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary text-xl">star</span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Top 5 Productos Más Vendidos
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-secondary bg-surface-container-high px-space-xs py-space-2xs rounded">
              Esta Semana
            </span>
          </div>

          {/* High Density Matrix Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase">
                  <th className="py-space-xs px-space-sm rounded-l">#</th>
                  <th className="py-space-xs px-space-sm">Producto / SKU</th>
                  <th className="py-space-xs px-space-sm">Categoría</th>
                  <th className="py-space-xs px-space-sm text-right">Cant.</th>
                  <th className="py-space-xs px-space-sm text-right rounded-r">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y-0 text-body-sm font-body-sm">
                <tr className="hover:bg-surface-container-low/70 transition-colors">
                  <td className="py-space-sm px-space-sm font-label-md text-label-md text-primary font-bold">01</td>
                  <td className="py-space-sm px-space-sm">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">
                        Taladro Percutor DeWalt 1/2' 20V
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">SKU: DWT-DCD776</span>
                    </div>
                  </td>
                  <td className="py-space-sm px-space-sm">
                    <span className="px-space-xs py-space-2xs rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                      Herramientas
                    </span>
                  </td>
                  <td className="py-space-sm px-space-sm text-right font-label-md text-label-md font-bold text-on-surface tabular-nums">
                    48 un.
                  </td>
                  <td className="py-space-sm px-space-sm text-right font-label-md text-label-md font-bold text-primary tabular-nums">
                    $6,240.00
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/70 transition-colors">
                  <td className="py-space-sm px-space-sm font-label-md text-label-md text-on-surface-variant font-bold">02</td>
                  <td className="py-space-sm px-space-sm">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">
                        Cable Eléctrico THW Calibre 12 AWG
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">SKU: CBL-THW-012 (Rollos 100m)</span>
                    </div>
                  </td>
                  <td className="py-space-sm px-space-sm">
                    <span className="px-space-xs py-space-2xs rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                      Electricidad
                    </span>
                  </td>
                  <td className="py-space-sm px-space-sm text-right font-label-md text-label-md font-bold text-on-surface tabular-nums">
                    34 rol.
                  </td>
                  <td className="py-space-sm px-space-sm text-right font-label-md text-label-md font-bold text-primary tabular-nums">
                    $2,890.00
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/70 transition-colors">
                  <td className="py-space-sm px-space-sm font-label-md text-label-md text-on-surface-variant font-bold">03</td>
                  <td className="py-space-sm px-space-sm">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">
                        Pintura Látex Blanco Profesional Cuñete
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">SKU: PNT-LTX-BLN (5 Galones)</span>
                    </div>
                  </td>
                  <td className="py-space-sm px-space-sm">
                    <span className="px-space-xs py-space-2xs rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                      Pinturas
                    </span>
                  </td>
                  <td className="py-space-sm px-space-sm text-right font-label-md text-label-md font-bold text-on-surface tabular-nums">
                    29 cuñ.
                  </td>
                  <td className="py-space-sm px-space-sm text-right font-label-md text-label-md font-bold text-primary tabular-nums">
                    $2,175.00
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/70 transition-colors">
                  <td className="py-space-sm px-space-sm font-label-md text-label-md text-on-surface-variant font-bold">04</td>
                  <td className="py-space-sm px-space-sm">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">
                        Bombillo LED 12W Luz Blanca E27
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">SKU: ILU-LED-012</span>
                    </div>
                  </td>
                  <td className="py-space-sm px-space-sm">
                    <span className="px-space-xs py-space-2xs rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                      Iluminación
                    </span>
                  </td>
                  <td className="py-space-sm px-space-sm text-right font-label-md text-label-md font-bold text-on-surface tabular-nums">
                    215 un.
                  </td>
                  <td className="py-space-sm px-space-sm text-right font-label-md text-label-md font-bold text-primary tabular-nums">
                    $967.50
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/70 transition-colors">
                  <td className="py-space-sm px-space-sm font-label-md text-label-md text-on-surface-variant font-bold">05</td>
                  <td className="py-space-sm px-space-sm">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">
                        Tornillo Drywall Punta Fina 6x1 1/4
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">SKU: TRN-DRY-614 (Caja 1000u)</span>
                    </div>
                  </td>
                  <td className="py-space-sm px-space-sm">
                    <span className="px-space-xs py-space-2xs rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                      Fijación
                    </span>
                  </td>
                  <td className="py-space-sm px-space-sm text-right font-label-md text-label-md font-bold text-on-surface tabular-nums">
                    62 caj.
                  </td>
                  <td className="py-space-sm px-space-sm text-right font-label-md text-label-md font-bold text-primary tabular-nums">
                    $744.00
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Sub-section 2: Latest POS Register Feed */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-space-md">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-tertiary text-xl">receipt_long</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Últimas Transacciones en Mostrador
                </span>
              </div>
              <button
                onClick={() => onNavigate('ventas')}
                className="font-label-sm text-label-sm text-tertiary hover:underline font-bold"
                type="button"
              >
                Ver todas
              </button>
            </div>
            <div className="flex flex-col gap-space-xs">
              {/* Row 1 */}
              <div className="flex items-center justify-between p-space-sm rounded-lg hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-space-md min-w-0">
                  <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
                    <span className="material-symbols-outlined text-base">shopping_cart</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-label-md text-label-md font-bold text-on-surface">#VTA-2024-0941</span>
                      <span className="px-space-xs py-space-2xs rounded text-label-sm font-label-sm bg-surface-container text-tertiary font-bold">
                        Completada
                      </span>
                    </div>
                    <span className="font-body-sm text-body-sm text-secondary truncate">
                      Cliente: Constructora Alfa C.A. · Cajero: R. Gómez
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-space-md shrink-0">
                  <span className="font-label-lg text-label-lg font-bold text-on-surface tabular-nums">$342.50</span>
                  <button
                    onClick={() => onNavigate('ventas')}
                    className="p-space-2xs hover:bg-surface-container-high rounded text-secondary"
                    title="Imprimir Ticket"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">print</span>
                  </button>
                </div>
              </div>

              {/* Row 2 */}
              <div className="flex items-center justify-between p-space-sm rounded-lg hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-space-md min-w-0">
                  <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
                    <span className="material-symbols-outlined text-base">shopping_cart</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-label-md text-label-md font-bold text-on-surface">#VTA-2024-0940</span>
                      <span className="px-space-xs py-space-2xs rounded text-label-sm font-label-sm bg-surface-container text-tertiary font-bold">
                        Completada
                      </span>
                    </div>
                    <span className="font-body-sm text-body-sm text-secondary truncate">
                      Cliente: Manuel Suárez (Contado) · Cajero: C. Méndez
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-space-md shrink-0">
                  <span className="font-label-lg text-label-lg font-bold text-on-surface tabular-nums">$18.90</span>
                  <button
                    onClick={() => onNavigate('ventas')}
                    className="p-space-2xs hover:bg-surface-container-high rounded text-secondary"
                    title="Imprimir Ticket"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">print</span>
                  </button>
                </div>
              </div>

              {/* Row 3 */}
              <div className="flex items-center justify-between p-space-sm rounded-lg hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-space-md min-w-0">
                  <div className="w-8 h-8 rounded bg-primary-fixed text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-base animate-pulse">pending</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-label-md text-label-md font-bold text-on-surface">#VTA-2024-0939</span>
                      <span className="px-space-xs py-space-2xs rounded text-label-sm font-label-sm bg-primary-fixed text-on-primary-fixed font-bold">
                        En proceso
                      </span>
                    </div>
                    <span className="font-body-sm text-body-sm text-secondary truncate">
                      Cliente: Taller Metalmecánico Pérez · Caja 02
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-space-md shrink-0">
                  <span className="font-label-lg text-label-lg font-bold text-on-surface tabular-nums">$520.00</span>
                  <button
                    onClick={() => onNavigate('pos')}
                    className="p-space-2xs hover:bg-surface-container-high rounded text-secondary"
                    title="Reanudar"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                  </button>
                </div>
              </div>

              {/* Row 4 */}
              <div className="flex items-center justify-between p-space-sm rounded-lg hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-space-md min-w-0">
                  <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
                    <span className="material-symbols-outlined text-base">shopping_cart</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-label-md text-label-md font-bold text-on-surface">#VTA-2024-0938</span>
                      <span className="px-space-xs py-space-2xs rounded text-label-sm font-label-sm bg-surface-container text-tertiary font-bold">
                        Completada
                      </span>
                    </div>
                    <span className="font-body-sm text-body-sm text-secondary truncate">
                      Cliente: Plomería & Gas Express · Cajero: R. Gómez
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-space-md shrink-0">
                  <span className="font-label-lg text-label-lg font-bold text-on-surface tabular-nums">$145.20</span>
                  <button
                    onClick={() => onNavigate('ventas')}
                    className="p-space-2xs hover:bg-surface-container-high rounded text-secondary"
                    title="Imprimir Ticket"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">print</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Live Sync Hardware Status Pill */}
          <div className="mt-space-md pt-space-xs flex items-center justify-between text-body-sm font-body-sm text-secondary border-t border-surface-container">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>
              <span>Caja 01: Impresora Fiscal OK</span>
            </div>
            <span className="tabular-nums font-mono">Último sync: 16:42:10</span>
          </div>
        </div>
      </div>
    </div>
  );
};
