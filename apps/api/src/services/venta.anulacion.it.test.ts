import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Prisma } from '@prisma/client-local';
import { RolUsuario, MetodoPago, Moneda, EstadoVenta } from '@ferreteria/shared';
import { prepararBdPrueba } from '../test/sqliteTestDb.js';

vi.mock('./backup.service.js', () => ({ backupService: { crearBackupSeguro: vi.fn().mockResolvedValue(null) } }));

const bd = await prepararBdPrueba();
const { prisma } = await import('../lib/prisma.js');
const { ventaService } = await import('./venta.service.js');
const { cajaService } = await import('./caja.service.js');
const { sembrarDatosBase } = await import('../test/semilla.js');

let d: Awaited<ReturnType<typeof sembrarDatosBase>>;
let vale15Id: string;
const cajero = () => ({ id: d.cajeroId, rol: RolUsuario.CAJERO });
const admin = () => ({ id: d.adminId, rol: RolUsuario.ADMIN });
const fondo = { montoInicialUsd: 0, montoInicialCop: 0, montoInicialVes: 0 };

/** Venta de $15 (exenta) pagada con $20 en efectivo → neto $15, vuelto $5. */
const vender15Efectivo = () =>
  ventaService.crearVenta(
    { clienteId: d.clienteId, items: [{ productoId: vale15Id, cantidad: 1 }], pagos: [{ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoRecibido: 20 }] },
    cajero()
  );
const vender15Zelle = () =>
  ventaService.crearVenta(
    { clienteId: d.clienteId, items: [{ productoId: vale15Id, cantidad: 1 }], pagos: [{ metodoPago: MetodoPago.ZELLE_USD, moneda: Moneda.USD, montoRecibido: 15, referencia: 'Z1' }] },
    cajero()
  );

