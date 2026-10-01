-- =============================================================================
-- FerrePro — Migración Fase 1 (SQLite local)  ·  20261001_fase1
-- Hallazgos: F1/F10 (precio, IVA por línea, descuentos, tasa vigente), F3 (vuelto),
--            F4 (estado CERRANDO: sin DDL, los enums de SQLite son TEXT),
--            F5 (auditoría de anulación), F9 (correlativo por serie).
-- Incluye la sección 1 del addendum de requerimientos: NEQUI_COP, TipoDocumento,
--   Venta.esPrueba/vueltoMoneda, campos de Configuracion y AuditoriaEvento.
-- Aplicar SOLO con scripts/migrar-fase1.mjs (backup, verificación y guardas).
-- Marcadores que sustituye el script según el flag --historicas-son-prueba:
--   {{ES_PRUEBA}}         0 (ventas reales)  | 1 (el dueño confirmó que son de prueba)
--   {{SERIE_HISTORICA}}   'N001'             | 'T001' (serie aparte, no abre huecos en N001/F001)
-- Todo el script corre en UNA transacción: si algo falla no queda nada a medias.
-- Las FK se desactivan ANTES del BEGIN (dentro de una transacción el PRAGMA no tiene efecto)
-- para que las tablas redefinidas puedan reemplazarse; al final se verifica foreign_key_check.
--
-- No se borra ninguna venta: las ventas reales nunca se borran, se anulan (addendum §5).
-- Si existen ventas sin turno, scripts/migrar-fase1.mjs se detiene ANTES de ejecutar este SQL.
-- =============================================================================
PRAGMA foreign_keys=OFF;
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Esquema (generado con: prisma migrate diff --from-schema-datamodel <antes>
--    --to-schema-datamodel prisma/schema.local.prisma --script; se quitaron sus PRAGMA)
-- -----------------------------------------------------------------------------
-- AlterTable
ALTER TABLE "turnos_caja" ADD COLUMN "vueltoCop" DECIMAL;
ALTER TABLE "turnos_caja" ADD COLUMN "vueltoUsd" DECIMAL;
ALTER TABLE "turnos_caja" ADD COLUMN "vueltoVes" DECIMAL;

-- AlterTable
ALTER TABLE "movimientos_caja" ADD COLUMN "ventaId" TEXT;

