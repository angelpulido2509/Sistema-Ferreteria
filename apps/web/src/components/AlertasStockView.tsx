import React from 'react';
import type { ProductoDTO } from '@ferreteria/shared';

interface AlertasStockViewProps {
  productosCriticos: ProductoDTO[];
  onNavigateToProducts: () => void;
}

export const AlertasStockView: React.FC<AlertasStockViewProps> = ({
  productosCriticos,
  onNavigateToProducts,
}) => {
  const costoTotalReposicion = productosCriticos.reduce((acc, p) => {
    const unidadesFaltantes = Math.max(0, p.stockMinimo - p.stockActual);
    return acc + unidadesFaltantes * p.precioCompra;
  }, 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Banner de Resumen de Alertas */}
      <div className="p-6 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-error-container text-error mb-2">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>Centro de Control de Reposición</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface">
            {productosCriticos.length} {productosCriticos.length === 1 ? 'Producto Requiere' : 'Productos Requieren'} Reposición Urgente
          </h2>
          <p className="text-xs sm:text-sm text-secondary mt-1">
            Artículos con existencias iguales o inferiores al nivel de stock mínimo configurado.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container shrink-0 text-right">
          <span className="text-[11px] uppercase tracking-wider text-secondary block font-bold">
            Presupuesto Estimado
          </span>
          <div className="text-2xl font-extrabold text-primary flex items-center justify-end gap-1 mt-0.5">
            <span>${costoTotalReposicion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <span className="text-[10px] text-secondary">Para nivelar al stock mínimo</span>
        </div>
      </div>

      {/* Lista de Alertas */}
      {productosCriticos.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm">
          <span className="material-symbols-outlined text-5xl text-emerald-600 mb-2">verified</span>
          <h3 className="text-lg font-bold text-on-surface">¡Inventario Saludable!</h3>
          <p className="text-xs text-secondary max-w-md mx-auto mt-1 mb-4">
            Todos los artículos en almacén superan sus umbrales de stock mínimo. No se requieren compras de reposición en este momento.
          </p>
          <button
            onClick={onNavigateToProducts}
            className="py-2.5 px-5 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 shadow-sm"
          >
            <span>Ver Catálogo General</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {productosCriticos.map(prod => {
            const faltante = prod.stockMinimo - prod.stockActual;
            const isAgotado = prod.stockActual <= 0;
            const costoSurtir = faltante * prod.precioCompra;

            return (
              <div
                key={prod.id}
                className={`p-5 rounded-2xl border shadow-sm transition relative overflow-hidden bg-surface-container-lowest ${
                  isAgotado
                    ? 'border-error/40 bg-error-container/10'
                    : 'border-surface-container'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-primary">{prod.codigo}</span>
                    <h3 className="font-bold text-on-surface text-base leading-snug mt-0.5">{prod.nombre}</h3>
                    <p className="text-xs text-secondary">{prod.categoria?.nombre || 'Sin categoría'}</p>
                  </div>

                  {isAgotado ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-error text-on-error shrink-0 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">block</span> AGOTADO
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 shrink-0 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">warning</span> CRÍTICO
                    </span>
                  )}
                </div>

                {/* Métricas de Stock */}
                <div className="grid grid-cols-3 gap-2 bg-surface-container-low p-3 rounded-xl border border-surface-container mb-3 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-secondary block">Stock Actual</span>
                    <span className="text-sm font-bold text-error font-mono">
                      {prod.stockActual} {prod.unidadMedida}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-secondary block">Mínimo</span>
                    <span className="text-sm font-bold text-on-surface font-mono">
                      {prod.stockMinimo} {prod.unidadMedida}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-secondary block">Faltante</span>
                    <span className="text-sm font-bold text-primary font-mono">
                      +{faltante} {prod.unidadMedida}
                    </span>
                  </div>
                </div>

                {/* Barra de Nivel de Stock */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-secondary font-semibold">
                    <span>Nivel de Cobertura</span>
                    <span>{Math.min(100, Math.round((prod.stockActual / prod.stockMinimo) * 100))}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isAgotado ? 'bg-error' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, Math.max(5, (prod.stockActual / prod.stockMinimo) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-secondary pt-3 mt-3 border-t border-surface-container">
                  <span>Costo unitario: <strong className="text-on-surface font-mono">${Number(prod.precioCompra).toFixed(2)}</strong></span>
                  <span className="text-primary font-bold font-mono">Surtir: ${costoSurtir.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
