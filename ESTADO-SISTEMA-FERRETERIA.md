# Estado General del Sistema y Roadmap de Pendientes — FerrePro Hardware ERP

**Documento elaborado para:** Claude Code / Agentes de Codificación  
**Fecha de actualización:** 2026-09-20  
**Proyecto:** Sistema de Gestión de Ventas e Inventario para Ferretería (FerrePro) — Guasdualito, Apure  
**Arquitectura:** Monorepo con `pnpm workspaces` (React + Vite + TailwindCSS / Node.js + Express + TypeScript + Prisma ORM / PostgreSQL Supabase + SQLite local)

---

## 1. Resumen Ejecutivo de la Arquitectura

```
/apps
  /web        -> Frontend React 18 + Vite + TailwindCSS + vite-plugin-pwa (SPA/PWA responsiva)
  /api        -> Backend Express + TypeScript + Prisma ORM (API REST centralizada)
/packages
  /shared     -> Tipos TypeScript compartidos (DTOs, Enums, Interfaces de API)
/prisma
  schema.prisma        -> Modelo de datos para PostgreSQL (Supabase Cloud)
  schema.local.prisma  -> Modelo de datos para SQLite (Local / Offline)
  supabase-schema.sql  -> DDL SQL directo para Supabase
  ferreteria.db        -> Base de datos SQLite local activa
```

- **Puertos de desarrollo:**
  - Frontend: `http://localhost:5173` (Vite)
  - Backend API: `http://localhost:4000` (Express sobre SQLite local `prisma/ferreteria.db`)
- **Convenciones del proyecto (`AGENTS.md`):**
  - TypeScript en modo estricto (`strict: true`).
  - Entidades de negocio en español (`Producto`, `Venta`, `Cliente`, `Proveedor`).
  - Código técnico en inglés (`controllers`, `services`, `repositories`, `middlewares`).
  - Formato unificado de respuesta de API: `{ "success": true, "data": {}, "error": null }`.
  - Roles autorizados en el sistema: exclusivamente **`ADMIN`** y **`CAJERO`**.
  - Reglas críticas: **Nunca** descontar stock antes de confirmar el pago; toda venta genera movimiento `SALIDA`; anulación revierte stock auditada.

---

## 2. Lo que el Sistema Tiene Implementado Hasta Ahora (100% Operativo)

### A. Módulo de Inventario y Productos (`ProductosView.tsx`)
1. **Gestión Completa de Productos (CRUD):**
   - **Registro de Nuevo Producto:** Formulario validado con código/SKU, nombre, descripción, categoría, precio de compra, precio de venta, stock actual, stock mínimo, unidad de medida (UND, KG, MTS, etc.) y soporte de imagen.
   - **Soporte de Imagen de Producto:**
     - Subida de archivo local (conversión y compresión a base64 / WebP).
     - Entrada de URL externa (`https://...`).
     - Vista previa interactiva en tiempo real.
     - Miniaturas reales en la tabla del catálogo con fallback elegante al icono de herramientas.
     - Imagen destacada en la tarjeta lateral de detalle.
   - **Edición de Producto:** Modal para actualizar cualquier campo del producto (incluyendo cambiar o remover la imagen).
   - **Eliminación de Producto:** Modal de confirmación con advertencia de impacto y eliminación segura.
2. **Control de Stock y Kárdex:**
   - **Ajuste Rápido de Stock:** Modal interactivo con 3 modos:
     - `Entrada (+)`: Suma existencias por compra o recepción.
     - `Salida (-)`: Descuenta existencias por merma, daño o uso interno.
     - `Fijar (=)`: Ajusta el stock directamente tras conteo físico.
     - Previsualización en tiempo real del nuevo stock resultante y campo de motivo obligatorio.
   - **Historial de Movimientos / Kárdex:** Modal detallado que consulta los movimientos históricos (`ENTRADA`, `SALIDA`, `AJUSTE`), cantidades, fechas, motivos y usuario responsable, con botón de impresión.
