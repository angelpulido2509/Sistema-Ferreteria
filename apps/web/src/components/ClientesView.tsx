import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Edit3, 
  Phone, 
  Mail, 
  MapPin, 
  UserCheck, 
  ShoppingBag, 
  FileText, 
  X, 
  AlertCircle,
  Clock
} from 'lucide-react';
import type { ClienteDTO, VentaDTO } from '@ferreteria/shared';

interface ClientesViewProps {
  clientes: ClienteDTO[];
  ventas: VentaDTO[];
  onCrearCliente: (data: {
    nombre: string;
    identificacion: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
  }) => Promise<void>;
  onActualizarCliente: (id: string, data: Partial<ClienteDTO>) => Promise<void>;
  onVerComprobante?: (ventaId: string) => void;
  canManage?: boolean;
}

export function ClientesView({
  clientes,
  ventas,
  onCrearCliente,
  onActualizarCliente,
  onVerComprobante,
  canManage: _canManage,
}: ClientesViewProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<ClienteDTO | null>(null);
  const [selectedClientHistory, setSelectedClientHistory] = useState<ClienteDTO | null>(null);

  // Estado del formulario
  const [nombre, setNombre] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingCliente(null);
    setNombre('');
    setIdentificacion('');
    setTelefono('');
    setCorreo('');
    setDireccion('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (c: ClienteDTO) => {
    setEditingCliente(c);
    setNombre(c.nombre);
    setIdentificacion(c.identificacion);
    setTelefono(c.telefono || '');
    setCorreo(c.correo || '');
    setDireccion(c.direccion || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !identificacion.trim()) {
      setFormError('El nombre y la identificación (Cédula/RIF) son obligatorios');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (editingCliente) {
        await onActualizarCliente(editingCliente.id, {
          nombre: nombre.trim(),
          identificacion: identificacion.trim().toUpperCase(),
          telefono: telefono.trim() || undefined,
          correo: correo.trim() || undefined,
          direccion: direccion.trim() || undefined,
        });
      } else {
        await onCrearCliente({
          nombre: nombre.trim(),
          identificacion: identificacion.trim().toUpperCase(),
          telefono: telefono.trim() || undefined,
          correo: correo.trim() || undefined,
          direccion: direccion.trim() || undefined,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar cliente');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClientes = clientes.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.identificacion.toLowerCase().includes(q) ||
      (c.correo && c.correo.toLowerCase().includes(q))
    );
  });

  // Ventas del cliente seleccionado para historial
  const clientVentas = selectedClientHistory
    ? ventas.filter((v) => v.clienteId === selectedClientHistory.id)
    : [];

  const getClientTotalPurchases = (clienteId: string) => {
    return ventas
      .filter((v) => v.clienteId === clienteId && v.estado === 'COMPLETADA')
      .reduce((acc, v) => acc + Number(v.total), 0);
  };

  const getClientPurchasesCount = (clienteId: string) => {
    return ventas.filter((v) => v.clienteId === clienteId && v.estado === 'COMPLETADA').length;
  };

  return (
    <div className="space-y-6">
      {/* Cabecera y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            Directorio de Clientes
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Consulta y gestiona los clientes registrados y su historial de compras
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Buscador y Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cédula/RIF, nombre o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">{clientes.length} Clientes</div>
            <div className="text-[10px] text-slate-400">
              {clientes.filter((c) => getClientPurchasesCount(c.id) > 0).length} Con compras
            </div>
          </div>
        </div>
      </div>

      {/* Tabla / Tarjetas */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredClientes.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="text-sm font-semibold">No se encontraron clientes</p>
            <p className="text-xs text-slate-500 mt-1">
              {search ? 'Intenta con otro término de búsqueda' : 'Registra tu primer cliente'}
            </p>
          </div>
        ) : (
          <>
            {/* Tabla Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Cliente / Nombre</th>
                    <th className="py-3 px-4">Cédula / RIF</th>
                    <th className="py-3 px-4">Contacto</th>
                    <th className="py-3 px-4">Dirección</th>
                    <th className="py-3 px-4 text-center">Compras</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredClientes.map((c) => {
                    const count = getClientPurchasesCount(c.id);
                    const total = getClientTotalPurchases(c.id);

                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                              {c.nombre.charAt(0).toUpperCase()}
                            </div>
                            <span>{c.nombre}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-blue-400 font-medium">
                          {c.identificacion}
                        </td>
                        <td className="py-3 px-4 space-y-0.5">
                          {c.telefono && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span>{c.telefono}</span>
                            </div>
                          )}
                          {c.correo && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <Mail className="w-3 h-3 text-slate-500" />
                              <span>{c.correo}</span>
                            </div>
                          )}
                          {!c.telefono && !c.correo && (
                            <span className="text-[11px] text-slate-500 italic">Sin datos</span>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-[11px] text-slate-400">
                          {c.direccion || <span className="italic text-slate-600">No registrada</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedClientHistory(c)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition"
                            title="Ver Historial de Compras"
                          >
                            <ShoppingBag className="w-3 h-3 text-emerald-400" />
                            <span>{count} facturas</span>
                            {count > 0 && (
                              <span className="text-emerald-400 font-bold ml-1">
                                (${total.toFixed(2)})
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(c)}
                              title="Editar Cliente"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tarjetas Móvil */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {filteredClientes.map((c) => {
                const count = getClientPurchasesCount(c.id);
                const total = getClientTotalPurchases(c.id);

                return (
                  <div key={c.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-sm text-white">{c.nombre}</h3>
                        <span className="font-mono text-xs text-blue-400 font-semibold">
                          {c.identificacion}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedClientHistory(c)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] font-semibold text-emerald-400"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span>{count}</span>
                      </button>
                    </div>

                    <div className="space-y-1 text-xs text-slate-300">
                      {c.telefono && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          <span>{c.telefono}</span>
                        </div>
                      )}
                      {c.correo && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span>{c.correo}</span>
                        </div>
                      )}
                      {c.direccion && (
                        <div className="flex items-start gap-2 text-slate-400 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <span>{c.direccion}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                      <span className="text-slate-400">
                        Total Acumulado: <strong className="text-white">${total.toFixed(2)}</strong>
                      </span>
                      <button
                        onClick={() => openEditModal(c)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal Historial de Compras del Cliente */}
      {selectedClientHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Historial de Compras: {selectedClientHistory.nombre}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {selectedClientHistory.identificacion}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClientHistory(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              {clientVentas.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p className="text-xs">Este cliente aún no tiene ventas registradas.</p>
                </div>
              ) : (
                clientVentas.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-400">
                          FAC-{String(v.id).padStart(6, '0')}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            v.estado === 'COMPLETADA'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {v.estado}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {new Date(v.fecha).toLocaleDateString()} &bull; {v.detalles?.length || 0} productos
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-white">${Number(v.total).toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">Total</div>
                      </div>
                      {onVerComprobante && (
                        <button
                          onClick={() => onVerComprobante(v.id)}
                          title="Ver Ticket"
                          className="p-2 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 transition"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/30 flex justify-end">
              <button
                onClick={() => setSelectedClientHistory(null)}
                className="px-4 py-1.5 bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Creación / Edición */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Nombre Completo o Razón Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez / Inversiones ABC"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Cédula / RIF / Pasaporte *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. V-12345678 o J-12345678-0"
                  value={identificacion}
                  onChange={(e) => setIdentificacion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    placeholder="0414-0000000"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="cliente@email.com"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Dirección
                </label>
                <textarea
                  rows={2}
                  placeholder="Dirección fiscal o residencial"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : editingCliente ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
