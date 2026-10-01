import type { Request, Response } from 'express';
import { ventaService } from '../services/venta.service.js';
import type { ApiResponse, VentaDTO } from '@ferreteria/shared';

export class VentaController {
  public static async getAll(
    _req: Request,
    res: Response<ApiResponse<VentaDTO[]>>
  ): Promise<void> {
    try {
      const ventas = await ventaService.getAll();
      res.status(200).json({
        success: true,
        data: ventas,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener historial de ventas',
      });
    }
  }

  public static async getById(
    req: Request,
    res: Response<ApiResponse<VentaDTO>>
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id) {
        res.status(400).json({
          success: false,
          data: null,
          error: 'ID de venta inválido',
        });
        return;
      }

      const venta = await ventaService.getById(id);
      res.status(200).json({
        success: true,
        data: venta,
        error: null,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Venta no encontrada',
      });
    }
  }

  public static async crear(
    req: Request,
    res: Response<ApiResponse<VentaDTO>>
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          data: null,
          error: 'Usuario no autenticado',
        });
        return;
      }

      const venta = await ventaService.crearVenta(req.body, { id: req.user.id, rol: req.user.rol });
      res.status(201).json({
        success: true,
        data: venta,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al procesar la venta',
      });
    }
  }

  public static async anular(
    req: Request,
    res: Response<ApiResponse<VentaDTO>>
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          data: null,
          error: 'Usuario no autenticado',
        });
        return;
      }

      const id = req.params.id as string;
      if (!id) {
        res.status(400).json({
          success: false,
          data: null,
          error: 'ID de venta inválido',
        });
        return;
      }

      const { motivo } = req.body;
      const venta = await ventaService.anularVenta(id, req.user.id, motivo);
      res.status(200).json({
        success: true,
        data: venta,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al anular la venta',
      });
    }
  }

  public static async obtenerComprobante(
    req: Request,
    res: Response<ApiResponse<any>>
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id) {
        res.status(400).json({
          success: false,
          data: null,
          error: 'ID de venta inválido',
        });
        return;
      }

      const comprobante = await ventaService.generarComprobante(id);
      res.status(200).json({
        success: true,
        data: comprobante,
        error: null,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al generar comprobante',
      });
    }
  }
}
