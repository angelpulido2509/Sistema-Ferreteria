import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Prisma } from '@prisma/client-local';
import { RolUsuario, MetodoPago, Moneda } from '@ferreteria/shared';
import { prepararBdPrueba } from '../test/sqliteTestDb.js';

const bd = await prepararBdPrueba();
const { prisma } = await import('../lib/prisma.js');
const { ventaService } = await import('./venta.service.js');
const { cajaService } = await import('./caja.service.js');
const { sembrarDatosBase, abrirTurnoPrueba } = await import('../test/semilla.js');

let d: Awaited<ReturnType<typeof sembrarDatosBase>>;
let vale15Id: string;
let turnoId: string;
const cajero = () => ({ id: d.cajeroId, rol: RolUsuario.CAJERO });
const efectivoUsd = (monto: number) => ({ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoRecibido: monto });
const efectivoCop = (monto: number) => ({ metodoPago: MetodoPago.EFECTIVO_COP, moneda: Moneda.COP, montoRecibido: monto });
const zelle = (monto: number) => ({ metodoPago: MetodoPago.ZELLE_USD, moneda: Moneda.USD, montoRecibido: monto, referencia: 'ZEL1' });
/** Venta de $15,00 exactos (producto exento de IVA). */
const vender15 = (pagos: unknown[], vueltoMoneda?: Moneda) =>
  ventaService.crearVenta(
    { clienteId: d.clienteId, items: [{ productoId: vale15Id, cantidad: 1 }], pagos: pagos as never, vueltoMoneda },
    cajero()
  );

describe('F3 — vuelto auditable y esperado de caja', () => {
  beforeAll(async () => {
    d = await sembrarDatosBase(prisma);
    const categoria = await prisma.categoria.findFirstOrThrow();
    vale15Id = (
      await prisma.producto.create({
        data: {
          codigo: 'VALE15',
          nombre: 'Vale $15',
          categoriaId: categoria.id,
          precioCompra: new Prisma.Decimal('1'),
          precioVenta: new Prisma.Decimal('15.00'),
          stockActual: 1000,
          exentoIva: true,
        },
      })
    ).id;
    turnoId = (await abrirTurnoPrueba(prisma, d.cajeroId)).id;
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await bd.limpiar();
  });

  it('venta de $15 pagada con $20 en efectivo: vuelto $5 y el esperado en caja sube $15 (no $20)', async () => {
    const antes = await cajaService.calcularResumenTurno(turnoId);
    const venta = await vender15([efectivoUsd(20)]);

    expect(venta.vueltoMoneda).toBe(Moneda.USD);
    expect(venta.pagos?.[0]).toMatchObject({ montoRecibido: 20, vuelto: 5, montoMoneda: 15, montoUsd: 15 });

    const despues = await cajaService.calcularResumenTurno(turnoId);
    expect(despues.esperadoEnCaja.efectivoUsd - antes.esperadoEnCaja.efectivoUsd).toBeCloseTo(15, 10);
    expect(despues.vueltoEntregado.usd - antes.vueltoEntregado.usd).toBeCloseTo(5, 10);
  });

  it('los pagos electrónicos no generan vuelto: sobrepago sin efectivo -> rechazado', async () => {
    await expect(vender15([zelle(20)])).rejects.toThrow(/solo se entrega de pagos en efectivo/);
  });

  it('Zelle + efectivo COP: el vuelto sale del efectivo en pesos y Zelle no afecta la caja', async () => {
    const antes = await cajaService.calcularResumenTurno(turnoId);
    // $10 Zelle + 30.000 COP ($7,50) = $17,50 → vuelto $2,50 = 10.000 COP
    const venta = await vender15([zelle(10), efectivoCop(30_000)]);
    const cop = venta.pagos!.find((p) => p.metodoPago === MetodoPago.EFECTIVO_COP)!;
    expect(cop).toMatchObject({ montoRecibido: 30_000, vuelto: 10_000, montoMoneda: 20_000 });
    expect(venta.vueltoMoneda).toBe(Moneda.COP);

    const despues = await cajaService.calcularResumenTurno(turnoId);
    expect(despues.esperadoEnCaja.efectivoCop - antes.esperadoEnCaja.efectivoCop).toBe(20_000);
    expect(despues.esperadoEnCaja.efectivoUsd).toBe(antes.esperadoEnCaja.efectivoUsd);
  });

  it('con efectivo en dos monedas, el cajero debe elegir la moneda del vuelto', async () => {
    // $10 USD + 40.000 COP ($10) = $20 → $5 de vuelto
    await expect(vender15([efectivoUsd(10), efectivoCop(40_000)])).rejects.toThrow(/Indique la moneda del vuelto/);

    const enUsd = await vender15([efectivoUsd(10), efectivoCop(40_000)], Moneda.USD);
    expect(enUsd.pagos!.find((p) => p.moneda === Moneda.USD)).toMatchObject({ vuelto: 5, montoMoneda: 5 });

    const enCop = await vender15([efectivoUsd(10), efectivoCop(40_000)], Moneda.COP);
    expect(enCop.pagos!.find((p) => p.moneda === Moneda.COP)).toMatchObject({ vuelto: 20_000, montoMoneda: 20_000 });
  });

  it('el vuelto no puede superar el efectivo recibido en esa moneda', async () => {
    // $1 efectivo + $20 Zelle → exceso $6 > $1 en efectivo
    await expect(vender15([efectivoUsd(1), zelle(20)])).rejects.toThrow(/supera el efectivo recibido/);
  });

  it('la moneda del vuelto debe ser una de las recibidas en efectivo', async () => {
    await expect(vender15([efectivoUsd(20)], Moneda.VES)).rejects.toThrow(/moneda del vuelto/);
  });

  it('tras el vuelto, Σ montoUsd de los pagos = total de la venta', async () => {
    const venta = await vender15([zelle(3.33), efectivoCop(50_000)]);
    const suma = venta.pagos!.reduce((s, p) => s + Math.round(p.montoUsd * 100), 0);
    expect(suma).toBe(1500);
  });
});
