import React, { useState } from 'react';
import type { ClienteDTO, ProveedorDTO, VentaDTO } from '@ferreteria/shared';

interface ContactosViewProps {
  initialTab?: 'clientes' | 'proveedores';
  clientes: ClienteDTO[];
  proveedores: ProveedorDTO[];
  ventas: VentaDTO[];
  onCrearCliente: (data: {
    nombre: string;
    identificacion: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
  }) => Promise<void>;
  onActualizarCliente: (id: string, data: Partial<ClienteDTO>) => Promise<void>;
  onCrearProveedor: (data: {
    nombre: string;
    rif: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
  }) => Promise<void>;
  onActualizarProveedor: (id: string, data: Partial<ProveedorDTO>) => Promise<void>;
  onVerComprobante?: (ventaId: string) => void;
  canManage?: boolean;
}

export const ContactosView: React.FC<ContactosViewProps> = ({
  initialTab = 'clientes',
  clientes,
  proveedores,
  ventas,
  onCrearCliente,
  onActualizarCliente,
  onCrearProveedor,
  onActualizarProveedor,
  onVerComprobante,
  canManage = true,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'clientes' | 'proveedores'>(initialTab);
  const [search, setSearch] = useState('');
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(clientes[0]?.id || null);
  const [selectedProveedorId, setSelectedProveedorId] = useState<string | null>(proveedores[0]?.id || null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClienteDTO | ProveedorDTO | null>(null);

  // Form Fields
  const [formNombre, setFormNombre] = useState('');
  const [formDoc, setFormDoc] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formCorreo, setFormCorreo] = useState('');
  const [formDireccion, setFormDireccion] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Active contact for right drawer
  const activeCliente = clientes.find(c => c.id === selectedClienteId) || clientes[0] || null;
  const activeProveedor = proveedores.find(p => p.id === selectedProveedorId) || proveedores[0] || null;

  // KPIs
  const totalClientesCount = clientes.length;
  const totalProveedoresCount = proveedores.length;
  // Clientes con compras registradas
  const clientesConCompras = new Set(ventas.map(v => v.clienteId)).size;

  // Filtrado
  const filteredClientes = clientes.filter(c => {
    const q = search.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.identificacion.toLowerCase().includes(q) ||
      (c.telefono && c.telefono.includes(q))
    );
  });

  const filteredProveedores = proveedores.filter(p => {
    const q = search.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(q) ||
      p.rif.toLowerCase().includes(q) ||
      (p.telefono && p.telefono.includes(q))
    );
  });

  const openCreateModal = () => {
    setEditingItem(null);
    setFormNombre('');
    setFormDoc('');
    setFormTelefono('');
    setFormCorreo('');
    setFormDireccion('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: ClienteDTO | ProveedorDTO) => {
    setEditingItem(item);
    setFormNombre(item.nombre);
    setFormDoc('identificacion' in item ? item.identificacion : item.rif);
    setFormTelefono(item.telefono || '');
    setFormCorreo(item.correo || '');
    setFormDireccion(item.direccion || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim() || !formDoc.trim()) {
      setFormError('El nombre y el documento de identificación son obligatorios');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (activeSubTab === 'clientes') {
        if (editingItem) {
          await onActualizarCliente(editingItem.id, {
            nombre: formNombre.trim(),
            identificacion: formDoc.trim().toUpperCase(),
            telefono: formTelefono.trim() || undefined,
            correo: formCorreo.trim() || undefined,
            direccion: formDireccion.trim() || undefined,
          });
        } else {
          await onCrearCliente({
            nombre: formNombre.trim(),
            identificacion: formDoc.trim().toUpperCase(),
            telefono: formTelefono.trim() || undefined,
            correo: formCorreo.trim() || undefined,
            direccion: formDireccion.trim() || undefined,
          });
        }
      } else {
        if (editingItem) {
          await onActualizarProveedor(editingItem.id, {
            nombre: formNombre.trim(),
            rif: formDoc.trim().toUpperCase(),
            telefono: formTelefono.trim() || undefined,
            correo: formCorreo.trim() || undefined,
            direccion: formDireccion.trim() || undefined,
          });
        } else {
          await onCrearProveedor({
            nombre: formNombre.trim(),
            rif: formDoc.trim().toUpperCase(),
            telefono: formTelefono.trim() || undefined,
            correo: formCorreo.trim() || undefined,
            direccion: formDireccion.trim() || undefined,
          });
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar el contacto');
    } finally {
      setSubmitting(false);
    }
  };

  // Historial de compras del cliente activo
  const clienteVentas = activeCliente ? ventas.filter(v => v.clienteId === activeCliente.id) : [];

  return (
    <div className="flex flex-col w-full gap-space-lg animate-fade-in">
      {/* 1. Header de Sección (Mismo formato que Inventario) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-xl">group</span>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              Directorio de Contactos Comerciales
            </h1>
          </div>
          <p className="font-body-md text-body-md text-secondary mt-space-2xs">
            Gestión centralizada de clientes de mostrador, empresas constructoras y proveedores mayoristas.
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-wrap shrink-0">
          {canManage && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-space-xs px-space-md py-space-xs h-9 bg-primary text-on-primary font-label-md text-label-md rounded shadow-sm hover:bg-primary-container transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              <span>{activeSubTab === 'clientes' ? 'Registrar Cliente' : 'Registrar Proveedor'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Tres Tarjetas de Resumen (Máximo 3, idéntico al Bento de Inventario) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
        {/* Card 1: Total Clientes */}
        <div
          onClick={() => setActiveSubTab('clientes')}
          className={`p-space-md rounded shadow-sm flex items-center justify-between cursor-pointer transition-all ${
            activeSubTab === 'clientes'
              ? 'bg-surface-container-lowest ring-2 ring-primary/40'
              : 'bg-surface-container-lowest hover:bg-surface-container-low'
          }`}
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                Total Clientes
              </span>
              <span
                title="Personas o empresas que compran en mostrador o con factura"
                className="material-symbols-outlined text-xs text-secondary cursor-help"
              >
                help
              </span>
            </div>
            <span className="font-display-md text-display-md text-on-surface font-bold mt-space-2xs">
              {totalClientesCount}
            </span>
            <div className="flex items-center gap-space-xs mt-space-2xs">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span className="font-body-sm text-body-sm text-secondary">
                {clientesConCompras} con compras registradas
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded bg-primary-fixed flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-2xl">badge</span>
          </div>
        </div>

        {/* Card 2: Total Proveedores */}
        <div
          onClick={() => setActiveSubTab('proveedores')}
          className={`p-space-md rounded shadow-sm flex items-center justify-between cursor-pointer transition-all ${
            activeSubTab === 'proveedores'
              ? 'bg-surface-container-lowest ring-2 ring-primary/40'
              : 'bg-surface-container-lowest hover:bg-surface-container-low'
          }`}
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                Proveedores Mayoristas
              </span>
              <span
                title="Empresas y fabricantes que suministran productos para tu inventario"
                className="material-symbols-outlined text-xs text-secondary cursor-help"
              >
                help
              </span>
            </div>
            <span className="font-display-md text-display-md text-tertiary font-bold mt-space-2xs">
              {totalProveedoresCount}
            </span>
            <div className="flex items-center gap-space-xs mt-space-2xs">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>
              <span className="font-body-sm text-body-sm text-secondary">Casas comerciales activas</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center text-tertiary shrink-0">
            <span className="material-symbols-outlined text-2xl">local_shipping</span>
          </div>
        </div>

        {/* Card 3: Clientes Frecuentes */}
        <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                Clientes Frecuentes
              </span>
              <span
                title="Clientes con más de una compra registrada en el sistema"
                className="material-symbols-outlined text-xs text-secondary cursor-help"
              >
                help
              </span>
            </div>
            <span className="font-display-md text-display-md text-on-surface font-bold mt-space-2xs">
              {clientesConCompras}
            </span>
            <div className="flex items-center gap-space-xs mt-space-2xs">
              <span className="w-2 h-2 rounded-full bg-tertiary-container"></span>
              <span className="font-body-sm text-body-sm text-secondary">Atención preferencial POS</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded bg-secondary-container flex items-center justify-center text-on-secondary-fixed shrink-0">
            <span className="material-symbols-outlined text-2xl">verified</span>
          </div>
        </div>
      </div>

      {/* 3. Barra Integrada de Subpestañas y Búsqueda */}
      <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col sm:flex-row gap-space-md items-stretch sm:items-center justify-between">
        {/* Selector de subpestañas integrado y simplificado */}
        <div className="inline-flex bg-surface-container-low p-space-2xs rounded-lg select-none shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('clientes')}
            className={`px-space-md py-space-xs rounded font-label-md text-label-md transition-all ${
              activeSubTab === 'clientes'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm font-bold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Clientes ({totalClientesCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('proveedores')}
            className={`px-space-md py-space-xs rounded font-label-md text-label-md transition-all ${
              activeSubTab === 'proveedores'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm font-bold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Proveedores ({totalProveedoresCount})
          </button>
        </div>

        {/* Buscador de contactos */}
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-secondary text-lg">
            search
          </span>
          <input
            className="w-full pl-10 pr-space-md py-space-xs h-9 bg-surface-container-low text-on-surface font-body-sm text-body-sm rounded outline-none placeholder:text-secondary focus:bg-surface-container-lowest"
            placeholder={
              activeSubTab === 'clientes'
                ? 'Buscar por nombre, cédula/RIF o teléfono...'
                : 'Buscar por nombre de empresa, RIF o contacto...'
            }
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-space-sm top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface"
              type="button"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Grid Principal: Tabla (8 cols) + Ficha Rápida Lateral (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Tabla de Contactos (8 cols) */}
        <div className="xl:col-span-8 flex flex-col bg-surface-container-lowest rounded shadow-sm overflow-hidden">
          <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-lg">
                {activeSubTab === 'clientes' ? 'person' : 'store'}
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {activeSubTab === 'clientes' ? 'Listado de Clientes' : 'Listado de Proveedores'}
              </h2>
            </div>
            <span className="font-label-sm text-label-sm text-secondary bg-surface-container px-space-xs py-space-2xs rounded">
              {activeSubTab === 'clientes' ? filteredClientes.length : filteredProveedores.length} registros
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high/60 text-secondary font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-space-sm px-space-md">Nombre / Razón Social</th>
                  <th className="py-space-sm px-space-sm">Documento / RIF</th>
                  <th className="py-space-sm px-space-md">Contacto</th>
                  <th className="py-space-sm px-space-md text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y-0 text-on-surface font-body-md text-body-md">
                {activeSubTab === 'clientes' ? (
                  filteredClientes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-space-2xl text-center text-secondary font-body-md">
                        <div className="flex flex-col items-center gap-space-xs">
                          <span className="material-symbols-outlined text-4xl text-secondary opacity-40">person_off</span>
                          <span>No se encontraron clientes registrados.</span>
                          {canManage && (
                            <button
                              onClick={openCreateModal}
                              className="mt-space-xs text-primary font-bold hover:underline"
                              type="button"
                            >
                              + Registrar el primer cliente
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredClientes.map(c => {
                      const isSelected = activeCliente?.id === c.id;
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedClienteId(c.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary-fixed/20 shadow-sm'
                              : 'hover:bg-surface-container-low'
                          }`}
                        >
                          <td className="py-space-md px-space-md">
                            <div className="flex items-center gap-space-sm">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {c.nombre.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-label-md text-label-md font-bold text-on-surface truncate">
                                  {c.nombre}
                                </span>
                                <span className="font-body-sm text-body-sm text-secondary truncate">
                                  {c.direccion || 'Sin dirección registrada'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-space-md px-space-sm font-label-md text-label-md text-primary font-mono whitespace-nowrap">
                            {c.identificacion}
                          </td>
                          <td className="py-space-md px-space-md">
                            <div className="flex flex-col">
                              <span className="font-body-sm text-body-sm text-on-surface">
                                {c.telefono || 'Sin teléfono'}
                              </span>
                              <span className="font-body-sm text-body-sm text-secondary truncate">
                                {c.correo || 'Sin correo'}
                              </span>
                            </div>
                          </td>
                          <td className="py-space-md px-space-md text-right">
                            {canManage && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  openEditModal(c);
                                }}
                                className="p-space-xs text-secondary hover:text-primary rounded transition-colors"
                                title="Editar cliente"
                                type="button"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )
                ) : (
                  filteredProveedores.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-space-2xl text-center text-secondary font-body-md">
                        <div className="flex flex-col items-center gap-space-xs">
                          <span className="material-symbols-outlined text-4xl text-secondary opacity-40">storefront</span>
                          <span>No se encontraron proveedores registrados.</span>
                          {canManage && (
                            <button
                              onClick={openCreateModal}
                              className="mt-space-xs text-primary font-bold hover:underline"
                              type="button"
                            >
                              + Registrar el primer proveedor
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProveedores.map(p => {
                      const isSelected = activeProveedor?.id === p.id;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedProveedorId(p.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary-fixed/20 shadow-sm'
                              : 'hover:bg-surface-container-low'
                          }`}
                        >
                          <td className="py-space-md px-space-md">
                            <div className="flex items-center gap-space-sm">
                              <div className="w-8 h-8 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center font-bold text-xs shrink-0">
                                {p.nombre.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-label-md text-label-md font-bold text-on-surface truncate">
                                  {p.nombre}
                                </span>
                                <span className="font-body-sm text-body-sm text-secondary truncate">
                                  {p.direccion || 'Distribuidor mayorista'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-space-md px-space-sm font-label-md text-label-md text-primary font-mono whitespace-nowrap">
                            {p.rif}
                          </td>
                          <td className="py-space-md px-space-md">
                            <div className="flex flex-col">
                              <span className="font-body-sm text-body-sm text-on-surface">
                                {p.telefono || 'Sin teléfono'}
                              </span>
                              <span className="font-body-sm text-body-sm text-secondary truncate">
                                {p.correo || 'Sin correo'}
                              </span>
                            </div>
                          </td>
                          <td className="py-space-md px-space-md text-right">
                            {canManage && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  openEditModal(p);
                                }}
                                className="p-space-xs text-secondary hover:text-primary rounded transition-colors"
                                title="Editar proveedor"
                                type="button"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Ficha Lateral de Inspección Rápida (Idéntico a Kárdex Rápido de Inventario) */}
        <div className="xl:col-span-4 flex flex-col gap-space-md">
          {activeSubTab === 'clientes' && activeCliente ? (
            <div className="bg-surface-container-lowest rounded shadow-sm p-space-md flex flex-col gap-space-md">
              <div className="flex items-center justify-between border-b-0 pb-space-2xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-xl">contact_page</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Ficha de Cliente
                  </span>
                </div>
                <span className="font-label-sm text-label-sm bg-surface-container-high px-space-xs py-space-2xs rounded font-mono font-bold text-secondary">
                  {activeCliente.identificacion}
                </span>
              </div>

              {/* Tarjeta de Información Principal */}
              <div className="bg-surface-container-low p-space-md rounded flex flex-col gap-space-xs">
                <span className="font-label-md text-label-md font-bold text-on-surface">
                  {activeCliente.nombre}
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  RIF/Cédula: <strong>{activeCliente.identificacion}</strong>
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  Teléfono: {activeCliente.telefono || 'No registrado'}
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  Correo: {activeCliente.correo || 'No registrado'}
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  Dirección: {activeCliente.direccion || 'Sin dirección registrada'}
                </span>
              </div>

              {/* Botones de Contacto Directo */}
              <div className="grid grid-cols-2 gap-space-xs">
                {activeCliente.telefono && (
                  <a
                    href={`tel:${activeCliente.telefono}`}
                    className="flex items-center justify-center gap-space-xs py-space-xs px-space-sm rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-primary">call</span>
                    <span>Llamar</span>
                  </a>
                )}
                {activeCliente.correo && (
                  <a
                    href={`mailto:${activeCliente.correo}`}
                    className="flex items-center justify-center gap-space-xs py-space-xs px-space-sm rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-tertiary">mail</span>
                    <span>Correo</span>
                  </a>
                )}
              </div>

              {/* Historial de Compras Recientes (Divulgación progresiva) */}
              <div className="flex flex-col gap-space-xs pt-space-xs">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-bold">
                    Últimas Compras ({clienteVentas.length})
                  </span>
                </div>

                {clienteVentas.length === 0 ? (
                  <div className="p-space-sm rounded bg-surface-container-low/50 text-center text-secondary font-body-sm text-body-sm">
                    Sin compras registradas aún.
                  </div>
                ) : (
                  <div className="flex flex-col gap-space-2xs max-h-[220px] overflow-y-auto">
                    {clienteVentas.slice(0, 5).map(v => (
                      <div
                        key={v.id}
                        onClick={() => onVerComprobante && onVerComprobante(v.id)}
                        className="p-space-xs bg-surface-container-low hover:bg-surface-container rounded flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="font-label-sm text-label-sm text-primary font-bold">
                            #VTA-2024-{String(v.id).padStart(4, '0')}
                          </span>
                          <span className="font-body-sm text-body-sm text-secondary">
                            {new Date(v.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="font-label-md text-label-md font-bold text-on-surface">
                          ${Number(v.total).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botón Editar Contacto */}
              {canManage && (
                <button
                  onClick={() => openEditModal(activeCliente)}
                  className="w-full py-space-xs bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md rounded transition-colors flex items-center justify-center gap-space-xs mt-space-xs"
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  <span>Editar Datos del Cliente</span>
                </button>
              )}
            </div>
          ) : activeSubTab === 'proveedores' && activeProveedor ? (
            <div className="bg-surface-container-lowest rounded shadow-sm p-space-md flex flex-col gap-space-md">
              <div className="flex items-center justify-between border-b-0 pb-space-2xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-tertiary text-xl">store</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Ficha de Proveedor
                  </span>
                </div>
                <span className="font-label-sm text-label-sm bg-surface-container-high px-space-xs py-space-2xs rounded font-mono font-bold text-secondary">
                  {activeProveedor.rif}
                </span>
              </div>

              {/* Información de Proveedor */}
              <div className="bg-surface-container-low p-space-md rounded flex flex-col gap-space-xs">
                <span className="font-label-md text-label-md font-bold text-on-surface">
                  {activeProveedor.nombre}
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  RIF Fiscal: <strong>{activeProveedor.rif}</strong>
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  Teléfono Comercial: {activeProveedor.telefono || 'No registrado'}
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  Correo Pedidos: {activeProveedor.correo || 'No registrado'}
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  Dirección / Galpón: {activeProveedor.direccion || 'Sin dirección registrada'}
                </span>
              </div>

              {/* Botones de Contacto Directo */}
              <div className="grid grid-cols-2 gap-space-xs">
                {activeProveedor.telefono && (
                  <a
                    href={`tel:${activeProveedor.telefono}`}
                    className="flex items-center justify-center gap-space-xs py-space-xs px-space-sm rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-primary">call</span>
                    <span>Llamar</span>
                  </a>
                )}
                {activeProveedor.correo && (
                  <a
                    href={`mailto:${activeProveedor.correo}`}
                    className="flex items-center justify-center gap-space-xs py-space-xs px-space-sm rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-tertiary">mail</span>
                    <span>Hacer Pedido</span>
                  </a>
                )}
              </div>

              {/* Botón Editar Proveedor */}
              {canManage && (
                <button
                  onClick={() => openEditModal(activeProveedor)}
                  className="w-full py-space-xs bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md rounded transition-colors flex items-center justify-center gap-space-xs mt-space-xs"
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  <span>Editar Datos del Proveedor</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-surface-container-lowest p-space-xl rounded text-center text-secondary">
              Seleccione un contacto para ver su ficha completa.
            </div>
          )}
        </div>
      </div>

      {/* 6. Modal de Registro / Edición (Flujo directo en 3 pasos) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-container-lowest max-w-md w-full mx-space-md rounded shadow-xl overflow-hidden">
            <div className="bg-primary text-on-primary px-space-lg py-space-md flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-xl">
                  {editingItem ? 'edit' : 'person_add'}
                </span>
                <h3 className="font-headline-sm text-headline-sm font-bold">
                  {editingItem
                    ? activeSubTab === 'clientes'
                      ? 'Editar Cliente'
                      : 'Editar Proveedor'
                    : activeSubTab === 'clientes'
                    ? 'Registrar Nuevo Cliente'
                    : 'Registrar Nuevo Proveedor'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-on-primary hover:opacity-80"
                type="button"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-space-lg flex flex-col gap-space-md">
              {formError && (
                <div className="p-space-sm bg-error-container text-on-error-container rounded text-body-sm flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-base text-error">error</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Paso 1: Identificación básica */}
              <div className="flex flex-col gap-space-xs">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  {activeSubTab === 'clientes' ? 'Nombre o Razón Social *' : 'Nombre de la Empresa *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={activeSubTab === 'clientes' ? 'Ej: Juan Pérez / FerreHierros C.A.' : 'Ej: Holcim C.A.'}
                  value={formNombre}
                  onChange={e => setFormNombre(e.target.value)}
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-space-xs">
                <label className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1">
                  <span>{activeSubTab === 'clientes' ? 'Cédula o RIF *' : 'RIF Fiscal *'}</span>
                  <span
                    title="Documento legal de identidad fiscal en Venezuela (ej: V-12345678 o J-12345678-0)"
                    className="material-symbols-outlined text-xs text-secondary cursor-help"
                  >
                    help
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: V-14283910 / J-31049281-0"
                  value={formDoc}
                  onChange={e => setFormDoc(e.target.value.toUpperCase())}
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none focus:ring-2 focus:ring-primary font-mono uppercase"
                />
              </div>

              {/* Paso 2: Datos de Contacto */}
              <div className="grid grid-cols-2 gap-space-sm">
                <div className="flex flex-col gap-space-xs">
                  <label className="font-label-md text-label-md text-on-surface font-bold">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    placeholder="0414-1234567"
                    value={formTelefono}
                    onChange={e => setFormTelefono(e.target.value)}
                    className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-space-xs">
                  <label className="font-label-md text-label-md text-on-surface font-bold">
                    Correo
                  </label>
                  <input
                    type="email"
                    placeholder="contacto@correo.com"
                    value={formCorreo}
                    onChange={e => setFormCorreo(e.target.value)}
                    className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Paso 3: Ubicación física */}
              <div className="flex flex-col gap-space-xs">
                <label className="font-label-md text-label-md text-on-surface font-bold">
                  Dirección
                </label>
                <input
                  type="text"
                  placeholder="Ciudad, zona o dirección del galpón"
                  value={formDireccion}
                  onChange={e => setFormDireccion(e.target.value)}
                  className="h-10 px-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Botonera de Acción */}
              <div className="flex items-center justify-end gap-space-sm pt-space-xs">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-space-md py-space-xs bg-surface-container text-on-surface font-label-md text-label-md rounded hover:bg-surface-container-high transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-space-md py-space-xs bg-primary text-on-primary font-label-md text-label-md rounded hover:bg-primary-container shadow-sm flex items-center gap-space-xs transition-colors disabled:opacity-50 font-bold"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  <span>
                    {submitting
                      ? 'Guardando...'
                      : editingItem
                      ? 'Guardar Cambios'
                      : activeSubTab === 'clientes'
                      ? 'Registrar Cliente'
                      : 'Registrar Proveedor'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
