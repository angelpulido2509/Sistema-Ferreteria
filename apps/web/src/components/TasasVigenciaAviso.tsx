import React from 'react';
import type { ConfiguracionDTO } from '@ferreteria/shared';

interface Props {
  config: ConfiguracionDTO | undefined;
}

/**
 * Estado de vigencia de las tasas VES/COP (F1). Con la tasa vencida o sin confirmar,
 * la API rechaza los cobros en bolívares y pesos; en dólares se sigue cobrando.
 */
export const TasasVigenciaAviso: React.FC<Props> = ({ config }) => {
  if (!config) return null;
  const vigencia = config.tasaVigenciaHoras ?? 12;
  const confirmada = config.tasaActualizadaEn ? new Date(config.tasaActualizadaEn) : null;
  const horas = confirmada ? (Date.now() - confirmada.getTime()) / 3_600_000 : null;
  const vencida = horas === null || horas > vigencia;

  return (
    <div
      className={`p-space-md rounded border text-xs font-semibold flex items-start gap-2 ${
        vencida ? 'bg-error-container text-error border-error/30' : 'bg-surface-container-low text-secondary border-surface-container'
      }`}
    >
      <span className="material-symbols-outlined text-base">{vencida ? 'warning' : 'schedule'}</span>
      <span>
        {confirmada
          ? `Tasas confirmadas el ${confirmada.toLocaleString('es-VE')} (vigencia ${vigencia} h).`
          : 'Las tasas VES/COP nunca han sido confirmadas.'}{' '}
        {vencida
          ? 'Cobros en VES y COP BLOQUEADOS: revise las tasas y guarde esta pestaña para confirmarlas.'
          : 'Al guardar esta pestaña se confirman las tasas actuales.'}
      </span>
    </div>
  );
};
