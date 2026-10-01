import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { RolUsuario, MetodoPago, Moneda } from '@ferreteria/shared';
import { prepararBdPrueba } from '../test/sqliteTestDb.js';

// El respaldo de cierre de turno corre en segundo plano: fuera de estos tests.
vi.mock('./backup.service.js', () => ({ backupService: { crearBackupSeguro: vi.fn().mockResolvedValue(null) } }));

// Pool real de Prisma + SQLite en WAL (como la app instalada): la concurrencia es real.
const bd = await prepararBdPrueba({ poolReal: true });
const { prisma } = await import('../lib/prisma.js');
const { ventaService } = await import('./venta.service.js');
const { cajaService } = await import('./caja.service.js');
const { sembrarDatosBase } = await import('../test/semilla.js');

let d: Awaited<ReturnType<typeof sembrarDatosBase>>;
const cajero = () => ({ id: d.cajeroId, rol: RolUsuario.CAJERO });
const cajero2 = () => ({ id: d.cajero2Id, rol: RolUsuario.CAJERO });
const admin = () => ({ id: d.adminId, rol: RolUsuario.ADMIN });
/** Venta de 1 martillo ($11,60) pagada exacta en USD. */
const vender = (usuario: { id: string; rol: RolUsuario }) =>
  ventaService.crearVenta(
    {
      clienteId: d.clienteId,
      items: [{ productoId: d.martilloId, cantidad: 1 }],
      pagos: [{ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoRecibido: 11.6 }],
    },
    usuario
  );
const fondo = { montoInicialUsd: 0, montoInicialCop: 0, montoInicialVes: 0 };
const cerrar = (usuario: { id: string; rol: RolUsuario }, turnoCajaId: string) =>
  cajaService.cerrarTurno(usuario, { turnoCajaId, conteoFisicoUsd: 0, conteoFisicoCop: 0, conteoFisicoVes: 0 });

describe('F4/F6 — turno obligatorio, un turno por caja y por cajero, cierre atómico', () => {
  beforeAll(async () => {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
    d = await sembrarDatosBase(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await bd.limpiar();
  });

  it('no se puede vender sin turno abierto', async () => {
    await expect(vender(cajero())).rejects.toThrow(/No tiene un turno de caja abierto/);
    expect(await prisma.venta.count()).toBe(0);
  });

  it('un turno por cajero y uno por caja', async () => {
    await cajaService.abrirTurno(d.cajeroId, { ...fondo, cajaNumero: 'Caja 1' });
    await expect(cajaService.abrirTurno(d.cajeroId, { ...fondo, cajaNumero: 'Caja 3' })).rejects.toThrow(/Ya tiene un turno abierto/);
    await expect(cajaService.abrirTurno(d.cajero2Id, { ...fondo, cajaNumero: 'Caja 1' })).rejects.toThrow(/La Caja 1 ya tiene un turno abierto/);
    await cajaService.abrirTurno(d.cajero2Id, { ...fondo, cajaNumero: 'Caja 2' });
  });

  it('cada venta va al turno de quien vende (no a un findFirst global) y el resumen solo cuenta su turno (F6)', async () => {
    const t1 = (await cajaService.getTurnoActivo(d.cajeroId))!;
    const t2 = (await cajaService.getTurnoActivo(d.cajero2Id))!;
    expect(t1.id).not.toBe(t2.id);

    const v1 = await vender(cajero());
    const v2 = await vender(cajero2());
    await vender(cajero2());
    expect(v1.turnoCajaId).toBe(t1.id);
    expect(v2.turnoCajaId).toBe(t2.id);

    // Turnos solapados en el tiempo: el OR por fechas mezclaba las ventas de ambas cajas
    expect((await cajaService.calcularResumenTurno(t1.id)).ventasPorMetodo.totalTransacciones).toBe(1);
    expect((await cajaService.calcularResumenTurno(t2.id)).ventasPorMetodo.totalTransacciones).toBe(2);
  });

  it('un CAJERO no puede cerrar el turno de otro; ADMIN sí', async () => {
    const t2 = (await cajaService.getTurnoActivo(d.cajero2Id))!;
    await expect(cerrar(cajero(), t2.id)).rejects.toThrow(/Solo quien abrió el turno o un administrador/);
    await cerrar(admin(), t2.id);
    expect((await prisma.turnoCaja.findUniqueOrThrow({ where: { id: t2.id } })).estado).toBe('CERRADO');
  });

  it('dos cierres simultáneos del mismo turno: exactamente uno tiene éxito', async () => {
    const t = await cajaService.abrirTurno(d.cajero2Id, { ...fondo, cajaNumero: 'Caja 2' });
    const resultados = await Promise.allSettled([cerrar(cajero2(), t.id), cerrar(admin(), t.id), cerrar(cajero2(), t.id)]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected')) {
      expect(String(r.reason)).toMatch(/ya fue cerrado o se está cerrando/);
    }
  });

  it('ventas concurrentes con el cierre: ninguna queda fuera del Z ni entra a un turno cerrado', async () => {
    const t1 = (await cajaService.getTurnoActivo(d.cajeroId))!;
    const ventas = Array.from({ length: 12 }, () => vender(cajero()));
    await new Promise((r) => setTimeout(r, 15)); // que algunas ventas lleguen antes que el cierre
    const cierre = cerrar(cajero(), t1.id);
    const masVentas = Array.from({ length: 12 }, () => vender(cajero()));
    const resultados = await Promise.allSettled([...ventas, cierre, ...masVentas]);

    const z = await prisma.turnoCaja.findUniqueOrThrow({ where: { id: t1.id } });
    expect(z.estado).toBe('CERRADO');
    expect(resultados[12]!.status).toBe('fulfilled');

    const exitosas = resultados.filter((r, i) => i !== 12 && r.status === 'fulfilled').length;
    const enTurno = await prisma.venta.count({ where: { turnoCajaId: t1.id } });
    // Toda venta exitosa de este cajero quedó en su turno (no existe otro abierto)
    expect(enTurno).toBe(exitosas + 1); // + la venta del test anterior
    // El Z incluye exactamente las ventas del turno: nada se "coló" después del cálculo
    expect(Number(z.ventasTotalesUsd)).toBeCloseTo(enTurno * 11.6, 2);
    for (const r of resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected')) {
      expect(String(r.reason)).toMatch(/No tiene un turno de caja abierto/);
    }
    expect(await prisma.venta.count({ where: { turnoCajaId: null } })).toBe(0);
  });

  it('no se aceptan movimientos de caja en el turno de otro cajero', async () => {
    const t = await cajaService.abrirTurno(d.cajero2Id, { ...fondo, cajaNumero: 'Caja 2' });
    await expect(
      cajaService.registrarMovimiento(cajero(), { turnoCajaId: t.id, tipo: 'INGRESO' as never, monto: 5, moneda: Moneda.USD, motivo: 'x' })
    ).rejects.toThrow(/Solo quien abrió el turno o un administrador/);
  });
});
