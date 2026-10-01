# Auditoría de Sistemas — FerrePro Hardware ERP
**Cliente:** Sistema Ferretería — Guasdualito, Apure
**Fecha:** 2026-10-01
**Alcance:** revisión estática de código y configuración (backend completo de ventas/caja/sync/auth, esquema Prisma, rutas, middlewares, `.env`, capa `lib/` del frontend, `LoginModal`, `vite.config`, scripts del monorepo) contrastada contra `INFORME-ESTADO-ACTUAL-Y-ROADMAP.md` y `AUDITORIA-CORRECCION.md`.
**Fuera de alcance / no verificado:** no se ejecutaron los 54 tests ni `tsc` (no hay `node_modules` en la copia revisada); no se leyeron línea por línea las vistas gigantes del frontend (`ProductosView` 139 KB, `ConfiguracionView` 78 KB, `PosView` 77 KB, `CajaView` 69 KB); no se auditó la instancia de Supabase ni su RLS; no verifiqué si la carpeta es un repo git.

---

## 1. Veredicto

La base **es buena**: capas claras (controller → service → repository), TypeScript estricto, tasas congeladas por pago, anulación transaccional con reversión de stock, patrón outbox para sync. Para ser un sistema de mostrador de una sola caja, el diseño funcional está por encima del promedio.

Pero **hoy no está listo para ponerse en producción ni para exponerse a Internet**. Hay un bloque de riesgos de seguridad que se explotan con facilidad (sobre todo porque el repo incluye un túnel público), y un bloque de riesgos de integridad del dinero (precios/IVA/tasas que manda el cliente, cuadre de caja con lógica dudosa, sync incompleto). El informe marca "100%" en módulos que, a nivel de reglas de negocio, aún tienen huecos.

| Área | Calificación | Comentario |
|---|---|---|
| Arquitectura | B+ | Local-first bien pensada; deuda en doble cliente Prisma y 4 fuentes de esquema |
| Seguridad | **D** | Secretos por defecto, credenciales prellenadas, endpoints sin auth, túnel público |
| Integridad financiera | **C-** | El servidor confía en precio/IVA/tasa del cliente; cuadre de caja con puntos ciegos |
| Resiliencia / datos | C | Sin backup; sync parcial y de un solo sentido |
| Calidad / pruebas | B- | 54 tests de servicio; cero de frontend, middleware, sync HTTP ni e2e |
| Mantenibilidad | C+ | Componentes de 70–140 KB, `any` en transacciones, docs contradictorios |
| Ajuste al negocio (ferretería VE/CO) | C+ | Faltan cantidades fraccionadas, fiado, numeración correlativa |

---

## 2. Hallazgos

Severidad: **CRÍTICO** (arreglar antes de usar con dinero real) · **ALTO** · **MEDIO** · **BAJO**.

### 2.1 Seguridad

