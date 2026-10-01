import React, { useState } from 'react';
import { api, setStoredAuth } from '../lib/api.js';
import type { UsuarioDTO } from '@ferreteria/shared';

interface LoginModalProps {
  onSuccess: (user: UsuarioDTO) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token, usuario } = await api.login(email, password);
      setStoredAuth(token, usuario);
      onSuccess(usuario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const selectDemoRole = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setLoading(true);
    setError(null);
    try {
      const { token, usuario } = await api.login(demoEmail, demoPass);
      setStoredAuth(token, usuario);
      onSuccess(usuario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-surface-container-lowest border border-surface-container rounded-3xl shadow-2xl p-6 sm:p-8 relative">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white mb-3 shadow-md">
            <span className="material-symbols-outlined text-3xl font-bold">build</span>
          </div>
          <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">FerrePro ERP</h2>
          <p className="text-xs text-secondary mt-1">
            Sistema Integral de Ventas e Inventario para Ferreterías
          </p>
        </div>

        {/* Cuentas de demostración: solo en desarrollo (Vite elimina este bloque en el build de producción) */}
        {import.meta.env.DEV && (
        <div className="mb-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-2">
            Acceso Rápido por Rol
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => selectDemoRole('admin@ferreteria.com', 'admin123')}
              className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                email.includes('admin')
                  ? 'bg-primary/10 border-primary text-primary shadow-xs'
                  : 'bg-surface-container-low border-surface-container text-secondary hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
              <span className="font-bold">Administrador</span>
            </button>
            <button
              type="button"
              onClick={() => selectDemoRole('cajero@ferreteria.com', 'cajero123')}
              className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                email.includes('cajero')
                  ? 'bg-primary/10 border-primary text-primary shadow-xs'
                  : 'bg-surface-container-low border-surface-container text-secondary hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-xl">point_of_sale</span>
              <span className="font-bold">Cajero</span>
            </button>
          </div>
        </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-error-container text-error text-xs flex items-center gap-2 font-semibold">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-secondary mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">
                mail
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@ferreteria.com"
                className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-surface-container rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-secondary mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">
                lock
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-surface-container rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-xl text-sm shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Ingresar al Sistema'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
