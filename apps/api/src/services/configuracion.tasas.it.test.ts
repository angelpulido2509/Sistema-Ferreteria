import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prepararBdPrueba } from '../test/sqliteTestDb.js';

const bd = await prepararBdPrueba();
const { prisma } = await import('../lib/prisma.js');
const { configuracionService } = await import('./configuracion.service.js');
const { sembrarDatosBase } = await import('../test/semilla.js');

const hace = (horas: number) => new Date(Date.now() - horas * 3600_000);
const confirmada = async () => (await prisma.configuracion.findFirstOrThrow()).tasaActualizadaEn;

describe('Confirmación de tasas (F1)', () => {
  beforeAll(async () => {
    await sembrarDatosBase(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await bd.limpiar();
  });
  beforeEach(async () => {
    await prisma.configuracion.updateMany({ data: { tasaActualizadaEn: hace(20), tasaVes: '100', tasaCop: '4000' } });
  });

  it('guardar otros datos reenviando las mismas tasas NO renueva la vigencia', async () => {
    const antes = await confirmada();
    await configuracionService.update({ telefono: '0414-9999999', tasaVes: 100, tasaCop: 4000 });
    expect(await confirmada()).toEqual(antes);
  });

  it('cambiar el valor de una tasa la confirma', async () => {
    await configuracionService.update({ tasaVes: 101.5 });
    expect((await confirmada())!.getTime()).toBeGreaterThan(hace(0.1).getTime());
  });

  it('confirmarTasas renueva la vigencia sin cambiar el valor', async () => {
    const dto = await configuracionService.update({ tasaVes: 100, confirmarTasas: true });
    expect(new Date(dto.tasaActualizadaEn!).getTime()).toBeGreaterThan(hace(0.1).getTime());
  });

  it('expone vigencia y tope de descuento, y valida sus rangos', async () => {
    const dto = await configuracionService.update({ tasaVigenciaHoras: 8, descuentoMaxCajeroPct: 5 });
    expect(dto).toMatchObject({ tasaVigenciaHoras: 8, descuentoMaxCajeroPct: 5 });
    await expect(configuracionService.update({ tasaVigenciaHoras: 0 })).rejects.toThrow(/entre 1 y 168/);
    await expect(configuracionService.update({ descuentoMaxCajeroPct: 101 })).rejects.toThrow(/entre 0 % y 100 %/);
  });
});