| # | Sev. | Hallazgo | Evidencia |
|---|---|---|---|
| S1 | CRÍTICO | **Sistema expuesto a Internet con CORS abierto.** El script `pnpm tunnel` publica Vite con cloudflared; Vite corre con `host: true`, `allowedHosts: true` y proxy `/api` → API. La API usa `cors({ origin: true, credentials: true })` (refleja cualquier origen). Toda la API queda alcanzable desde la red pública. | `package.json` (script `tunnel`), `apps/web/vite.config.ts`, `apps/api/src/app.ts` |
| S2 | CRÍTICO | **Credenciales por defecto prellenadas en la UI.** `LoginModal` inicia con `admin@ferreteria.com` / `admin123` ya escritos y un botón "demo" que entra como admin. El seed crea `admin123` y `cajero123`. Combinado con S1, cualquiera que encuentre la URL entra como ADMIN. | `LoginModal.tsx` líneas 10-11, 67; `prisma/seed.ts` 36-57 |
| S3 | CRÍTICO | **Secretos con valor por defecto en el código fuente, y el `.env` usa esos mismos valores.** `JWT_SECRET`, `JWT_REFRESH_SECRET` y `SYNC_API_KEY` tienen fallback literal en `auth.middleware.ts`, `auth.service.ts` y `sync.routes.ts`; mis comprobaciones indican que los valores reales de `.env` y `apps/api/.env` contienen esas mismas cadenas "de desarrollo". Quien lea el código (o este repo) puede **forjar un JWT de ADMIN** y empujar datos a `/api/sync/push`. Además el servidor arranca sin fallar aunque falte el secreto. | `auth.middleware.ts`, `auth.service.ts`, `sync.routes.ts`, `.env` |
| S4 | ALTO | **`GET /api/sync/status` y `POST /api/sync/retry` no tienen autenticación.** Filtran conteos y errores detallados de la cola y permiten disparar el worker. | `sync.routes.ts` |
| S5 | ALTO | **`POST /api/sync/push` (modo nube) acepta `Usuario` con `passwordHash` y `rol`** protegido solo por una API key estática. Con la key por defecto (S3) se puede crear un ADMIN en la nube. | `sync.service.ts` caso `'Usuario'` |
| S6 | ALTO | **Sin límite de intentos de login** (ni rate-limit, ni bloqueo, ni retardo). Con `admin123` esto es trivial de abusar. | `auth.routes.ts` |
| S7 | ALTO | **Tokens no revocables:** `authenticateToken` valida solo la firma; un usuario desactivado o con rol cambiado conserva acceso hasta 8 h. El frontend además no guarda ni usa el `refreshToken`. | `auth.middleware.ts`; `api.ts` |
| S8 | MEDIO | `NODE_ENV=development` en `.env` → el manejador de errores devuelve `err.message` crudo (rutas, mensajes de Prisma). | `errorHandler.middleware.ts` |
| S9 | MEDIO | Sin `helmet`, sin validación de esquema (zod/joi) en el body, JWT en `localStorage`, y `express.json()` con el límite por defecto de 100 KB mientras el informe dice que las imágenes se suben como base64 (probable 413 en producción o cambio de límite sin documentar). | `app.ts`; `api.ts` |
| S10 | MEDIO | Hay **dos `.env`** (raíz y `apps/api`) con valores distintos; el de `apps/api` apunta a PostgreSQL local y el de la raíz a SQLite. Con `dotenv` sin override gana el primero cargado: comportamiento depende del directorio desde el que arranque. | `server.ts`; ambos `.env` |
| S11 | BAJO | Hack en el frontend que reescribe al usuario guardado a "Administrador/admin@ferreteria.com" según su nombre/email (`getStoredUser`). Es un escalamiento de privilegios solo cliente, pero indica código de parche. | `api.ts` |

### 2.2 Integridad financiera y reglas de negocio