-- CreateTable
CREATE TABLE "secuencias_documento" (
    "serie" TEXT NOT NULL PRIMARY KEY,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "auditoria_eventos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "accion" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalle" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
CREATE TABLE "new_productos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "imagenUrl" TEXT,
    "categoriaId" TEXT NOT NULL,
    "precioCompra" DECIMAL NOT NULL,
    "precioVenta" DECIMAL NOT NULL,
    "stockActual" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 5,
    "unidadMedida" TEXT NOT NULL DEFAULT 'UND',
    "exentoIva" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_productos" ("activo", "categoriaId", "codigo", "createdAt", "descripcion", "id", "imagenUrl", "nombre", "precioCompra", "precioVenta", "stockActual", "stockMinimo", "unidadMedida", "updatedAt") SELECT "activo", "categoriaId", "codigo", "createdAt", "descripcion", "id", "imagenUrl", "nombre", "precioCompra", "precioVenta", "stockActual", "stockMinimo", "unidadMedida", "updatedAt" FROM "productos";
DROP TABLE "productos";
ALTER TABLE "new_productos" RENAME TO "productos";
CREATE UNIQUE INDEX "productos_codigo_key" ON "productos"("codigo");
CREATE TABLE "new_ventas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "numero" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL NOT NULL,
    "impuesto" DECIMAL NOT NULL,
    "total" DECIMAL NOT NULL,
    "descuentoTotal" DECIMAL NOT NULL DEFAULT 0,
    "descuentoAplicadoPorId" TEXT,
    "monedaFuncional" TEXT NOT NULL DEFAULT 'USD',
    "totalUsd" DECIMAL NOT NULL DEFAULT 0,
    "tipoDocumento" TEXT NOT NULL DEFAULT 'NOTA_ENTREGA',
    "esPrueba" BOOLEAN NOT NULL DEFAULT false,
    "vueltoMoneda" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'COMPLETADA',
    "turnoCajaId" TEXT,
    "motivoAnulacion" TEXT,
    "anuladaPorId" TEXT,
    "fechaAnulacion" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ventas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ventas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ventas_descuentoAplicadoPorId_fkey" FOREIGN KEY ("descuentoAplicadoPorId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ventas_turnoCajaId_fkey" FOREIGN KEY ("turnoCajaId") REFERENCES "turnos_caja" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ventas_anuladaPorId_fkey" FOREIGN KEY ("anuladaPorId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ventas" ("clienteId", "createdAt", "estado", "fecha", "id", "impuesto", "monedaFuncional", "subtotal", "total", "totalUsd", "turnoCajaId", "updatedAt", "usuarioId") SELECT "clienteId", "createdAt", "estado", "fecha", "id", "impuesto", "monedaFuncional", "subtotal", "total", "totalUsd", "turnoCajaId", "updatedAt", "usuarioId" FROM "ventas";
DROP TABLE "ventas";
ALTER TABLE "new_ventas" RENAME TO "ventas";
CREATE UNIQUE INDEX "ventas_numero_key" ON "ventas"("numero");
CREATE TABLE "new_detalles_venta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ventaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL NOT NULL,
    "descuentoPorcentaje" DECIMAL NOT NULL DEFAULT 0,
    "descuentoMonto" DECIMAL NOT NULL DEFAULT 0,
    "subtotalLinea" DECIMAL NOT NULL,
    "porcentajeImpuesto" DECIMAL NOT NULL DEFAULT 0,
    "impuestoLinea" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "detalles_venta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "detalles_venta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_detalles_venta" ("cantidad", "id", "precioUnitario", "productoId", "subtotalLinea", "ventaId") SELECT "cantidad", "id", "precioUnitario", "productoId", "subtotalLinea", "ventaId" FROM "detalles_venta";
DROP TABLE "detalles_venta";
ALTER TABLE "new_detalles_venta" RENAME TO "detalles_venta";
CREATE TABLE "new_pagos_venta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ventaId" TEXT NOT NULL,
    "metodoPago" TEXT NOT NULL,
    "moneda" TEXT NOT NULL,
    "montoRecibido" DECIMAL NOT NULL DEFAULT 0,
    "vuelto" DECIMAL NOT NULL DEFAULT 0,
    "montoMoneda" DECIMAL NOT NULL,
    "tasaAplicada" DECIMAL NOT NULL,
    "montoUsd" DECIMAL NOT NULL,
    "referencia" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pagos_venta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_pagos_venta" ("createdAt", "id", "metodoPago", "moneda", "montoMoneda", "montoUsd", "referencia", "tasaAplicada", "ventaId") SELECT "createdAt", "id", "metodoPago", "moneda", "montoMoneda", "montoUsd", "referencia", "tasaAplicada", "ventaId" FROM "pagos_venta";
DROP TABLE "pagos_venta";
ALTER TABLE "new_pagos_venta" RENAME TO "pagos_venta";
CREATE TABLE "new_configuracion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombreFerreteria" TEXT NOT NULL DEFAULT 'Mi Ferretería',
    "rif" TEXT NOT NULL DEFAULT 'J-00000000-0',
    "direccion" TEXT NOT NULL DEFAULT 'Guasdualito, Apure, Venezuela',
    "telefono" TEXT NOT NULL DEFAULT '0414-0000000',
    "ivaPorcentaje" DECIMAL NOT NULL DEFAULT 16.0,
    "stockMinimoAlerta" INTEGER NOT NULL DEFAULT 5,
    "monedaFuncional" TEXT NOT NULL DEFAULT 'USD',
    "tasaVes" DECIMAL NOT NULL DEFAULT 60.0000,
    "tasaCop" DECIMAL NOT NULL DEFAULT 4100.0000,
    "tasaActualizadaEn" DATETIME,
    "tasaVigenciaHoras" INTEGER NOT NULL DEFAULT 12,
    "descuentoMaxCajeroPct" DECIMAL NOT NULL DEFAULT 10,
    "facturacionFiscalActiva" BOOLEAN NOT NULL DEFAULT false,
    "modoPruebas" BOOLEAN NOT NULL DEFAULT false,
    "logoPath" TEXT,
    "serieFactura" TEXT NOT NULL DEFAULT 'F001',
    "serieNotaEntrega" TEXT NOT NULL DEFAULT 'N001',
    "igtfActivo" BOOLEAN NOT NULL DEFAULT false,
    "igtfPorcentaje" DECIMAL NOT NULL DEFAULT 3,
    "metodosHabilitados" JSONB NOT NULL DEFAULT ["EFECTIVO_USD","EFECTIVO_COP","PAGO_MOVIL_VES","TARJETA_VES","ZELLE_USD"],
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_configuracion" ("direccion", "id", "ivaPorcentaje", "metodosHabilitados", "monedaFuncional", "nombreFerreteria", "rif", "stockMinimoAlerta", "tasaCop", "tasaVes", "telefono", "updatedAt") SELECT "direccion", "id", "ivaPorcentaje", "metodosHabilitados", "monedaFuncional", "nombreFerreteria", "rif", "stockMinimoAlerta", "tasaCop", "tasaVes", "telefono", "updatedAt" FROM "configuracion";
DROP TABLE "configuracion";
ALTER TABLE "new_configuracion" RENAME TO "configuracion";


-- -----------------------------------------------------------------------------
-- 2. Datos
-- -----------------------------------------------------------------------------
-- Históricas: tipoDocumento = NOTA_ENTREGA; esPrueba según la decisión del dueño.
UPDATE "ventas" SET "esPrueba" = {{ES_PRUEBA}};

-- F3: ventas históricas -> montoRecibido = montoMoneda, vuelto = 0
UPDATE "pagos_venta" SET "montoRecibido" = "montoMoneda", "vuelto" = 0;

-- F10: IVA por línea de ventas históricas, prorrateado con la alícuota efectiva de cada venta
UPDATE "detalles_venta" SET
  "porcentajeImpuesto" = COALESCE((SELECT ROUND(CAST(v."impuesto" AS REAL) * 100.0 / CAST(v."subtotal" AS REAL), 2)
                                     FROM "ventas" v WHERE v."id" = "detalles_venta"."ventaId" AND CAST(v."subtotal" AS REAL) > 0), 0),
  "impuestoLinea"      = COALESCE((SELECT ROUND(CAST("detalles_venta"."subtotalLinea" AS REAL) * CAST(v."impuesto" AS REAL) / CAST(v."subtotal" AS REAL), 2)
                                     FROM "ventas" v WHERE v."id" = "detalles_venta"."ventaId" AND CAST(v."subtotal" AS REAL) > 0), 0);

-- F5: recuperar la auditoría de anulaciones desde el kárdex ("Anulación Venta #<id>: <motivo>")
UPDATE "ventas" SET
  "fechaAnulacion"  = (SELECT m."fecha" FROM "movimientos_inventario" m
                        WHERE m."motivo" LIKE 'Anulación Venta #' || "ventas"."id" || ':%' ORDER BY m."fecha" LIMIT 1),
  "anuladaPorId"    = (SELECT m."usuarioId" FROM "movimientos_inventario" m
                        WHERE m."motivo" LIKE 'Anulación Venta #' || "ventas"."id" || ':%' ORDER BY m."fecha" LIMIT 1),
  "motivoAnulacion" = COALESCE((SELECT substr(m."motivo", length('Anulación Venta #' || "ventas"."id" || ': ') + 1)
                                  FROM "movimientos_inventario" m
                                 WHERE m."motivo" LIKE 'Anulación Venta #' || "ventas"."id" || ':%' ORDER BY m."fecha" LIMIT 1),
                               'Sin registro (anulada antes de la Fase 1)')
 WHERE "estado" = 'ANULADA';

-- F5 + addendum: evento de auditoría por cada anulación histórica con autor conocido
INSERT INTO "auditoria_eventos" ("id", "entidad", "entidadId", "accion", "usuarioId", "motivo", "detalle", "fecha")
SELECT 'mig-fase1-anular-' || "id", 'Venta', "id", 'ANULAR', "anuladaPorId", "motivoAnulacion",
       '{"origen":"migracion-fase1","fuente":"kardex"}', "fechaAnulacion"
  FROM "ventas"
 WHERE "estado" = 'ANULADA' AND "anuladaPorId" IS NOT NULL AND "fechaAnulacion" IS NOT NULL;

-- F9: correlativo de las ventas históricas en orden cronológico (serie N001, o T001 si son de prueba)
UPDATE "ventas" SET "numero" = (
  SELECT {{SERIE_HISTORICA}} || '-' || printf('%06d', x.rn)
    FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "fecha", "id") AS rn FROM "ventas") x
   WHERE x."id" = "ventas"."id");
