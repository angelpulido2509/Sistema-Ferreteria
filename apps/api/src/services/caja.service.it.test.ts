import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { RolUsuario, MetodoPago, Moneda, TipoMovimientoCaja, EstadoTurnoCaja } from '@ferreteria/shared';
import { prepararBdPrueba } from '../test/sqliteTestDb.js';

/**
 * Escenarios de CajaService contra SQLite real (reemplazan caja.service.test.ts, cuyos mocks
 * no podían representar transacciones ni el turno por cajero).
 */
vi.mock('./backup.service.js', () => ({ backupService: { crearBackupSeguro: vi.fn().mockResolvedValue(null) } }));

const bd = await prepararBdPrueba();
const { prisma } = await import('../lib/prisma.js');
const { ventaService } = await import('./venta.service.js');
const { cajaService } = await import('./caja.service.js');
const { sembrarDatosBase } = await import('../test/semilla.js');

let d: Awaited<ReturnType<typeof sembrarDatosBase>>;
const cajero = () => ({ id: d.cajeroId, rol: RolUsuario.CAJERO });

describe('CajaService (integración)', () => {
  beforeAll(async () => {
    d = await sembrarDatosBase(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await bd.limpiar();
  });

  describe('apertura y turno activo', () => {
    it('getTurnoActivo devuelve null si el cajero no tiene turno abierto', async () => {
      expect(await cajaService.getTurnoActivo(d.cajeroId)).toBeNull();
    });

    it('rechaza fondos iniciales negativos', async () => {
      await expect(cajaService.abrirTurno(d.cajeroId, { montoInicialUsd: -1, montoInicialCop: 0 })).rejects.toThrow(
        'Los fondos iniciales de caja no pueden ser negativos.'
      );
    });

    it('abre el turno con fondos en USD y COP y lo devuelve como DTO', async () => {
      const turno = await cajaService.abrirTurno(d.cajeroId, { cajaNumero: 'Caja 1', montoInicialUsd: 100, montoInicialCop: 50_000 });
      expect(turno).toMatchObject({ cajaNumero: 'Caja 1', estado: EstadoTurnoCaja.ABIERTO, montoInicialUsd: 100, montoInicialCop: 50_000 });
      const activo = await cajaService.getTurnoActivo(d.cajeroId);
      expect(activo?.id).toBe(turno.id);
      expect(activo?.usuarioApertura?.id).toBe(d.cajeroId);
    });

    it('rechaza abrir un segundo turno del mismo cajero', async () => {
      await expect(cajaService.abrirTurno(d.cajeroId, { montoInicialUsd: 0, montoInicialCop: 0, cajaNumero: 'Caja 9' })).rejects.toThrow(
        /Ya tiene un turno abierto/
      );
    });
  });

  describe('movimientos', () => {
    it('rechaza montos menores o iguales a 0', async () => {
      const t = (await cajaService.getTurnoActivo(d.cajeroId))!;
      await expect(
        cajaService.registrarMovimiento(cajero(), { turnoCajaId: t.id, tipo: TipoMovimientoCaja.EGRESO, monto: 0, moneda: Moneda.USD, motivo: 'x' })
      ).rejects.toThrow('El monto del movimiento debe ser mayor a 0');
    });

    it('registra un egreso de efectivo', async () => {
      const t = (await cajaService.getTurnoActivo(d.cajeroId))!;
      const mov = await cajaService.registrarMovimiento(cajero(), {
        turnoCajaId: t.id,
        tipo: TipoMovimientoCaja.EGRESO,
        monto: 10,
        moneda: Moneda.USD,
        motivo: 'Compra de café',
      });
      expect(mov).toMatchObject({ tipo: TipoMovimientoCaja.EGRESO, monto: 10, moneda: Moneda.USD, usuarioId: d.cajeroId });
    });
  });

  it('Reporte X: esperado = fondo + efectivo neto de ventas + ingresos − egresos', async () => {
    const t = (await cajaService.getTurnoActivo(d.cajeroId))!;
    await cajaService.registrarMovimiento(cajero(), { turnoCajaId: t.id, tipo: TipoMovimientoCaja.INGRESO, monto: 5_000, moneda: Moneda.COP, motivo: 'Cambio' });
    // 1 martillo $11,60 en efectivo USD; 1 martillo en COP 46.400; 1 martillo por pago móvil (no efectivo)
    const base = { clienteId: d.clienteId, items: [{ productoId: d.martilloId, cantidad: 1 }] };
    await ventaService.crearVenta({ ...base, pagos: [{ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoRecibido: 11.6 }] }, cajero());
    await ventaService.crearVenta({ ...base, pagos: [{ metodoPago: MetodoPago.EFECTIVO_COP, moneda: Moneda.COP, montoRecibido: 46_400 }] }, cajero());
    await ventaService.crearVenta(
      { ...base, pagos: [{ metodoPago: MetodoPago.PAGO_MOVIL_VES, moneda: Moneda.VES, montoRecibido: 1_160, referencia: 'PM1' }] },
      cajero()
    );

    const r = await cajaService.calcularResumenTurno(t.id);
    expect(r.ventasPorMetodo.totalTransacciones).toBe(3);
    expect(r.ventasPorMetodo.totalVentasUsd).toBeCloseTo(34.8, 10);
    expect(r.ventasPorMetodo.pagoMovilVes).toEqual({ monto: 1_160, transacciones: 1 });
    expect(r.esperadoEnCaja.efectivoUsd).toBeCloseTo(100 + 11.6 - 10, 10);
    expect(r.esperadoEnCaja.efectivoCop).toBe(50_000 + 46_400 + 5_000);
    expect(r.esperadoEnCaja.efectivoVes).toBe(0);
  });

  it('Reporte Z: cierra, calcula descuadres exactos y deja el turno CERRADO', async () => {
    const t = (await cajaService.getTurnoActivo(d.cajeroId))!;
    // Esperado USD 101,60 y COP 101.400. Conteo: faltan $2 y sobran 2.000 COP.
    const r = await cajaService.cerrarTurno(cajero(), {
      turnoCajaId: t.id,
      conteoFisicoUsd: 99.6,
      conteoFisicoCop: 103_400,
      conteoFisicoVes: 0,
    });
    expect(r.turnoCaja.estado).toBe(EstadoTurnoCaja.CERRADO);
    expect(r.diferencias).toEqual({ usd: -2, cop: 2_000, ves: 0 });

    const z = await prisma.turnoCaja.findUniqueOrThrow({ where: { id: t.id } });
    expect(Number(z.diferenciaUsd)).toBe(-2);
    expect(Number(z.diferenciaCop)).toBe(2_000);
    expect(z.usuarioCierreId).toBe(d.cajeroId);
  });

  it('rechaza movimientos en un turno cerrado', async () => {
    const cerrado = await prisma.turnoCaja.findFirstOrThrow({ where: { estado: 'CERRADO' } });
    await expect(
      cajaService.registrarMovimiento(cajero(), { turnoCajaId: cerrado.id, tipo: TipoMovimientoCaja.INGRESO, monto: 1, moneda: Moneda.USD, motivo: 'x' })
    ).rejects.toThrow('El turno de caja ya se encuentra cerrado. No se admiten nuevos movimientos.');
  });
});
