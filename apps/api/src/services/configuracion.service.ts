import { configuracionRepository, type ActualizarConfiguracionData } from '../repositories/configuracion.repository.js';
import { ConfiguracionDTO, Moneda } from '@ferreteria/shared';

export class ConfiguracionService {
  public async get(): Promise<ConfiguracionDTO> {
    const raw = await configuracionRepository.get();
    return this.mapToDTO(raw);
  }

  public async update(data: ActualizarConfiguracionData): Promise<ConfiguracionDTO> {
    if (data.tasaVes !== undefined && (typeof data.tasaVes !== 'number' || data.tasaVes <= 0)) {
      throw new Error('La tasa VES debe ser un número mayor a 0');
    }
    if (data.tasaCop !== undefined && (typeof data.tasaCop !== 'number' || data.tasaCop <= 0)) {
      throw new Error('La tasa COP debe ser un número mayor a 0');
    }
    if (data.ivaPorcentaje !== undefined && (typeof data.ivaPorcentaje !== 'number' || data.ivaPorcentaje < 0)) {
      throw new Error('El porcentaje de IVA debe ser un número mayor o igual a 0');
    }
    if (data.stockMinimoAlerta !== undefined && (typeof data.stockMinimoAlerta !== 'number' || data.stockMinimoAlerta < 0)) {
      throw new Error('El stock mínimo de alerta debe ser un número mayor o igual a 0');
    }

    if (
      data.tasaVigenciaHoras !== undefined &&
      (!Number.isInteger(data.tasaVigenciaHoras) || data.tasaVigenciaHoras < 1 || data.tasaVigenciaHoras > 168)
    ) {
      throw new Error('La vigencia de la tasa debe ser un número entero de horas entre 1 y 168');
    }
    if (
      data.descuentoMaxCajeroPct !== undefined &&
      (typeof data.descuentoMaxCajeroPct !== 'number' || data.descuentoMaxCajeroPct < 0 || data.descuentoMaxCajeroPct > 100)
    ) {
      throw new Error('El tope de descuento del cajero debe estar entre 0 % y 100 %');
    }

    const updated = await configuracionRepository.update(data);
    return this.mapToDTO(updated);
  }

  private mapToDTO(raw: any): ConfiguracionDTO {
    return {
      id: raw.id,
      nombreFerreteria: raw.nombreFerreteria,
      rif: raw.rif,
      direccion: raw.direccion,
      telefono: raw.telefono,
      ivaPorcentaje: Number(raw.ivaPorcentaje),
      stockMinimoAlerta: raw.stockMinimoAlerta,
      monedaFuncional: raw.monedaFuncional as Moneda,
      tasaVes: Number(raw.tasaVes),
      tasaCop: Number(raw.tasaCop),
      tasaActualizadaEn: raw.tasaActualizadaEn ?? null,
      tasaVigenciaHoras: raw.tasaVigenciaHoras ?? 12,
      descuentoMaxCajeroPct: raw.descuentoMaxCajeroPct !== undefined ? Number(raw.descuentoMaxCajeroPct) : 10,
      metodosHabilitados: Array.isArray(raw.metodosHabilitados)
        ? (raw.metodosHabilitados as string[])
        : JSON.parse(raw.metodosHabilitados || '[]'),
      updatedAt: raw.updatedAt,
    };
  }
}

export const configuracionService = new ConfiguracionService();
