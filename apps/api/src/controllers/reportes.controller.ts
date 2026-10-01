import type { Request, Response } from 'express';
import { reportesService } from '../services/reportes.service.js';
import type {
  ApiResponse,
  MetricasResumenDTO,
  VentasDiariasDTO,
  ProductoMasVendidoDTO,
  StockCriticoDTO,
} from '@ferreteria/shared';

export class ReportesController {
  public static async getMetricas(
    _req: Request,
    res: Response<ApiResponse<MetricasResumenDTO>>
  ): Promise<void> {
    try {
      const metricas = await reportesService.getMetricasResumen();
      res.status(200).json({
        success: true,
        data: metricas,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener métricas',
      });
    }
  }

  public static async getVentasDiarias(
    req: Request,
    res: Response<ApiResponse<VentasDiariasDTO[]>>
  ): Promise<void> {
    try {
      const dias = req.query.dias ? parseInt(req.query.dias as string, 10) : 30;
      const ventasDiarias = await reportesService.getVentasDiarias(isNaN(dias) ? 30 : dias);
      res.status(200).json({
        success: true,
        data: ventasDiarias,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener reporte de ventas diarias',
      });
    }
  }

  public static async getProductosMasVendidos(
    req: Request,
    res: Response<ApiResponse<ProductoMasVendidoDTO[]>>
  ): Promise<void> {
    try {
      const limite = req.query.limite ? parseInt(req.query.limite as string, 10) : 10;
      const productos = await reportesService.getProductosMasVendidos(isNaN(limite) ? 10 : limite);
      res.status(200).json({
        success: true,
        data: productos,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener productos más vendidos',
      });
    }
  }

  public static async getStockCritico(
    _req: Request,
    res: Response<ApiResponse<StockCriticoDTO[]>>
  ): Promise<void> {
    try {
      const stock = await reportesService.getStockCritico();
      res.status(200).json({
        success: true,
        data: stock,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener reporte de stock crítico',
      });
    }
  }
}
