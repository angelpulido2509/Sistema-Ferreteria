import React from 'react';
import { useBackups, useCrearBackup } from '../hooks/useBackups.js';

const MOTIVOS: Record<string, string> = {
  arranque: 'Al iniciar',
  diario: 'Diario',
  'cierre-turno': 'Cierre de turno',
  manual: 'Manual',
};

function formatearTamano(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Panel mínimo de respaldos: lista y botón de respaldo inmediato. */
export const BackupPanel: React.FC = () => {
  const { data: backups = [], isLoading, error } = useBackups();
  const crear = useCrearBackup();

  return (
    <div className="bg-surface-container-lowest p-space-xl rounded shadow-sm border border-surface-container flex flex-col gap-space-md mt-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md pb-space-md border-b border-surface-container">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-primary text-2xl">backup</span>
          <div>
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Respaldos de la base de datos</h3>
            <p className="text-xs text-secondary">
              Automáticos al iniciar, al cerrar turno y cada 24 h. Se verifican y se conservan 30 días.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => crear.mutate()}
          disabled={crear.isPending}
          className="flex items-center gap-space-xs px-space-lg py-space-sm bg-primary text-on-primary font-label-md text-label-md font-bold rounded shadow-sm hover:bg-primary-container transition-colors disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-lg ${crear.isPending ? 'animate-spin' : ''}`}>
            {crear.isPending ? 'sync' : 'save'}
          </span>
          <span>{crear.isPending ? 'Respaldando…' : 'Respaldar ahora'}</span>
        </button>
      </div>

      {crear.isError && (
        <p className="text-xs text-error font-semibold">
          {crear.error instanceof Error ? crear.error.message : 'No se pudo crear el respaldo'}
        </p>
      )}
      {crear.isSuccess && <p className="text-xs text-primary font-semibold">Respaldo creado y verificado: {crear.data.archivo}</p>}

      {isLoading ? (
        <p className="text-xs text-secondary">Cargando respaldos…</p>
      ) : error ? (
        <p className="text-xs text-error">No se pudo obtener la lista de respaldos.</p>
      ) : backups.length === 0 ? (
        <p className="text-xs text-error font-semibold">No hay respaldos todavía.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-secondary border-b border-surface-container">
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Origen</th>
                <th className="py-2 pr-4">Tamaño</th>
                <th className="py-2">Archivo</th>
              </tr>
            </thead>
            <tbody>
              {backups.slice(0, 15).map((b) => (
                <tr key={b.archivo} className="border-b border-surface-container last:border-0">
                  <td className="py-2 pr-4 whitespace-nowrap">{new Date(b.creadoEn).toLocaleString('es-VE')}</td>
                  <td className="py-2 pr-4">{MOTIVOS[b.motivo] ?? b.motivo}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatearTamano(b.tamanoBytes)}</td>
                  <td className="py-2 font-mono break-all">{b.archivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
