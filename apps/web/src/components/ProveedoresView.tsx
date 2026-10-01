import React, { useState } from 'react';
import { 
  Truck, 
  Search, 
  Plus, 
  Edit3, 
  Phone, 
  Mail, 
  MapPin, 
  Building2, 
  CheckCircle2, 
  XCircle,
  X,
  AlertCircle
} from 'lucide-react';
import type { ProveedorDTO } from '@ferreteria/shared';

interface ProveedoresViewProps {
  proveedores: ProveedorDTO[];
  onCrearProveedor: (data: {
    nombre: string;
    rif: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
  }) => Promise<void>;
  onActualizarProveedor: (id: string, data: Partial<ProveedorDTO>) => Promise<void>;
  canManage: boolean;
}

export function ProveedoresView({
  proveedores,
  onCrearProveedor,
  onActualizarProveedor,
  canManage,
}: ProveedoresViewProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<ProveedorDTO | null>(null);

  // Estado del formulario
  const [nombre, setNombre] = useState('');
  const [rif, setRif] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingProveedor(null);
    setNombre('');
    setRif('');
    setTelefono('');
    setCorreo('');
    setDireccion('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: ProveedorDTO) => {
    setEditingProveedor(p);
    setNombre(p.nombre);
    setRif(p.rif);
    setTelefono(p.telefono || '');
    setCorreo(p.correo || '');
    setDireccion(p.direccion || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !rif.trim()) {
      setFormError('El nombre y el RIF son obligatorios');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (editingProveedor) {
        await onActualizarProveedor(editingProveedor.id, {
          nombre: nombre.trim(),
          rif: rif.trim().toUpperCase(),
          telefono: telefono.trim() || undefined,
          correo: correo.trim() || undefined,
          direccion: direccion.trim() || undefined,
        });
      } else {
        await onCrearProveedor({
          nombre: nombre.trim(),
          rif: rif.trim().toUpperCase(),
          telefono: telefono.trim() || undefined,
          correo: correo.trim() || undefined,
          direccion: direccion.trim() || undefined,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar proveedor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActivo = async (p: ProveedorDTO) => {
    try {
      await onActualizarProveedor(p.id, { activo: !p.activo });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar estado');
    }
  };

  const filteredProveedores = proveedores.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(q) ||
      p.rif.toLowerCase().includes(q) ||
      (p.correo && p.correo.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Cabecera y Barra de Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-500" />
            Proveedores de Suministro
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Administra los proveedores y distribuidores comerciales de la ferretería
          </p>
        </div>

        {canManage && (
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Proveedor</span>
          </button>
        )}
      </div>

      {/* Barra de Búsqueda y Estadísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por RIF, razón social o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">{proveedores.length} Registrados</div>
            <div className="text-[10px] text-slate-400">
              {proveedores.filter((p) => p.activo).length} Activos
            </div>
          </div>
        </div>
      </div>

      {/* Tabla en Desktop / Tarjetas en Móvil */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredProveedores.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Truck className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="text-sm font-semibold">No se encontraron proveedores</p>
            <p className="text-xs text-slate-500 mt-1">
              {search ? 'Intenta con otro término de búsqueda' : 'Registra tu primer proveedor'}
            </p>
          </div>
        ) : (
          <>
            {/* Tabla para Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Proveedor / Razón Social</th>
                    <th className="py-3 px-4">RIF / Identificación</th>
                    <th className="py-3 px-4">Contacto</th>
                    <th className="py-3 px-4">Dirección</th>
                    <th className="py-3 px-4">Estado</th>
                    {canManage && <th className="py-3 px-4 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredProveedores.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                          <span>{p.nombre}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-400 font-medium">
                        {p.rif}
                      </td>
                      <td className="py-3 px-4 space-y-0.5">
                        {p.telefono && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{p.telefono}</span>
                          </div>
                        )}
                        {p.correo && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{p.correo}</span>
                          </div>
                        )}
                        {!p.telefono && !p.correo && (
                          <span className="text-[11px] text-slate-500 italic">Sin contacto</span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-[11px] text-slate-400">
                        {p.direccion || <span className="italic text-slate-600">No registrada</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.activo
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {p.activo ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Activo
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Inactivo
                            </>
                          )}
                        </span>
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(p)}
                              title="Editar Proveedor"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleActivo(p)}
                              title={p.activo ? 'Desactivar Proveedor' : 'Activar Proveedor'}
                              className={`p-1.5 rounded-lg transition ${
                                p.activo
                                  ? 'bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400'
                                  : 'bg-slate-800 hover:bg-emerald-950/40 text-slate-400 hover:text-emerald-400'
                              }`}
                            >
                              {p.activo ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tarjetas para Móvil */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {filteredProveedores.map((p) => (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-white">{p.nombre}</h3>
                      <span className="font-mono text-xs text-blue-400 font-semibold">{p.rif}</span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.activo
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-300">
                    {p.telefono && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{p.telefono}</span>
                      </div>
                    )}
                    {p.correo && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{p.correo}</span>
                      </div>
                    )}
                    {p.direccion && (
                      <div className="flex items-start gap-2 text-slate-400 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span>{p.direccion}</span>
                      </div>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => openEditModal(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => handleToggleActivo(p)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          p.activo
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {p.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal de Creación / Edición */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
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
                  Nombre o Razón Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Distribuidora Nacional C.A."
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  RIF / Identificación Fiscal *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. J-30123456-7"
                  value={rif}
                  onChange={(e) => setRif(e.target.value)}
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
                    placeholder="0212-0000000"
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
                    placeholder="proveedor@email.com"
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
                  placeholder="Dirección física del proveedor o galpón"
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
                  {submitting ? 'Guardando...' : editingProveedor ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