describe('F5 — anulación auditable', () => {
  let turnoCerradoId: string;
  let ventaTurnoCerrado: string;
  let ventaZelleTurnoCerrado: string;

  beforeAll(async () => {
    d = await sembrarDatosBase(prisma);
    const categoria = await prisma.categoria.findFirstOrThrow();
    vale15Id = (
      await prisma.producto.create({
        data: { codigo: 'VALE15', nombre: 'Vale', categoriaId: categoria.id, precioCompra: new Prisma.Decimal(1), precioVenta: new Prisma.Decimal('15'), stockActual: 100, exentoIva: true },
      })
    ).id;

    // Turno del cajero con dos ventas, luego cerrado (Z)
    const t = await cajaService.abrirTurno(d.cajeroId, { ...fondo, cajaNumero: 'Caja 1' });
    turnoCerradoId = t.id;
    ventaTurnoCerrado = (await vender15Efectivo()).id;
    ventaZelleTurnoCerrado = (await vender15Zelle()).id;
    await cajaService.cerrarTurno(cajero(), { turnoCajaId: t.id, conteoFisicoUsd: 15, conteoFisicoCop: 0 });
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await bd.limpiar();
  });

  it('anular en turno abierto guarda motivo, autor y fecha en la venta y deja AuditoriaEvento', async () => {
    await cajaService.abrirTurno(d.cajeroId, { ...fondo, cajaNumero: 'Caja 1' });
    const venta = await vender15Efectivo();

    const anulada = await ventaService.anularVenta(venta.id, admin(), '  Cliente desistió  ');
    expect(anulada).toMatchObject({ estado: EstadoVenta.ANULADA, motivoAnulacion: 'Cliente desistió', anuladaPorId: d.adminId });
    expect(anulada.fechaAnulacion).toBeTruthy();

    const evento = await prisma.auditoriaEvento.findFirstOrThrow({ where: { entidad: 'Venta', entidadId: venta.id, accion: 'ANULAR' } });
    expect(evento).toMatchObject({ usuarioId: d.adminId, motivo: 'Cliente desistió' });
    // Turno abierto: no hace falta ajuste (el resumen ya excluye la venta anulada)
    expect(await prisma.movimientoCaja.count({ where: { ventaId: venta.id } })).toBe(0);
  });

  it('no se puede anular dos veces', async () => {
    const venta = await vender15Efectivo();
    await ventaService.anularVenta(venta.id, admin(), 'x');
    await expect(ventaService.anularVenta(venta.id, admin(), 'otra vez')).rejects.toThrow(/ya ha sido anulada/);
  });

  it('venta de turno CERRADO: un CAJERO no puede anularla', async () => {
    await expect(ventaService.anularVenta(ventaTurnoCerrado, cajero(), 'error')).rejects.toThrow(
      /Solo un administrador puede anular ventas de un turno cerrado/
    );
  });

  it('venta de turno CERRADO sin turno vigente donde registrar el ajuste en efectivo -> rechazada', async () => {
    // Cerrar el turno que quedó abierto en Caja 1 (lo usaría como turno vigente de la misma caja)
    const abierto = (await cajaService.getTurnoActivo(d.cajeroId))!;
    await cajaService.cerrarTurno(admin(), { turnoCajaId: abierto.id, conteoFisicoUsd: 0, conteoFisicoCop: 0 });
    await expect(ventaService.anularVenta(ventaTurnoCerrado, admin(), 'error')).rejects.toThrow(/Abra un turno/);
    expect((await prisma.venta.findUniqueOrThrow({ where: { id: ventaTurnoCerrado } })).estado).toBe('COMPLETADA');
  });

  it('venta de turno CERRADO: ADMIN anula, ajuste en el turno vigente y el Z cerrado queda intacto', async () => {
    const zAntes = await prisma.turnoCaja.findUniqueOrThrow({ where: { id: turnoCerradoId } });
    const resumenAntes = await cajaService.calcularResumenTurno(turnoCerradoId);
    const turnoAdmin = await cajaService.abrirTurno(d.adminId, { ...fondo, cajaNumero: 'Caja 2' });

    await ventaService.anularVenta(ventaTurnoCerrado, admin(), 'Devolución de mercancía');

    // Ajuste: egreso del efectivo NETO devuelto ($15, no los $20 recibidos) en el turno vigente
    const ajustes = await prisma.movimientoCaja.findMany({ where: { ventaId: ventaTurnoCerrado } });
    expect(ajustes).toHaveLength(1);
    expect(ajustes[0]).toMatchObject({ turnoCajaId: turnoAdmin.id, tipo: 'EGRESO', moneda: 'USD', usuarioId: d.adminId });
    expect(Number(ajustes[0]!.monto)).toBe(15);
    expect(ajustes[0]!.motivo).toMatch(/Ajuste por anulación/);

    // El Z cerrado no se modifica y su resumen sigue siendo reproducible
    const zDespues = await prisma.turnoCaja.findUniqueOrThrow({ where: { id: turnoCerradoId } });
    expect(zDespues).toEqual(zAntes);
    const resumenDespues = await cajaService.calcularResumenTurno(turnoCerradoId);
    expect(resumenDespues.ventasPorMetodo).toEqual(resumenAntes.ventasPorMetodo);
    expect(resumenDespues.esperadoEnCaja).toEqual(resumenAntes.esperadoEnCaja);

    const evento = await prisma.auditoriaEvento.findFirstOrThrow({ where: { entidadId: ventaTurnoCerrado, accion: 'ANULAR' } });
    expect(JSON.parse(evento.detalle!)).toMatchObject({ turnoCerrado: true, ajustes: [{ turnoCajaId: turnoAdmin.id, moneda: 'USD', monto: 15 }] });
  });

  it('venta de turno CERRADO pagada por Zelle: no genera ajuste de efectivo', async () => {
    await ventaService.anularVenta(ventaZelleTurnoCerrado, admin(), 'Reembolso por Zelle');
    expect(await prisma.movimientoCaja.count({ where: { ventaId: ventaZelleTurnoCerrado } })).toBe(0);
  });

  it('si quien anula no tiene turno, el ajuste va al turno abierto en la misma caja de la venta', async () => {
    const turnoCaja1 = await cajaService.abrirTurno(d.cajeroId, { ...fondo, cajaNumero: 'Caja 1' });
    const venta = await vender15Efectivo();
    await cajaService.cerrarTurno(cajero(), { turnoCajaId: turnoCaja1.id, conteoFisicoUsd: 15, conteoFisicoCop: 0 });
    const turnoNuevo = await cajaService.abrirTurno(d.cajeroId, { ...fondo, cajaNumero: 'Caja 1' });
    // El admin cierra su propio turno para forzar el fallback por caja
    const turnoAdmin = (await cajaService.getTurnoActivo(d.adminId))!;
    await cajaService.cerrarTurno(admin(), { turnoCajaId: turnoAdmin.id, conteoFisicoUsd: 0, conteoFisicoCop: 0 });

    await ventaService.anularVenta(venta.id, admin(), 'Devolución');
    const ajuste = await prisma.movimientoCaja.findFirstOrThrow({ where: { ventaId: venta.id } });
    expect(ajuste.turnoCajaId).toBe(turnoNuevo.id);
  });
});