3. **Importar y Exportar Catálogo:**
   - **Exportar a Excel / CSV:** Genera y descarga el catálogo completo o los productos filtrados con cabeceras estándar. Incluye prefijo **UTF-8 BOM** (`\uFEFF`) para compatibilidad perfecta con Microsoft Excel (sin errores en acentos ni letra `ñ`).
   - **Importar Catálogo (Carga Masiva):**
     - Botón de **Descarga de Plantilla Oficial** (`plantilla_importacion_productos.csv`) con datos de muestra.
     - Zona de carga de archivo CSV (drag & drop o selector de archivos).
     - Parser inteligente con mapeo flexible de columnas en español e inglés.
     - Validación fila por fila (precios numéricos, stock, campos requeridos).
     - Detección automática de SKU existentes para permitir actualización o creación de nuevos.
     - Tabla de previsualización antes de importar con filtros (*Todos*, *Válidos*, *Con Errores*).
     - Barra de progreso interactiva durante la importación por lotes.
4. **Sugerencia de Orden de Compra Automática:**
   - Detección en tiempo real de productos críticos (`stockActual <= stockMinimo`).
   - Modal con cálculo de unidades sugeridas para reponer un buffer óptimo (`(stockMinimo * 2) - stockActual`).
   - Cálculo automático de inversión requerida en USD ($).
   - Botón para descargar la orden en CSV y botón para imprimir.

---

### B. Módulo de Punto de Venta Multimoneda — Guasdualito, Apure (`PosView.tsx`)
1. **Catálogo Rápido y Búsqueda:**
   - Búsqueda por nombre o código de barras (compatible con lectores láser/USB).
   - Filtrado rápido por categorías visuales.
   - Atajos de teclado del POS: `F2` (Nueva Venta), `F4` (Buscar), `F8` (Nuevo Cliente), `F12` (Abrir Cobro), `ESC` (Cerrar).
2. **Soporte Trimonedal y 5 Métodos de Pago Reales de Frontera:**
   - **Dólares (USD):** Moneda ancla de inventario y precios base. Métodos: `EFECTIVO_USD`, `ZELLE_USD`.
   - **Bolívares (VES):** Tasa referencial oficial configurada (ej. 60.00 Bs/$). Métodos: `PAGO_MOVIL_VES`, `TARJETA_VES`.
   - **Pesos Colombianos (COP):** Tasa de frontera Guasdualito/Arauquita configurada (ej. 4,100 COP/$). Método: `EFECTIVO_COP`.
   - Botones de cobro directo agrupados por moneda en la barra de checkout para rellenar en 1 clic.
   - Drawer de cobro multimoneda para **pagos mixtos** (por ejemplo, parte en Efectivo USD, parte en Pago Móvil VES y parte en Pesos COP).
   - **Tasa Congelada por Línea de Pago:** La tasa aplicada se almacena de forma inmutable en `PagoVenta.tasaAplicada` en base de datos.
   - **Calculadora de Vuelto Estricta:** El vuelto se calcula y entrega en la moneda correspondiente al pago recibido, cumpliendo la política operativa de Guasdualito.
3. **Emisión de Comprobante / Ticket (`ComprobanteModal.tsx`):**
   - Formato optimizado para impresoras térmicas (58mm y 80mm) o formato carta/PDF.
   - Muestra totales en USD y referencias convertidas en Bs. y COP.
   - Muestra el desglose detallado de las formas de pago aplicadas con las tasas congeladas de la transacción.
   - Datos fiscales dinámicos configurables de la ferretería.

---

### C. Módulo de Ventas e Historial (`VentasHistorialView.tsx`)
1. **Histórico de Transacciones:**
   - Listado cronológico de ventas con estados (`COMPLETADA`, `ANULADA`).
   - Filtros por rango de fechas, cliente y número de comprobante.
   - Inspección completa de detalles de productos y desglose de formas de pago.
2. **Anulación Transaccional Segura:**
   - Modal de anulación con campo obligatorio de motivo para auditoría.
   - Reversión automática del stock al inventario (`SALIDA` revertida a disponibilidad).
   - Auditoría de usuario que ejecutó la anulación.
3. **Reimpresión de Comprobantes:**
   - Acceso inmediato al comprobante térmico o de media carta para cualquier venta histórica.

---

### D. Módulo de Directorio Comercial / Contactos (`ContactosView.tsx`)
1. **Subpestaña Clientes (`ClientesView.tsx`):**
   - CRUD completo con validación de cédula/RIF único.
   - Cliente por defecto "Consumidor Final" (`V-00000000`) para ventas rápidas de mostrador.
   - Ficha detallada con métricas históricas del cliente (total comprado, ticket promedio, última visita).
