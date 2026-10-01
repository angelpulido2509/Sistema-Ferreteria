import type { Request, Response } from 'express';
import { categoriaService } from '../services/categoria.service.js';
import type { ApiResponse, CategoriaDTO } from '@ferreteria/shared';

export class CategoriaController {
  public static async getAll(
    _req: Request,
    res: Response<ApiResponse<CategoriaDTO[]>>
  ): Promise<void> {
    try {
      const categorias = await categoriaService.getAll();
      res.status(200).json({
        success: true,
        data: categorias,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener categorías',
      });
    }
  }

  public static async getById(
    req: Request,
    res: Response<ApiResponse<CategoriaDTO>>
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

      const categoria = await categoriaService.getById(id);
      res.status(200).json({
        success: true,
        data: categoria,
        error: null,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Categoría no encontrada',
      });
    }
  }

  public static async create(
    req: Request,
    res: Response<ApiResponse<CategoriaDTO>>
  ): Promise<void> {
    try {
      const { nombre } = req.body;
      const categoria = await categoriaService.create(nombre);
      res.status(201).json({
        success: true,
        data: categoria,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al crear categoría',
      });
    }
  }

  public static async update(
    req: Request,
    res: Response<ApiResponse<CategoriaDTO>>
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

      const { nombre } = req.body;
      const categoria = await categoriaService.update(id, nombre);
      res.status(200).json({
        success: true,
        data: categoria,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al actualizar categoría',
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

      await categoriaService.delete(id);
      res.status(200).json({
        success: true,
        data: null,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al eliminar categoría',
      });
    }
  }
}
