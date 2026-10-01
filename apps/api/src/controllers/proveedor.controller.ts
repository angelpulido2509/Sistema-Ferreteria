import type { Request, Response } from 'express';
import { proveedorService } from '../services/proveedor.service.js';
import type { ApiResponse, ProveedorDTO } from '@ferreteria/shared';

export class ProveedorController {
  public static async getAll(
    req: Request,
    res: Response<ApiResponse<ProveedorDTO[]>>
  ): Promise<void> {
    try {
      const soloActivos = req.query.soloActivos !== 'false';
      const proveedores = await proveedorService.getAll(soloActivos);
      res.status(200).json({
        success: true,
        data: proveedores,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener proveedores',
      });
    }
  }

  public static async getById(
    req: Request,
    res: Response<ApiResponse<ProveedorDTO>>
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

      const proveedor = await proveedorService.getById(id);
      res.status(200).json({
        success: true,
        data: proveedor,
        error: null,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Proveedor no encontrado',
      });
    }
  }

  public static async create(
    req: Request,
    res: Response<ApiResponse<ProveedorDTO>>
  ): Promise<void> {
    try {
      const proveedor = await proveedorService.create(req.body);
      res.status(201).json({
        success: true,
        data: proveedor,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al crear proveedor',
      });
    }
  }

  public static async update(
    req: Request,
    res: Response<ApiResponse<ProveedorDTO>>
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

      const proveedor = await proveedorService.update(id, req.body);
      res.status(200).json({
        success: true,
        data: proveedor,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al actualizar proveedor',
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

      await proveedorService.delete(id);
      res.status(200).json({
        success: true,
        data: null,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al eliminar proveedor',
      });
    }
  }
}
