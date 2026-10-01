import { reportesRepository, ReportesRepository } from '../repositories/reportes.repository.js';
import type {
  MetricasResumenDTO,
  VentasDiariasDTO,
  ProductoMasVendidoDTO,
  StockCriticoDTO,
} from '@ferreteria/shared';

export class ReportesService {
  constructor(private readonly repo: ReportesRepository = reportesRepository) {}

  public async getMetricasResumen(): Promise<MetricasResumenDTO> {
    return this.repo.getMetricasResumen();
  }

  public async getVentasDiarias(dias: number = 30): Promise<VentasDiariasDTO[]> {
    const numDias = Math.max(1, Math.min(dias, 365));
    return this.repo.getVentasDiarias(numDias);
  }

  public async getProductosMasVendidos(limite: number = 10): Promise<ProductoMasVendidoDTO[]> {
    const lim = Math.max(1, Math.min(limite, 50));
    return this.repo.getProductosMasVendidos(lim);
  }

  public async getStockCritico(): Promise<StockCriticoDTO[]> {
    return this.repo.getStockCritico();
  }
}

export const reportesService = new ReportesService();
