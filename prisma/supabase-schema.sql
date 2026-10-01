-- =============================================================================
-- ESQUEMA DE BASE DE DATOS PARA SUPABASE (POSTGRESQL) - SISTEMA FERRETERÍA FERREPRO
-- Generado automáticamente desde prisma/schema.cloud.prisma
-- =============================================================================

-- 1. Esquema
CREATE SCHEMA IF NOT EXISTS "public";

-- 2. Enums
DO $$ BEGIN
  CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'CAJERO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoVenta" AS ENUM ('COMPLETADA', 'ANULADA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "Moneda" AS ENUM ('USD', 'VES', 'COP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO_USD', 'EFECTIVO_COP', 'PAGO_MOVIL_VES', 'TARJETA_VES', 'ZELLE_USD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Tablas Principales
CREATE TABLE IF NOT EXISTS "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'CAJERO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "categorias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "proveedores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rif" TEXT NOT NULL,
    "telefono" TEXT,
    "correo" TEXT,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "productos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "imagenUrl" TEXT,
    "categoriaId" TEXT NOT NULL,
    "precioCompra" DECIMAL(12,2) NOT NULL,
    "precioVenta" DECIMAL(12,2) NOT NULL,
    "stockActual" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 5,
    "unidadMedida" TEXT NOT NULL DEFAULT 'UND',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "producto_proveedores" (
    "productoId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    CONSTRAINT "producto_proveedores_pkey" PRIMARY KEY ("productoId","proveedorId")
);

CREATE TABLE IF NOT EXISTS "clientes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "identificacion" TEXT NOT NULL,
    "telefono" TEXT,
    "correo" TEXT,
    "direccion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ventas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "impuesto" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "monedaFuncional" "Moneda" NOT NULL DEFAULT 'USD',
    "totalUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'COMPLETADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "detalles_venta" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(12,2) NOT NULL,
    "subtotalLinea" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "detalles_venta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pagos_venta" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "montoMoneda" DECIMAL(14,2) NOT NULL,
    "tasaAplicada" DECIMAL(14,4) NOT NULL,
    "montoUsd" DECIMAL(12,2) NOT NULL,
    "referencia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pagos_venta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tasas_cambio" (
    "id" TEXT NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "tasaRespectoUsd" DECIMAL(14,4) NOT NULL,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasas_cambio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "configuracion" (
    "id" TEXT NOT NULL,
    "nombreFerreteria" TEXT NOT NULL DEFAULT 'Mi Ferretería',
    "rif" TEXT NOT NULL DEFAULT 'J-00000000-0',
    "direccion" TEXT NOT NULL DEFAULT 'Guasdualito, Apure, Venezuela',
    "telefono" TEXT NOT NULL DEFAULT '0414-0000000',
    "ivaPorcentaje" DECIMAL(5,2) NOT NULL DEFAULT 16.0,
    "stockMinimoAlerta" INTEGER NOT NULL DEFAULT 5,
    "monedaFuncional" "Moneda" NOT NULL DEFAULT 'USD',
    "tasaVes" DECIMAL(14,4) NOT NULL DEFAULT 60.0000,
    "tasaCop" DECIMAL(14,4) NOT NULL DEFAULT 4100.0000,
    "metodosHabilitados" JSONB NOT NULL DEFAULT '["EFECTIVO_USD","EFECTIVO_COP","PAGO_MOVIL_VES","TARJETA_VES","ZELLE_USD"]',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "movimientos_inventario" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- 4. Índices Únicos
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_email_key" ON "usuarios"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "categorias_nombre_key" ON "categorias"("nombre");
CREATE UNIQUE INDEX IF NOT EXISTS "proveedores_rif_key" ON "proveedores"("rif");
CREATE UNIQUE INDEX IF NOT EXISTS "productos_codigo_key" ON "productos"("codigo");
CREATE UNIQUE INDEX IF NOT EXISTS "clientes_identificacion_key" ON "clientes"("identificacion");
CREATE UNIQUE INDEX IF NOT EXISTS "tasas_cambio_moneda_key" ON "tasas_cambio"("moneda");

-- 5. Claves Foráneas (Foreign Keys)
DO $$ BEGIN
  ALTER TABLE "productos" ADD CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "producto_proveedores" ADD CONSTRAINT "producto_proveedores_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "producto_proveedores" ADD CONSTRAINT "producto_proveedores_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ventas" ADD CONSTRAINT "ventas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "detalles_venta" ADD CONSTRAINT "detalles_venta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "detalles_venta" ADD CONSTRAINT "detalles_venta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
