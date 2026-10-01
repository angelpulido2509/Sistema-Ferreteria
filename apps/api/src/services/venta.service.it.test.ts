import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RolUsuario, MetodoPago, Moneda, EstadoVenta } from '@ferreteria/shared';
import { prepararBdPrueba } from '../test/sqliteTestDb.js';

/**
 * Escenarios base de VentaService contra SQLite real (reemplazan los tests con mocks que
 * aceptaban precio y tasa del cliente). AGENTS.md §6: venta exitosa, stock insuficiente, anulación.
 */
const bd = await prepararBdPrueba();
const { prisma } = await import('../lib/prisma.js');
const { ventaService } = await import('./venta.service.js');
const { sembrarDatosBase, abrirTurnoPrueba } = await import('../test/semilla.js');

let d: Awaited<ReturnType<typeof sembrarDatosBase>>;
const cajero = () => ({ id: d.cajeroId, rol: RolUsuario.CAJERO });

describe('VentaService (integración)', () => {
  beforeAll(async () => {
    d = await sembrarDatosBase(prisma);
    await abrirTurnoPrueba(prisma, d.cajeroId);
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await bd.limpiar();
  });

  it('venta exitosa: descuenta stock, escribe kárdex SALIDA y calcula IVA', async () => {
    const antes = await prisma.producto.findUniqueOrThrow({ where: { id: d.martilloId } });
    const venta = await ventaService.crearVenta(
      {
        clienteId: d.clienteId,
        items: [{ productoId: d.martilloId, cantidad: 2 }],
        pagos: [{ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoMoneda: 23.2 }],
      },
      cajero()
    );
    expect(venta).toMatchObject({ subtotal: 20, impuesto: 3.2, total: 23.2, estado: EstadoVenta.COMPLETADA });

    const despues = await prisma.producto.findUniqueOrThrow({ where: { id: d.martilloId } });
    expect(despues.stockActual).toBe(antes.stockActual - 2);
    const kardex = await prisma.movimientoInventario.findMany({ where: { motivo: `Venta #${venta.id}` } });
    expect(kardex).toHaveLength(1);
    expect(kardex[0]).toMatchObject({ tipo: 'SALIDA', cantidad: 2, usuarioId: d.cajeroId });
  });

  it('pagos multimoneda con la tasa congelada de Configuracion', async () => {
    // $116,00 + 16 % ... usamos 10 martillos = $116,00 → $50 USD + Bs 6.600 (= $66 a 100)
    const venta = await ventaService.crearVenta(
      {
        clienteId: d.clienteId,
        items: [{ productoId: d.martilloId, cantidad: 10 }],
        pagos: [
          { metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoMoneda: 50 },
          { metodoPago: MetodoPago.PAGO_MOVIL_VES, moneda: Moneda.VES, montoMoneda: 6600, referencia: 'REF-123456' },
        ],
      },
      cajero()
    );
    expect(venta.total).toBe(116);
    expect(venta.pagos?.map((p) => [p.metodoPago, p.tasaAplicada, p.montoUsd])).toEqual(
      expect.arrayContaining([
        [MetodoPago.EFECTIVO_USD, 1, 50],
        [MetodoPago.PAGO_MOVIL_VES, 100, 66],
      ])
    );
  });

  it('rechaza pagos insuficientes', async () => {
    await expect(
      ventaService.crearVenta(
        {
          clienteId: d.clienteId,
          items: [{ productoId: d.martilloId, cantidad: 10 }],
          pagos: [{ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoMoneda: 50 }],
        },
        cajero()
      )
    ).rejects.toThrow('Monto pagado insuficiente. Total requerido: $116.00, Pagado: $50.00');
  });

  it('rechaza stock insuficiente sin dejar rastro (rollback completo)', async () => {
    const ventasAntes = await prisma.venta.count();
    await expect(
      ventaService.crearVenta(
        {
          clienteId: d.clienteId,
          items: [{ productoId: d.cementoId, cantidad: 5 }],
          pagos: [{ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoMoneda: 100 }],
        },
        cajero()
      )
    ).rejects.toThrow('Stock insuficiente para "CEMENTO"');
    expect(await prisma.venta.count()).toBe(ventasAntes);
  });

  it('suma líneas repetidas del mismo producto al validar stock', async () => {
    await expect(
      ventaService.crearVenta(
        {
          clienteId: d.clienteId,
          items: [
            { productoId: d.cementoId, cantidad: 2 },
            { productoId: d.cementoId, cantidad: 2 },
          ],
          pagos: [{ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoMoneda: 100 }],
        },
        cajero()
      )
    ).rejects.toThrow(/Stock insuficiente.*Disponible: 3, Solicitado: 4/);
  });

  it('anula una venta revirtiendo stock y escribiendo kárdex ENTRADA', async () => {
    const venta = await ventaService.crearVenta(
      {
        clienteId: d.clienteId,
        items: [{ productoId: d.martilloId, cantidad: 3 }],
        pagos: [{ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoMoneda: 34.8 }],
      },
      cajero()
    );
    const stockTrasVenta = (await prisma.producto.findUniqueOrThrow({ where: { id: d.martilloId } })).stockActual;

    const anulada = await ventaService.anularVenta(venta.id, { id: d.adminId, rol: RolUsuario.ADMIN }, 'Cliente canceló el pedido');
    expect(anulada.estado).toBe(EstadoVenta.ANULADA);
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: d.martilloId } })).stockActual).toBe(stockTrasVenta + 3);
    const entrada = await prisma.movimientoInventario.findFirst({ where: { tipo: 'ENTRADA', motivo: { startsWith: `Anulación Venta #${venta.id}` } } });
    expect(entrada?.cantidad).toBe(3);
  });

  it('rechaza la anulación sin motivo', async () => {
    await expect(ventaService.anularVenta('x', { id: d.adminId, rol: RolUsuario.ADMIN }, '')).rejects.toThrow(
      'El motivo de anulación es obligatorio para efectos de auditoría'
    );
  });

  it('rechaza la venta sin productos', async () => {
    await expect(ventaService.crearVenta({ clienteId: d.clienteId, items: [] }, cajero())).rejects.toThrow(
      'La venta debe incluir al menos un producto'
    );
  });
});