| # | Sev. | Hallazgo | Evidencia |
|---|---|---|---|
| F1 | CRÍTICO | **El servidor confía en el precio, el IVA y la tasa que manda el cliente.** `precioUnitario` solo se consulta en BD si viene vacío; `porcentajeImpuesto` lo acepta del request (default 0.16, ignora `Configuracion.ivaPorcentaje`); `tasaAplicada` de cada pago también. Un cajero (o quien robe su token) puede vender a $0, con IVA 0 o declarar una tasa VES/COP inflada para "pagar" con menos dinero real. | `venta.service.ts` `crearVenta` |
| F2 | ALTO | **`pagos` es opcional.** Una venta sin pagos se registra como COMPLETADA y la caja la cuenta como efectivo USD. No hay validación de que cada método pertenezca a su moneda ni de que esté habilitado en `metodosHabilitados`. | `venta.service.ts`; `caja.service.ts` rama `else` |
| F3 | ALTO | **El esperado de efectivo en caja suma el monto recibido (`montoMoneda`), no el neto tras vuelto.** No existe campo de vuelto en `PagoVenta`/`Venta`. Si el cajero recibe $20 por una venta de $15 y da $5 de vuelto, el sistema "espera" $20 en caja → faltantes falsos o, peor, compensaciones. *Verificar con una venta real si el frontend manda el monto neto; si lo hace, entonces no queda rastro auditable del vuelto.* | `caja.service.ts` ~L240-262 |
| F4 | ALTO | **Cierre de turno no atómico y sin candado.** `cerrarTurno` calcula, luego actualiza, sin `$transaction`; una venta que entre en medio queda fuera del Z. Tampoco se impide vender **sin turno abierto** (`turnoCajaId` queda `null`). | `caja.service.ts`; `venta.service.ts` |
| F5 | ALTO | **Ventas de turnos cerrados pueden anularse** sin dejar rastro en el Z ya impreso. Además la anulación no guarda `motivo`, `anuladaPor` ni `fechaAnulacion` en `Venta`; el motivo solo vive como texto en `MovimientoInventario.motivo`. El informe dice que se "registra el usuario" pero no es un campo consultable. | `venta.repository.ts`; `schema.local.prisma` |
| F6 | MEDIO | `calcularResumenTurno` filtra ventas con `OR` entre `turnoCajaId` y ventana de fechas → puede mezclar ventas de otro turno/caja que se solapen en tiempo. `TurnoCaja` es global (`findFirst ABIERTO`): no hay multi-caja real aunque exista `cajaNumero`. | `caja.service.ts` ~L220 |
| F7 | MEDIO | **Dinero con `number` de JS** (`Math.round(x*100)/100`, sumas flotantes) mezclado con `Decimal`. Hoy el error es de centavos, pero con COP (miles) y VES (tasa 4 decimales) se acumula. Tolerancia fija de $0.05 en pagos. | `venta.service.ts`, `caja.service.ts` |
| F8 | MEDIO | **`cantidad` es `Int` y se rechaza lo no entero.** Una ferretería vende cable por metro, tubería, cabillas, pintura por litro, tornillos al peso. Hoy eso obliga a trucos (unidad = centímetro). Cambiar esto más tarde implica migrar stock, kárdex y reportes. | `venta.service.ts`; `schema.local.prisma` (`stockActual Int`) |
| F9 | MEDIO | **Numeración de comprobante falsa:** `FAC-${venta.id.padStart(6,'0')}` sobre un UUID no produce un correlativo; sale un UUID largo con prefijo. No hay secuencia por serie/caja. | `venta.service.ts` `generarComprobante` |
| F10 | MEDIO | IVA único del 16% para todo; sin productos exentos ni alícuotas por ítem. Ver sección 5 (fiscal). | `venta.service.ts` |
| F11 | BAJO | `venta.service` consulta Prisma directo y busca el turno fuera de la transacción de la venta (rompe la capa repository). | `venta.service.ts` |

### 2.3 Sincronización y resiliencia de datos

| # | Sev. | Hallazgo | Evidencia |
|---|---|---|---|
| D1 | ALTO | **No hay backup real.** La BD es un archivo único (`prisma/ferreteria.db`, excluido de git) y el único respaldo es el sync, que es parcial (D2). Un disco dañado o un `.exe` reinstalado = pérdida del negocio. | `.gitignore`; sección Electron del informe |
| D2 | ALTO | **El sync no cubre todo:** solo viajan Categoría, Cliente, Proveedor, Producto, Usuario, Venta y Configuración. **No viajan `TurnoCaja`, `MovimientoCaja`, `MovimientoInventario` ni `TasaCambio`** → la nube no tiene kárdex ni cuadres. | `sync.service.ts` `aplicarItem` |
| D3 | ALTO | **Lote todo-o-nada con bloqueo en cabeza de cola.** Si un solo ítem falla en la nube, se marcan como fallidos los 50 del lote; tras 5 intentos pasan a `ERROR` definitivo, sin reintento manual por ítem ni cola de "muertos". Un registro corrupto puede frenar la sincronización de todos los posteriores. | `sincronizarPendientes` |
| D4 | ALTO | **`registrarSync` traga sus propios errores** (`try/catch` que solo hace `console.error`) dentro de la transacción de la venta: la venta se confirma pero **nunca llega a la cola** → pérdida silenciosa en la nube. | `lib/syncQueue.ts` |
| D5 | MEDIO | **Last-write-wins sin versión ni reloj.** El `Producto` sincroniza `stockActual` absoluto; con 2 puntos de venta, o edición en la nube, se pisa el stock. El sync marca `SINCRONIZADO` fila por fila fuera de transacción. | `sync.service.ts` |
| D6 | MEDIO | Detalles y pagos con id derivado (`${ventaId}_pago_${metodo}`) si falta el id: dos pagos con el mismo método en una venta colisionan y se pierde uno. | `sync.service.ts` caso `'Venta'` |
| D7 | MEDIO | **Cuatro fuentes de verdad del esquema:** `schema.prisma`, `schema.local.prisma`, `schema.cloud.prisma` y `supabase-schema.sql`. Más el hack `as unknown as PrismaClientLocal` para fingir un solo cliente. Ya hay drift en puerta (la nube corre Postgres, local SQLite; enums y `Decimal` se comportan distinto). | `prisma/`, `lib/prisma.ts` |
| D8 | BAJO | `db push` en vez de migraciones versionadas: no hay forma segura de actualizar la BD de clientes ya instalados. | `package.json` `prisma:push:local` |

