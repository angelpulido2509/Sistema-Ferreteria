import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client-local';
import {
  EstadoTurnoCaja,
  TipoMovimientoCaja,
  Moneda,
  MetodoPago,
  type TurnoCajaDTO,
  type AbrirCajaDTO,
  type MovimientoCajaDTO,
  type CrearMovimientoCajaDTO,
  type CerrarCajaDTO,
  type ResumenArqueoDTO,
} from '@ferreteria/shared';

export class CajaService {
  /**
   * Mapea un registro de Prisma a TurnoCajaDTO
   */
  private mapToDTO(t: any): TurnoCajaDTO {
    return {
      id: t.id,
      cajaNumero: t.cajaNumero,
      usuarioAperturaId: t.usuarioAperturaId,
      usuarioApertura: t.usuarioApertura
        ? {
            id: t.usuarioApertura.id,
            nombre: t.usuarioApertura.nombre,
            email: t.usuarioApertura.email,
            rol: t.usuarioApertura.rol,
            activo: t.usuarioApertura.activo,
            createdAt: t.usuarioApertura.createdAt,
            updatedAt: t.usuarioApertura.updatedAt,
          }
        : undefined,
      usuarioCierreId: t.usuarioCierreId,
      usuarioCierre: t.usuarioCierre
        ? {
            id: t.usuarioCierre.id,
            nombre: t.usuarioCierre.nombre,
            email: t.usuarioCierre.email,
            rol: t.usuarioCierre.rol,
            activo: t.usuarioCierre.activo,
            createdAt: t.usuarioCierre.createdAt,
            updatedAt: t.usuarioCierre.updatedAt,
          }
        : undefined,
      estado: t.estado as EstadoTurnoCaja,
      fechaApertura: t.fechaApertura,
      fechaCierre: t.fechaCierre,
      montoInicialUsd: Number(t.montoInicialUsd ?? 0),
      montoInicialCop: Number(t.montoInicialCop ?? 0),
      montoInicialVes: Number(t.montoInicialVes ?? 0),
      conteoFisicoUsd: t.conteoFisicoUsd !== null ? Number(t.conteoFisicoUsd) : null,
      conteoFisicoCop: t.conteoFisicoCop !== null ? Number(t.conteoFisicoCop) : null,
      conteoFisicoVes: t.conteoFisicoVes !== null ? Number(t.conteoFisicoVes) : null,
      ventasTotalesUsd: t.ventasTotalesUsd !== null ? Number(t.ventasTotalesUsd) : null,
      ventasEfectivoUsd: t.ventasEfectivoUsd !== null ? Number(t.ventasEfectivoUsd) : null,
      ventasEfectivoCop: t.ventasEfectivoCop !== null ? Number(t.ventasEfectivoCop) : null,
      ventasPagoMovilVes: t.ventasPagoMovilVes !== null ? Number(t.ventasPagoMovilVes) : null,
      ventasTarjetaVes: t.ventasTarjetaVes !== null ? Number(t.ventasTarjetaVes) : null,
      ventasZelleUsd: t.ventasZelleUsd !== null ? Number(t.ventasZelleUsd) : null,
      ingresosManualesUsd: t.ingresosManualesUsd !== null ? Number(t.ingresosManualesUsd) : null,
      egresosManualesUsd: t.egresosManualesUsd !== null ? Number(t.egresosManualesUsd) : null,
      ingresosManualesCop: t.ingresosManualesCop !== null ? Number(t.ingresosManualesCop) : null,
      egresosManualesCop: t.egresosManualesCop !== null ? Number(t.egresosManualesCop) : null,
      ingresosManualesVes: t.ingresosManualesVes !== null ? Number(t.ingresosManualesVes) : null,
      egresosManualesVes: t.egresosManualesVes !== null ? Number(t.egresosManualesVes) : null,
      diferenciaUsd: t.diferenciaUsd !== null ? Number(t.diferenciaUsd) : null,
      diferenciaCop: t.diferenciaCop !== null ? Number(t.diferenciaCop) : null,
      diferenciaVes: t.diferenciaVes !== null ? Number(t.diferenciaVes) : null,
      observaciones: t.observaciones,
      movimientos: t.movimientos?.map((m: any) => ({
        id: m.id,
        turnoCajaId: m.turnoCajaId,
        usuarioId: m.usuarioId,
        tipo: m.tipo as TipoMovimientoCaja,
        monto: Number(m.monto),
        moneda: m.moneda as Moneda,
        motivo: m.motivo,
        fecha: m.fecha,
        usuario: m.usuario ? { id: m.usuario.id, nombre: m.usuario.nombre } : undefined,
      })),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  /**
   * Obtiene el turno activo actual
   */
  public async getTurnoActivo(_usuarioId?: string): Promise<TurnoCajaDTO | null> {
    const turno = await prisma.turnoCaja.findFirst({
      where: {
        estado: EstadoTurnoCaja.ABIERTO,
      },
      include: {
        usuarioApertura: true,
        usuarioCierre: true,
        movimientos: {
          include: { usuario: { select: { id: true, nombre: true } } },
          orderBy: { fecha: 'asc' },
        },
      },
      orderBy: { fechaApertura: 'desc' },
    });

    return turno ? this.mapToDTO(turno) : null;
  }

  /**
   * Abre un nuevo turno de caja
   */
  public async abrirTurno(usuarioId: string, data: AbrirCajaDTO): Promise<TurnoCajaDTO> {
    // Validar que no haya un turno abierto actualmente
    const abierto = await prisma.turnoCaja.findFirst({
      where: { estado: EstadoTurnoCaja.ABIERTO },
    });

    if (abierto) {
      throw new Error(`Ya existe un turno de caja abierto (#${abierto.cajaNumero}). Debes cerrarlo antes de iniciar otro.`);
    }

    if (data.montoInicialUsd < 0 || data.montoInicialCop < 0 || (data.montoInicialVes ?? 0) < 0) {
      throw new Error('Los fondos iniciales de caja no pueden ser negativos.');
    }

    const turno = await prisma.turnoCaja.create({
      data: {
        cajaNumero: data.cajaNumero?.trim() || 'Caja 1',
        usuarioAperturaId: usuarioId,
        estado: EstadoTurnoCaja.ABIERTO,
        montoInicialUsd: new Prisma.Decimal((data.montoInicialUsd || 0).toFixed(2)),
        montoInicialCop: new Prisma.Decimal((data.montoInicialCop || 0).toFixed(2)),
        montoInicialVes: new Prisma.Decimal((data.montoInicialVes || 0).toFixed(2)),
      },
      include: {
        usuarioApertura: true,
        usuarioCierre: true,
        movimientos: true,
      },
    });

    return this.mapToDTO(turno);
  }

  /**
   * Registra un ingreso o egreso manual de caja menor
   */
  public async registrarMovimiento(usuarioId: string, data: CrearMovimientoCajaDTO): Promise<MovimientoCajaDTO> {
    const turno = await prisma.turnoCaja.findUnique({
      where: { id: data.turnoCajaId },
    });

    if (!turno) {
      throw new Error('Turno de caja no encontrado');
    }

    if (turno.estado !== EstadoTurnoCaja.ABIERTO) {
      throw new Error('El turno de caja ya se encuentra cerrado. No se admiten nuevos movimientos.');
    }

    if (data.monto <= 0) {
      throw new Error('El monto del movimiento debe ser mayor a 0');
    }

    if (!data.motivo || !data.motivo.trim()) {
      throw new Error('El motivo del movimiento es obligatorio para efectos de auditoría');
    }

    const mov = await prisma.movimientoCaja.create({
      data: {
        turnoCajaId: data.turnoCajaId,
        usuarioId,
        tipo: data.tipo,
        monto: new Prisma.Decimal(data.monto.toFixed(2)),
        moneda: data.moneda,
        motivo: data.motivo.trim(),
      },
      include: {
        usuario: { select: { id: true, nombre: true } },
      },
    });

    return {
      id: mov.id,
      turnoCajaId: mov.turnoCajaId,
      usuarioId: mov.usuarioId,
      tipo: mov.tipo as TipoMovimientoCaja,
      monto: Number(mov.monto),
      moneda: mov.moneda as Moneda,
      motivo: mov.motivo,
      fecha: mov.fecha,
      usuario: mov.usuario ? { id: mov.usuario.id, nombre: mov.usuario.nombre } : undefined,
    };
  }

  /**
   * Calcula el arqueo y balance actual del turno (Reporte X parcial o base de Reporte Z)
   */
  public async calcularResumenTurno(turnoCajaId: string): Promise<ResumenArqueoDTO> {
    const turno = await prisma.turnoCaja.findUnique({
      where: { id: turnoCajaId },
      include: {
        usuarioApertura: true,
        usuarioCierre: true,
        movimientos: {
          include: { usuario: { select: { id: true, nombre: true } } },
          orderBy: { fecha: 'asc' },
        },
      },
    });

    if (!turno) {
      throw new Error('Turno de caja no encontrado');
    }

    // Obtener ventas asociadas al turno (o completadas dentro del intervalo de tiempo del turno)
    const fechaFin = turno.fechaCierre || new Date();
    const ventasTurno = await prisma.venta.findMany({
      where: {
        OR: [
          { turnoCajaId: turno.id },
          {
            fecha: {
              gte: turno.fechaApertura,
              lte: fechaFin,
            },
          },
        ],
        estado: 'COMPLETADA',
      },
      include: {
        pagos: true,
      },
    });

    // Desglose de ventas por método
    const ventasPorMetodo = {
      efectivoUsd: { monto: 0, transacciones: 0 },
      efectivoCop: { monto: 0, transacciones: 0 },
      pagoMovilVes: { monto: 0, transacciones: 0 },
      tarjetaVes: { monto: 0, transacciones: 0 },
      zelleUsd: { monto: 0, transacciones: 0 },
      totalVentasUsd: 0,
      totalTransacciones: ventasTurno.length,
    };

    for (const v of ventasTurno) {
      ventasPorMetodo.totalVentasUsd += Number(v.totalUsd ?? v.total);

      if (v.pagos && v.pagos.length > 0) {
        for (const p of v.pagos) {
          const montoMoneda = Number(p.montoMoneda);
          if (p.metodoPago === MetodoPago.EFECTIVO_USD) {
            ventasPorMetodo.efectivoUsd.monto += montoMoneda;
            ventasPorMetodo.efectivoUsd.transacciones++;
          } else if (p.metodoPago === MetodoPago.EFECTIVO_COP) {
            ventasPorMetodo.efectivoCop.monto += montoMoneda;
            ventasPorMetodo.efectivoCop.transacciones++;
          } else if (p.metodoPago === MetodoPago.PAGO_MOVIL_VES) {
            ventasPorMetodo.pagoMovilVes.monto += montoMoneda;
            ventasPorMetodo.pagoMovilVes.transacciones++;
          } else if (p.metodoPago === MetodoPago.TARJETA_VES) {
            ventasPorMetodo.tarjetaVes.monto += montoMoneda;
            ventasPorMetodo.tarjetaVes.transacciones++;
          } else if (p.metodoPago === MetodoPago.ZELLE_USD) {
            ventasPorMetodo.zelleUsd.monto += montoMoneda;
            ventasPorMetodo.zelleUsd.transacciones++;
          } else {
            // Fallback
            ventasPorMetodo.efectivoUsd.monto += Number(p.montoUsd);
            ventasPorMetodo.efectivoUsd.transacciones++;
          }
        }
      } else {
        ventasPorMetodo.efectivoUsd.monto += Number(v.total);
        ventasPorMetodo.efectivoUsd.transacciones++;
      }
    }

    // Redondear totales de ventas
    ventasPorMetodo.totalVentasUsd = Math.round(ventasPorMetodo.totalVentasUsd * 100) / 100;
    ventasPorMetodo.efectivoUsd.monto = Math.round(ventasPorMetodo.efectivoUsd.monto * 100) / 100;
    ventasPorMetodo.pagoMovilVes.monto = Math.round(ventasPorMetodo.pagoMovilVes.monto * 100) / 100;
    ventasPorMetodo.tarjetaVes.monto = Math.round(ventasPorMetodo.tarjetaVes.monto * 100) / 100;
    ventasPorMetodo.zelleUsd.monto = Math.round(ventasPorMetodo.zelleUsd.monto * 100) / 100;

    // Desglose de movimientos manuales
    const movimientosManuales = {
      ingresosUsd: 0,
      egresosUsd: 0,
      ingresosCop: 0,
      egresosCop: 0,
      ingresosVes: 0,
      egresosVes: 0,
      lista: turno.movimientos.map((m: any) => ({
        id: m.id,
        turnoCajaId: m.turnoCajaId,
        usuarioId: m.usuarioId,
        tipo: m.tipo as TipoMovimientoCaja,
        monto: Number(m.monto),
        moneda: m.moneda as Moneda,
        motivo: m.motivo,
        fecha: m.fecha,
        usuario: m.usuario ? { id: m.usuario.id, nombre: m.usuario.nombre } : undefined,
      })),
    };

    for (const m of turno.movimientos) {
      const monto = Number(m.monto);
      if (m.tipo === TipoMovimientoCaja.INGRESO) {
        if (m.moneda === Moneda.USD) movimientosManuales.ingresosUsd += monto;
        else if (m.moneda === Moneda.COP) movimientosManuales.ingresosCop += monto;
        else if (m.moneda === Moneda.VES) movimientosManuales.ingresosVes += monto;
      } else {
        if (m.moneda === Moneda.USD) movimientosManuales.egresosUsd += monto;
        else if (m.moneda === Moneda.COP) movimientosManuales.egresosCop += monto;
        else if (m.moneda === Moneda.VES) movimientosManuales.egresosVes += monto;
      }
    }

    const fondosIniciales = {
      usd: Number(turno.montoInicialUsd ?? 0),
      cop: Number(turno.montoInicialCop ?? 0),
      ves: Number(turno.montoInicialVes ?? 0),
    };

    // Dinero esperado en gaveta = Fondo Inicial + Ventas en Efectivo + Ingresos Manuales - Egresos Manuales
    const esperadoEnCaja = {
      efectivoUsd:
        Math.round(
          (fondosIniciales.usd +
            ventasPorMetodo.efectivoUsd.monto +
            movimientosManuales.ingresosUsd -
            movimientosManuales.egresosUsd) *
            100
        ) / 100,
      efectivoCop: Math.round(
        fondosIniciales.cop +
          ventasPorMetodo.efectivoCop.monto +
          movimientosManuales.ingresosCop -
          movimientosManuales.egresosCop
      ),
      efectivoVes:
        Math.round(
          (fondosIniciales.ves +
            movimientosManuales.ingresosVes -
            movimientosManuales.egresosVes) *
            100
        ) / 100,
    };

    const turnoDTO = this.mapToDTO(turno);

    let conteoFisico: { usd: number; cop: number; ves: number } | undefined = undefined;
    let diferencias: { usd: number; cop: number; ves: number } | undefined = undefined;

    if (turnoDTO.conteoFisicoUsd !== null && turnoDTO.conteoFisicoUsd !== undefined) {
      conteoFisico = {
        usd: turnoDTO.conteoFisicoUsd,
        cop: turnoDTO.conteoFisicoCop ?? 0,
        ves: turnoDTO.conteoFisicoVes ?? 0,
      };
      diferencias = {
        usd: Math.round((conteoFisico.usd - esperadoEnCaja.efectivoUsd) * 100) / 100,
        cop: Math.round(conteoFisico.cop - esperadoEnCaja.efectivoCop),
        ves: Math.round((conteoFisico.ves - esperadoEnCaja.efectivoVes) * 100) / 100,
      };
    }

    return {
      turnoCaja: turnoDTO,
      fondosIniciales,
      ventasPorMetodo,
      movimientosManuales,
      esperadoEnCaja,
      conteoFisico,
      diferencias,
    };
  }

  /**
   * Cierra definitivamente el turno (Reporte Z) tras conteo ciego
   */
  public async cerrarTurno(usuarioId: string, data: CerrarCajaDTO): Promise<ResumenArqueoDTO> {
    const turno = await prisma.turnoCaja.findUnique({
      where: { id: data.turnoCajaId },
    });

    if (!turno) {
      throw new Error('Turno de caja no encontrado');
    }

    if (turno.estado === EstadoTurnoCaja.CERRADO) {
      throw new Error('Este turno de caja ya fue cerrado previamente.');
    }

    if (data.conteoFisicoUsd < 0 || data.conteoFisicoCop < 0 || (data.conteoFisicoVes ?? 0) < 0) {
      throw new Error('El conteo físico de billetes no puede ser negativo.');
    }

    // Calcular resumen previo al cierre
    const resumen = await this.calcularResumenTurno(data.turnoCajaId);

    const diferenciaUsd =
      Math.round((data.conteoFisicoUsd - resumen.esperadoEnCaja.efectivoUsd) * 100) / 100;
    const diferenciaCop = Math.round(data.conteoFisicoCop - resumen.esperadoEnCaja.efectivoCop);
    const diferenciaVes =
      Math.round(((data.conteoFisicoVes || 0) - resumen.esperadoEnCaja.efectivoVes) * 100) / 100;

    await prisma.turnoCaja.update({
      where: { id: data.turnoCajaId },
      data: {
        estado: EstadoTurnoCaja.CERRADO,
        usuarioCierreId: usuarioId,
        fechaCierre: new Date(),
        conteoFisicoUsd: new Prisma.Decimal(data.conteoFisicoUsd.toFixed(2)),
        conteoFisicoCop: new Prisma.Decimal(data.conteoFisicoCop.toFixed(2)),
        conteoFisicoVes: new Prisma.Decimal((data.conteoFisicoVes || 0).toFixed(2)),
        ventasTotalesUsd: new Prisma.Decimal(resumen.ventasPorMetodo.totalVentasUsd.toFixed(2)),
        ventasEfectivoUsd: new Prisma.Decimal(resumen.ventasPorMetodo.efectivoUsd.monto.toFixed(2)),
        ventasEfectivoCop: new Prisma.Decimal(resumen.ventasPorMetodo.efectivoCop.monto.toFixed(2)),
        ventasPagoMovilVes: new Prisma.Decimal(resumen.ventasPorMetodo.pagoMovilVes.monto.toFixed(2)),
        ventasTarjetaVes: new Prisma.Decimal(resumen.ventasPorMetodo.tarjetaVes.monto.toFixed(2)),
        ventasZelleUsd: new Prisma.Decimal(resumen.ventasPorMetodo.zelleUsd.monto.toFixed(2)),
        ingresosManualesUsd: new Prisma.Decimal(resumen.movimientosManuales.ingresosUsd.toFixed(2)),
        egresosManualesUsd: new Prisma.Decimal(resumen.movimientosManuales.egresosUsd.toFixed(2)),
        ingresosManualesCop: new Prisma.Decimal(resumen.movimientosManuales.ingresosCop.toFixed(2)),
        egresosManualesCop: new Prisma.Decimal(resumen.movimientosManuales.egresosCop.toFixed(2)),
        ingresosManualesVes: new Prisma.Decimal(resumen.movimientosManuales.ingresosVes.toFixed(2)),
        egresosManualesVes: new Prisma.Decimal(resumen.movimientosManuales.egresosVes.toFixed(2)),
        diferenciaUsd: new Prisma.Decimal(diferenciaUsd.toFixed(2)),
        diferenciaCop: new Prisma.Decimal(diferenciaCop.toFixed(2)),
        diferenciaVes: new Prisma.Decimal(diferenciaVes.toFixed(2)),
        observaciones: data.observaciones?.trim() || null,
      },
    });

    // Retornar resumen completo actualizado
    return await this.calcularResumenTurno(data.turnoCajaId);
  }

  /**
   * Consulta el historial de turnos cerrados para auditoría
   */
  public async getHistorialTurnos(limite: number = 30): Promise<TurnoCajaDTO[]> {
    const turnos = await prisma.turnoCaja.findMany({
      take: limite,
      orderBy: { fechaApertura: 'desc' },
      include: {
        usuarioApertura: true,
        usuarioCierre: true,
        movimientos: {
          include: { usuario: { select: { id: true, nombre: true } } },
        },
      },
    });

    return turnos.map((t: any) => this.mapToDTO(t));
  }

  /**
   * Obtiene un turno específico por ID
   */
  public async getTurnoById(id: string): Promise<TurnoCajaDTO> {
    const turno = await prisma.turnoCaja.findUnique({
      where: { id },
      include: {
        usuarioApertura: true,
        usuarioCierre: true,
        movimientos: {
          include: { usuario: { select: { id: true, nombre: true } } },
          orderBy: { fecha: 'asc' },
        },
      },
    });

    if (!turno) {
      throw new Error(`Turno #${id} no encontrado`);
    }

    return this.mapToDTO(turno);
  }
}

export const cajaService = new CajaService();
