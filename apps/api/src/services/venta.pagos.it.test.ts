import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { RolUsuario, MetodoPago, Moneda } from '@ferreteria/shared';
import { prepararBdPrueba } from '../test/sqliteTestDb.js';

const bd = await prepararBdPrueba();
const { prisma } = await import('../lib/prisma.js');
const { ventaService } = await import('./venta.service.js');
const { TOLERANCIA_PAGO_CENTAVOS_USD } = await import('../config/money.js');
const { sembrarDatosBase, abrirTurnoPrueba } = await import('../test/semilla.js');

let d: Awaited<ReturnType<typeof sembrarDatosBase>>;
const cajero = () => ({ id: d.cajeroId, rol: RolUsuario.CAJERO });
/** Un martillo: $10,00 + IVA 16 % = $11,60 */
const unMartillo = () => [{ productoId: d.martilloId, cantidad: 1 }];
const vender = (pagos: unknown) =>
  ventaService.crearVenta({ clienteId: d.clienteId, items: unMartillo(), pagos: pagos as never }, cajero());

describe('F2 — pagos obligatorios y consistentes', () => {
  beforeAll(async () => {
    d = await sembrarDatosBase(prisma);
    await abrirTurnoPrueba(prisma, d.cajeroId);
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await bd.limpiar();
  });
  beforeEach(async () => {
    await prisma.configuracion.updateMany({
      data: {
        tasaActualizadaEn: new Date(),
        metodosHabilitados: ['EFECTIVO_USD', 'EFECTIVO_COP', 'PAGO_MOVIL_VES', 'TARJETA_VES', 'ZELLE_USD', 'NEQUI_COP'],
      },
    });
  });

  it('rechaza una venta sin pagos', async () => {
    await expect(vender(undefined)).rejects.toThrow(/al menos un pago/);
    await expect(vender([])).rejects.toThrow(/al menos un pago/);
  });

  it('rechaza un método no habilitado en Configuración', async () => {
    await prisma.configuracion.updateMany({ data: { metodosHabilitados: ['EFECTIVO_USD'] } });
    await expect(vender([{ metodoPago: MetodoPago.ZELLE_USD, moneda: Moneda.USD, montoRecibido: 11.6 }])).rejects.toThrow(
      /ZELLE_USD no está habilitado/
    );
  });

  it.each([
    [MetodoPago.EFECTIVO_COP, Moneda.USD],
    [MetodoPago.PAGO_MOVIL_VES, Moneda.USD],
    [MetodoPago.TARJETA_VES, Moneda.COP],
    [MetodoPago.ZELLE_USD, Moneda.VES],
    [MetodoPago.NEQUI_COP, Moneda.USD],
  ])('rechaza %s cobrado en %s', async (metodoPago, moneda) => {
    await expect(vender([{ metodoPago, moneda, montoRecibido: 999_999 }])).rejects.toThrow(/se cobra en/);
  });

  it('acepta NEQUI_COP en pesos', async () => {
    const venta = await vender([{ metodoPago: MetodoPago.NEQUI_COP, moneda: Moneda.COP, montoRecibido: 46_400, referencia: 'NEQ1' }]);
    expect(venta.pagos?.[0]).toMatchObject({ metodoPago: MetodoPago.NEQUI_COP, montoUsd: 11.6 });
  });

  it(`la tolerancia es una constante nombrada (${TOLERANCIA_PAGO_CENTAVOS_USD} centavo), no $0,05`, async () => {
    expect(TOLERANCIA_PAGO_CENTAVOS_USD).toBe(1);
    await expect(vender([{ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoRecibido: 11.59 }])).resolves.toBeDefined();
    await expect(vender([{ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoRecibido: 11.58 }])).rejects.toThrow(
      /insuficiente/
    );
    await expect(vender([{ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoRecibido: 11.56 }])).rejects.toThrow(
      /insuficiente/
    );
  });
});
