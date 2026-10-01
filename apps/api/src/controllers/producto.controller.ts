import type { Request, Response } from 'express';
import { productoService } from '../services/producto.service.js';
import type { ApiResponse, ProductoDTO } from '@ferreteria/shared';

export class ProductoController {
  public static async getAll(
    req: Request,
    res: Response<ApiResponse<ProductoDTO[]>>
  ): Promise<void> {
    try {
      const categoriaId = req.query.categoriaId as string | undefined;
      const search = req.query.search as string | undefined;
      const soloActivos = req.query.soloActivos !== 'false';

      const productos = await productoService.getAll({ categoriaId, search, soloActivos });
      res.status(200).json({
        success: true,
        data: productos,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener productos',
      });
    }
  }

  public static async getById(
    req: Request,
    res: Response<ApiResponse<ProductoDTO>>
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id) {
        res.status(400).json({
          success: false,
          data: null,
          error: 'ID inválido',
        });
        return;
      }

      const producto = await productoService.getById(id);
      res.status(200).json({
        success: true,
        data: producto,
        error: null,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Producto no encontrado',
      });
    }
  }

  public static async getStockAlerts(
    _req: Request,
    res: Response<ApiResponse<ProductoDTO[]>>
  ): Promise<void> {
    try {
      const alertas = await productoService.getStockAlerts();
      res.status(200).json({
        success: true,
        data: alertas,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener alertas de stock',
      });
    }
  }

  public static async create(
    req: Request,
    res: Response<ApiResponse<ProductoDTO>>
  ): Promise<void> {
    try {
      const producto = await productoService.create(req.body);
      res.status(201).json({
        success: true,
        data: producto,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al crear producto',
      });
    }
  }

  public static async update(
    req: Request,
    res: Response<ApiResponse<ProductoDTO>>
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id) {
        res.status(400).json({
          success: false,
          data: null,
          error: 'ID inválido',
        });
        return;
      }

      const producto = await productoService.update(id, req.body);
      res.status(200).json({
        success: true,
        data: producto,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al actualizar producto',
      });
    }
  }

  public static async delete(
    req: Request,
    res: Response<ApiResponse<null>>
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id) {
        res.status(400).json({
          success: false,
          data: null,
          error: 'ID inválido',
        });
        return;
      }

      await productoService.delete(id);
      res.status(200).json({
        success: true,
        data: null,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al eliminar producto',
      });
    }
  }

  public static async ajustarStock(
    req: Request,
    res: Response<ApiResponse<ProductoDTO>>
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id) {
        res.status(400).json({
          success: false,
          data: null,
          error: 'ID inválido',
        });
        return;
      }

      const usuarioId = req.user?.id || '1';
      const producto = await productoService.ajustarStock(id, req.body, usuarioId);
      res.status(200).json({
        success: true,
        data: producto,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al ajustar stock',
      });
    }
  }

  public static async getMovimientos(
    req: Request,
    res: Response<ApiResponse<any[]>>
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id) {
        res.status(400).json({
          success: false,
          data: null,
          error: 'ID inválido',
        });
        return;
      }

      const movimientos = await productoService.getMovimientos(id);
      res.status(200).json({
        success: true,
        data: movimientos,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener movimientos',
      });
    }
  }
}
