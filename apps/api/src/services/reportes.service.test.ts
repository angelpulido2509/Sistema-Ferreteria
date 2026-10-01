import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportesService } from './reportes.service.js';
import type { ReportesRepository } from '../repositories/reportes.repository.js';

describe('ReportesService', () => {
  let reportesService: ReportesService;
  let mockReportesRepo: {
    getMetricasResumen: ReturnType<typeof vi.fn>;
    getVentasDiarias: ReturnType<typeof vi.fn>;
    getProductosMasVendidos: ReturnType<typeof vi.fn>;
    getStockCritico: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockReportesRepo = {
      getMetricasResumen: vi.fn(),
      getVentasDiarias: vi.fn(),
      getProductosMasVendidos: vi.fn(),
      getStockCritico: vi.fn(),
    };

    reportesService = new ReportesService(mockReportesRepo as unknown as ReportesRepository);
  });

  describe('getMetricasResumen', () => {
    it('debe retornar el resumen consolidado de métricas', async () => {
      const mockMetricas = {
        ventasHoy: 5,
        ingresosHoy: 120.5,
        ventasMes: 45,
        ingresosMes: 1450.0,
        ticketPromedio: 32.22,
        productosCriticos: 3,
        totalClientes: 12,
      };

      mockReportesRepo.getMetricasResumen.mockResolvedValue(mockMetricas);

      const resultado = await reportesService.getMetricasResumen();

      expect(mockReportesRepo.getMetricasResumen).toHaveBeenCalledTimes(1);
      expect(resultado).toEqual(mockMetricas);
      expect(resultado.ingresosHoy).toBe(120.5);
    });
  });

  describe('getVentasDiarias', () => {
    it('debe consultar ventas diarias con el número de días solicitado', async () => {
      const mockVentas = [
        { fecha: '2026-03-01', totalVentas: 3, montoTotal: 150.0, totalArticulos: 6 },
        { fecha: '2026-03-02', totalVentas: 5, montoTotal: 280.0, totalArticulos: 12 },
      ];

      mockReportesRepo.getVentasDiarias.mockResolvedValue(mockVentas);

      const resultado = await reportesService.getVentasDiarias(15);

      expect(mockReportesRepo.getVentasDiarias).toHaveBeenCalledWith(15);
      expect(resultado).toHaveLength(2);
      expect(resultado[0]?.montoTotal).toBe(150.0);
    });

    it('debe acotar el número de días dentro del rango válido (1 a 365)', async () => {
      mockReportesRepo.getVentasDiarias.mockResolvedValue([]);

      await reportesService.getVentasDiarias(0);
      expect(mockReportesRepo.getVentasDiarias).toHaveBeenCalledWith(1);

      await reportesService.getVentasDiarias(500);
      expect(mockReportesRepo.getVentasDiarias).toHaveBeenCalledWith(365);
    });
  });

  describe('getProductosMasVendidos', () => {
    it('debe retornar los productos más vendidos respetando el límite', async () => {
      const mockTop = [
        {
          productoId: 1,
          codigo: 'MART-01',
          nombre: 'Martillo',
          cantidadVendida: 25,
          totalGenerado: 300.0,
        },
      ];

      mockReportesRepo.getProductosMasVendidos.mockResolvedValue(mockTop);

      const resultado = await reportesService.getProductosMasVendidos(5);

      expect(mockReportesRepo.getProductosMasVendidos).toHaveBeenCalledWith(5);
      expect(resultado).toEqual(mockTop);
    });
  });

  describe('getStockCritico', () => {
    it('debe retornar la lista de productos en stock crítico ordenados por deficiencia', async () => {
      const mockCriticos = [
        {
          productoId: 3,
          codigo: 'CLAV-01',
          nombre: 'Clavos',
          categoria: 'Fijaciones',
          stockActual: 1,
          stockMinimo: 10,
          unidadMedida: 'CAJ',
          deficiencia: 9,
        },
      ];

      mockReportesRepo.getStockCritico.mockResolvedValue(mockCriticos);

      const resultado = await reportesService.getStockCritico();

      expect(mockReportesRepo.getStockCritico).toHaveBeenCalledTimes(1);
      expect(resultado[0]?.deficiencia).toBe(9);
    });
  });
});