2. **Subpestaña Proveedores (`ProveedoresView.tsx`):**
   - CRUD completo con validación de RIF empresarial.
   - Historial de compras y productos suministrados.

---

### E. Módulo de Configuración, Tasas y Sincronización (`ConfiguracionView.tsx`)
1. **Pestaña 1 — Identidad y Datos Fiscales:** Nombre comercial, razón social, RIF, teléfono, dirección y mensaje de garantía al pie del ticket.
2. **Pestaña 2 — Monedas y Tasas de Cambio:**
   - Moneda ancla fija en USD ($).
   - Tasa de Bolívares (VES / USD).
   - Tasa de Pesos Colombianos (COP / USD).
   - Porcentaje de impuesto IVA (16.0% editable).
   - Activación y desactivación individual de métodos de pago.
3. **Pestaña 3 — Operaciones y Parámetros:** Umbral de stock mínimo predeterminado, bloqueo de venta sin stock, formato de ticket.
4. **Pestaña 4 — Usuarios y Roles:** Control de usuarios del sistema (`ADMIN` y `CAJERO`), creación, reseteo de credenciales y desactivación.
5. **Pestaña 5 — Sincronización Híbrida (Outbox a la Nube):**
   - Monitor de estado de conectividad en tiempo real (conectado a nube / offline).
   - Contador de elementos pendientes en cola `SyncQueue`.
   - Contador de errores y botón para forzar sincronización manual.

---

### F. Arquitectura Híbrida Local-First y Resiliencia Offline
1. **Backend Local Embebido:**
   - El POS se comunica exclusivamente con `localhost:4000`, respaldado por SQLite local (`ferreteria.db`).
   - No depende de conexión a internet para vender, consultar catálogo o registrar clientes.
2. **Cola de Sincronización `SyncQueue` en Backend Local:**
   - Registra transacciones con estados `PENDIENTE`, `SINCRONIZADO`, `ERROR`.
   - Worker en segundo plano `SyncService.sincronizarPendientes()` con reintentos progresivos (hasta 5) y backoff.
   - Endpoint receptor en la nube con inserción idempotente (`upsert`).
3. **Contingencia PWA en Frontend (`offlineDb.ts`):**
   - Si la terminal de venta pierde comunicación con el servidor local, las ventas se depositan en una cola local persistente en IndexedDB (`ventas_offline`).
   - Al recuperar la comunicación, el sistema sincroniza automáticamente las ventas pendientes con el backend.
   - Se eliminaron todos los mocks en memoria de `api.ts`, asegurando que las operaciones se persistan en bases de datos reales.

---

## 3. Lo que Falta por Implementar (Roadmap Reordenado)

### Prioridad ALTA Inmediata (Siguiente Iteración)

1. **Cierre de Caja Diario (Arqueo de Caja / Reportes X y Z):**
   - *Dependencia satisfecha:* Multimoneda trimonedal y persistencia local ya completadas.
   - *Alcance a desarrollar:*
     - **Apertura de Caja:** Registro de fondo inicial de caja por separado en Efectivo USD ($) y Efectivo COP (pesos), más bolívares si aplica.
     - **Control de Turno:** Registro de ingresos manuales (aportes de cambio) y egresos manuales (retiros para gastos menores con motivo).
     - **Cierre / Arqueo de Caja:** Conteo ciego por denominación de billetes físicos en USD y COP, contraste automático contra ventas registradas por método de pago (`EFECTIVO_USD`, `EFECTIVO_COP`, `PAGO_MOVIL_VES`, `TARJETA_VES`, `ZELLE_USD`).
     - **Cálculo de Descuadres:** Detección de sobrantes o faltantes por moneda.
     - **Reporte X (parcial) y Reporte Z (cierre final):** Generación e impresión de comprobante térmico de cierre de turno.

2. **Empaquetado de Escritorio con Electron (`electron-builder`):**
   - *Situación actual:* El proyecto corre en desarrollo como dos procesos independientes (`vite` en puerto 5173 y `tsx server.ts` en puerto 4000).
   - *Alcance a desarrollar:*
     - Configuración de Electron como contenedor de escritorio.
     - El proceso principal de Electron arranca el backend Express en segundo plano como subproceso.
     - Reubicación de `ferreteria.db` en la carpeta oficial de datos de usuario del sistema operativo (`app.getPath('userData')`) para garantizar que las actualizaciones del ejecutable `.exe` no sobreescriban la base de datos local.
     - Generación del instalador instalable `.exe` para Windows.

