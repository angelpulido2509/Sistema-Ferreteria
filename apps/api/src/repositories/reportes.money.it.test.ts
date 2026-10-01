import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Prisma } from '@prisma/client-local';
import { prepararBdPrueba } from '../test/sqliteTestDb.js';

const bd = await prepararBdPrueba();
const { prisma } = await import('../lib/prisma.js');
const { reportesRepository } = await import('./reportes.repository.js');
const { sembrarDatosBase } = await import('../test/semilla.js');

describe('F7 — reportes en centavos', () => {
  beforeAll(async () => {
    const d = await sembrarDatosBase(prisma);
    const venta = (total: string) =>
      prisma.venta.create({
        data: {
          clienteId: d.clienteId,
          usuarioId: d.cajeroId,
          subtotal: new Prisma.Decimal(total),
          impuesto: new Prisma.Decimal(0),
          total: new Prisma.Decimal(total),
          totalUsd: new Prisma.Decimal(total),
        },
      });
    await venta('2.00');
    await venta('0.01');
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await bd.limpiar();
  });

  it('ticket promedio de $2,01 / 2 = $1,005 redondea a $1,01 (con flotantes daba $1,00)', async () => {
    expect(Math.round((2.01 / 2) * 100) / 100).toBe(1); // el error que se corrige
    const m = await reportesRepository.getMetricasResumen();
    expect(m.ingresosHoy).toBe(2.01);
    expect(m.ticketPromedio).toBe(1.01);
  });
});