### 2.4 Calidad, pruebas y mantenibilidad

| # | Sev. | Hallazgo |
|---|---|---|
| Q1 | MEDIO | Los 54 tests son de servicios. No hay tests de: middleware de auth/roles, rutas (supertest), el receptor de sync, ni **ningún** test de frontend. "100%" significa 100% de lo que existe, no cobertura. No pude ejecutarlos en esta revisión. |
| Q2 | MEDIO | Componentes monolíticos (`ProductosView.tsx` 139 KB, `ConfiguracionView` 78 KB, `PosView` 77 KB, `CajaView` 69 KB, `VentasHistorialView` 72 KB, `App.tsx` 36 KB). Difíciles de probar y de modificar sin regresiones. |
| Q3 | MEDIO | `tx: any` en repositorios y casts a `any` en servicios: el "0 errores con `strict`" es en parte aparente. |
| Q4 | BAJO | Documentación dispersa y contradictoria (`ESTADO-SISTEMA`, `REPORTE-ESTADO`, `INFORME`, `AUDITORIA-CORRECCION`, 3 `INSTRUCCIONES-ANTIGRAVITY`, etc.); artefactos de diseño (`stitch_*`), `test_stitch.js` y `cloudflared.exe` (55 MB) dentro del proyecto. |
| Q5 | BAJO | Sin CI, sin lint ejecutado en pipeline, sin `README` operativo único (cómo instalar, respaldar, restaurar). |

### 2.5 Lo que está bien (para que no se pierda)

- Contraseñas con `bcrypt`, mensajes de login genéricos ("Credenciales inválidas").
- RBAC por ruta con `authorizeRoles`; escritura de productos, usuarios, configuración y anulaciones restringidas a ADMIN.
- `crearVentaTransaccional` y `anularVentaTransaccional` realmente usan `$transaction`, validan stock y escriben kárdex.
- Tasa congelada por línea de pago (`PagoVenta.tasaAplicada`): decisión correcta para auditoría.
- Conteo ciego y separación de efectivo por moneda en el arqueo.
- Outbox con backoff y detección de conectividad real (no solo `navigator.onLine`).
- Contingencia IndexedDB en el cliente.

---

## 3. Recomendaciones priorizadas

### Fase 0 — Antes de tocar dinero real (≈ 1 semana)

1. **Apagar el túnel público** hasta que existan S2/S3/S6. Si necesitas acceso remoto como dueño, usa Tailscale o Cloudflare Tunnel **con Cloudflare Access** (login), no el quick-tunnel anónimo. Poner `allowedHosts` y CORS a una lista explícita (`localhost:5173`).
2. **Rotar todos los secretos**: generar `JWT_SECRET`, `JWT_REFRESH_SECRET` y `SYNC_API_KEY` con `openssl rand -base64 48`; **eliminar los fallbacks del código** y hacer que el servidor **no arranque** si faltan. Tratar los valores actuales como comprometidos.
3. **Quitar credenciales de la UI y del seed de producción.** Eliminar `admin123` prellenado y el botón demo (o dejarlo solo con `import.meta.env.DEV`). Primer arranque = asistente que obliga a crear el ADMIN con contraseña propia (mín. 10-12 caracteres).
4. **Proteger `/sync/status` y `/sync/retry`** con `authenticateToken` + ADMIN. En el receptor cloud, no aceptar `Usuario` por sync (o aceptarlo solo con firma HMAC).
5. **Rate-limit de login** (`express-rate-limit`: p. ej. 5 intentos/15 min por IP+email) y `helmet`.
6. **Revalidar usuario en cada request** (o token corto de 15-30 min + refresh real) para que desactivar a un cajero tenga efecto inmediato.
7. **Backup automático hoy mismo:** copia diaria (y al cerrar turno) de `ferreteria.db` con `VACUUM INTO`/`.backup` a una segunda ubicación (USB/otra carpeta) con retención de 30 días. Activar WAL.