---

### Prioridad MEDIA (Gestión Comercial y Control)

3. **Módulo Formal de Órdenes de Compra y Recepción de Mercancía:**
   - Emisión formal de órdenes a proveedores con estados (`BORRADOR`, `ENVIADA`, `RECIBIDA_PARCIAL`, `RECIBIDA_TOTAL`, `CANCELADA`).
   - Recepción física de bultos con cotejo de cantidades, actualización de stock y ajuste automático de precio de costo ponderado.

4. **Generación de Archivos PDF Nativos en Servidor:**
   - Generación de comprobantes PDF descargables vía `pdf-lib` en endpoint `/api/ventas/:id/pdf` para envío directo por correo electrónico o WhatsApp.

5. **Cuentas por Cobrar (Ventas a Crédito / Fiado):**
   - Modalidad de venta a crédito con asignación de límite a clientes autorizados.
   - Módulo de cobranza, registro de abonos parciales multimoneda y estado de cuenta del cliente.

6. **Cuentas por Pagar (Facturas de Proveedores a Crédito):**
   - Registro de facturas pendientes con proveedores, calendario de vencimientos y comprobantes de egreso.

---

### Prioridad BAJA / FASE 2 (Hardware y Sucursales)

7. **Integración Directa con Hardware ESC/POS:**
   - Envío de comandos directos a impresoras de 80mm/58mm vía Web USB/Serial y apertura automática del cajón monedero.
8. **Reportes Tributarios y de Margen Neto:**
   - Libro de ventas mensual en formato Excel para declaraciones tributarias.
   - Análisis de rentabilidad neta por línea de producto.
9. **Multi-sucursal / Almacenes Secundarios:**
   - Soporte para transferencias entre diferentes bodegas o tiendas.

---

## 4. Matriz Resumen de Estado Real

| Componente | Estado | Notas Técnicas y Auditoría |
|---|---|---|
| Monorepo & Workspaces | ✅ 100% | Configurado con `pnpm`, `@ferreteria/shared` compilado |
| Modelo de Datos Prisma | ✅ 100% | Modelos Postgres y SQLite sincronizados; soporte de imágenes y `SyncQueue` |
| Autenticación & Roles | ✅ 100% | JWT, bcrypt, roles estrictos `ADMIN` y `CAJERO` |
| Catálogo & Productos | ✅ 100% | CRUD completo, carga de imágenes (base64/WebP/URL), kárdex, export/import CSV |
| POS Multimoneda (Guasdualito) | ✅ 100% | 3 monedas (USD, VES, COP) en 5 métodos reales, tasas congeladas en BD, vuelto estricto |
| Comprobante Fiscal / Ticket | ✅ 100% | Impresión térmica con desglose trimonedal y tasas históricas de la transacción |
| Contactos (Clientes / Prov.) | ✅ 100% | Fichas detalladas, cliente mostrador predeterminado, histórico de movimientos |
| Ventas e Historial | ✅ 100% | Listado, anulación con reversión de inventario auditada |
| Configuración y Tasas | ✅ 100% | Pestaña de tasas USD/VES/COP, IVA, métodos habilitados, monitor sync |
| Resiliencia Offline / Local-First | ✅ 100% | SQLite local embebido, cola `SyncQueue` con reintentos, fallback IndexedDB en POS, sin mocks |
| Tests Automatizados Backend | ✅ 100% | **44 tests pasando (8 suites)** con Vitest |
| Arqueo / Cierre de Caja | ⏳ Próximo | Prioridad inmediata; requiere conteo físico separado en USD y COP |
| Empaquetado Electron (.exe) | 📋 Planificado | Instalador Windows y reubicación de `ferreteria.db` en `userData` |
| Órdenes de Compra Formales | 📋 Planificado | Sugerencia automática lista; recepción formal en Fase 2 |
| Cuentas por Cobrar / Pagar | 📋 Planificado | Crédito a clientes y facturas de proveedores |