-- Una fila por serie (F001, N001, T001); la serie histórica continúa tras las ventas migradas.
INSERT INTO "secuencias_documento" ("serie", "ultimoNumero", "updatedAt") VALUES
  ('F001', 0, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  ('N001', 0, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  ('T001', 0, CAST(strftime('%s', 'now') AS INTEGER) * 1000);
UPDATE "secuencias_documento" SET "ultimoNumero" = (SELECT COUNT(*) FROM "ventas") WHERE "serie" = {{SERIE_HISTORICA}};

-- Auditoría del marcado de pruebas (solo si el dueño lo confirmó; usuario = proceso de migración)
INSERT INTO "auditoria_eventos" ("id", "entidad", "entidadId", "accion", "usuarioId", "motivo", "detalle", "fecha")
SELECT 'mig-fase1-marcar-pruebas', 'Venta', NULL, 'MARCAR_PRUEBAS', 'SISTEMA:migracion-fase1',
       'Migración Fase 1: el dueño confirmó que las ventas históricas son de prueba',
       '{"conteo":' || (SELECT COUNT(*) FROM "ventas") || ',"serie":"T001","stockRevertido":false}',
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
 WHERE {{ES_PRUEBA}} = 1;

-- F1: tasaActualizadaEn queda NULL a propósito: hay que confirmar las tasas antes de cobrar en VES/COP.

COMMIT;
PRAGMA foreign_keys=ON;
