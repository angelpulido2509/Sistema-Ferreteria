import React, { useState } from 'react';
import type { CategoriaDTO, ProductoDTO } from '@ferreteria/shared';

interface CategoriasViewProps {
  categorias: CategoriaDTO[];
  productos: ProductoDTO[];
  onCrearCategoria: (nombre: string) => Promise<void>;
  canManage: boolean;
}

export const CategoriasView: React.FC<CategoriasViewProps> = ({
  categorias,
  productos,
  onCrearCategoria,
  canManage,
}) => {
  const [nombre, setNombre] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await onCrearCategoria(nombre.trim());
      setNombre('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear categoría');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Formulario de Creación Rápida */}
      {canManage && (
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm">
          <h3 className="text-base font-bold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">add_circle</span>
            Crear Nueva Categoría
          </h3>

          {error && (
            <div className="mb-3 p-3 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-3 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2 font-semibold">
              <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
              <span>Categoría creada con éxito</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 text-xs">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-lg">
                category
              </span>
              <input
                type="text"
                required
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Nombre de la categoría (ej: Herramientas Neumáticas)..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-surface-container rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>{submitting ? 'Guardando...' : 'Añadir Categoría'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Grid de Categorías */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categorias.map(cat => {
          const count = productos.filter(p => p.categoriaId === cat.id).length;
          return (
            <div
              key={cat.id}
              className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm hover:shadow-md transition flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">folder</span>
                </div>
                <div>
                  <h4 className="font-bold text-on-surface text-base leading-snug">{cat.nombre}</h4>
                  <p className="text-xs text-secondary mt-0.5">ID: #{cat.id}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-surface-container-low text-secondary border border-surface-container font-mono">
                  {count} {count === 1 ? 'artículo' : 'artículos'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
