import { prisma } from '../apps/api/src/lib/prisma.js';
import bcrypt from 'bcrypt';
import { RolUsuario, Moneda, MetodoPago } from '@ferreteria/shared';
import { Prisma } from '@prisma/client-local';

async function main() {
  console.log('🌱 Inicializando datos base en la base de datos local...');

  // 1. Configuración del sistema
  const configExistente = await prisma.configuracion.findFirst();
  if (!configExistente) {
    await prisma.configuracion.create({
      data: {
        nombreFerreteria: 'Ferretería El Tornillo Fuerte',
        rif: 'J-12345678-9',
        direccion: 'Av. Marqués del Pumar, Guasdualito, Apure, Venezuela',
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
    console.log('✔ Configuración inicial registrada.');
  }

  // 2. Usuarios de demostración: SOLO en desarrollo explícito.
  //    En cualquier otro entorno el primer ADMIN se crea con el asistente
  //    de primer arranque (POST /api/auth/setup) con contraseña propia.
  if (process.env.NODE_ENV === 'development') {
    await crearUsuariosDemo();
  } else {
    console.log('ℹ Seed sin usuarios (NODE_ENV != development): crea el ADMIN desde el asistente de primer arranque.');
  }

  // 3. Cliente Mostrador genérico
  await prisma.cliente.upsert({
    where: { identificacion: 'V-00000000' },
    update: {},
    create: {
      nombre: 'Cliente Mostrador / Venta Rápida',
      identificacion: 'V-00000000',
      telefono: '0000-0000000',
      correo: 'mostrador@ferreteria.com',
      direccion: 'Guasdualito',
    },
  });
  console.log('✔ Cliente mostrador verificado.');

  await crearCatalogoBase();
  console.log('🎉 Seed completado exitosamente.');
}

/** Usuarios con contraseñas conocidas: nunca usar fuera de desarrollo local. */
async function crearUsuariosDemo() {
  const passwordHashAdmin = await bcrypt.hash('admin123', 10);
  const passwordHashCajero = await bcrypt.hash('cajero123', 10);

  await prisma.usuario.upsert({
    where: { email: 'admin@ferreteria.com' },
    update: {},
    create: {
      nombre: 'Administrador FerrePro',
      email: 'admin@ferreteria.com',
      passwordHash: passwordHashAdmin,
      rol: RolUsuario.ADMIN,
      activo: true,
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'cajero@ferreteria.com' },
    update: {},
    create: {
      nombre: 'Cajero Principal',
      email: 'cajero@ferreteria.com',
      passwordHash: passwordHashCajero,
      rol: RolUsuario.CAJERO,
      activo: true,
    },
  });
  console.log('✔ Usuarios DEMO verificados (solo desarrollo).');
}

async function crearCatalogoBase() {
  // 4. Categorías base
  const categoriasData = [
    'Herramientas Manuales',
    'Construcción y Cemento',
    'Pinturas y Acabados',
    'Electricidad e Iluminación',
    'Plomería y Grifería',
  ];

  const catMap = new Map<string, string>();
  for (const nombre of categoriasData) {
    const cat = await prisma.categoria.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    catMap.set(nombre, cat.id);
  }
  console.log('✔ Categorías base verificadas.');

  // 5. Productos base de demostración
  const productosData = [
    {
      codigo: 'MART-001',
      nombre: 'Martillo de Uña 16oz Mango Fibra',
      descripcion: 'Martillo carpintero con mango de fibra de vidrio',
      categoria: 'Herramientas Manuales',
      precioCompra: 7.5,
      precioVenta: 12.0,
      stockActual: 25,
      stockMinimo: 5,
      unidadMedida: 'UND',
    },
    {
      codigo: 'CEMT-001',
      nombre: 'Cemento Gris Tipo I Saco 42.5kg',
      descripcion: 'Cemento portland para construcción en general',
      categoria: 'Construcción y Cemento',
      precioCompra: 6.8,
      precioVenta: 8.5,
      stockActual: 100,
      stockMinimo: 20,
      unidadMedida: 'SACO',
    },
    {
      codigo: 'PINT-001',
      nombre: 'Pintura Caucho Blanco Galón',
      descripcion: 'Pintura tipo B blanco mate para interiores y exteriores',
      categoria: 'Pinturas y Acabados',
      precioCompra: 12.0,
      precioVenta: 18.0,
      stockActual: 30,
      stockMinimo: 6,
      unidadMedida: 'GAL',
    },
    {
      codigo: 'CABL-001',
      nombre: 'Cable Eléctrico THW #12 AWG Rollo 100m',
      descripcion: 'Cable de cobre 100% para instalaciones residenciales',
      categoria: 'Electricidad e Iluminación',
      precioCompra: 32.0,
      precioVenta: 45.0,
      stockActual: 15,
      stockMinimo: 3,
      unidadMedida: 'ROLLO',
    },
    {
      codigo: 'TUBO-001',
      nombre: 'Tubo PVC Presión 1/2 pulgada x 6m',
      descripcion: 'Tubo para aguas blancas PVC alta resistencia',
      categoria: 'Plomería y Grifería',
      precioCompra: 2.5,
      precioVenta: 4.0,
      stockActual: 50,
      stockMinimo: 10,
      unidadMedida: 'TUBO',
    },
    {
      codigo: 'DISC-001',
      nombre: 'Disco de Corte Metal 4 1/2 pulgada x 1mm',
      descripcion: 'Disco abrasivo fino para corte rápido de metal y acero',
      categoria: 'Herramientas Manuales',
      precioCompra: 0.8,
      precioVenta: 1.5,
      stockActual: 120,
      stockMinimo: 25,
      unidadMedida: 'UND',
    },
  ];

  for (const prod of productosData) {
    const categoriaId = catMap.get(prod.categoria)!;
    await prisma.producto.upsert({
      where: { codigo: prod.codigo },
      update: {
        nombre: prod.nombre,
        categoriaId,
        precioCompra: new Prisma.Decimal(prod.precioCompra.toFixed(2)),
        precioVenta: new Prisma.Decimal(prod.precioVenta.toFixed(2)),
        stockActual: prod.stockActual,
        stockMinimo: prod.stockMinimo,
        unidadMedida: prod.unidadMedida,
        activo: true,
      },
      create: {
        codigo: prod.codigo,
        nombre: prod.nombre,
        descripcion: prod.descripcion,
        categoriaId,
        precioCompra: new Prisma.Decimal(prod.precioCompra.toFixed(2)),
        precioVenta: new Prisma.Decimal(prod.precioVenta.toFixed(2)),
        stockActual: prod.stockActual,
        stockMinimo: prod.stockMinimo,
        unidadMedida: prod.unidadMedida,
        activo: true,
      },
    });
  }
  console.log('✔ Productos base de demostración verificados.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
