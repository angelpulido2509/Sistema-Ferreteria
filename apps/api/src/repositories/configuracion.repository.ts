import { prisma } from '../lib/prisma.js';
import { Moneda, MetodoPago, ConfiguracionDTO, OperacionSync } from '@ferreteria/shared';
import { Prisma } from '@prisma/client-local';
import { registrarSync } from '../lib/syncQueue.js';

/** Datos editables de Configuracion. confirmarTasas renueva la vigencia de las tasas (F1). */
export type ActualizarConfiguracionData = Partial<ConfiguracionDTO> & { confirmarTasas?: boolean };

export class ConfiguracionRepository {
  public async get(): Promise<any> {
    let config = await prisma.configuracion.findFirst();
    if (!config) {
      config = await prisma.configuracion.create({
        data: {
          nombreFerreteria: 'Ferretería El Tornillo Fuerte',
          rif: 'J-12345678-9',
          direccion: 'Guasdualito, Apure, Venezuela',
          telefono: '0414-1234567',
          ivaPorcentaje: new Prisma.Decimal(16.0),
          stockMinimoAlerta: 5,
          monedaFuncional: Moneda.USD,
          tasaVes: new Prisma.Decimal(60.0),
          tasaCop: new Prisma.Decimal(4100.0),
          metodosHabilitados: [
            MetodoPago.EFECTIVO_USD,
            MetodoPago.EFECTIVO_COP,
            MetodoPago.PAGO_MOVIL_VES,
            MetodoPago.TARJETA_VES,
            MetodoPago.ZELLE_USD,
          ],
        },
      });
    }
    return config;
  }

  public async update(data: ActualizarConfiguracionData, ahora: Date = new Date()): Promise<any> {
    const current = await this.get();

    const updateData: any = {};
    if (data.nombreFerreteria !== undefined) updateData.nombreFerreteria = data.nombreFerreteria;
    if (data.rif !== undefined) updateData.rif = data.rif;
    if (data.direccion !== undefined) updateData.direccion = data.direccion;
    if (data.telefono !== undefined) updateData.telefono = data.telefono;
    if (data.ivaPorcentaje !== undefined) updateData.ivaPorcentaje = new Prisma.Decimal(data.ivaPorcentaje);
    if (data.stockMinimoAlerta !== undefined) updateData.stockMinimoAlerta = data.stockMinimoAlerta;
    if (data.monedaFuncional !== undefined) updateData.monedaFuncional = data.monedaFuncional;
    if (data.tasaVes !== undefined) updateData.tasaVes = new Prisma.Decimal(data.tasaVes);
    if (data.tasaCop !== undefined) updateData.tasaCop = new Prisma.Decimal(data.tasaCop);
    if (data.metodosHabilitados !== undefined) updateData.metodosHabilitados = data.metodosHabilitados;
    if (data.tasaVigenciaHoras !== undefined) updateData.tasaVigenciaHoras = data.tasaVigenciaHoras;
    if (data.descuentoMaxCajeroPct !== undefined) updateData.descuentoMaxCajeroPct = new Prisma.Decimal(data.descuentoMaxCajeroPct);

    // F1: la tasa queda confirmada si cambia su valor o si el administrador la confirma explícitamente.
    const tasaCambio =
      (data.tasaVes !== undefined && !new Prisma.Decimal(data.tasaVes).equals(current.tasaVes)) ||
      (data.tasaCop !== undefined && !new Prisma.Decimal(data.tasaCop).equals(current.tasaCop));
    if (data.confirmarTasas === true || tasaCambio) {
      updateData.tasaActualizadaEn = ahora;
    }

    const updated = await prisma.configuracion.update({
      where: { id: current.id },
      data: updateData,
    });

    await registrarSync('Configuracion', updated.id, OperacionSync.ACTUALIZAR, updated as unknown as Record<string, unknown>);
    return updated;
  }
}

export const configuracionRepository = new ConfiguracionRepository();
