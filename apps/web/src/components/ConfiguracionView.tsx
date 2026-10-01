import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RolUsuario, Moneda, MetodoPago, type UsuarioDTO, type ConfiguracionDTO, type SyncStatusDTO } from '@ferreteria/shared';
import { api } from '../lib/api.js';

interface ConfiguracionViewProps {
  currentUser: UsuarioDTO | null;
}

export interface SystemSettings {
  // Datos de la Empresa / Ferretería
  nombreComercial: string;
  razonSocial: string;
  rif: string;
  telefono: string;
  correo: string;
  direccion: string;
  mensajePieTicket: string;

  // Finanzas y Moneda
  monedaPrincipal: string;
  monedaSecundaria: string;
  tasaBcv: number; // Tasa VES por 1 USD
  tasaCop: number; // Tasa COP por 1 USD
  ivaPorcentaje: number;
  metodosHabilitados: string[];

  // Parámetros de Inventario y POS
  stockMinimoDefault: number;
  alertaStockCritico: boolean;
  bloquearVentaSinStock: boolean;
  formatoTicket: '80mm' | '58mm' | 'carta';
  impresionAutomatica: boolean;
  prefijoCorrelativo: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  nombreComercial: 'FerrePro Hardware',
  razonSocial: 'Ferretería y Materiales FerrePro C.A.',
  rif: 'J-40892182-0',
  telefono: '+58 212 994-8800',
  correo: 'contacto@ferrepro.com',
  direccion: 'Guasdualito, Apure, Venezuela',
  mensajePieTicket: '¡Gracias por su compra! Garantía de 30 días presentando este comprobante.',

  monedaPrincipal: 'USD',
  monedaSecundaria: 'VES',
  tasaBcv: 60.00,
  tasaCop: 4100.00,
  ivaPorcentaje: 16.0,
  metodosHabilitados: [
    MetodoPago.EFECTIVO_USD,
    MetodoPago.EFECTIVO_COP,
    MetodoPago.PAGO_MOVIL_VES,
    MetodoPago.TARJETA_VES,
    MetodoPago.ZELLE_USD,
  ],

  stockMinimoDefault: 5,
  alertaStockCritico: true,
  bloquearVentaSinStock: true,
  formatoTicket: '80mm',
  impresionAutomatica: false,
  prefijoCorrelativo: '#VTA-2024-',
};

const SETTINGS_KEY = 'ferrepro_system_settings';

