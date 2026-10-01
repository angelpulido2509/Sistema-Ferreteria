import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Pencil,
  UserX,
  UserCheck,
  Shield,
  ShoppingCart,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { RolUsuario, type UsuarioDTO } from '@ferreteria/shared';

// ─── helpers ───────────────────────────────────────────────────────────────

const ROL_META: Record<
  RolUsuario,
  { label: string; color: string; bg: string; Icon: React.ElementType }
> = {
  [RolUsuario.ADMIN]: {
    label: 'Administrador',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    Icon: Shield,
  },
  [RolUsuario.CAJERO]: {
    label: 'Cajero',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    Icon: ShoppingCart,
  },
};

function RolBadge({ rol }: { rol: RolUsuario }) {
  const meta = ROL_META[rol];
  const { Icon } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${meta.color} ${meta.bg}`}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

function Initials({ nombre }: { nombre: string }) {
  const parts = nombre.trim().split(' ');
  const initials = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
      {initials}
    </div>
  );
}

// ─── Modal de creación / edición ───────────────────────────────────────────

interface ModalProps {
  usuario: UsuarioDTO | null; // null = crear
  onClose: () => void;
  onSaved: () => void;
  currentUserId?: string;
}

function UsuarioModal({ usuario, onClose, onSaved, currentUserId }: ModalProps) {
  const isEditing = usuario !== null;

  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolUsuario>(usuario?.rol ?? RolUsuario.CAJERO);
  const [activo, setActivo] = useState(usuario?.activo ?? true);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isSelf = currentUserId === usuario?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !email.trim()) {
      setError('El nombre y el correo son obligatorios.');
      return;
    }
    if (!isEditing && !password) {
      setError('La contraseña es obligatoria al crear un usuario.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await api.updateUsuario(usuario.id, {
          nombre: nombre.trim(),
          email: email.trim(),
          rol,
          activo,
          ...(password ? { password } : {}),
        });
      } else {
        await api.createUsuario({ nombre: nombre.trim(), email: email.trim(), password, rol });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <h2 className="text-white font-semibold text-base">
            {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Nombre completo
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: María González"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ferreteria.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Contraseña {isEditing && <span className="text-slate-500 font-normal normal-case">(dejar vacío para no cambiar)</span>}
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEditing ? '••••••••' : 'Mínimo 6 caracteres'}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 pr-10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                tabIndex={-1}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Rol */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Rol
            </label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as RolUsuario)}
              disabled={isSelf}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {Object.values(RolUsuario).map((r) => (
                <option key={r} value={r}>
                  {ROL_META[r].label}
                </option>
              ))}
            </select>
            {isSelf && (
              <p className="mt-1 text-xs text-amber-500">No puedes cambiar tu propio rol.</p>
            )}
          </div>

          {/* Estado activo (solo en edición) */}
          {isEditing && !isSelf && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActivo((v) => !v)}
                className={`relative w-10 h-5.5 rounded-full transition-colors ${activo ? 'bg-blue-600' : 'bg-slate-700'}`}
                style={{ height: '22px', width: '40px' }}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${activo ? 'translate-x-4.5' : ''}`}
                  style={{ transform: activo ? 'translateX(18px)' : 'translateX(0)' }}
                />
              </button>
              <span className="text-sm text-slate-300">
                {activo ? 'Usuario activo' : 'Usuario inactivo (acceso bloqueado)'}
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition disabled:opacity-60"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isEditing ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Vista principal ────────────────────────────────────────────────────────

interface UsuariosViewProps {
  currentUser: UsuarioDTO | null;
}

export function UsuariosView({ currentUser }: UsuariosViewProps): React.JSX.Element {
  const queryClient = useQueryClient();
  // null = crear nuevo, UsuarioDTO = editar existente
  const [modalUsuario, setModalUsuario] = useState<UsuarioDTO | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.getUsuarios(),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.deactivateUsuario(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setConfirmDeactivateId(null);
    },
  });

  const handleSaved = () => {
    void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
  };

  const openCreate = () => {
    setModalUsuario(null); // null = crear nuevo
    setShowModal(true);
  };

  const openEdit = (usuario: UsuarioDTO) => {
    setModalUsuario(usuario);
    setShowModal(true);
  };

  const activos = usuarios.filter((u) => u.activo);
  const inactivos = usuarios.filter((u) => !u.activo);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Usuarios</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Administra los accesos y roles del sistema
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo usuario
        </button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.values(RolUsuario).map((r) => {
          const count = activos.filter((u) => u.rol === r).length;
          const meta = ROL_META[r];
          const { Icon } = meta;
          return (
            <div
              key={r}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3"
            >
              <div className={`p-2 rounded-lg ${meta.bg}`}>
                <Icon className={`w-5 h-5 ${meta.color}`} />
              </div>
              <div>
                <p className="text-2xl font-black text-white">{count}</p>
                <p className="text-xs text-slate-400">{meta.label}s</p>
              </div>
            </div>
          );
        })}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-700/40">
            <UserX className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-400">{inactivos.length}</p>
            <p className="text-xs text-slate-500">Inactivos</p>
          </div>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Usuarios activos ({activos.length})</h2>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Cargando usuarios...</p>
          </div>
        ) : activos.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No hay usuarios activos.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {activos.map((usuario) => {
              const isSelf = currentUser?.id === usuario.id;
              return (
                <div
                  key={usuario.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-800/40 transition group"
                >
                  <Initials nombre={usuario.nombre} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{usuario.nombre}</span>
                      {isSelf && (
                        <span className="text-[10px] font-bold bg-blue-600/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
                          Tú
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{usuario.email}</p>
                  </div>

                  <div className="hidden sm:block">
                    <RolBadge rol={usuario.rol} />
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => openEdit(usuario)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {!isSelf && (
                      <button
                        onClick={() => setConfirmDeactivateId(usuario.id)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        title="Desactivar usuario"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Usuarios inactivos */}
      {inactivos.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/60">
            <h2 className="text-sm font-semibold text-slate-500">
              Usuarios inactivos ({inactivos.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-800/50">
            {inactivos.map((usuario) => (
              <div
                key={usuario.id}
                className="flex items-center gap-4 px-5 py-3 opacity-50 hover:opacity-70 transition group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-500 font-bold text-sm flex-shrink-0">
                  {usuario.nombre[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-400 text-sm line-through">
                    {usuario.nombre}
                  </p>
                  <p className="text-xs text-slate-600 truncate">{usuario.email}</p>
                </div>
                <RolBadge rol={usuario.rol} />
                <button
                  onClick={() =>
                    void api
                      .updateUsuario(usuario.id, { activo: true })
                      .then(() => void queryClient.invalidateQueries({ queryKey: ['usuarios'] }))
                  }
                  className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                  title="Reactivar usuario"
                >
                  <UserCheck className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <UsuarioModal
          usuario={modalUsuario}
          currentUserId={currentUser?.id}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Confirmación de desactivación */}
      {confirmDeactivateId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Desactivar usuario</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  El usuario perderá acceso al sistema inmediatamente.
                </p>
              </div>
            </div>
            <p className="text-slate-300 text-sm">
              ¿Estás seguro de que deseas desactivar a{' '}
              <strong className="text-white">
                {usuarios.find((u) => u.id === confirmDeactivateId)?.nombre}
              </strong>
              ?
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmDeactivateId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => deactivateMutation.mutate(confirmDeactivateId)}
                disabled={deactivateMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition disabled:opacity-60"
              >
                {deactivateMutation.isPending ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <UserX className="w-4 h-4" />
                )}
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