### Fase 1 — Integridad del dinero (1-2 semanas)

8. **El servidor decide los números:** ignorar `precioUnitario`, `porcentajeImpuesto` y `tasaAplicada` del cliente; leer precio de `Producto`, IVA y tasas de `Configuracion`. Permitir descuento solo como campo explícito, con tope por rol y auditoría.
9. **Exigir pagos** que cubran el total, validar que cada `metodoPago` corresponda a su `moneda` y esté habilitado, y registrar **`vuelto` y `montoRecibido` por separado** en `PagoVenta` para que el cuadre use el neto.
10. **Cierre de turno dentro de una transacción**, con bloqueo de nuevas ventas durante el cierre; **prohibir vender sin turno abierto**; resumen filtrado **solo** por `turnoCajaId` (quitar el `OR` por fechas).
11. **Anulación auditable:** agregar `motivoAnulacion`, `anuladaPorId`, `fechaAnulacion` a `Venta`; si el turno está CERRADO exigir ADMIN + generar un movimiento de ajuste en el turno vigente en lugar de modificar el pasado.
12. **Migrar el dinero a enteros/Decimal en el servidor** (centavos USD, centavos VES, pesos COP enteros) y centralizar el redondeo en un único módulo `money.ts` con tests de propiedad.
13. **Correlativo real de comprobante:** tabla `SecuenciaDocumento` (serie + número), asignado en la misma transacción de la venta.

### Fase 2 — Datos y despliegue (2-3 semanas)

14. **Unificar el esquema** a una sola fuente (Prisma multi-provider es limitado; lo más sano: un solo `schema.prisma` + generador que produzca la variante cloud, o usar Postgres también en local con SQLite solo si es indispensable) y **pasar a `prisma migrate`** con migraciones versionadas aplicadas al arrancar la app instalada.
15. **Rediseñar el sync:** (a) procesar por ítem con resultado individual y cola de errores reintentable; (b) agregar `TurnoCaja`, `MovimientoCaja`, `MovimientoInventario`, `TasaCambio`; (c) sincronizar **eventos de inventario (deltas)** en vez de `stockActual` absoluto; (d) `registrarSync` debe **fallar la transacción** si no puede encolar; (e) `version`/`updatedAt` para detectar conflictos.
16. **Electron:** antes de empaquetar, cambiar `bcrypt` (módulo nativo) por `bcryptjs` o recompilar con `electron-rebuild`; incluir los binarios del query engine de Prisma en `asarUnpack`; `ferreteria.db` en `userData`; backup automático y **exportar/restaurar desde la UI**; firma del instalador y canal de auto-actualización.
17. **Lectura segura de la BD en la nube:** activar RLS en Supabase y que solo el rol de servicio escriba; la `anon key` jamás en el cliente.

### Fase 3 — Producto (ajuste al negocio)

