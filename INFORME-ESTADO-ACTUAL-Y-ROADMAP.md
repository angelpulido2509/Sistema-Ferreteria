# Informe de Estado del Sistema y Hoja de Ruta (Roadmap)
## FerrePro Hardware ERP — Guasdualito, Estado Apure
**Fecha de actualización:** 2026-10-01  
**Entorno de ejecución:** Monorepo `pnpm workspaces` (React 18 + Vite / Node.js + Express + Prisma / SQLite local + Supabase Postgres)

---

## 1. Resumen Ejecutivo de Arquitectura

El sistema está concebido bajo una arquitectura **Local-First con resiliencia total ante fallos de conexión**, adaptada específicamente a las condiciones operativas y comerciales de **Guasdualito (zona fronteriza Apure - Arauca)**:

```
/apps
  /web        -> Frontend SPA/PWA en React 18 + Vite + TailwindCSS + TanStack Query
  /api        -> Backend REST en Express + TypeScript + Prisma ORM
/packages
  /shared     -> Tipos TypeScript y DTOs compartidos (@ferreteria/shared)
/prisma
  schema.local.prisma  -> Esquema SQLite activo para operación local (ferreteria.db)
  schema.cloud.prisma  -> Esquema PostgreSQL para sincronización en la nube (Supabase)
  ferreteria.db        -> Base de datos SQLite local embebida
```

* **Frontend:** `http://localhost:5173` (Vite)
* **Backend API:** `http://localhost:4000` (Express)
* **Conexión:** El frontend se comunica exclusivamente con la API local; nunca depende de conexión a internet para vender o consultar existencias.

---

## 2. Estado de Calidad y Verificación Técnica

* **Compilación TypeScript:**
  * `apps/web`: **0 errores** con `strict: true`.
  * `apps/api`: **0 errores** con `strict: true`.
  * `packages/shared`: Compilación limpia.
* **Cobertura de Tests Automatizados (`vitest`):**
  * **54 de 54 tests aprobados (100% de éxito en 9 suites)**:
    1. `caja.service.test.ts` (10 tests) — Apertura, movimientos manuales, conteo ciego, cuadres y Reportes X/Z.
    2. `sync.service.test.ts` (9 tests) — Encolamiento, reintentos con backoff y resolución de conflictos.
    3. `venta.service.test.ts` (7 tests) — Descuento de stock, pagos mixtos multimoneda, tasas congeladas, anulación transaccional.
    4. `auth.service.test.ts` (5 tests) — Autenticación JWT, contraseñas con bcrypt y roles.
    5. `producto.service.test.ts` (5 tests) — CRUD, validación de SKU y ajustes de stock.
    6. `cliente.service.test.ts` (5 tests) — CRUD y validación de documentos de identidad.
    7. `reportes.service.test.ts` (5 tests) — Métricas de ventas, rentabilidad y productos top.
    8. `proveedor.service.test.ts` (5 tests) — Registro y consulta de proveedores.
    9. `configuracion.service.test.ts` (3 tests) — Lectura y actualización de tasas y parámetros.

---

## 3. Módulos Implementados al 100%

### A. Punto de Venta (POS) Multimoneda de Frontera (`PosView.tsx`)
* **Contexto Trimonedal Real:**
  * **USD ($):** Moneda ancla de inventario y valoración contable. Métodos: `EFECTIVO_USD`, `ZELLE_USD`.
  * **VES (Bs.):** Moneda nacional con tasa referencial BCV. Métodos: `PAGO_MOVIL_VES`, `TARJETA_VES`.
  * **COP (Pesos):** Moneda física circulante en frontera Guasdualito/Arauca. Método: `EFECTIVO_COP`.
* **Drawer de Cobro Multimoneda:**
  * Agrupación visual por moneda.
  * Soporte de **pagos mixtos** (ej. cobrar una venta combinando Efectivo USD + Pago Móvil Bs. + Pesos COP).
  * **Tasas Congeladas en BD:** La tasa aplicada se guarda de forma inmutable por línea de pago en `PagoVenta.tasaAplicada` para auditoría y cuadre histórico.
  * **Política Estricta de Vuelto:** El vuelto se calcula y entrega en la misma moneda del pago recibido, evitando distorsiones por conversión cambiaria.
* **Atajos de Teclado POS:** `F2` (Nueva Venta), `F4` (Buscar), `F8` (Nuevo Cliente), `F12` (Abrir Cobro), `ESC` (Cerrar).
* **Emisión de Comprobante Térmico:** Formato para impresoras de 58mm y 80mm o carta/PDF con desglose de métodos y tasas aplicadas (`ComprobanteModal.tsx`).

