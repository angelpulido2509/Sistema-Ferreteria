import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client-local';
import { transaccionEscritura } from '../lib/transaccion.js';
import { backupService } from './backup.service.js';
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
  MONEDA_POR_METODO,
  METODOS_EFECTIVO,
  RolUsuario,
} from '@ferreteria/shared';
import { aMinimo, decimalAMinimo, desdeMinimo, minimoADecimal, type CodigoMoneda } from '../config/money.js';

/** Usuario que opera la caja (rol vigente en BD, de req.user). */
export interface UsuarioCaja {
  id: string;
  rol: RolUsuario;
}

type ClienteBd = Prisma.TransactionClient;

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
      vueltoUsd: t.vueltoUsd != null ? Number(t.vueltoUsd) : null,
      vueltoCop: t.vueltoCop != null ? Number(t.vueltoCop) : null,
      vueltoVes: t.vueltoVes != null ? Number(t.vueltoVes) : null,
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
  public async getTurnoActivo(usuarioId: string): Promise<TurnoCajaDTO | null> {
    // F4: cada cajero tiene su propio turno (ya no hay un findFirst global)
    const turno = await prisma.turnoCaja.findFirst({
      where: {
        estado: EstadoTurnoCaja.ABIERTO,
        usuarioAperturaId: usuarioId,
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
    if (data.montoInicialUsd < 0 || data.montoInicialCop < 0 || (data.montoInicialVes ?? 0) < 0) {
      throw new Error('Los fondos iniciales de caja no pueden ser negativos.');
    }

    const cajaNumero = data.cajaNumero?.trim() || 'Caja 1';
    const turno = await transaccionEscritura(async (tx) => {
      // F4: un turno abierto por cajero y uno por caja
      const abiertos = { in: [EstadoTurnoCaja.ABIERTO, EstadoTurnoCaja.CERRANDO] };
      const propio = await tx.turnoCaja.findFirst({ where: { usuarioAperturaId: usuarioId, estado: abiertos } });
      if (propio) {
        throw new Error(`Ya tiene un turno abierto en ${propio.cajaNumero}. Ciérrelo antes de iniciar otro.`);
      }
      const enCaja = await tx.turnoCaja.findFirst({ where: { cajaNumero, estado: abiertos } });
      if (enCaja) {
        throw new Error(`La ${cajaNumero} ya tiene un turno abierto por otro usuario.`);
      }
      return tx.turnoCaja.create({
      data: {
        cajaNumero,
        usuarioAperturaId: usuarioId,
        estado: EstadoTurnoCaja.ABIERTO,
        montoInicialUsd: minimoADecimal(aMinimo(data.montoInicialUsd || 0, 'USD'), 'USD'),
        montoInicialCop: minimoADecimal(aMinimo(data.montoInicialCop || 0, 'COP'), 'COP'),
        montoInicialVes: minimoADecimal(aMinimo(data.montoInicialVes || 0, 'VES'), 'VES'),
      },
      include: {
        usuarioApertura: true,
        usuarioCierre: true,
        movimientos: true,
      },
      });
    });

    return this.mapToDTO(turno);
  }

  /**
   * Registra un ingreso o egreso manual de caja menor
   */
  public async registrarMovimiento(usuario: UsuarioCaja, data: CrearMovimientoCajaDTO): Promise<MovimientoCajaDTO> {
    const usuarioId = usuario.id;
    const turno = await prisma.turnoCaja.findUnique({
      where: { id: data.turnoCajaId },
    });

    if (!turno) {
      throw new Error('Turno de caja no encontrado');
    }

    if (turno.estado !== EstadoTurnoCaja.ABIERTO) {
      throw new Error('El turno de caja ya se encuentra cerrado. No se admiten nuevos movimientos.');
    }

    if (usuario.rol !== RolUsuario.ADMIN && turno.usuarioAperturaId !== usuario.id) {
      throw new Error('Solo quien abrió el turno o un administrador puede registrar movimientos en él.');
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
        monto: minimoADecimal(aMinimo(data.monto, data.moneda as CodigoMoneda), data.moneda as CodigoMoneda),
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
   * Calcula el arqueo y balance actual del turno (Reporte X parcial o base de Reporte Z).
   *
   * Efectivo esperado en gaveta, por moneda (F3):
   *
   *   esperado = fondo inicial
   *            + Σ montoRecibido de los pagos en EFECTIVO de esa moneda
   *            − Σ vuelto entregado en esa moneda
   *            + ingresos manuales − egresos manuales
   *
   * Como el vuelto solo sale de pagos en efectivo, equivale a fondo + Σ neto (montoMoneda) de los
   * pagos en efectivo + ingresos − egresos. Zelle, Nequi, pago móvil y punto de venta no entran al
   * cuadre físico. Todo se suma en unidades mínimas enteras (money.ts).
   */
  public async calcularResumenTurno(turnoCajaId: string, db: ClienteBd = prisma): Promise<ResumenArqueoDTO> {
    const turno = await db.turnoCaja.findUnique({
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

    // F6: SOLO las ventas de este turno. El antiguo OR por rango de fechas mezclaba ventas
    // de otras cajas/turnos que se solapaban en el tiempo.
    // F5: en un turno CERRADO también cuentan las ventas anuladas DESPUÉS del cierre (estaban
    // completadas cuando se emitió el Z): así el Z es reproducible y su ajuste vive en otro turno.
    const anuladasTrasCierre =
      turno.estado === EstadoTurnoCaja.CERRADO && turno.fechaCierre
        ? [{ estado: 'ANULADA' as const, fechaAnulacion: { gt: turno.fechaCierre } }]
        : [];
    const ventasTurno = await db.venta.findMany({
      where: {
        turnoCajaId: turno.id,
        OR: [{ estado: 'COMPLETADA' as const }, ...anuladasTrasCierre],
      },
      include: {
        pagos: true,
      },
    });

    const porMetodo = Object.fromEntries(
      Object.values(MetodoPago).map((m) => [m, { monto: 0, transacciones: 0 }])
    ) as Record<MetodoPago, { monto: number; transacciones: number }>;
    const cero = (): Record<CodigoMoneda, number> => ({ USD: 0, COP: 0, VES: 0 });
    const recibidoEfectivo = cero();
    const vuelto = cero();
    let totalVentasCentavos = 0;

    for (const v of ventasTurno) {
      totalVentasCentavos += decimalAMinimo(v.totalUsd ?? v.total, 'USD');
      for (const p of v.pagos) {
        const moneda = p.moneda as CodigoMoneda;
        const metodo = p.metodoPago as MetodoPago;
        porMetodo[metodo].monto += decimalAMinimo(p.montoMoneda, moneda);
        porMetodo[metodo].transacciones++;
        if (METODOS_EFECTIVO.includes(metodo)) {
          recibidoEfectivo[moneda] += decimalAMinimo(p.montoRecibido, moneda);
        }
        vuelto[moneda] += decimalAMinimo(p.vuelto, moneda);
      }
    }

    const metodoDTO = (m: MetodoPago) => ({
      monto: desdeMinimo(porMetodo[m].monto, MONEDA_POR_METODO[m] as CodigoMoneda),
      transacciones: porMetodo[m].transacciones,
    });
    const ventasPorMetodo = {
      efectivoUsd: metodoDTO(MetodoPago.EFECTIVO_USD),
      efectivoCop: metodoDTO(MetodoPago.EFECTIVO_COP),
      pagoMovilVes: metodoDTO(MetodoPago.PAGO_MOVIL_VES),
      tarjetaVes: metodoDTO(MetodoPago.TARJETA_VES),
      zelleUsd: metodoDTO(MetodoPago.ZELLE_USD),
      nequiCop: metodoDTO(MetodoPago.NEQUI_COP),
      totalVentasUsd: desdeMinimo(totalVentasCentavos, 'USD'),
      totalTransacciones: ventasTurno.length,
    };

    // Movimientos manuales por moneda
    const ingresos = cero();
    const egresos = cero();
    for (const m of turno.movimientos) {
      const moneda = m.moneda as CodigoMoneda;
      const monto = decimalAMinimo(m.monto, moneda);
      if (m.tipo === TipoMovimientoCaja.INGRESO) ingresos[moneda] += monto;
      else egresos[moneda] += monto;
    }
    const movimientosManuales = {
      ingresosUsd: desdeMinimo(ingresos.USD, 'USD'),
      egresosUsd: desdeMinimo(egresos.USD, 'USD'),
      ingresosCop: desdeMinimo(ingresos.COP, 'COP'),
      egresosCop: desdeMinimo(egresos.COP, 'COP'),
      ingresosVes: desdeMinimo(ingresos.VES, 'VES'),
      egresosVes: desdeMinimo(egresos.VES, 'VES'),
      lista: turno.movimientos.map((m) => ({
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

    const fondo: Record<CodigoMoneda, number> = {
      USD: decimalAMinimo(turno.montoInicialUsd, 'USD'),
      COP: decimalAMinimo(turno.montoInicialCop, 'COP'),
      VES: decimalAMinimo(turno.montoInicialVes, 'VES'),
    };
    const esperado = (m: CodigoMoneda) => fondo[m] + recibidoEfectivo[m] - vuelto[m] + ingresos[m] - egresos[m];

    const fondosIniciales = {
      usd: desdeMinimo(fondo.USD, 'USD'),
      cop: desdeMinimo(fondo.COP, 'COP'),
      ves: desdeMinimo(fondo.VES, 'VES'),
    };
    const esperadoEnCaja = {
      efectivoUsd: desdeMinimo(esperado('USD'), 'USD'),
      efectivoCop: desdeMinimo(esperado('COP'), 'COP'),
      efectivoVes: desdeMinimo(esperado('VES'), 'VES'),
    };
    const vueltoEntregado = {
      usd: desdeMinimo(vuelto.USD, 'USD'),
      cop: desdeMinimo(vuelto.COP, 'COP'),
      ves: desdeMinimo(vuelto.VES, 'VES'),
    };

    const turnoDTO = this.mapToDTO(turno);

    let conteoFisico: { usd: number; cop: number; ves: number } | undefined = undefined;
    let diferencias: { usd: number; cop: number; ves: number } | undefined = undefined;

    if (turno.conteoFisicoUsd !== null) {
      const conteo: Record<CodigoMoneda, number> = {
        USD: decimalAMinimo(turno.conteoFisicoUsd, 'USD'),
        COP: decimalAMinimo(turno.conteoFisicoCop, 'COP'),
        VES: decimalAMinimo(turno.conteoFisicoVes, 'VES'),
      };
      conteoFisico = {
        usd: desdeMinimo(conteo.USD, 'USD'),
        cop: desdeMinimo(conteo.COP, 'COP'),
        ves: desdeMinimo(conteo.VES, 'VES'),
      };
      diferencias = {
        usd: desdeMinimo(conteo.USD - esperado('USD'), 'USD'),
        cop: desdeMinimo(conteo.COP - esperado('COP'), 'COP'),
        ves: desdeMinimo(conteo.VES - esperado('VES'), 'VES'),
      };
    }

    return {
      turnoCaja: turnoDTO,
      fondosIniciales,
      ventasPorMetodo,
      movimientosManuales,
      vueltoEntregado,
      esperadoEnCaja,
      conteoFisico,
      diferencias,
    };
  }

  /**
   * Cierra definitivamente el turno (Reporte Z) tras conteo ciego. Atómico (F4):
   *  1. La primera sentencia marca el turno CERRANDO solo si sigue ABIERTO (y es propio, salvo ADMIN).
   *     Esa escritura toma el bloqueo de SQLite: las ventas en curso terminan antes y las nuevas
   *     esperan y luego fallan porque el turno ya no está ABIERTO. Un segundo cierre no encuentra
   *     el turno ABIERTO y falla.
   *  2. El resumen se calcula dentro de la misma transacción y se guarda el Z como CERRADO.
   */
  public async cerrarTurno(usuario: UsuarioCaja, data: CerrarCajaDTO): Promise<ResumenArqueoDTO> {
    if (data.conteoFisicoUsd < 0 || data.conteoFisicoCop < 0 || (data.conteoFisicoVes ?? 0) < 0) {
      throw new Error('El conteo físico de billetes no puede ser negativo.');
    }

    await transaccionEscritura(async (tx) => {
      const bloqueo = await tx.turnoCaja.updateMany({
        where: {
          id: data.turnoCajaId,
          estado: EstadoTurnoCaja.ABIERTO,
          ...(usuario.rol === RolUsuario.ADMIN ? {} : { usuarioAperturaId: usuario.id }),
        },
        data: { estado: EstadoTurnoCaja.CERRANDO },
      });

      if (bloqueo.count === 0) {
        const turno = await tx.turnoCaja.findUnique({ where: { id: data.turnoCajaId } });
        if (!turno) {
          throw new Error('Turno de caja no encontrado');
        }
        if (turno.estado !== EstadoTurnoCaja.ABIERTO) {
          throw new Error('Este turno de caja ya fue cerrado o se está cerrando.');
        }
        throw new Error('Solo quien abrió el turno o un administrador puede cerrarlo.');
      }

      await this.guardarCierre(tx, usuario.id, data);
    });

    // Respaldo al cerrar turno (D1): en segundo plano, nunca bloquea ni hace fallar el cierre.
    void backupService.crearBackupSeguro('cierre-turno');

    // Retornar resumen completo actualizado
    return await this.calcularResumenTurno(data.turnoCajaId);
  }

  /** Calcula el resumen dentro de la transacción del cierre y guarda el Reporte Z. */
  private async guardarCierre(tx: ClienteBd, usuarioId: string, data: CerrarCajaDTO): Promise<void> {
    const resumen = await this.calcularResumenTurno(data.turnoCajaId, tx);

    const conteo: Record<CodigoMoneda, number> = {
      USD: aMinimo(data.conteoFisicoUsd, 'USD'),
      COP: aMinimo(data.conteoFisicoCop, 'COP'),
      VES: aMinimo(data.conteoFisicoVes ?? 0, 'VES'),
    };
    const usd = (v: number) => minimoADecimal(aMinimo(v, 'USD'), 'USD');
    const cop = (v: number) => minimoADecimal(aMinimo(v, 'COP'), 'COP');
    const ves = (v: number) => minimoADecimal(aMinimo(v, 'VES'), 'VES');
    const { ventasPorMetodo: vpm, movimientosManuales: mm, esperadoEnCaja: esp, vueltoEntregado: vu } = resumen;

    await tx.turnoCaja.update({
      where: { id: data.turnoCajaId },
      data: {
        estado: EstadoTurnoCaja.CERRADO,
        usuarioCierreId: usuarioId,
        fechaCierre: new Date(),
        conteoFisicoUsd: minimoADecimal(conteo.USD, 'USD'),
        conteoFisicoCop: minimoADecimal(conteo.COP, 'COP'),
        conteoFisicoVes: minimoADecimal(conteo.VES, 'VES'),
        ventasTotalesUsd: usd(vpm.totalVentasUsd),
        ventasEfectivoUsd: usd(vpm.efectivoUsd.monto),
        ventasEfectivoCop: cop(vpm.efectivoCop.monto),
        ventasPagoMovilVes: ves(vpm.pagoMovilVes.monto),
        ventasTarjetaVes: ves(vpm.tarjetaVes.monto),
        ventasZelleUsd: usd(vpm.zelleUsd.monto),
        vueltoUsd: usd(vu.usd),
        vueltoCop: cop(vu.cop),
        vueltoVes: ves(vu.ves),
        ingresosManualesUsd: usd(mm.ingresosUsd),
        egresosManualesUsd: usd(mm.egresosUsd),
        ingresosManualesCop: cop(mm.ingresosCop),
        egresosManualesCop: cop(mm.egresosCop),
        ingresosManualesVes: ves(mm.ingresosVes),
        egresosManualesVes: ves(mm.egresosVes),
        diferenciaUsd: minimoADecimal(conteo.USD - aMinimo(esp.efectivoUsd, 'USD'), 'USD'),
        diferenciaCop: minimoADecimal(conteo.COP - aMinimo(esp.efectivoCop, 'COP'), 'COP'),
        diferenciaVes: minimoADecimal(conteo.VES - aMinimo(esp.efectivoVes, 'VES'), 'VES'),
        observaciones: data.observaciones?.trim() || null,
      },
    });
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
