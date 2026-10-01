import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfiguracionService } from './configuracion.service.js';
import { configuracionRepository } from '../repositories/configuracion.repository.js';
import { Moneda, MetodoPago } from '@ferreteria/shared';

vi.mock('../repositories/configuracion.repository.js', () => ({
  configuracionRepository: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

describe('ConfiguracionService', () => {
  let service: ConfiguracionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConfiguracionService();
  });

  it('debe retornar la configuración actual mapeada a DTO', async () => {
    const mockConfig = {
      id: 1,
      nombreFerreteria: 'Ferretería El Tornillo Fuerte',
      rif: 'J-12345678-9',
      direccion: 'Guasdualito, Apure',
      telefono: '0414-1234567',
      ivaPorcentaje: '16.00',
      stockMinimoAlerta: 5,
      monedaFuncional: Moneda.USD,
      tasaVes: '60.0000',
      tasaCop: '4100.0000',
      metodosHabilitados: [MetodoPago.EFECTIVO_USD, MetodoPago.PAGO_MOVIL_VES],
      updatedAt: new Date(),
    };

    vi.mocked(configuracionRepository.get).mockResolvedValue(mockConfig);

    const result = await service.get();
    expect(result.nombreFerreteria).toBe('Ferretería El Tornillo Fuerte');
    expect(result.tasaVes).toBe(60.0);
    expect(result.tasaCop).toBe(4100.0);
    expect(result.ivaPorcentaje).toBe(16.0);
    expect(result.metodosHabilitados).toHaveLength(2);
  });

  it('debe actualizar tasas de cambio correctamente cuando los valores son válidos', async () => {
    const mockUpdated = {
      id: 1,
      nombreFerreteria: 'Ferretería El Tornillo Fuerte',
      rif: 'J-12345678-9',
      direccion: 'Guasdualito, Apure',
      telefono: '0414-1234567',
      ivaPorcentaje: '16.00',
      stockMinimoAlerta: 5,
      monedaFuncional: Moneda.USD,
      tasaVes: '65.5000',
      tasaCop: '4200.0000',
      metodosHabilitados: [MetodoPago.EFECTIVO_USD],
      updatedAt: new Date(),
    };

    vi.mocked(configuracionRepository.update).mockResolvedValue(mockUpdated);

    const result = await service.update({
      tasaVes: 65.5,
      tasaCop: 4200.0,
    });

    expect(result.tasaVes).toBe(65.5);
    expect(result.tasaCop).toBe(4200.0);
    expect(configuracionRepository.update).toHaveBeenCalledWith({
      tasaVes: 65.5,
      tasaCop: 4200.0,
    });
  });

  it('debe rechazar tasas menores o iguales a cero', async () => {
    await expect(service.update({ tasaVes: 0 })).rejects.toThrow(
      'La tasa VES debe ser un número mayor a 0'
    );
    await expect(service.update({ tasaCop: -10 })).rejects.toThrow(
      'La tasa COP debe ser un número mayor a 0'
    );
  });
});
