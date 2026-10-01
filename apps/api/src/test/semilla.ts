import { Prisma, type PrismaClient } from '@prisma/client-local';

export interface DatosBase {
  adminId: string;
  cajeroId: string;
  cajero2Id: string;
  clienteId: string;
  martilloId: string; // $10,00 con IVA
  libroId: string; // $5,00 exento de IVA
  cementoId: string; // $8,50 con IVA, poco stock
}

/**
 * Datos mínimos para tests de integración: usuarios, cliente, productos, configuración
 * (IVA 16 %, VES 100, COP 4000, tasas recién confirmadas, tope de descuento 10 %) y series.
 */
export async function sembrarDatosBase(prisma: PrismaClient): Promise<DatosBase> {
  const admin = await prisma.usuario.create({
    data: { nombre: 'Admin', email: 'admin@it.local', passwordHash: 'x', rol: 'ADMIN' },
  });
  const cajero = await prisma.usuario.create({
    data: { nombre: 'Cajera', email: 'cajera@it.local', passwordHash: 'x', rol: 'CAJERO' },
  });
  const cajero2 = await prisma.usuario.create({
    data: { nombre: 'Cajero 2', email: 'cajero2@it.local', passwordHash: 'x', rol: 'CAJERO' },
  });
  const cliente = await prisma.cliente.create({ data: { nombre: 'Mostrador', identificacion: 'V-00000000' } });
  const categoria = await prisma.categoria.create({ data: { nombre: 'General' } });

  const producto = (codigo: string, precio: string, stock: number, exentoIva = false) =>
    prisma.producto.create({
      data: {
        codigo,
        nombre: codigo,
        categoriaId: categoria.id,
        precioCompra: new Prisma.Decimal('1.00'),
        precioVenta: new Prisma.Decimal(precio),
        stockActual: stock,
        exentoIva,
      },
    });
  const martillo = await producto('MART', '10.00', 1000);
  const libro = await producto('LIBRO', '5.00', 1000, true);
  const cemento = await producto('CEMENTO', '8.50', 3);

  await prisma.configuracion.create({
    data: {
      ivaPorcentaje: new Prisma.Decimal('16'),
      tasaVes: new Prisma.Decimal('100.0000'),
      tasaCop: new Prisma.Decimal('4000.0000'),
      tasaActualizadaEn: new Date(),
      tasaVigenciaHoras: 12,
      descuentoMaxCajeroPct: new Prisma.Decimal('10'),
      metodosHabilitados: ['EFECTIVO_USD', 'EFECTIVO_COP', 'PAGO_MOVIL_VES', 'TARJETA_VES', 'ZELLE_USD', 'NEQUI_COP'],
    },
  });
  for (const serie of ['F001', 'N001', 'T001']) {
    await prisma.secuenciaDocumento.create({ data: { serie, ultimoNumero: 0 } });
  }

  return {
    adminId: admin.id,
    cajeroId: cajero.id,
    cajero2Id: cajero2.id,
    clienteId: cliente.id,
    martilloId: martillo.id,
    libroId: libro.id,
    cementoId: cemento.id,
  };
}

/** Abre un turno directamente en BD (para preparar escenarios). */
export async function abrirTurnoPrueba(prisma: PrismaClient, usuarioId: string, cajaNumero = 'Caja 1') {
  return prisma.turnoCaja.create({ data: { usuarioAperturaId: usuarioId, cajaNumero, estado: 'ABIERTO' } });
}
