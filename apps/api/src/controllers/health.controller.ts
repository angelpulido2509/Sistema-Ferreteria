import type { Request, Response } from 'express';
import type { ApiResponse } from '@ferreteria/shared';

export class HealthController {
  public static getStatus(_req: Request, res: Response<ApiResponse<{ status: string; uptime: number; timestamp: string }>>): void {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      error: null,
    });
  }
}