### B. Control de Caja, Turnos y Arqueo (`CajaView.tsx`)
* **Apertura de Turno:** Registro obligatorio de fondo de cambio inicial desglosado en USD ($), COP (pesos) y VES (bolívares).
* **Movimientos Manuales de Caja:** Registro de Entradas y Salidas de dinero con motivo obligatorio y moneda específica (ej. retiro para flete menor o pago de servicios).
* **Cierre y Arqueo Ciego:**
  * El cajero cuenta el efectivo físico sin ver los totales del sistema.
  * **Conteo físico separado:** Efectivo USD y Efectivo COP se cuentan en cajas independientes.
  * Cotejo automático contra ventas registradas por método de pago.
  * Detección exacta de sobrantes o faltantes por moneda.
* **Reportes Fiscales de Turno:**
  * **Reporte X:** Corte parcial informativo sin cerrar turno.
  * **Reporte Z:** Cierre definitivo de turno con bloqueo de nuevas operaciones hasta nueva apertura.
  * Vista previa e impresión térmica de comprobantes de arqueo.
* **Historial de Turnos:** Consulta histórica de turnos cerrados con auditoría de usuario de apertura y cierre.

### C. Inventario, Catálogo y Kárdex (`ProductosView.tsx`)
* **Gestión Completa de Productos (CRUD):** Código/SKU, nombre, descripción, categoría, costo, precio de venta, stock actual, stock mínimo y unidad de medida.
* **Soporte de Imágenes de Producto:**
  * Subida de archivo local con compresión automática a base64 / WebP.
  * Enlace por URL externa.
  * Miniaturas en catálogo y visualización destacada en la tarjeta lateral de detalle.
* **Control de Stock y Kárdex:**
  * Ajuste rápido en 3 modos: `Entrada (+)` por compras, `Salida (-)` por mermas/uso interno, `Fijar (=)` por conteo físico.
  * Historial cronológico de movimientos con motivo y usuario responsable.
* **Exportación e Importación Masiva (CSV / Excel):**
  * Exportación con prefijo UTF-8 BOM (`\uFEFF`) para compatibilidad perfecta con Microsoft Excel.
  * Importación con validación fila por fila, descarga de plantilla modelo y barra de progreso.
* **Sugerencia Automática de Compra:** Detección de productos en stock crítico con cálculo de unidades necesarias para stock de seguridad y monto de inversión en USD.

### D. Ventas e Historial Transaccional (`VentasHistorialView.tsx`)
* Consulta y filtrado de ventas por fecha, número de comprobante y cliente.
* Inspección de artículos y desglose de formas de pago aplicadas.
* **Anulación Transaccional Segura:**
  * Campo obligatorio de motivo de anulación para auditoría.
  * **Reversión automática e inmediata de stock** al catálogo (`SALIDA` revertida).
  * Registro del usuario que realizó la anulación.
* Reimpresión directa de comprobantes de venta.

### E. Directorio de Contactos (`ContactosView.tsx`)
* **Clientes:** CRUD con validación de documento de identidad (Cédula / RIF). Cliente por defecto *"Consumidor Final"* (`V-00000000`) para ventas rápidas.
* **Proveedores:** Directorio comercial con RIF y registro de contacto.
* **Ficha Lateral de Inspección:** Visualización inmediata del histórico de compras o suministros de cada contacto.

### F. Configuración y Parámetros del Sistema (`ConfiguracionView.tsx`)
* **Persistencia Centralizada en Base de Datos:** Eliminado el almacenamiento exclusivo en `localStorage`; lectura y guardado vía endpoints protegidos `GET/PUT /api/configuracion`.
* **Monedas y Tasas:** Edición de tasa oficial VES (BCV) y tasa COP de frontera, porcentaje de IVA (16%), activación/desactivación de métodos de pago.
* **Identidad Fiscal:** Nombre comercial, Razón Social, RIF, teléfono, dirección y mensaje de garantía en ticket.
* **Control de Usuarios y Roles:** Exclusivamente roles `ADMIN` y `CAJERO` con cambio rápido de rol en modo prueba.
* **Monitor de Sincronización:** Estado de conexión y visualización de la cola de salida `SyncQueue`.

### G. Arquitectura Local-First y Modo Offline
* **SQLite Local (`ferreteria.db`):** Operatividad continua en el mostrador sin depender de internet.
* **Cola Outbox (`SyncQueue`):** Encolamiento de ventas y operaciones locales con estados (`PENDIENTE`, `SINCRONIZADO`, `ERROR`) y reintentos con backoff exponencial hacia la nube.
* **Contingencia PWA (`offlineDb.ts`):** Almacenamiento temporal en IndexedDB si el frontend pierde conexión con el servidor local.

