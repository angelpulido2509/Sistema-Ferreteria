import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { RolUsuario, MetodoPago, Moneda } from '@ferreteria/shared';
import { prepararBdPrueba } from '../test/sqliteTestDb.js';

// BD SQLite temporal: debe prepararse antes de importar módulos que usan lib/prisma.ts
const bd = await prepararBdPrueba();
const { prisma } = await import('../lib/prisma.js');
const { ventaService } = await import('./venta.service.js');
const { sembrarDatosBase, abrirTurnoPrueba } = await import('../test/semilla.js');

type Datos = Awaited<ReturnType<typeof sembrarDatosBase>>;
let d: Datos;
const cajero = () => ({ id: d.cajeroId, rol: RolUsuario.CAJERO });
const admin = () => ({ id: d.adminId, rol: RolUsuario.ADMIN });
const efectivoUsd = (monto: number) => ({ metodoPago: MetodoPago.EFECTIVO_USD, moneda: Moneda.USD, montoMoneda: monto, tasaAplicada: 1 });

describe('F1/F10 — el servidor decide precio, IVA y tasa', () => {
  beforeAll(async () => {
    d = await sembrarDatosBase(prisma);
    await abrirTurnoPrueba(prisma, d.cajeroId);
    await abrirTurnoPrueba(prisma, d.adminId, 'Caja 2');
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await bd.limpiar();
  });
  beforeEach(async () => {
    await prisma.configuracion.updateMany({ data: { tasaActualizadaEn: new Date(), ivaPorcentaje: '16' } });
  });

  it('precioUnitario=0 y porcentajeImpuesto=0 del request NO alteran el total', async () => {
    const venta = await ventaService.crearVenta(
      {
        clienteId: d.clienteId,
        items: [{ productoId: d.martilloId, cantidad: 2, precioUnitario: 0 }],
        porcentajeImpuesto: 0,
        pagos: [efectivoUsd(23.2)],
      },
      cajero()
    );
    expect(venta.subtotal).toBe(20);
    expect(venta.impuesto).toBe(3.2);
    expect(venta.total).toBe(23.2);
    expect(venta.detalles?.[0]?.precioUnitario).toBe(10);
  });

  it('usa el IVA de Configuracion (no 0,16 fijo)', async () => {
    await prisma.configuracion.updateMany({ data: { ivaPorcentaje: '8' } });
    const venta = await ventaService.crearVenta(
      { clienteId: d.clienteId, items: [{ productoId: d.martilloId, cantidad: 1 }], pagos: [efectivoUsd(10.8)] },
      cajero()
    );
    expect(venta.impuesto).toBe(0.8);
    expect(venta.total).toBe(10.8);
  });

  it('calcula IVA por línea y respeta productos exentos', async () => {
    const venta = await ventaService.crearVenta(
      {
        clienteId: d.clienteId,
        items: [
          { productoId: d.martilloId, cantidad: 1 },
          { productoId: d.libroId, cantidad: 2 },
        ],
        pagos: [efectivoUsd(21.6)],
      },
      cajero()
    );
    expect(venta.subtotal).toBe(20);
    expect(venta.impuesto).toBe(1.6); // solo el martillo
    const libro = venta.detalles!.find((x) => x.productoId === d.libroId)!;
    expect(libro.porcentajeImpuesto).toBe(0);
    expect(libro.impuestoLinea).toBe(0);
  });

  it('ignora la tasa del request y usa la de Configuracion', async () => {
    // Total $11,60 = Bs 1.160 a tasa 100. El cliente dice "tasa 1000" para pagar Bs 116.
    await expect(
      ventaService.crearVenta(
        {
          clienteId: d.clienteId,
          items: [{ productoId: d.martilloId, cantidad: 1 }],
          pagos: [{ metodoPago: MetodoPago.PAGO_MOVIL_VES, moneda: Moneda.VES, montoMoneda: 116, tasaAplicada: 1000, referencia: 'REF1' }],
        },
        cajero()
      )
    ).rejects.toThrow(/insuficiente/);

    const ok = await ventaService.crearVenta(
      {
        clienteId: d.clienteId,
        items: [{ productoId: d.martilloId, cantidad: 1 }],
        pagos: [{ metodoPago: MetodoPago.PAGO_MOVIL_VES, moneda: Moneda.VES, montoMoneda: 1160, tasaAplicada: 1000, referencia: 'REF2' }],
      },
      cajero()
    );
    expect(ok.pagos?.[0]?.tasaAplicada).toBe(100);
    expect(ok.pagos?.[0]?.montoUsd).toBe(11.6);
  });

  it('bloquea cobrar en VES/COP con la tasa vencida, pero permite USD', async () => {
    await prisma.configuracion.updateMany({ data: { tasaActualizadaEn: new Date(Date.now() - 13 * 3600_000) } });
    await expect(
      ventaService.crearVenta(
        {
          clienteId: d.clienteId,
          items: [{ productoId: d.martilloId, cantidad: 1 }],
          pagos: [{ metodoPago: MetodoPago.EFECTIVO_COP, moneda: Moneda.COP, montoMoneda: 46400, tasaAplicada: 4000 }],
        },
        cajero()
      )
    ).rejects.toThrow(/tasa de COP está desactualizada/);

    await expect(
      ventaService.crearVenta(
        { clienteId: d.clienteId, items: [{ productoId: d.martilloId, cantidad: 1 }], pagos: [efectivoUsd(11.6)] },
        cajero()
      )
    ).resolves.toMatchObject({ total: 11.6 });
  });

  it('bloquea VES/COP si la tasa nunca fue confirmada', async () => {
    await prisma.configuracion.updateMany({ data: { tasaActualizadaEn: null } });
    await expect(
      ventaService.crearVenta(
        {
          clienteId: d.clienteId,
          items: [{ productoId: d.martilloId, cantidad: 1 }],
          pagos: [{ metodoPago: MetodoPago.TARJETA_VES, moneda: Moneda.VES, montoMoneda: 1160, tasaAplicada: 100, referencia: 'REF3' }],
        },
        cajero()
      )
    ).rejects.toThrow(/no ha sido confirmada/);
  });

  describe('descuentos', () => {
    it('aplica el descuento por línea y registra quién lo aplicó', async () => {
      const venta = await ventaService.crearVenta(
        {
          clienteId: d.clienteId,
          items: [{ productoId: d.martilloId, cantidad: 2, descuentoPorcentaje: 10 }],
          pagos: [efectivoUsd(20.88)],
        },
        cajero()
      );
      // bruto 20,00 − 10 % = 18,00 + IVA 2,88 = 20,88
      expect(venta.subtotal).toBe(18);
      expect(venta.descuentoTotal).toBe(2);
      expect(venta.total).toBe(20.88);
      const fila = await prisma.venta.findUniqueOrThrow({ where: { id: venta.id } });
      expect(fila.descuentoAplicadoPorId).toBe(d.cajeroId);
    });

    it('rechaza un descuento de CAJERO por encima del tope (10 %)', async () => {
      await expect(
        ventaService.crearVenta(
          {
            clienteId: d.clienteId,
            items: [{ productoId: d.martilloId, cantidad: 1, descuentoPorcentaje: 10.01 }],
            pagos: [efectivoUsd(20)],
          },
          cajero()
        )
      ).rejects.toThrow(/tope de descuento/);
    });

    it('ADMIN no tiene tope de descuento', async () => {
      const venta = await ventaService.crearVenta(
        {
          clienteId: d.clienteId,
          items: [{ productoId: d.martilloId, cantidad: 1, descuentoPorcentaje: 50 }],
          pagos: [efectivoUsd(5.8)],
        },
        admin()
      );
      expect(venta.total).toBe(5.8);
    });

    it('sin descuento no se registra autor de descuento', async () => {
      const venta = await ventaService.crearVenta(
        { clienteId: d.clienteId, items: [{ productoId: d.martilloId, cantidad: 1 }], pagos: [efectivoUsd(11.6)] },
        cajero()
      );
      const fila = await prisma.venta.findUniqueOrThrow({ where: { id: venta.id } });
      expect(fila.descuentoAplicadoPorId).toBeNull();
    });
  });
});