export const ConfiguracionView: React.FC<ConfiguracionViewProps> = ({ currentUser }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'empresa' | 'finanzas' | 'usuarios' | 'operaciones' | 'sincronizacion'>('empresa');
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [saveSuccess, setSaveSuccess] = useState(false);

  // Consulta de configuración persistida en backend PostgreSQL
  const { data: serverConfig } = useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api.getConfiguracion(),
  });

  // Mutación para actualizar la configuración en PostgreSQL
  const configMutation = useMutation({
    mutationFn: (data: Partial<ConfiguracionDTO>) => api.updateConfiguracion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    },
    onError: (err: any) => {
      if (err?.message?.includes('Token') || err?.message?.includes('autenticad') || err?.message?.includes('expirado')) {
        return;
      }
      alert(err?.message || 'Error al guardar la configuración');
    },
  });

  // Consulta de estado de sincronización híbrida (Outbox a la nube)
  const { data: syncStatus, refetch: refetchSync, isFetching: fetchingSync } = useQuery<SyncStatusDTO>({
    queryKey: ['sync-status'],
    queryFn: () => api.getSyncStatus(),
    refetchInterval: activeTab === 'sincronizacion' ? 5000 : 30000,
  });

  // Mutación para forzar sincronización manual
  const retrySyncMutation = useMutation({
    mutationFn: () => api.retrySync(),
    onSuccess: () => {
      refetchSync();
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
    },
    onError: (err: any) => {
      alert(err?.message || 'Error al sincronizar con la nube');
    },
  });

  // Sincronizar configuración del backend en el estado local
  useEffect(() => {
    if (serverConfig) {
      setSettings(prev => ({
        ...prev,
        nombreComercial: serverConfig.nombreFerreteria || prev.nombreComercial,
        rif: serverConfig.rif || prev.rif,
        direccion: serverConfig.direccion || prev.direccion,
        telefono: serverConfig.telefono || prev.telefono,
        ivaPorcentaje: serverConfig.ivaPorcentaje ?? prev.ivaPorcentaje,
        stockMinimoDefault: serverConfig.stockMinimoAlerta ?? prev.stockMinimoDefault,
        tasaBcv: serverConfig.tasaVes ?? prev.tasaBcv,
        tasaCop: serverConfig.tasaCop ?? prev.tasaCop,
        metodosHabilitados: serverConfig.metodosHabilitados ?? prev.metodosHabilitados,
      }));
    }
  }, [serverConfig]);

  // Consulta de usuarios para la pestaña de Usuarios y Roles
  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.getUsuarios(),
    enabled: activeTab === 'usuarios',
  });

  // Modal de Usuario (crear / editar)
  const [modalUser, setModalUser] = useState<UsuarioDTO | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userNombre, setUserNombre] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRol, setUserRol] = useState<RolUsuario>(RolUsuario.CAJERO);
  const [userActivo, setUserActivo] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSubmitting, setUserSubmitting] = useState(false);

  const saveSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    
    // Guardar en el backend PostgreSQL
    configMutation.mutate({
      nombreFerreteria: newSettings.nombreComercial,
      rif: newSettings.rif,
      direccion: newSettings.direccion,
      telefono: newSettings.telefono,
      ivaPorcentaje: newSettings.ivaPorcentaje,
      stockMinimoAlerta: newSettings.stockMinimoDefault,
      monedaFuncional: Moneda.USD,
      tasaVes: newSettings.tasaBcv,
      tasaCop: newSettings.tasaCop,
      metodosHabilitados: newSettings.metodosHabilitados,
    });
  };

  const openCreateUser = () => {
    setModalUser(null);
    setUserNombre('');
    setUserEmail('');
    setUserPassword('');
    setUserRol(RolUsuario.CAJERO);
    setUserActivo(true);
    setUserError(null);
    setIsUserModalOpen(true);
  };

  const openEditUser = (u: UsuarioDTO) => {
    setModalUser(u);
    setUserNombre(u.nombre);
    setUserEmail(u.email);
    setUserPassword('');
    setUserRol(u.rol);
    setUserActivo(u.activo);
    setUserError(null);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);

    if (!userNombre.trim() || !userEmail.trim()) {
      setUserError('Nombre y correo son requeridos.');
      return;
    }

    if (!modalUser && !userPassword) {
      setUserError('La contraseña es requerida para nuevos usuarios.');
      return;
    }

    setUserSubmitting(true);
    try {
      if (modalUser) {
        await api.updateUsuario(modalUser.id, {
          nombre: userNombre.trim(),
          email: userEmail.trim(),
          rol: userRol,
          activo: userActivo,
          ...(userPassword ? { password: userPassword } : {}),
        });
      } else {
        await api.createUsuario({
          nombre: userNombre.trim(),
          email: userEmail.trim(),
          password: userPassword,
          rol: userRol,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setIsUserModalOpen(false);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Error al guardar usuario');
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleToggleActiveUser = async (u: UsuarioDTO) => {
    try {
      await api.updateUsuario(u.id, { activo: !u.activo });
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar estado del usuario');
    }
  };

  // Contadores para Usuarios
  const adminsCount = usuarios.filter(u => u.rol === RolUsuario.ADMIN && u.activo).length;
  const cajerosCount = usuarios.filter(u => u.rol === RolUsuario.CAJERO && u.activo).length;

  return (
    <div className="flex flex-col w-full gap-space-lg animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-semibold">
              Panel de Administración
            </span>
            <span className="text-secondary">•</span>
            <span className="font-label-sm text-label-sm text-secondary">Control del Sistema</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight mt-space-2xs">
            Configuración y Gestión General
          </h1>
          <p className="font-body-md text-body-md text-secondary mt-space-2xs">
            Personaliza los datos de tu ferretería, define la tasa oficial BCV, administra los roles y ajusta la facturación.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-space-xs px-space-md py-space-xs bg-tertiary-fixed text-on-tertiary-fixed rounded font-label-md text-label-md shadow-sm animate-in fade-in">
            <span className="material-symbols-outlined text-lg text-tertiary">check_circle</span>
            <span>Cambios guardados con éxito</span>
          </div>
        )}
      </div>

      {/* Subpestañas Integradas estilo Inventario / Contactos */}
      <div className="bg-surface-container-lowest p-space-xs rounded shadow-sm flex items-center gap-space-xs overflow-x-auto border border-surface-container">
        <button
          type="button"
          onClick={() => setActiveTab('empresa')}
          className={`flex items-center gap-space-xs px-space-md py-space-sm rounded font-label-md text-label-md transition-colors whitespace-nowrap ${
            activeTab === 'empresa'
              ? 'bg-primary text-on-primary font-bold shadow-sm'
              : 'text-secondary hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">storefront</span>
          <span>Datos de la Ferretería</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('finanzas')}
          className={`flex items-center gap-space-xs px-space-md py-space-sm rounded font-label-md text-label-md transition-colors whitespace-nowrap ${
            activeTab === 'finanzas'
              ? 'bg-primary text-on-primary font-bold shadow-sm'
              : 'text-secondary hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">currency_exchange</span>
          <span>Monedas y Tasas de Cambio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('usuarios')}
          className={`flex items-center gap-space-xs px-space-md py-space-sm rounded font-label-md text-label-md transition-colors whitespace-nowrap ${
            activeTab === 'usuarios'
              ? 'bg-primary text-on-primary font-bold shadow-sm'
              : 'text-secondary hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">manage_accounts</span>
          <span>Usuarios y Roles</span>
          <span className={`px-space-xs py-0.5 rounded text-xs ${
            activeTab === 'usuarios' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-high text-secondary'
          }`}>
            2 Roles
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('operaciones')}
          className={`flex items-center gap-space-xs px-space-md py-space-sm rounded font-label-md text-label-md transition-colors whitespace-nowrap ${
            activeTab === 'operaciones'
              ? 'bg-primary text-on-primary font-bold shadow-sm'
              : 'text-secondary hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">tune</span>
          <span>Inventario, POS e Impresión</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sincronizacion')}
          className={`flex items-center gap-space-xs px-space-md py-space-sm rounded font-label-md text-label-md transition-colors whitespace-nowrap ${
            activeTab === 'sincronizacion'
              ? 'bg-primary text-on-primary font-bold shadow-sm'
              : 'text-secondary hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">cloud_sync</span>
          <span>Sincronización Híbrida</span>
          {syncStatus && syncStatus.pendientes > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white animate-pulse">
              {syncStatus.pendientes}
            </span>
          )}
          {syncStatus && syncStatus.errores > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-error text-on-error">
              {syncStatus.errores}
            </span>
          )}
        </button>
      </div>

      {/* PESTAÑA 1: DATOS DE LA FERRETERÍA */}
      {activeTab === 'empresa' && (
        <div className="bg-surface-container-lowest p-space-xl rounded shadow-sm border border-surface-container flex flex-col gap-space-lg">
          <div className="flex items-center gap-space-sm pb-space-md border-b border-surface-container">
            <span className="material-symbols-outlined text-primary text-2xl">store</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Identidad y Datos Fiscales del Negocio
              </h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Esta información aparece en los encabezados y pies de página de comprobantes, tickets y reportes fiscales.
              </p>
            </div>
          </div>

          <form
            onSubmit={e => {
              e.preventDefault();
              saveSettings(settings);
            }}
            className="flex flex-col gap-space-lg"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  Nombre Comercial / Ferretería:
                </label>
                <input
                  type="text"
                  required
                  value={settings.nombreComercial}
                  onChange={e => setSettings({ ...settings, nombreComercial: e.target.value })}
                  placeholder="ej. Ferretería El Tornillo Fuerte"
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  Razón Social (Fiscal):
                </label>
                <input
                  type="text"
                  required
                  value={settings.razonSocial}
                  onChange={e => setSettings({ ...settings, razonSocial: e.target.value })}
                  placeholder="ej. Ferretería y Materiales FerrePro C.A."
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  RIF / Identificación Fiscal:
                </label>
                <input
                  type="text"
                  required
                  value={settings.rif}
                  onChange={e => setSettings({ ...settings, rif: e.target.value })}
                  placeholder="ej. J-12345678-9"
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  Teléfono de Contacto:
                </label>
                <input
                  type="text"
                  value={settings.telefono}
                  onChange={e => setSettings({ ...settings, telefono: e.target.value })}
                  placeholder="ej. 0414-1234567"
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-space-2xs md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  Correo Electrónico de la Ferretería:
                </label>
                <input
                  type="email"
                  value={settings.correo}
                  onChange={e => setSettings({ ...settings, correo: e.target.value })}
                  placeholder="ej. contacto@ferreteria.com"
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-space-2xs md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  Dirección Física / Almacén Central (Guasdualito):
                </label>
                <textarea
                  rows={2}
                  value={settings.direccion}
                  onChange={e => setSettings({ ...settings, direccion: e.target.value })}
                  placeholder="Guasdualito, Apure, Venezuela"
                  className="p-space-sm bg-surface-container-low text-on-surface font-body-sm text-body-sm rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex flex-col gap-space-2xs md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  Mensaje de Pie de Ticket (Garantía / Agradecimiento):
                </label>
                <input
                  type="text"
                  value={settings.mensajePieTicket}
                  onChange={e => setSettings({ ...settings, mensajePieTicket: e.target.value })}
                  placeholder="ej. ¡Gracias por su compra! Garantía de 30 días presentando este ticket."
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end pt-space-md border-t border-surface-container">
              <button
                type="submit"
                disabled={configMutation.isPending}
                className="flex items-center gap-space-xs px-space-lg py-space-sm bg-primary text-on-primary font-label-md text-label-md font-bold rounded shadow-sm hover:bg-primary-container transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">save</span>
                <span>{configMutation.isPending ? 'Guardando en Servidor...' : 'Guardar Datos de Ferretería'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PESTAÑA 2: MONEDAS Y TASAS DE CAMBIO (GUASDUALITO, APURE) */}
      {activeTab === 'finanzas' && (
        <div className="bg-surface-container-lowest p-space-xl rounded shadow-sm border border-surface-container flex flex-col gap-space-lg">
          <div className="flex items-center gap-space-sm pb-space-md border-b border-surface-container">
            <span className="material-symbols-outlined text-tertiary text-2xl">currency_exchange</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Monedas y Tasas de Cambio — Guasdualito, Apure
              </h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Configura la moneda ancla del catálogo (USD), las tasas de cambio de referencia para cobros (VES y COP) y los métodos habilitados en caja.
              </p>
            </div>
          </div>

          <form
            onSubmit={e => {
              e.preventDefault();
              saveSettings(settings);
            }}
            className="flex flex-col gap-space-lg"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md">
              {/* Moneda Ancla / Funcional */}
              <div className="p-space-md rounded bg-surface-container-low border border-surface-container flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-secondary uppercase font-bold">
                      Moneda Ancla Base
                    </span>
                    <span className="material-symbols-outlined text-secondary text-xl">attach_money</span>
                  </div>
                  <div className="mt-space-sm flex items-baseline gap-space-xs">
                    <span className="font-display-md text-display-md font-extrabold text-primary">
                      USD ($)
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                      Fija
                    </span>
                  </div>
                </div>
                <span className="font-body-sm text-body-sm text-secondary mt-space-xs">
                  Inventario y precios anclados en Dólares
                </span>
              </div>

              {/* Tasa VES / USD */}
              <div className="p-space-md rounded bg-surface-container-low border border-surface-container flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-secondary uppercase font-bold">
                      Tasa Bolívares (VES)
                    </span>
                    <span className="material-symbols-outlined text-tertiary text-xl">trending_up</span>
                  </div>
                  <div className="mt-space-sm flex items-center gap-space-xs">
                    <span className="font-headline-sm text-headline-sm text-secondary">Bs.</span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      required
                      value={settings.tasaBcv}
                      onChange={e => setSettings({ ...settings, tasaBcv: parseFloat(e.target.value) || 0 })}
                      className="w-full font-display-md text-display-md font-extrabold text-on-surface bg-surface-container-lowest px-space-sm py-1 rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <span className="font-body-sm text-body-sm text-secondary mt-space-xs">
                  Bs. por cada 1.00 USD (Pago Móvil / Tarjeta)
                </span>
              </div>

              {/* Tasa COP / USD */}
              <div className="p-space-md rounded bg-surface-container-low border border-surface-container flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-secondary uppercase font-bold">
                      Tasa Pesos (COP)
                    </span>
                    <span className="material-symbols-outlined text-secondary text-xl">payments</span>
                  </div>
                  <div className="mt-space-sm flex items-center gap-space-xs">
                    <span className="font-headline-sm text-headline-sm text-secondary">$COP</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      value={settings.tasaCop}
                      onChange={e => setSettings({ ...settings, tasaCop: parseFloat(e.target.value) || 0 })}
                      className="w-full font-display-md text-display-md font-extrabold text-on-surface bg-surface-container-lowest px-space-sm py-1 rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <span className="font-body-sm text-body-sm text-secondary mt-space-xs">
                  COP por cada 1.00 USD (Efectivo Guasdualito)
                </span>
              </div>

              {/* IVA % */}
              <div className="p-space-md rounded bg-surface-container-low border border-surface-container flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-secondary uppercase font-bold">
                      Impuesto IVA (%)
                    </span>
                    <span className="material-symbols-outlined text-primary text-xl">percent</span>
                  </div>
                  <div className="mt-space-sm flex items-center gap-space-xs">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      required
                      value={settings.ivaPorcentaje}
                      onChange={e => setSettings({ ...settings, ivaPorcentaje: parseFloat(e.target.value) || 0 })}
                      className="w-full font-display-md text-display-md font-extrabold text-on-surface bg-surface-container-lowest px-space-sm py-1 rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                    />
                    <span className="font-headline-sm text-headline-sm text-secondary">%</span>
                  </div>
                </div>
                <span className="font-body-sm text-body-sm text-secondary mt-space-xs">
                  Aplicado sobre base gravable en USD
                </span>
              </div>
            </div>

            {/* Métodos de Pago Activos agrupados por moneda */}
            <div className="flex flex-col gap-space-sm pt-space-xs">
              <h3 className="font-label-lg text-label-lg text-on-surface font-bold">
                Métodos de Pago Habilitados en Caja (Guasdualito):
              </h3>
              <p className="font-body-sm text-body-sm text-secondary -mt-1">
                Activa o desactiva las opciones de cobro disponibles en el punto de venta POS:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md mt-space-2xs">
                {/* Moneda USD */}
                <div className="p-space-md rounded bg-surface-container-low border border-surface-container flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between border-b border-surface-container pb-space-xs">
                    <span className="font-label-md text-label-md font-bold text-on-surface flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      Dólares (USD)
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-surface-container-high font-mono text-secondary">
                      Tasa: 1.00
                    </span>
                  </div>

                  <label className={`flex items-center gap-space-sm p-space-sm rounded border cursor-pointer transition-colors ${
                    settings.metodosHabilitados.includes(MetodoPago.EFECTIVO_USD)
                      ? 'bg-primary-fixed/20 border-primary/40 text-on-surface font-semibold'
                      : 'bg-surface-container-lowest border-surface-container text-secondary hover:bg-surface-container'
                  }`}>
                    <input
                      type="checkbox"
                      checked={settings.metodosHabilitados.includes(MetodoPago.EFECTIVO_USD)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...settings.metodosHabilitados, MetodoPago.EFECTIVO_USD]
                          : settings.metodosHabilitados.filter(m => m !== MetodoPago.EFECTIVO_USD);
                        setSettings({ ...settings, metodosHabilitados: next });
                      }}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <span className="material-symbols-outlined text-lg">payments</span>
                    <div className="flex flex-col">
                      <span className="font-body-sm text-body-sm">Efectivo USD</span>
                      <span className="text-[11px] text-secondary">Billetes físicos en dólares</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-space-sm p-space-sm rounded border cursor-pointer transition-colors ${
                    settings.metodosHabilitados.includes(MetodoPago.ZELLE_USD)
                      ? 'bg-primary-fixed/20 border-primary/40 text-on-surface font-semibold'
                      : 'bg-surface-container-lowest border-surface-container text-secondary hover:bg-surface-container'
                  }`}>
                    <input
                      type="checkbox"
                      checked={settings.metodosHabilitados.includes(MetodoPago.ZELLE_USD)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...settings.metodosHabilitados, MetodoPago.ZELLE_USD]
                          : settings.metodosHabilitados.filter(m => m !== MetodoPago.ZELLE_USD);
                        setSettings({ ...settings, metodosHabilitados: next });
                      }}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <span className="material-symbols-outlined text-lg">send_to_mobile</span>
                    <div className="flex flex-col">
                      <span className="font-body-sm text-body-sm">Zelle USD</span>
                      <span className="text-[11px] text-secondary">Transferencia digital USD</span>
                    </div>
                  </label>
                </div>

                {/* Moneda VES */}
                <div className="p-space-md rounded bg-surface-container-low border border-surface-container flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between border-b border-surface-container pb-space-xs">
                    <span className="font-label-md text-label-md font-bold text-on-surface flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                      Bolívares (VES)
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-surface-container-high font-mono text-secondary">
                      Tasa: {settings.tasaBcv.toFixed(2)}
                    </span>
                  </div>

                  <label className={`flex items-center gap-space-sm p-space-sm rounded border cursor-pointer transition-colors ${
                    settings.metodosHabilitados.includes(MetodoPago.PAGO_MOVIL_VES)
                      ? 'bg-primary-fixed/20 border-primary/40 text-on-surface font-semibold'
                      : 'bg-surface-container-lowest border-surface-container text-secondary hover:bg-surface-container'
                  }`}>
                    <input
                      type="checkbox"
                      checked={settings.metodosHabilitados.includes(MetodoPago.PAGO_MOVIL_VES)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...settings.metodosHabilitados, MetodoPago.PAGO_MOVIL_VES]
                          : settings.metodosHabilitados.filter(m => m !== MetodoPago.PAGO_MOVIL_VES);
                        setSettings({ ...settings, metodosHabilitados: next });
                      }}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <span className="material-symbols-outlined text-lg">smartphone</span>
                    <div className="flex flex-col">
                      <span className="font-body-sm text-body-sm">Pago Móvil (VES)</span>
                      <span className="text-[11px] text-secondary">C2P / P2P interbancario</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-space-sm p-space-sm rounded border cursor-pointer transition-colors ${
                    settings.metodosHabilitados.includes(MetodoPago.TARJETA_VES)
                      ? 'bg-primary-fixed/20 border-primary/40 text-on-surface font-semibold'
                      : 'bg-surface-container-lowest border-surface-container text-secondary hover:bg-surface-container'
                  }`}>
                    <input
                      type="checkbox"
                      checked={settings.metodosHabilitados.includes(MetodoPago.TARJETA_VES)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...settings.metodosHabilitados, MetodoPago.TARJETA_VES]
                          : settings.metodosHabilitados.filter(m => m !== MetodoPago.TARJETA_VES);
                        setSettings({ ...settings, metodosHabilitados: next });
                      }}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <span className="material-symbols-outlined text-lg">credit_card</span>
                    <div className="flex flex-col">
                      <span className="font-body-sm text-body-sm">Punto de Venta / Tarjeta</span>
                      <span className="text-[11px] text-secondary">Débito y crédito nacional</span>
                    </div>
                  </label>
                </div>

                {/* Moneda COP */}
                <div className="p-space-md rounded bg-surface-container-low border border-surface-container flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between border-b border-surface-container pb-space-xs">
                    <span className="font-label-md text-label-md font-bold text-on-surface flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                      Pesos Colombianos (COP)
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-surface-container-high font-mono text-secondary">
                      Tasa: {settings.tasaCop.toLocaleString()}
                    </span>
                  </div>

                  <label className={`flex items-center gap-space-sm p-space-sm rounded border cursor-pointer transition-colors ${
                    settings.metodosHabilitados.includes(MetodoPago.EFECTIVO_COP)
                      ? 'bg-primary-fixed/20 border-primary/40 text-on-surface font-semibold'
                      : 'bg-surface-container-lowest border-surface-container text-secondary hover:bg-surface-container'
                  }`}>
                    <input
                      type="checkbox"
                      checked={settings.metodosHabilitados.includes(MetodoPago.EFECTIVO_COP)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...settings.metodosHabilitados, MetodoPago.EFECTIVO_COP]
                          : settings.metodosHabilitados.filter(m => m !== MetodoPago.EFECTIVO_COP);
                        setSettings({ ...settings, metodosHabilitados: next });
                      }}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <span className="material-symbols-outlined text-lg">local_atm</span>
                    <div className="flex flex-col">
                      <span className="font-body-sm text-body-sm">Efectivo COP</span>
                      <span className="text-[11px] text-secondary">Billetes físicos pesos (Guasdualito)</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-space-md border-t border-surface-container">
              <button
                type="submit"
                disabled={configMutation.isPending}
                className="flex items-center gap-space-xs px-space-lg py-space-sm bg-primary text-on-primary font-label-md text-label-md font-bold rounded shadow-sm hover:bg-primary-container transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">save</span>
                <span>{configMutation.isPending ? 'Guardando en Servidor...' : 'Guardar Monedas, Tasas y Métodos'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PESTAÑA 3: USUARIOS Y ROLES (ADMIN Y CAJERO) */}
      {activeTab === 'usuarios' && (
        <div className="flex flex-col gap-space-lg">
          {/* 3 Bento Cards de Usuarios */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
            <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm border border-surface-container flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Administradores
                </span>
                <span className="material-symbols-outlined text-primary text-xl">admin_panel_settings</span>
              </div>
              <div className="mt-space-md">
                <span className="font-display-md text-display-md text-on-surface font-extrabold">
                  {adminsCount}
                </span>
                <p className="font-body-sm text-body-sm text-secondary mt-space-2xs">
                  Acceso total y configuración
                </p>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm border border-surface-container flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Cajeros
                </span>
                <span className="material-symbols-outlined text-tertiary text-xl">point_of_sale</span>
              </div>
              <div className="mt-space-md">
                <span className="font-display-md text-display-md text-on-surface font-extrabold">
                  {cajerosCount}
                </span>
                <p className="font-body-sm text-body-sm text-secondary mt-space-2xs">
                  Operación exclusiva en caja y ventas
                </p>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm border border-surface-container flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Roles en el Sistema
                </span>
                <span className="material-symbols-outlined text-secondary text-xl">badge</span>
              </div>
              <div className="mt-space-md">
                <span className="font-display-md text-display-md text-on-surface font-extrabold">
                  2
                </span>
                <p className="font-body-sm text-body-sm text-secondary mt-space-2xs">
                  ADMIN y CAJERO únicamente
                </p>
              </div>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="bg-surface-container-lowest rounded shadow-sm border border-surface-container overflow-hidden">
            <div className="p-space-lg bg-surface-container-low flex items-center justify-between border-b border-surface-container">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Listado de Cuentas de Acceso
                </h2>
                <p className="font-body-sm text-body-sm text-secondary">
                  Administra las credenciales y el rol asignado a cada usuario.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateUser}
                className="flex items-center gap-space-xs px-space-md py-space-xs bg-primary text-on-primary font-label-md text-label-md font-bold rounded shadow-sm hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-base">person_add</span>
                <span>Nuevo Usuario</span>
              </button>
            </div>

            {loadingUsuarios ? (
              <div className="p-space-xl text-center text-secondary">Cargando usuarios...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high/60 text-secondary font-label-sm text-label-sm uppercase tracking-wider">
                      <th className="py-space-sm px-space-md">Usuario</th>
                      <th className="py-space-sm px-space-md">Correo</th>
                      <th className="py-space-sm px-space-md">Rol Asignado</th>
                      <th className="py-space-sm px-space-md text-center">Estado</th>
                      <th className="py-space-sm px-space-md text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low text-on-surface font-body-md text-body-md">
                    {usuarios.map(u => {
                      const isSelf = currentUser?.id === u.id;
                      const isAdmin = u.rol === RolUsuario.ADMIN;

                      return (
                        <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="py-space-md px-space-md">
                            <div className="flex items-center gap-space-sm">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                isAdmin
                                  ? 'bg-primary-fixed text-on-primary-fixed'
                                  : 'bg-tertiary-fixed text-on-tertiary-fixed'
                              }`}>
                                {u.nombre[0]?.toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-label-md text-label-md font-bold text-on-surface">
                                  {u.nombre}
                                </span>
                                {isSelf && (
                                  <span className="font-label-sm text-label-sm text-primary font-semibold">
                                    (Tu usuario actual)
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-space-md px-space-md font-body-sm text-body-sm text-secondary">
                            {u.email}
                          </td>

                          <td className="py-space-md px-space-md">
                            {isAdmin ? (
                              <span className="font-label-sm text-label-sm bg-primary-fixed text-on-primary-fixed px-space-xs py-0.5 rounded font-bold inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">shield</span>
                                Administrador
                              </span>
                            ) : (
                              <span className="font-label-sm text-label-sm bg-tertiary-fixed text-on-tertiary-fixed px-space-xs py-0.5 rounded font-bold inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">point_of_sale</span>
                                Cajero
                              </span>
                            )}
                          </td>

                          <td className="py-space-md px-space-md text-center">
                            {u.activo ? (
                              <span className="font-label-sm text-label-sm text-tertiary font-bold inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                                Activo
                              </span>
                            ) : (
                              <span className="font-label-sm text-label-sm text-error font-bold inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-error"></span>
                                Inactivo
                              </span>
                            )}
                          </td>

                          <td className="py-space-md px-space-md text-right">
                            <div className="flex items-center justify-end gap-space-xs">
                              <button
                                type="button"
                                onClick={() => openEditUser(u)}
                                className="p-space-xs text-secondary hover:text-on-surface hover:bg-surface-container rounded transition-colors"
                                title="Editar datos"
                              >
                                <span className="material-symbols-outlined text-lg">edit</span>
                              </button>
                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleActiveUser(u)}
                                  className={`p-space-xs rounded transition-colors ${
                                    u.activo
                                      ? 'text-secondary hover:text-error hover:bg-error-container/20'
                                      : 'text-secondary hover:text-tertiary hover:bg-tertiary-fixed/20'
                                  }`}
                                  title={u.activo ? 'Desactivar usuario' : 'Activar usuario'}
                                >
                                  <span className="material-symbols-outlined text-lg">
                                    {u.activo ? 'person_off' : 'person_check'}
                                  </span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 4: INVENTARIO, POS E IMPRESIÓN */}
      {activeTab === 'operaciones' && (
        <div className="bg-surface-container-lowest p-space-xl rounded shadow-sm border border-surface-container flex flex-col gap-space-lg">
          <div className="flex items-center gap-space-sm pb-space-md border-b border-surface-container">
            <span className="material-symbols-outlined text-primary text-2xl">print</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Parámetros de Inventario, POS y Comprobantes
              </h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Configura los umbrales de stock, modo de venta y el formato de ticket térmico o carta para la caja.
              </p>
            </div>
          </div>

          <form
            onSubmit={e => {
              e.preventDefault();
              saveSettings(settings);
            }}
            className="flex flex-col gap-space-lg"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
              {/* Inventario */}
              <div className="flex flex-col gap-space-md">
                <h3 className="font-label-lg text-label-lg text-on-surface font-bold flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-lg">inventory_2</span>
                  Reglas de Inventario
                </h3>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md text-on-surface font-bold">
                    Stock Mínimo por Defecto (Nuevos Productos):
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={settings.stockMinimoDefault}
                    onChange={e => setSettings({ ...settings, stockMinimoDefault: parseInt(e.target.value, 10) || 5 })}
                    className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                  />
                  <span className="font-body-sm text-body-sm text-secondary">
                    Cantidad a partir de la cual el producto entra en alerta de reposición.
                  </span>
                </div>

                <label className="flex items-start gap-space-sm p-space-md rounded bg-surface-container-low border border-surface-container cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.bloquearVentaSinStock}
                    onChange={e => setSettings({ ...settings, bloquearVentaSinStock: e.target.checked })}
                    className="w-4 h-4 text-primary rounded mt-0.5"
                  />
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-bold">
                      Bloquear venta si no hay stock (Modo Estricto)
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">
                      Impide procesar cobros en el POS si el inventario disponible es menor a la cantidad solicitada.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-space-sm p-space-md rounded bg-surface-container-low border border-surface-container cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.alertaStockCritico}
                    onChange={e => setSettings({ ...settings, alertaStockCritico: e.target.checked })}
                    className="w-4 h-4 text-primary rounded mt-0.5"
                  />
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-bold">
                      Notificaciones de Stock Crítico
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">
                      Mostrar indicador rojo en el menú de navegación cuando existan productos agotándose.
                    </span>
                  </div>
                </label>
              </div>

              {/* Impresión y POS */}
              <div className="flex flex-col gap-space-md">
                <h3 className="font-label-lg text-label-lg text-on-surface font-bold flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-lg">receipt_long</span>
                  Comprobantes e Impresora
                </h3>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md text-on-surface font-bold">
                    Formato de Comprobante:
                  </label>
                  <select
                    value={settings.formatoTicket}
                    onChange={e => setSettings({ ...settings, formatoTicket: e.target.value as any })}
                    className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    <option value="80mm">Ticket Térmico 80 mm (Estándar Punto de Venta)</option>
                    <option value="58mm">Ticket Térmico 58 mm (Impresora Compacta)</option>
                    <option value="carta">Factura Digital Carta / A4 (PDF)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md text-on-surface font-bold">
                    Prefijo de Correlativo Fiscal:
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.prefijoCorrelativo}
                    onChange={e => setSettings({ ...settings, prefijoCorrelativo: e.target.value })}
                    placeholder="#VTA-2024-"
                    className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                  />
                  <span className="font-body-sm text-body-sm text-secondary">
                    Prefijo para la numeración consecutiva de tickets.
                  </span>
                </div>

                <label className="flex items-start gap-space-sm p-space-md rounded bg-surface-container-low border border-surface-container cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.impresionAutomatica}
                    onChange={e => setSettings({ ...settings, impresionAutomatica: e.target.checked })}
                    className="w-4 h-4 text-primary rounded mt-0.5"
                  />
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-bold">
                      Impresión automática al confirmar venta
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">
                      Abre el diálogo de impresión directamente tras registrar el pago exitosamente.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-space-md border-t border-surface-container">
              <button
                type="submit"
                className="flex items-center gap-space-xs px-space-lg py-space-sm bg-primary text-on-primary font-label-md text-label-md font-bold rounded shadow-sm hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-lg">save</span>
                <span>Guardar Parámetros de Operación</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PESTAÑA 5: ESTADO DE SINCRONIZACIÓN HÍBRIDA (OUTBOX A LA NUBE) */}
      {activeTab === 'sincronizacion' && (
        <div className="bg-surface-container-lowest p-space-xl rounded shadow-sm border border-surface-container flex flex-col gap-space-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md pb-space-md border-b border-surface-container">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary text-2xl">cloud_sync</span>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Estado de Sincronización Híbrida (Local-First + Nube)
                </h2>
                <p className="font-body-sm text-body-sm text-secondary">
                  Monitorea la cola de salida (Outbox Queue), conectividad con la nube y reintentos automáticos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-space-sm">
              <button
                type="button"
                onClick={() => refetchSync()}
                disabled={fetchingSync}
                className="px-space-md py-space-xs bg-surface-container text-on-surface font-label-md text-label-md rounded hover:bg-surface-container-high transition-colors flex items-center gap-space-xs disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-base ${fetchingSync ? 'animate-spin' : ''}`}>
                  refresh
                </span>
                <span>Actualizar</span>
              </button>

              <button
                type="button"
                onClick={() => retrySyncMutation.mutate()}
                disabled={retrySyncMutation.isPending || !syncStatus?.conectado}
                className="px-space-md py-space-xs bg-primary text-on-primary font-label-md text-label-md font-bold rounded hover:bg-primary-container shadow-sm flex items-center gap-space-xs transition-colors disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-base ${retrySyncMutation.isPending ? 'animate-spin' : ''}`}>
                  sync
                </span>
                <span>{retrySyncMutation.isPending ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
              </button>
            </div>
          </div>

          {/* Banner de Estado Visual */}
          <div
            className={`p-space-md rounded-xl border flex items-center gap-space-md ${
              !syncStatus?.conectado
                ? 'bg-red-50 border-red-200 text-red-900'
                : (syncStatus?.pendientes || 0) > 0
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                !syncStatus?.conectado
                  ? 'bg-red-100 text-red-600'
                  : (syncStatus?.pendientes || 0) > 0
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              <span className="material-symbols-outlined text-xl">
                {!syncStatus?.conectado ? 'cloud_off' : (syncStatus?.pendientes || 0) > 0 ? 'sync' : 'cloud_done'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-lg text-label-lg font-bold">
                {!syncStatus?.conectado
                  ? 'Sin Conexión a Internet — Operando en Modo Local'
                  : (syncStatus?.pendientes || 0) > 0
                  ? `Sincronización en curso (${syncStatus.pendientes} cambios pendientes)`
                  : 'Sistema Totalmente Sincronizado con la Nube'}
              </span>
              <p className="font-body-sm text-body-sm opacity-90">
                {!syncStatus?.conectado
                  ? 'Todas las ventas, cobros y movimientos de inventario se guardan de forma segura en la base de datos SQLite local. Se subirán automáticamente al detectar internet.'
                  : (syncStatus?.pendientes || 0) > 0
                  ? 'Los cambios se están enviando a la base de datos central en la nube mediante el proceso en segundo plano (Worker Outbox).'
                  : 'Todos los registros locales están respaldados en la nube. La PWA móvil y los reportes remotos están al día.'}
              </p>
            </div>
          </div>

          {/* Métricas del Sistema de Sincronización */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
            <div className="p-space-md bg-surface-container-low rounded-xl border border-surface-container flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-secondary">Estado de Red</span>
              <div className="flex items-center gap-space-xs mt-1">
                <span
                  className={`w-3 h-3 rounded-full ${
                    syncStatus?.conectado ? 'bg-emerald-500 shadow-xs shadow-emerald-400' : 'bg-red-500'
                  }`}
                />
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  {syncStatus?.conectado ? 'En Línea' : 'Desconectado'}
                </span>
              </div>
              <span className="font-body-xs text-body-xs text-secondary mt-1">
                {syncStatus?.conectado ? 'Conexión HTTPS verificada' : 'Trabajando en SQLite local'}
              </span>
            </div>

            <div className="p-space-md bg-surface-container-low rounded-xl border border-surface-container flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-secondary">Cola de Salida (Outbox)</span>
              <span className="font-headline-sm text-headline-sm font-bold text-on-surface mt-1">
                {syncStatus?.pendientes ?? 0}
              </span>
              <span className="font-body-xs text-body-xs text-secondary">
                {(syncStatus?.pendientes ?? 0) === 0 ? 'Sin cambios pendientes' : 'Esperando envío a la nube'}
              </span>
            </div>

            <div className="p-space-md bg-surface-container-low rounded-xl border border-surface-container flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-secondary">Errores de Sincronización</span>
              <span
                className={`font-headline-sm text-headline-sm font-bold mt-1 ${
                  (syncStatus?.errores ?? 0) > 0 ? 'text-error' : 'text-on-surface'
                }`}
              >
                {syncStatus?.errores ?? 0}
              </span>
              <span className="font-body-xs text-body-xs text-secondary">
                {(syncStatus?.errores ?? 0) > 0 ? 'Requiere atención' : 'Todo en orden'}
              </span>
            </div>

            <div className="p-space-md bg-surface-container-low rounded-xl border border-surface-container flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-secondary">Última Sincronización</span>
              <span className="font-body-md text-body-md font-bold text-on-surface mt-1 truncate">
                {syncStatus?.ultimaSincronizacion
                  ? new Date(syncStatus.ultimaSincronizacion).toLocaleTimeString('es-VE', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Aún no registrada'}
              </span>
              <span className="font-body-xs text-body-xs text-secondary">
                {syncStatus?.ultimaSincronizacion
                  ? new Date(syncStatus.ultimaSincronizacion).toLocaleDateString('es-VE')
                  : 'Esperando primer ciclo'}
              </span>
            </div>
          </div>

          {/* Tabla de Errores Detallados si existen */}
          {syncStatus?.detallesErrores && syncStatus.detallesErrores.length > 0 && (
            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center gap-space-xs text-error">
                <span className="material-symbols-outlined text-lg">warning</span>
                <h3 className="font-label-lg text-label-lg font-bold">Registros con Error de Envío</h3>
              </div>
              <div className="overflow-x-auto rounded border border-surface-container">
                <table className="w-full text-left font-body-sm text-body-sm">
                  <thead className="bg-surface-container-low text-secondary uppercase font-label-xs text-label-xs border-b border-surface-container">
                    <tr>
                      <th className="py-2.5 px-3">Entidad</th>
                      <th className="py-2.5 px-3">ID Registro</th>
                      <th className="py-2.5 px-3">Intentos</th>
                      <th className="py-2.5 px-3">Motivo del Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {syncStatus.detallesErrores.map((err) => (
                      <tr key={err.id} className="hover:bg-surface-container-low/50">
                        <td className="py-2 px-3 font-semibold text-on-surface">{err.entidad}</td>
                        <td className="py-2 px-3 font-mono text-xs text-secondary">{err.entidadId}</td>
                        <td className="py-2 px-3">{err.intentos} / 5</td>
                        <td className="py-2 px-3 text-error font-mono text-xs">{err.ultimoError || 'Error desconocido'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Información de Arquitectura Híbrida */}
          <div className="p-space-md bg-surface-container-low rounded-xl border border-surface-container flex flex-col gap-space-xs text-secondary font-body-sm text-body-sm">
            <span className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-base text-primary">info</span>
              ¿Cómo funciona la Arquitectura Híbrida de FerrePro?
            </span>
            <p>
              1. <strong>Operación Local-First:</strong> Tu terminal trabaja siempre contra una base de datos SQLite de alta velocidad en disco local. Cobros, ventas e impresión de tickets nunca se bloquean por falta de internet.
            </p>
            <p>
              2. <strong>Cola Outbox Automática:</strong> Cada venta o cambio genera un registro seguro en la cola local. Un proceso worker intenta sincronizarlo cada 15 segundos hacia el servidor en la nube vía HTTPS.
            </p>
            <p>
              3. <strong>Sincronización Idempotente:</strong> La nube procesa cada cambio mediante operaciones de inserción/actualización únicas (UUIDs), evitando duplicados aunque la conexión se interrumpa a mitad del envío.
            </p>
          </div>
        </div>
      )}

      {/* MODAL DE USUARIO (SOLO ADMIN Y CAJERO) */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 backdrop-blur-xs p-space-md">
          <div className="bg-surface-container-lowest max-w-md w-full rounded shadow-xl border border-surface-container overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-inverse-surface text-inverse-on-surface px-space-lg py-space-md flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-xl">
                  {modalUser ? 'manage_accounts' : 'person_add'}
                </span>
                <h3 className="font-headline-sm text-headline-sm font-bold">
                  {modalUser ? 'Editar Cuenta de Usuario' : 'Crear Nueva Cuenta'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="text-inverse-on-surface hover:text-surface-container-lowest"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-space-lg flex flex-col gap-space-md">
              {userError && (
                <div className="p-space-sm bg-error-container text-on-error-container rounded font-body-sm text-body-sm font-medium">
                  {userError}
                </div>
              )}

              <div className="flex flex-col gap-space-xs">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  Nombre Completo:
                </label>
                <input
                  type="text"
                  required
                  value={userNombre}
                  onChange={e => setUserNombre(e.target.value)}
                  placeholder="ej. Ana Rodríguez"
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-space-xs">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  Correo Electrónico:
                </label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={e => setUserEmail(e.target.value)}
                  placeholder="ej. ana@ferreteria.com"
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-space-xs">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  Contraseña: {modalUser && <span className="font-normal text-secondary">(dejar en blanco para no cambiar)</span>}
                </label>
                <input
                  type="password"
                  required={!modalUser}
                  value={userPassword}
                  onChange={e => setUserPassword(e.target.value)}
                  placeholder={modalUser ? '••••••••' : 'Mínimo 6 caracteres'}
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none border border-surface-container focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Selector exclusivo de Roles: ADMIN o CAJERO */}
              <div className="flex flex-col gap-space-xs">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  Rol del Usuario:
                </label>
                <div className="grid grid-cols-2 gap-space-sm">
                  <label
                    className={`flex flex-col p-space-md rounded border cursor-pointer transition-colors ${
                      userRol === RolUsuario.ADMIN
                        ? 'bg-primary-fixed/30 border-primary text-on-surface font-bold shadow-xs'
                        : 'bg-surface-container-low border-surface-container text-secondary hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center gap-space-xs mb-1">
                      <input
                        type="radio"
                        name="rolUsuario"
                        value={RolUsuario.ADMIN}
                        checked={userRol === RolUsuario.ADMIN}
                        onChange={() => setUserRol(RolUsuario.ADMIN)}
                        className="text-primary"
                      />
                      <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                      <span className="font-label-md text-label-md">ADMIN</span>
                    </div>
                    <span className="font-body-sm text-body-sm text-secondary font-normal">
                      Acceso total y configuración
                    </span>
                  </label>

                  <label
                    className={`flex flex-col p-space-md rounded border cursor-pointer transition-colors ${
                      userRol === RolUsuario.CAJERO
                        ? 'bg-tertiary-fixed/30 border-tertiary text-on-surface font-bold shadow-xs'
                        : 'bg-surface-container-low border-surface-container text-secondary hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center gap-space-xs mb-1">
                      <input
                        type="radio"
                        name="rolUsuario"
                        value={RolUsuario.CAJERO}
                        checked={userRol === RolUsuario.CAJERO}
                        onChange={() => setUserRol(RolUsuario.CAJERO)}
                        className="text-tertiary"
                      />
                      <span className="material-symbols-outlined text-lg">point_of_sale</span>
                      <span className="font-label-md text-label-md">CAJERO</span>
                    </div>
                    <span className="font-body-sm text-body-sm text-secondary font-normal">
                      Ventas, cobros y clientes
                    </span>
                  </label>
                </div>
              </div>

              {/* Estado Activo */}
              {modalUser && (
                <label className="flex items-center gap-space-sm pt-space-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userActivo}
                    onChange={e => setUserActivo(e.target.checked)}
                    className="w-4 h-4 text-primary rounded"
                  />
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    Usuario Activo (permite iniciar sesión)
                  </span>
                </label>
              )}

              <div className="flex items-center justify-end gap-space-sm pt-space-md border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-space-md py-space-xs bg-surface-container text-on-surface font-label-md text-label-md rounded hover:bg-surface-container-high transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={userSubmitting}
                  className="px-space-md py-space-xs bg-primary text-on-primary font-label-md text-label-md font-bold rounded hover:bg-primary-container shadow-sm flex items-center gap-space-xs transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>{userSubmitting ? 'Guardando...' : 'Guardar Usuario'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
