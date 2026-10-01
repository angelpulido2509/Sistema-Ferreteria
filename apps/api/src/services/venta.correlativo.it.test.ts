import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RolUsuario, MetodoPago, Moneda } from '@ferreteria/shared';
import { prepararBdPrueba } from '../test/sqliteTestDb.js';

// Pool real + WAL: la numeración se prueba bajo concurrencia real.
const bd = await prepararBdPrueba({ poolReal: true });
const { prisma } = await import('../lib/prisma.js');
const { ventaService } = await import('./venta.service.js');
const { sembrarDatosBase, abrirTurnoPrueba } = await import('../test/semilla.js');

let d: Awaited<ReturnType<typeof sembrarDatosBase>>;
const pagoUsd = (monto: number) => [{ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoRecibido: monto }];

describe('F9 — correlativo de comprobante', () => {
  beforeAll(async () => {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
    d = await sembrarDatosBase(prisma);
    await abrirTurnoPrueba(prisma, d.cajeroId, 'Caja 1');
    await abrirTurnoPrueba(prisma, d.cajero2Id, 'Caja 2');
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await bd.limpiar();
  });

  it('numeración N001 correlativa, única y sin huecos bajo concurrencia (las ventas fallidas no consumen número)', async () => {
    const usuarios = [
      { id: d.cajeroId, rol: RolUsuario.CAJERO },
      { id: d.cajero2Id, rol: RolUsuario.CAJERO },
    ];
    const ok = Array.from({ length: 30 }, (_, i) =>
      ventaService.crearVenta({ clienteId: d.clienteId, items: [{ productoId: d.martilloId, cantidad: 1 }], pagos: pagoUsd(11.6) }, usuarios[i % 2]!)
    );
    // Ventas que fallan dentro de la transacción (stock insuficiente) intercaladas
    const fallidas = Array.from({ length: 6 }, () =>
      ventaService.crearVenta({ clienteId: d.clienteId, items: [{ productoId: d.cementoId, cantidad: 50 }], pagos: pagoUsd(500) }, usuarios[0]!)
    );
    const resultados = await Promise.allSettled([...ok, ...fallidas]);
    expect(resultados.slice(0, 30).every((r) => r.status === 'fulfilled')).toBe(true);
    expect(resultados.slice(30).every((r) => r.status === 'rejected')).toBe(true);

    const numeros = (await prisma.venta.findMany({ select: { numero: true } })).map((v) => v.numero!).sort();
    expect(numeros).toEqual(Array.from({ length: 30 }, (_, i) => `N001-${String(i + 1).padStart(6, '0')}`));
    expect((await prisma.secuenciaDocumento.findUniqueOrThrow({ where: { serie: 'N001' } })).ultimoNumero).toBe(30);
    // Las demás series no se tocan
    expect((await prisma.secuenciaDocumento.findUniqueOrThrow({ where: { serie: 'F001' } })).ultimoNumero).toBe(0);
  });

  it('la venta devuelve su número y tipo de documento; el comprobante lo usa y se rotula NO FISCAL', async () => {
    const venta = await ventaService.crearVenta(
      { clienteId: d.clienteId, items: [{ productoId: d.martilloId, cantidad: 1 }], pagos: pagoUsd(11.6) },
      { id: d.cajeroId, rol: RolUsuario.CAJERO }
    );
    expect(venta.numero).toBe('N001-000031');
    expect(venta.tipoDocumento).toBe('NOTA_ENTREGA');

    const comprobante = await ventaService.generarComprobante(venta.id);
    expect(comprobante.comprobante.numero).toBe('N001-000031');
    expect(comprobante.comprobante.leyenda).toBe('COMPROBANTE — NO VÁLIDO COMO FACTURA FISCAL');
    expect(comprobante.comprobante.numero).not.toMatch(/FAC-/);
  });

  it('anular no libera el número', async () => {
    const venta = await ventaService.crearVenta(
      { clienteId: d.clienteId, items: [{ productoId: d.martilloId, cantidad: 1 }], pagos: pagoUsd(11.6) },
      { id: d.cajeroId, rol: RolUsuario.CAJERO }
    );
    await ventaService.anularVenta(venta.id, { id: d.adminId, rol: RolUsuario.ADMIN }, 'prueba');
    const siguiente = await ventaService.crearVenta(
      { clienteId: d.clienteId, items: [{ productoId: d.martilloId, cantidad: 1 }], pagos: pagoUsd(11.6) },
      { id: d.cajeroId, rol: RolUsuario.CAJERO }
    );
    expect(venta.numero).toBe('N001-000032');
    expect(siguiente.numero).toBe('N001-000033');
  });
});
