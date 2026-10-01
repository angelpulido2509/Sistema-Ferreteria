import type { Request, Response } from 'express';
import { clienteService } from '../services/cliente.service.js';
import type { ApiResponse, ClienteDTO } from '@ferreteria/shared';

export class ClienteController {
  public static async getAll(
    req: Request,
    res: Response<ApiResponse<ClienteDTO[]>>
  ): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const clientes = await clienteService.getAll(search);
      res.status(200).json({
        success: true,
        data: clientes,
        error: null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al obtener clientes',
      });
    }
  }

  public static async getById(
    req: Request,
    res: Response<ApiResponse<ClienteDTO>>
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

      const cliente = await clienteService.getById(id);
      res.status(200).json({
        success: true,
        data: cliente,
        error: null,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Cliente no encontrado',
      });
    }
  }

  public static async create(
    req: Request,
    res: Response<ApiResponse<ClienteDTO>>
  ): Promise<void> {
    try {
      const cliente = await clienteService.create(req.body);
      res.status(201).json({
        success: true,
        data: cliente,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al crear cliente',
      });
    }
  }

  public static async update(
    req: Request,
    res: Response<ApiResponse<ClienteDTO>>
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

      const cliente = await clienteService.update(id, req.body);
      res.status(200).json({
        success: true,
        data: cliente,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al actualizar cliente',
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

      await clienteService.delete(id);
      res.status(200).json({
        success: true,
        data: null,
        error: null,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error al eliminar cliente',
      });
    }
  }
}
