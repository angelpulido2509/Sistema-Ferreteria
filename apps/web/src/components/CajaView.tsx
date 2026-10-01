import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  EstadoTurnoCaja,
  TipoMovimientoCaja,
  Moneda,
  type TurnoCajaDTO,
  type AbrirCajaDTO,
  type CrearMovimientoCajaDTO,
  type CerrarCajaDTO,
  type ResumenArqueoDTO,
  type UsuarioDTO,
} from '@ferreteria/shared';
import { api } from '../lib/api.js';

interface CajaViewProps {
  currentUser: UsuarioDTO | null;
  onNavigateToPos?: () => void;
}

export const CajaView: React.FC<CajaViewProps> = ({ currentUser, onNavigateToPos }) => {
  const queryClient = useQueryClient();

  // Estados de modales
  const [isAbrirModalOpen, setIsAbrirModalOpen] = useState(false);
  const [isMovimientoModalOpen, setIsMovimientoModalOpen] = useState(false);
  const [isArqueoModalOpen, setIsArqueoModalOpen] = useState(false);
  const [arqueoTipo, setArqueoTipo] = useState<'X' | 'Z'>('X');

  // Modal para ver/imprimir arqueo de turno pasado
  const [selectedTurnoId, setSelectedTurnoId] = useState<string | null>(null);

  // Formulario de apertura
  const [cajaNumero, setCajaNumero] = useState('Caja 1');
  const [montoInicialUsd, setMontoInicialUsd] = useState<number>(50);
  const [montoInicialCop, setMontoInicialCop] = useState<number>(100000);
  const [montoInicialVes, setMontoInicialVes] = useState<number>(0);

  // Formulario de movimiento manual
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoCaja>(TipoMovimientoCaja.EGRESO);
  const [montoMovimiento, setMontoMovimiento] = useState<number>(0);
  const [monedaMovimiento, setMonedaMovimiento] = useState<Moneda>(Moneda.USD);
  const [motivoMovimiento, setMotivoMovimiento] = useState('');

  // Formulario de arqueo y cierre ciego
  const [conteoFisicoUsd, setConteoFisicoUsd] = useState<number>(0);
  const [conteoFisicoCop, setConteoFisicoCop] = useState<number>(0);
  const [conteoFisicoVes, setConteoFisicoVes] = useState<number>(0);
  const [observacionesCierre, setObservacionesCierre] = useState('');

  // Pestaña activa: 'turno' o 'historial'
  const [activeTab, setActiveTab] = useState<'turno' | 'historial'>('turno');

  // Consulta de configuración
  const { data: config } = useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api.getConfiguracion(),
  });
  const tasaVes = config?.tasaVes ?? 60.0;
  const tasaCop = config?.tasaCop ?? 4100.0;

  // Consulta de turno activo
  const {
    data: turnoActivo,
    isLoading: loadingTurno,
  } = useQuery<TurnoCajaDTO | null>({
    queryKey: ['caja', 'turno-activo'],
    queryFn: () => api.getTurnoActivo(),
    refetchInterval: 15000,
  });

  // Consulta de resumen del turno activo para Reporte X o base de Reporte Z
  const { data: resumenTurno, refetch: refetchResumen } = useQuery<ResumenArqueoDTO | null>({
    queryKey: ['caja', 'resumen', turnoActivo?.id],
    queryFn: () => (turnoActivo?.id ? api.getResumenArqueo(turnoActivo.id) : Promise.resolve(null)),
    enabled: !!turnoActivo?.id,
    refetchInterval: isArqueoModalOpen ? 5000 : 30000,
  });

  // Consulta del resumen de un turno histórico para ver/imprimir
  const { data: resumenTurnoHistorico } = useQuery<ResumenArqueoDTO | null>({
    queryKey: ['caja', 'resumen', selectedTurnoId],
    queryFn: () => (selectedTurnoId ? api.getResumenArqueo(selectedTurnoId) : Promise.resolve(null)),
    enabled: !!selectedTurnoId,
  });

  // Consulta de historial de turnos
  const { data: historialTurnos = [], isLoading: loadingHistorial } = useQuery<TurnoCajaDTO[]>({
    queryKey: ['caja', 'historial'],
    queryFn: () => api.getHistorialCajas(30),
    enabled: activeTab === 'historial',
  });

  // Mutación para abrir turno
  const abrirMutation = useMutation({
    mutationFn: (data: AbrirCajaDTO) => api.abrirCaja(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja'] });
      setIsAbrirModalOpen(false);
    },
    onError: (err: any) => {
      alert(err?.message || 'Error al abrir turno de caja');
    },
  });

  // Mutación para registrar movimiento
  const movimientoMutation = useMutation({
    mutationFn: (data: CrearMovimientoCajaDTO) => api.registrarMovimientoCaja(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja'] });
      setIsMovimientoModalOpen(false);
      setMontoMovimiento(0);
      setMotivoMovimiento('');
    },
    onError: (err: any) => {
      alert(err?.message || 'Error al registrar movimiento');
    },
  });

  // Mutación para cerrar turno (Reporte Z)
  const cerrarMutation = useMutation({
    mutationFn: (data: CerrarCajaDTO) => api.cerrarCaja(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja'] });
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      setIsArqueoModalOpen(false);
      alert('Turno de caja cerrado exitosamente con Reporte Z.');
    },
    onError: (err: any) => {
      alert(err?.message || 'Error al cerrar turno de caja');
    },
  });

  const handleAbrirSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    abrirMutation.mutate({
      cajaNumero,
      montoInicialUsd: Number(montoInicialUsd),
      montoInicialCop: Number(montoInicialCop),
      montoInicialVes: Number(montoInicialVes),
    });
  };

  const handleMovimientoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnoActivo) return;
    if (montoMovimiento <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }
    if (!motivoMovimiento.trim()) {
      alert('Debe especificar el motivo del movimiento');
      return;
    }
    movimientoMutation.mutate({
      turnoCajaId: turnoActivo.id,
      tipo: tipoMovimiento,
      monto: Number(montoMovimiento),
      moneda: monedaMovimiento,
      motivo: motivoMovimiento.trim(),
    });
  };

  const handleCerrarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnoActivo) return;
    if (
      !confirm(
        '¿Estás seguro de cerrar definitivamente este turno de caja (Reporte Z)? Esta acción no se puede revertir.'
      )
    ) {
      return;
    }
    cerrarMutation.mutate({
      turnoCajaId: turnoActivo.id,
      conteoFisicoUsd: Number(conteoFisicoUsd),
      conteoFisicoCop: Number(conteoFisicoCop),
      conteoFisicoVes: Number(conteoFisicoVes),
      observaciones: observacionesCierre.trim() || undefined,
    });
  };

  const handlePrintTicket = () => {
    window.print();
  };

  // Cálculo en vivo de descuadres durante el conteo ciego
  const esperadoUsd = resumenTurno?.esperadoEnCaja.efectivoUsd ?? 0;
  const esperadoCop = resumenTurno?.esperadoEnCaja.efectivoCop ?? 0;
  const esperadoVes = resumenTurno?.esperadoEnCaja.efectivoVes ?? 0;

  const diffUsd = Math.round((Number(conteoFisicoUsd || 0) - esperadoUsd) * 100) / 100;
  const diffCop = Math.round(Number(conteoFisicoCop || 0) - esperadoCop);
  const diffVes = Math.round((Number(conteoFisicoVes || 0) - esperadoVes) * 100) / 100;

  return (
    <div className="flex flex-col gap-space-lg p-space-lg w-full max-w-7xl mx-auto">
      {/* Estilos específicos de impresión para ticket térmico de 80mm */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #ticket-arqueo, #ticket-arqueo * {
              visibility: visible;
            }
            #ticket-arqueo {
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

      {/* Barra de Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md border-b border-surface-container pb-space-md">
        <div>
          <h1 className="font-headline-md text-headline-md font-extrabold text-on-surface flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-primary text-3xl">point_of_sale</span>
            <span>Control de Caja y Arqueo Multimoneda</span>
          </h1>
          <div className="font-body-sm text-body-sm text-secondary mt-1 flex items-center gap-2 flex-wrap">
            <span>Gestión de turnos de mostrador, movimientos de efectivo y arqueos ciegos (Reportes X y Z).</span>
            {currentUser && (
              <span className="bg-surface-container px-2 py-0.5 rounded text-xs font-semibold text-on-surface">
                Operador: {currentUser.nombre} ({currentUser.rol})
              </span>
            )}
            <span className="bg-surface-container px-2 py-0.5 rounded text-xs font-medium text-secondary">
              Tasas: 1$ = {tasaCop.toLocaleString()} COP | {tasaVes} VES
            </span>
          </div>
        </div>

        {/* Pestañas / Acciones */}
        <div className="flex items-center gap-space-sm">
          <div className="flex bg-surface-container-low p-1 rounded-xl border border-surface-container">
            <button
              type="button"
              onClick={() => setActiveTab('turno')}
              className={`px-space-md py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'turno'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">payments</span>
              <span>Turno Activo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('historial')}
              className={`px-space-md py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'historial'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">history</span>
              <span>Historial de Cierres</span>
            </button>
          </div>

          {onNavigateToPos && (
            <button
              type="button"
              onClick={onNavigateToPos}
              className="flex items-center gap-1.5 px-space-md py-2 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-xl border border-surface-container transition"
            >
              <span className="material-symbols-outlined text-base">shopping_cart</span>
              <span>Ir al POS</span>
            </button>
          )}
        </div>
      </div>

      {/* VISTA 1: TURNO ACTIVO */}
      {activeTab === 'turno' && (
        <div className="flex flex-col gap-space-lg">
          {loadingTurno ? (
            <div className="p-12 text-center text-secondary">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs">Consultando estado de caja...</p>
            </div>
          ) : !turnoActivo ? (
            /* ESTADO 1: CAJA CERRADA / SIN TURNO */
            <div className="p-space-xl bg-surface-container-lowest border border-surface-container rounded-3xl shadow-sm text-center flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-4xl">lock_clock</span>
              </div>
              <h2 className="text-2xl font-black text-on-surface mb-2">Caja Cerrada / Sin Turno Activo</h2>
              <p className="text-sm text-secondary max-w-md mb-6">
                Para comenzar a facturar en el punto de venta (POS) y recibir pagos en efectivo o electrónicos, abre un turno con la base inicial de cambio en dólares y pesos.
              </p>
              <button
                type="button"
                onClick={() => setIsAbrirModalOpen(true)}
                className="flex items-center gap-2 px-space-xl py-3 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-2xl shadow-md transition"
              >
                <span className="material-symbols-outlined text-xl">key</span>
                <span>Abrir Turno de Caja</span>
              </button>
            </div>
          ) : (
            /* ESTADO 2: TURNO ACTIVO ABIERTO */
            <div className="flex flex-col gap-space-lg">
              {/* Banner de Estado del Turno */}
              <div className="p-space-lg bg-surface-container-lowest border border-surface-container rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-space-md">
                <div className="flex items-center gap-space-md">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-3xl">storefront</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-white uppercase tracking-wider">
                        Turno Abierto
                      </span>
                      <h2 className="text-xl font-black text-on-surface">
                        {turnoActivo.cajaNumero}
                      </h2>
                    </div>
                    <p className="text-xs text-secondary mt-1">
                      Iniciado por <strong className="text-on-surface">{turnoActivo.usuarioApertura?.nombre || 'Cajero'}</strong> el{' '}
                      {new Date(turnoActivo.fechaApertura).toLocaleString('es-VE')}
                    </p>
                  </div>
                </div>

                {/* Acciones de Caja */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTipoMovimiento(TipoMovimientoCaja.INGRESO);
                      setIsMovimientoModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-container-low hover:bg-surface-container border border-surface-container rounded-xl text-xs font-bold text-on-surface transition"
                  >
                    <span className="material-symbols-outlined text-emerald-600 text-base">arrow_downward</span>
                    <span>Ingreso (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTipoMovimiento(TipoMovimientoCaja.EGRESO);
                      setIsMovimientoModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-container-low hover:bg-surface-container border border-surface-container rounded-xl text-xs font-bold text-on-surface transition"
                  >
                    <span className="material-symbols-outlined text-red-600 text-base">arrow_upward</span>
                    <span>Egreso (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setArqueoTipo('X');
                      refetchResumen();
                      setIsArqueoModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 border border-blue-500/30 rounded-xl text-xs font-bold transition"
                  >
                    <span className="material-symbols-outlined text-base">assessment</span>
                    <span>Reporte X (Corte Parcial)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setArqueoTipo('Z');
                      refetchResumen();
                      setConteoFisicoUsd(resumenTurno?.esperadoEnCaja.efectivoUsd ?? 0);
                      setConteoFisicoCop(resumenTurno?.esperadoEnCaja.efectivoCop ?? 0);
                      setIsArqueoModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-xs font-black shadow-sm transition"
                  >
                    <span className="material-symbols-outlined text-base">lock</span>
                    <span>Cerrar Turno (Reporte Z)</span>
                  </button>
                </div>
              </div>

              {/* Bento Grid: 4 Tarjetas de Dinero en Turno */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
                {/* 1. Fondo Inicial */}
                <div className="p-space-lg bg-surface-container-lowest border border-surface-container rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-secondary flex items-center justify-between">
                      <span>Fondo Inicial de Caja</span>
                      <span className="material-symbols-outlined text-base text-secondary">account_balance_wallet</span>
                    </span>
                    <div className="mt-3 flex flex-col gap-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-on-surface">
                          ${turnoActivo.montoInicialUsd.toFixed(2)}
                        </span>
                        <span className="text-xs font-mono text-secondary">USD</span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1 border-t border-surface-container">
                        <span className="text-base font-bold text-on-surface">
                          ${turnoActivo.montoInicialCop.toLocaleString('es-CO')}
                        </span>
                        <span className="text-xs font-mono text-secondary">COP</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-secondary mt-3">Base suministrada al abrir</span>
                </div>

                {/* 2. Ventas en Efectivo */}
                <div className="p-space-lg bg-surface-container-lowest border border-surface-container rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-secondary flex items-center justify-between">
                      <span>Ventas en Efectivo</span>
                      <span className="material-symbols-outlined text-base text-emerald-600">payments</span>
                    </span>
                    <div className="mt-3 flex flex-col gap-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                          ${(resumenTurno?.ventasPorMetodo.efectivoUsd.monto ?? 0).toFixed(2)}
                        </span>
                        <span className="text-xs font-mono text-emerald-700">
                          {resumenTurno?.ventasPorMetodo.efectivoUsd.transacciones ?? 0} tx
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1 border-t border-surface-container">
                        <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                          ${(resumenTurno?.ventasPorMetodo.efectivoCop.monto ?? 0).toLocaleString('es-CO')}
                        </span>
                        <span className="text-xs font-mono text-emerald-700">
                          {resumenTurno?.ventasPorMetodo.efectivoCop.transacciones ?? 0} tx
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-secondary mt-3">Cobrado en gaveta física</span>
                </div>

                {/* 3. Dinero Estimado en Gaveta (Esperado) */}
                <div className="p-space-lg bg-primary/5 border border-primary/20 rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center justify-between">
                      <span>Total Esperado en Gaveta</span>
                      <span className="material-symbols-outlined text-base text-primary">calculate</span>
                    </span>
                    <div className="mt-3 flex flex-col gap-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-primary">
                          ${(resumenTurno?.esperadoEnCaja.efectivoUsd ?? 0).toFixed(2)}
                        </span>
                        <span className="text-xs font-mono text-primary">USD</span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1 border-t border-primary/20">
                        <span className="text-base font-bold text-primary">
                          ${(resumenTurno?.esperadoEnCaja.efectivoCop ?? 0).toLocaleString('es-CO')}
                        </span>
                        <span className="text-xs font-mono text-primary">COP</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-primary/80 mt-3">Fondo inicial + Ventas ± Movimientos</span>
                </div>

                {/* 4. Ventas Electrónicas / Bancos */}
                <div className="p-space-lg bg-surface-container-lowest border border-surface-container rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-secondary flex items-center justify-between">
                      <span>Bancos / Electrónicos</span>
                      <span className="material-symbols-outlined text-base text-blue-600">account_balance</span>
                    </span>
                    <div className="mt-3 flex flex-col gap-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-black text-on-surface">
                          Bs. {(
                            (resumenTurno?.ventasPorMetodo.pagoMovilVes.monto ?? 0) +
                            (resumenTurno?.ventasPorMetodo.tarjetaVes.monto ?? 0)
                          ).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs font-mono text-secondary">VES</span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1 border-t border-surface-container">
                        <span className="text-base font-bold text-on-surface">
                          ${(resumenTurno?.ventasPorMetodo.zelleUsd.monto ?? 0).toFixed(2)}
                        </span>
                        <span className="text-xs font-mono text-secondary">Zelle USD</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-secondary mt-3">Conciliación en cuentas bancarias</span>
                </div>
              </div>

              {/* Movimientos de Caja Registrados */}
              <div className="p-space-lg bg-surface-container-lowest border border-surface-container rounded-3xl shadow-sm flex flex-col gap-space-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">sync_alt</span>
                    <h3 className="font-bold text-base text-on-surface">
                      Movimientos de Caja del Turno ({turnoActivo.movimientos?.length || 0})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMovimientoModalOpen(true)}
                    className="text-xs font-bold text-primary hover:text-primary-container px-2.5 py-1 rounded-lg bg-primary/10 transition flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span>Registrar Ingreso / Egreso</span>
                  </button>
                </div>

                {!turnoActivo.movimientos || turnoActivo.movimientos.length === 0 ? (
                  <p className="text-xs text-secondary italic py-4 text-center">
                    No se han registrado ingresos ni egresos manuales en este turno.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-surface-container text-secondary font-bold text-[11px] uppercase">
                          <th className="pb-2">Hora</th>
                          <th className="pb-2">Tipo</th>
                          <th className="pb-2">Monto</th>
                          <th className="pb-2">Moneda</th>
                          <th className="pb-2">Motivo</th>
                          <th className="pb-2">Registrado por</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-low">
                        {turnoActivo.movimientos.map(m => (
                          <tr key={m.id} className="hover:bg-surface-container-low/50">
                            <td className="py-2 text-secondary">{new Date(m.fecha).toLocaleTimeString()}</td>
                            <td className="py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  m.tipo === TipoMovimientoCaja.INGRESO
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {m.tipo}
                              </span>
                            </td>
                            <td className="py-2 font-bold text-on-surface">
                              {m.moneda === Moneda.USD
                                ? `$${m.monto.toFixed(2)}`
                                : m.moneda === Moneda.COP
                                ? `$${m.monto.toLocaleString('es-CO')}`
                                : `Bs. ${m.monto.toFixed(2)}`}
                            </td>
                            <td className="py-2 font-mono text-secondary">{m.moneda}</td>
                            <td className="py-2 text-on-surface max-w-xs truncate">{m.motivo}</td>
                            <td className="py-2 text-secondary">{m.usuario?.nombre || 'Cajero'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: HISTORIAL DE CIERRES ANTERIORES */}
      {activeTab === 'historial' && (
        <div className="p-space-lg bg-surface-container-lowest border border-surface-container rounded-3xl shadow-sm flex flex-col gap-space-md">
          <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Auditoría de Turnos y Cierres Anteriores</h2>
              <p className="text-xs text-secondary">
                Historial completo de turnos cerrados con conteo físico, sobrantes, faltantes y reportes imprimibles.
              </p>
            </div>
            <span className="text-xs font-bold text-secondary">{historialTurnos.length} turnos</span>
          </div>

          {loadingHistorial ? (
            <div className="p-8 text-center text-secondary text-xs">Cargando historial de turnos...</div>
          ) : historialTurnos.length === 0 ? (
            <div className="p-8 text-center text-secondary text-xs italic">
              No hay turnos registrados en el historial todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-container text-secondary font-bold text-[11px] uppercase">
                    <th className="pb-2">Turno</th>
                    <th className="pb-2">Caja</th>
                    <th className="pb-2">Cajero</th>
                    <th className="pb-2">Apertura</th>
                    <th className="pb-2">Cierre</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2 text-right">Ventas USD</th>
                    <th className="pb-2 text-right">Dif. USD</th>
                    <th className="pb-2 text-right">Dif. COP</th>
                    <th className="pb-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {historialTurnos.map(t => (
                    <tr key={t.id} className="hover:bg-surface-container-low/50">
                      <td className="py-2.5 font-mono font-bold text-on-surface">#{t.id.slice(0, 8)}</td>
                      <td className="py-2.5 font-semibold text-secondary">{t.cajaNumero}</td>
                      <td className="py-2.5 text-on-surface">{t.usuarioApertura?.nombre || 'N/A'}</td>
                      <td className="py-2.5 text-secondary">{new Date(t.fechaApertura).toLocaleDateString()}</td>
                      <td className="py-2.5 text-secondary">
                        {t.fechaCierre ? new Date(t.fechaCierre).toLocaleTimeString() : 'En curso'}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.estado === EstadoTurnoCaja.ABIERTO
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {t.estado}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-bold text-on-surface">
                        ${(t.ventasTotalesUsd ?? 0).toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-bold ${
                          (t.diferenciaUsd ?? 0) === 0
                            ? 'text-secondary'
                            : (t.diferenciaUsd ?? 0) > 0
                            ? 'text-blue-600'
                            : 'text-red-600'
                        }`}
                      >
                        {t.diferenciaUsd !== null && t.diferenciaUsd !== undefined
                          ? `${t.diferenciaUsd > 0 ? '+' : ''}$${t.diferenciaUsd.toFixed(2)}`
                          : '-'}
                      </td>
                      <td
                        className={`py-2.5 text-right font-bold ${
                          (t.diferenciaCop ?? 0) === 0
                            ? 'text-secondary'
                            : (t.diferenciaCop ?? 0) > 0
                            ? 'text-blue-600'
                            : 'text-red-600'
                        }`}
                      >
                        {t.diferenciaCop !== null && t.diferenciaCop !== undefined
                          ? `${t.diferenciaCop > 0 ? '+' : ''}${t.diferenciaCop.toLocaleString('es-CO')}`
                          : '-'}
                      </td>
                      <td className="py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTurnoId(t.id);
                            setArqueoTipo('Z');
                            setIsArqueoModalOpen(true);
                          }}
                          className="px-2 py-1 bg-surface-container hover:bg-surface-container-high rounded text-[11px] font-bold text-primary transition"
                        >
                          Ver Reporte
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: APERTURA DE CAJA */}
      {isAbrirModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-container-lowest border border-surface-container rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">key</span>
                <h3 className="text-lg font-black text-on-surface">Apertura de Turno de Caja</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAbrirModalOpen(false)}
                className="p-1 rounded text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAbrirSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-secondary mb-1">Nombre o Número de Caja:</label>
                <input
                  type="text"
                  required
                  value={cajaNumero}
                  onChange={e => setCajaNumero(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low border border-surface-container rounded-xl font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">
                  Fondo Inicial en Dólares ($ USD):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={montoInicialUsd}
                    onChange={e => setMontoInicialUsd(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-3 py-2 bg-surface-container-low border border-surface-container rounded-xl font-black text-base text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <span className="text-[10px] text-secondary">Base en billetes de dólares para dar cambio</span>
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">
                  Fondo Inicial en Pesos ($ COP):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary font-bold">$COP</span>
                  <input
                    type="number"
                    step="500"
                    min="0"
                    required
                    value={montoInicialCop}
                    onChange={e => setMontoInicialCop(parseFloat(e.target.value) || 0)}
                    className="w-full pl-14 pr-3 py-2 bg-surface-container-low border border-surface-container rounded-xl font-black text-base text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <span className="text-[10px] text-secondary">Base en billetes de pesos colombianos (Guasdualito)</span>
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">
                  Fondo Inicial en Bolívares (Bs. VES - Opcional):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary font-bold">Bs.</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={montoInicialVes}
                    onChange={e => setMontoInicialVes(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-surface-container rounded-xl font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsAbrirModalOpen(false)}
                  className="px-4 py-2 bg-surface-container-low hover:bg-surface-container rounded-xl font-bold text-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={abrirMutation.isPending}
                  className="px-5 py-2 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {abrirMutation.isPending ? 'Iniciando...' : 'Confirmar e Iniciar Turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INGRESO / EGRESO MANUAL DE CAJA */}
      {isMovimientoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-container-lowest border border-surface-container rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container mb-4">
              <div className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-2xl ${
                    tipoMovimiento === TipoMovimientoCaja.INGRESO ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {tipoMovimiento === TipoMovimientoCaja.INGRESO ? 'add_circle' : 'remove_circle'}
                </span>
                <h3 className="text-lg font-black text-on-surface">
                  Registrar {tipoMovimiento === TipoMovimientoCaja.INGRESO ? 'Ingreso de Efectivo' : 'Egreso / Retiro de Efectivo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMovimientoModalOpen(false)}
                className="p-1 rounded text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleMovimientoSubmit} className="space-y-4 text-xs">
              {/* Selector de Tipo */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoMovimiento(TipoMovimientoCaja.INGRESO)}
                  className={`py-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    tipoMovimiento === TipoMovimientoCaja.INGRESO
                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                      : 'bg-surface-container-low border-surface-container text-secondary'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">arrow_downward</span>
                  <span>Ingreso (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoMovimiento(TipoMovimientoCaja.EGRESO)}
                  className={`py-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    tipoMovimiento === TipoMovimientoCaja.EGRESO
                      ? 'bg-red-500 text-white border-red-600 shadow-xs'
                      : 'bg-surface-container-low border-surface-container text-secondary'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">arrow_upward</span>
                  <span>Egreso (-)</span>
                </button>
              </div>

              {/* Selector de Moneda */}
              <div>
                <label className="block font-bold text-secondary mb-1">Moneda del Dinero:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMonedaMovimiento(Moneda.USD)}
                    className={`py-2 rounded-xl border text-xs font-bold transition ${
                      monedaMovimiento === Moneda.USD
                        ? 'bg-primary text-on-primary border-primary shadow-xs'
                        : 'bg-surface-container-low border-surface-container text-secondary'
                    }`}
                  >
                    Dólares (USD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonedaMovimiento(Moneda.COP)}
                    className={`py-2 rounded-xl border text-xs font-bold transition ${
                      monedaMovimiento === Moneda.COP
                        ? 'bg-primary text-on-primary border-primary shadow-xs'
                        : 'bg-surface-container-low border-surface-container text-secondary'
                    }`}
                  >
                    Pesos (COP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonedaMovimiento(Moneda.VES)}
                    className={`py-2 rounded-xl border text-xs font-bold transition ${
                      monedaMovimiento === Moneda.VES
                        ? 'bg-primary text-on-primary border-primary shadow-xs'
                        : 'bg-surface-container-low border-surface-container text-secondary'
                    }`}
                  >
                    Bolívares (VES)
                  </button>
                </div>
              </div>

              {/* Monto */}
              <div>
                <label className="block font-bold text-secondary mb-1">Monto del Movimiento:</label>
                <input
                  type="number"
                  step={monedaMovimiento === Moneda.COP ? '100' : '0.01'}
                  min="0.01"
                  required
                  value={montoMovimiento || ''}
                  onChange={e => setMontoMovimiento(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-surface-container-low border border-surface-container rounded-xl font-black text-lg text-on-surface outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Motivo */}
              <div>
                <label className="block font-bold text-secondary mb-1">Motivo / Justificación:</label>
                <textarea
                  rows={2}
                  required
                  value={motivoMovimiento}
                  onChange={e => setMotivoMovimiento(e.target.value)}
                  placeholder="ej. Aporte de cambio por administración / Pago a flete local / Retiro por exceso"
                  className="w-full p-2.5 bg-surface-container-low border border-surface-container rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsMovimientoModalOpen(false)}
                  className="px-4 py-2 bg-surface-container-low hover:bg-surface-container rounded-xl font-bold text-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={movimientoMutation.isPending}
                  className={`px-5 py-2 rounded-xl font-bold text-white shadow-sm disabled:opacity-50 ${
                    tipoMovimiento === TipoMovimientoCaja.INGRESO
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {movimientoMutation.isPending ? 'Guardando...' : 'Guardar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ARQUEO, CORTE PARCIAL (REPORTE X) Y CIERRE FISCAL (REPORTE Z) */}
      {isArqueoModalOpen && (() => {
        const datosResumen = selectedTurnoId ? resumenTurnoHistorico : resumenTurno;
        if (!datosResumen) {
          return null;
        }

        const { turnoCaja, fondosIniciales, ventasPorMetodo, movimientosManuales, esperadoEnCaja } = datosResumen;
        const isHistorico = turnoCaja.estado === EstadoTurnoCaja.CERRADO;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-fade-in">
            <div className="bg-surface-container-lowest border border-surface-container rounded-3xl shadow-2xl max-w-2xl w-full my-6 overflow-hidden flex flex-col max-h-[92vh]">
              {/* Header del Modal */}
              <div className="no-print p-space-lg bg-surface-container-low border-b border-surface-container flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl">
                    {arqueoTipo === 'X' ? 'assessment' : 'receipt_long'}
                  </span>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      {arqueoTipo === 'X' ? 'Reporte X — Corte Parcial de Caja' : 'Reporte Z — Cierre y Arqueo Definitivo'}
                    </h3>
                    <p className="text-xs text-secondary">
                      {isHistorico
                        ? `Auditoría del Turno Cerrado #${turnoCaja.id.slice(0, 8)}`
                        : arqueoTipo === 'X'
                        ? 'Informe acumulado en tiempo real sin cerrar la caja'
                        : 'Conteo ciego y cierre formal de turno en mostrador'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintTicket}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-xs hover:bg-primary-container transition"
                    title="Imprimir Ticket Térmico 80mm"
                  >
                    <span className="material-symbols-outlined text-base">print</span>
                    <span>Imprimir Ticket</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsArqueoModalOpen(false);
                      setSelectedTurnoId(null);
                    }}
                    className="p-1 rounded text-secondary hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>
              </div>

              {/* Contenedor del Ticket Imprimible y Vista Previa */}
              <div className="p-space-lg overflow-y-auto flex flex-col gap-space-md">
                {/* Formulario de Conteo Ciego si es Cierre Activo */}
                {!isHistorico && arqueoTipo === 'Z' && (
                  <div className="no-print p-space-md bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base">visibility_off</span>
                        <span>Conteo Físico Ciego (Ingresar lo contado en gaveta)</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-secondary mb-1">
                          Total Billetes USD ($):
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={conteoFisicoUsd}
                          onChange={e => setConteoFisicoUsd(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-black text-base text-on-surface outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-secondary mb-1">
                          Total Billetes COP (Pesos):
                        </label>
                        <input
                          type="number"
                          step="500"
                          min="0"
                          value={conteoFisicoCop}
                          onChange={e => setConteoFisicoCop(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-black text-base text-on-surface outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-secondary mb-1">
                          Efectivo Bolívares (VES):
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={conteoFisicoVes}
                          onChange={e => setConteoFisicoVes(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-black text-base text-on-surface outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>

                    {/* Comparación y Alertas de Descuadre */}
                    <div className="pt-2 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center justify-between bg-white/60 p-2 rounded-lg">
                        <span className="text-secondary font-medium">Dif. USD:</span>
                        <span
                          className={`font-black ${
                            diffUsd === 0 ? 'text-emerald-700' : diffUsd > 0 ? 'text-blue-700' : 'text-red-700'
                          }`}
                        >
                          {diffUsd === 0 ? 'Exacto ($0.00)' : `${diffUsd > 0 ? 'Sobrante +' : 'Faltante -'}$${Math.abs(diffUsd).toFixed(2)}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-white/60 p-2 rounded-lg">
                        <span className="text-secondary font-medium">Dif. COP:</span>
                        <span
                          className={`font-black ${
                            diffCop === 0 ? 'text-emerald-700' : diffCop > 0 ? 'text-blue-700' : 'text-red-700'
                          }`}
                        >
                          {diffCop === 0 ? 'Exacto ($0)' : `${diffCop > 0 ? 'Sobrante +' : 'Faltante -'}$${Math.abs(diffCop).toLocaleString('es-CO')}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-white/60 p-2 rounded-lg">
                        <span className="text-secondary font-medium">Dif. VES:</span>
                        <span
                          className={`font-black ${
                            diffVes === 0 ? 'text-emerald-700' : diffVes > 0 ? 'text-blue-700' : 'text-red-700'
                          }`}
                        >
                          {diffVes === 0 ? 'Exacto (Bs. 0.00)' : `${diffVes > 0 ? 'Sobrante +' : 'Faltante -'}Bs. ${Math.abs(diffVes).toFixed(2)}`}
                        </span>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={observacionesCierre}
                        onChange={e => setObservacionesCierre(e.target.value)}
                        placeholder="Observaciones de cierre (ej. Se entregaron $5 en billetes deteriorados a administración)"
                        className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-on-surface outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* EL TICKET TÉRMICO FORMAL (IMPRIMIBLE) */}
                <div
                  id="ticket-arqueo"
                  className="bg-white text-slate-900 p-6 rounded-2xl border border-slate-200 shadow-inner font-mono text-xs space-y-3"
                >
                  {/* Encabezado */}
                  <div className="text-center pb-3 border-b border-dashed border-slate-300 space-y-0.5">
                    <h2 className="text-sm font-black uppercase text-slate-950">
                      {config?.nombreFerreteria || 'Ferretería El Tornillo Fuerte'}
                    </h2>
                    <p className="text-[10px] text-slate-700">RIF: {config?.rif || 'J-12345678-9'}</p>
                    <p className="text-[10px] text-slate-600">Guasdualito, Apure, Venezuela</p>
                    <div className="pt-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                        {arqueoTipo === 'X' ? 'REPORTE X — CORTE PARCIAL' : 'REPORTE Z — CIERRE FISCAL'}
                      </span>
                    </div>
                  </div>

                  {/* Datos del Turno */}
                  <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-600">TURNO:</span>
                      <span className="font-bold">#{turnoCaja.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">ESTACIÓN / CAJA:</span>
                      <span className="font-bold">{turnoCaja.cajaNumero}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">CAJERO APERTURA:</span>
                      <span>{turnoCaja.usuarioApertura?.nombre || 'Cajero'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">FECHA APERTURA:</span>
                      <span>{new Date(turnoCaja.fechaApertura).toLocaleString('es-VE')}</span>
                    </div>
                    {turnoCaja.fechaCierre && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">FECHA CIERRE:</span>
                        <span>{new Date(turnoCaja.fechaCierre).toLocaleString('es-VE')}</span>
                      </div>
                    )}
                  </div>

                  {/* 1. Fondo Inicial */}
                  <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
                    <div className="font-bold text-slate-950 uppercase text-[10px]">1. FONDOS INICIALES:</div>
                    <div className="flex justify-between">
                      <span>Base Efectivo USD:</span>
                      <span className="font-bold">${fondosIniciales.usd.toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Base Efectivo COP:</span>
                      <span className="font-bold">${fondosIniciales.cop.toLocaleString('es-CO')} COP</span>
                    </div>
                  </div>

                  {/* 2. Ventas por Método de Pago */}
                  <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
                    <div className="font-bold text-slate-950 uppercase text-[10px] flex justify-between">
                      <span>2. VENTAS DEL TURNO:</span>
                      <span>{ventasPorMetodo.totalTransacciones} tx</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Efectivo USD:</span>
                      <span className="font-bold">${ventasPorMetodo.efectivoUsd.monto.toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Efectivo Pesos (COP):</span>
                      <span className="font-bold">${ventasPorMetodo.efectivoCop.monto.toLocaleString('es-CO')} COP</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pago Móvil (VES):</span>
                      <span className="font-bold">Bs. {ventasPorMetodo.pagoMovilVes.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tarjeta / Débito (VES):</span>
                      <span className="font-bold">Bs. {ventasPorMetodo.tarjetaVes.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Zelle (USD):</span>
                      <span className="font-bold">${ventasPorMetodo.zelleUsd.monto.toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between font-black text-slate-950 pt-1 border-t border-slate-200">
                      <span>TOTAL VENTAS CONSOLIDADO:</span>
                      <span>${ventasPorMetodo.totalVentasUsd.toFixed(2)} USD</span>
                    </div>
                  </div>

                  {/* 3. Movimientos Manuales de Caja */}
                  <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
                    <div className="font-bold text-slate-950 uppercase text-[10px]">3. MOVIMIENTOS MANUALES:</div>
                    <div className="flex justify-between text-emerald-800">
                      <span>(+) Ingresos USD:</span>
                      <span>+${movimientosManuales.ingresosUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-red-800">
                      <span>(-) Egresos USD:</span>
                      <span>-${movimientosManuales.egresosUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800">
                      <span>(+) Ingresos COP:</span>
                      <span>+${movimientosManuales.ingresosCop.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between text-red-800">
                      <span>(-) Egresos COP:</span>
                      <span>-${movimientosManuales.egresosCop.toLocaleString('es-CO')}</span>
                    </div>
                  </div>

                  {/* 4. Arqueo y Descuadre en Gaveta */}
                  <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
                    <div className="font-bold text-slate-950 uppercase text-[10px]">
                      4. CUADRE FÍSICO EN GAVETA:
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Esperado en Efectivo USD:</span>
                      <span>${esperadoEnCaja.efectivoUsd.toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Esperado en Efectivo COP:</span>
                      <span>${esperadoEnCaja.efectivoCop.toLocaleString('es-CO')} COP</span>
                    </div>

                    {(isHistorico || arqueoTipo === 'Z') && (
                      <div className="pt-2 border-t border-slate-200 space-y-1">
                        <div className="flex justify-between text-slate-900 font-bold">
                          <span>Conteo Físico USD:</span>
                          <span>
                            ${(isHistorico ? turnoCaja.conteoFisicoUsd ?? 0 : conteoFisicoUsd).toFixed(2)} USD
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-900 font-bold">
                          <span>Conteo Físico COP:</span>
                          <span>
                            ${(isHistorico ? turnoCaja.conteoFisicoCop ?? 0 : conteoFisicoCop).toLocaleString('es-CO')} COP
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-black pt-1">
                          <span>DESCUADRE USD:</span>
                          <span
                            className={
                              (isHistorico ? turnoCaja.diferenciaUsd ?? 0 : diffUsd) < 0
                                ? 'text-red-700'
                                : (isHistorico ? turnoCaja.diferenciaUsd ?? 0 : diffUsd) > 0
                                ? 'text-blue-700'
                                : 'text-emerald-700'
                            }
                          >
                            {(isHistorico ? turnoCaja.diferenciaUsd ?? 0 : diffUsd) === 0
                              ? 'CUADRADO ($0.00)'
                              : `${(isHistorico ? turnoCaja.diferenciaUsd ?? 0 : diffUsd) > 0 ? 'SOBRANTE +' : 'FALTANTE -'}$${Math.abs(isHistorico ? turnoCaja.diferenciaUsd ?? 0 : diffUsd).toFixed(2)}`}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-black">
                          <span>DESCUADRE COP:</span>
                          <span
                            className={
                              (isHistorico ? turnoCaja.diferenciaCop ?? 0 : diffCop) < 0
                                ? 'text-red-700'
                                : (isHistorico ? turnoCaja.diferenciaCop ?? 0 : diffCop) > 0
                                ? 'text-blue-700'
                                : 'text-emerald-700'
                            }
                          >
                            {(isHistorico ? turnoCaja.diferenciaCop ?? 0 : diffCop) === 0
                              ? 'CUADRADO ($0)'
                              : `${(isHistorico ? turnoCaja.diferenciaCop ?? 0 : diffCop) > 0 ? 'SOBRANTE +' : 'FALTANTE -'}$${Math.abs(isHistorico ? turnoCaja.diferenciaCop ?? 0 : diffCop).toLocaleString('es-CO')}`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Firmas de Auditoría */}
                  <div className="pt-8 grid grid-cols-2 gap-4 text-center text-[10px]">
                    <div className="border-t border-slate-400 pt-1">
                      <p className="font-bold">Firma Cajero</p>
                      <p className="text-slate-500">{turnoCaja.usuarioApertura?.nombre}</p>
                    </div>
                    <div className="border-t border-slate-400 pt-1">
                      <p className="font-bold">Firma Administración</p>
                      <p className="text-slate-500">Revisado y Conforme</p>
                    </div>
                  </div>

                  <p className="text-center text-[9px] text-slate-400 pt-2">
                    FerrePro Hardware ERP — Guasdualito, Apure
                  </p>
                </div>
              </div>

              {/* Footer Acciones */}
              <div className="no-print p-space-lg bg-surface-container-low border-t border-surface-container flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrintTicket}
                  className="flex items-center gap-1.5 px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-bold text-on-surface transition"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  <span>Imprimir Ticket Térmico</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsArqueoModalOpen(false);
                      setSelectedTurnoId(null);
                    }}
                    className="px-4 py-2 bg-surface-container-low hover:bg-surface-container rounded-xl text-xs font-bold text-secondary"
                  >
                    Cerrar Vista
                  </button>

                  {!isHistorico && arqueoTipo === 'Z' && (
                    <button
                      type="button"
                      onClick={handleCerrarSubmit}
                      disabled={cerrarMutation.isPending}
                      className="px-5 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-xs font-black shadow-md transition disabled:opacity-50"
                    >
                      {cerrarMutation.isPending ? 'Cerrando Turno...' : 'Confirmar Cierre Definitivo (Reporte Z)'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