18. **Reordenar el roadmap.** Yo subiría **Cuentas por Cobrar (fiado)** por encima de Órdenes de Compra y PDFs: en una ferretería de frontera el crédito a clientes/contratistas es parte central del flujo de caja. Y subiría **cantidades fraccionadas y unidades/presentaciones** (metro/rollo, kg/saco, litro/galón) antes de seguir cargando inventario real.
19. **Roles:** hoy solo ADMIN/CAJERO. Considerar `ENCARGADO` (inventario sin acceso a reportes financieros ni anulaciones) y permisos finos (descuentos, anulaciones, ajustes de stock, cambio de tasa).
20. **Tasa de cambio:** guardar historial (`TasaCambioHistorial`) y alertar si la tasa tiene más de N horas sin actualizar; el cajero no debería poder cobrar con una tasa vencida.
21. **Pruebas:** tests de rutas con `supertest` (matriz de roles), tests del receptor de sync (idempotencia, orden), test de cierre de caja con vuelto, y un smoke e2e con Playwright del flujo vender → cobrar mixto → cerrar turno. Meter `typecheck + test + lint` en CI.
22. **Refactor del frontend** por vistas: dividir `ProductosView`, `PosView`, `CajaView` y `ConfiguracionView` en componentes + hooks (`useCarrito`, `useCobro`, `useArqueo`), con TanStack Query para el estado de servidor.
23. **Higiene del repo:** consolidar la documentación en un `README` + `docs/` con un solo informe de estado; sacar `cloudflared.exe`, `stitch_*` y scripts de prueba del árbol; añadir `CODEOWNERS`/plantilla de PR.

---

## 4. Plan de acción resumido (orden de ejecución)

| Orden | Acción | Esfuerzo | Riesgo que elimina |
|---|---|---|---|
| 1 | Apagar túnel + rotar secretos + quitar `admin123` | 0.5 día | S1, S2, S3 |
| 2 | Auth en `/sync/*`, rate-limit, helmet, revocación | 1-2 días | S4–S7 |
| 3 | Backup automático + WAL | 0.5 día | D1 |
| 4 | Servidor decide precio/IVA/tasa; pagos obligatorios; vuelto | 2-3 días | F1–F3 |
| 5 | Cierre atómico, turno obligatorio, anulación auditable | 2-3 días | F4–F6 |
| 6 | Correlativo de comprobante | 1 día | F9 |
| 7 | Rediseño del sync y unificación de esquema + migraciones | 1-2 semanas | D2–D8 |
| 8 | Cantidades fraccionadas | 3-5 días | F8 |
| 9 | Electron con bcryptjs/Prisma engines/backup/auto-update | 1-2 semanas | Despliegue |
| 10 | CxC → OC → CxP → PDF → ESC/POS | según prioridad | Funcionalidad |

---

## 5. Cumplimiento fiscal (a validar con tu contador)

No soy contador ni abogado; esto son puntos a confirmar, no afirmaciones legales:

- Los comprobantes actuales son "comprobantes de venta" internos. Confirmar con tu contador si el negocio necesita **factura fiscal** (máquina fiscal / imprenta digital autorizada por el SENIAT) y rotular claramente el comprobante como **"no fiscal"** si no lo es.
- Confirmar el tratamiento del **IGTF** sobre pagos en divisas (USD efectivo / Zelle) y si aplica a tu condición de contribuyente; hoy el sistema no lo calcula.
- Confirmar productos **exentos** de IVA y si necesitas alícuotas por ítem.
- Para el lado colombiano (cobros en COP), el sistema registra el pago en pesos pero no emite nada para DIAN; solo es contabilidad interna.
- Conservar los registros (ventas, cierres Z, kárdex) el tiempo que exija la normativa: otro motivo para el backup de la Fase 0.

---

## 6. Observaciones sobre el informe de estado

- "Módulos al 100%" refleja **funcionalidad presente**, no robustez. Por los hallazgos F1–F6, el POS y la caja deberían figurar como **"funcionales, con brechas de control"**.
- "Eliminado el almacenamiento exclusivo en `localStorage`" es correcto para la configuración, pero **el token y el usuario siguen en `localStorage`** (S9, S11).
- "Anulación con registro del usuario" → hoy el usuario queda solo en el movimiento de inventario, no en la venta (F5).
- "Conexión: el frontend nunca depende de internet" es correcto con el backend local, **pero el script de túnel contradice ese principio de aislamiento** (S1).
- El roadmap omite seguridad, backup, migraciones y pruebas e2e: deberían ser ítems explícitos de prioridad ALTA, por delante de Electron.

---

*Revisión basada en el código y configuración disponibles al 2026-10-01. Los hallazgos marcados "verificar" requieren una prueba funcional en el sistema en ejecución para confirmarse.*
