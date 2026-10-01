import React, { useState } from 'react';
import { useSetupInicial } from '../hooks/useSetupStatus.js';

const MIN_ADMIN_PASSWORD = 12;

const inputClass =
  'w-full px-3 py-2.5 bg-surface-container-low border border-surface-container rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary transition';

/** Primer arranque: crea el usuario ADMIN con contraseña propia. */
export const SetupModal: React.FC = () => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const setup = useSetupInicial();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);
    if (password.length < MIN_ADMIN_PASSWORD) {
      setErrorLocal(`La contraseña debe tener al menos ${MIN_ADMIN_PASSWORD} caracteres`);
      return;
    }
    if (password !== confirmacion) {
      setErrorLocal('Las contraseñas no coinciden');
      return;
    }
    setup.mutate({ nombre, email, password });
  };

  const error = errorLocal ?? (setup.error instanceof Error ? setup.error.message : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-surface-container-lowest border border-surface-container rounded-3xl shadow-2xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white mb-3 shadow-md">
            <span className="material-symbols-outlined text-3xl font-bold">admin_panel_settings</span>
          </div>
          <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">Configuración inicial</h2>
          <p className="text-xs text-secondary mt-1">
            Crea la cuenta de administrador. Este paso solo se puede hacer una vez.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-error-container text-error text-xs flex items-center gap-2 font-semibold">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-secondary mb-1.5">Nombre</label>
            <input required value={nombre} onChange={e => setNombre(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block font-bold text-secondary mb-1.5">Correo electrónico</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block font-bold text-secondary mb-1.5">
              Contraseña (mín. {MIN_ADMIN_PASSWORD} caracteres, letras y números)
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block font-bold text-secondary mb-1.5">Repetir contraseña</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmacion}
              onChange={e => setConfirmacion(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={setup.isPending}
            className="w-full py-3 px-4 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-xl text-sm shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {setup.isPending ? 'Creando…' : 'Crear administrador'}
          </button>
        </form>
      </div>
    </div>
  );
};