---

## 4. Hoja de Ruta de Pendientes (Roadmap de Trabajo)

```
[ COMPLETADO ]
├── Módulo de Productos y Kárdex (100%)
├── POS Multimoneda Guasdualito USD/VES/COP (100%)
├── Control de Caja y Arqueo X/Z (100%)
├── Ventas y Anulación Transaccional (100%)
├── Directorio de Contactos (100%)
├── Configuración y Tasas en BD (100%)
└── Tests Unitarios 54/54 (100%)

[ PENDIENTE POR REALIZAR ]
├── PRIORIDAD ALTA
│   └── 1. Empaquetado Desktop con Electron (.exe para Windows)
├── PRIORIDAD MEDIA
│   ├── 2. Módulo Formal de Órdenes de Compra y Recepción
│   ├── 3. Cuentas por Cobrar (Ventas a Crédito / Fiado)
│   ├── 4. Cuentas por Pagar (Facturas de Proveedores)
│   └── 5. Generación Nativa de PDFs en Backend (/api/ventas/:id/pdf)
└── PRIORIDAD BAJA / FASE 2
    ├── 6. Integración Directa con Hardware ESC/POS (Gaveta y Corte)
    └── 7. Reportes Contables y Fiscales Avanzados
```

---

### Detalle de Funcionalidades Pendientes

#### 1. Empaquetado Desktop con Electron (`.exe` para Windows) — Prioridad ALTA
* **Situación actual:** El sistema corre en desarrollo como dos procesos independientes (`pnpm dev:web` en puerto 5173 y `pnpm dev:api` en puerto 4000).
* **Alcance a realizar:**
  1. Configuración de Electron y `electron-builder` en el monorepo.
  2. Proceso principal (`main.ts`) que lanza el backend Express en segundo plano como subproceso invisible.
  3. Reubicación de la base de datos `ferreteria.db` a `app.getPath('userData')` para que las actualizaciones del programa no sobrescriban la información del negocio.
  4. Generación del instalador ejecutable `.exe` para instalación en computadoras de mostrador.

#### 2. Módulo Formal de Órdenes de Compra y Recepción — Prioridad MEDIA
* **Situación actual:** Existe la sugerencia matemática de compra y la exportación en CSV.
* **Alcance a realizar:**
  1. Modelo `OrdenCompra` y `DetalleOrdenCompra` con estados (`BORRADOR`, `EMITIDA`, `RECIBIDA_PARCIAL`, `RECIBIDA_TOTAL`, `CANCELADA`).
  2. Pantalla de recepción física de mercancía contra orden: validación de cantidades recibidas, ingreso automático al stock y recálculo del costo promedio unitario.

#### 3. Cuentas por Cobrar (Ventas a Crédito / Fiado) — Prioridad MEDIA
* **Situación actual:** Todas las ventas se liquidan al contado en el POS.
* **Alcance a realizar:**
  1. Límite de crédito y plazo máximo asignable por cliente en su ficha.
  2. Opción en el POS de cobro a crédito (`A_CREDITO`).
  3. Módulo de Cobranzas: registro de abonos parciales multimoneda (un cliente puede abonar a su deuda en dólares, bolívares o pesos) y emisión de recibo de cobro.
  4. Reporte de cartera vencida y estado de cuenta individual.

#### 4. Cuentas por Pagar (Proveedores) — Prioridad MEDIA
* **Situación actual:** Se registran los datos de contacto de los proveedores pero no facturas pendientes.
* **Alcance a realizar:**
  1. Registro de facturas por pagar a proveedores asociadas a recepciones de mercancía.
  2. Calendario de vencimientos de pagos y registro de egresos de caja o banco vinculados.

#### 5. Generación Nativa de PDFs en Servidor — Prioridad MEDIA
* **Situación actual:** La impresión se realiza en el cliente vía ventana de impresión del navegador (`window.print`).
* **Alcance a realizar:**
  1. Endpoint `/api/ventas/:id/pdf` con `pdf-lib` o `puppeteer`.
  2. Emisión de comprobantes en archivo `.pdf` real para facilitar su envío directo por WhatsApp o correo electrónico sin pasar por la vista de impresión.

#### 6. Integración Directa con Hardware ESC/POS — Prioridad BAJA
* **Alcance a realizar:**
  1. Envío de secuencias de escape ESC/POS directas vía WebUSB o Serial.
  2. Pulso para apertura automática de la gaveta de dinero al completar la venta.
  3. Disparo de corte automático de papel en impresoras térmicas de 80mm.
