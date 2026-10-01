# Instrucciones para Claude Code — Remediación y Endurecimiento de FerrePro
## Proyecto: Sistema Ferretería (FerrePro) — Guasdualito, Estado Apure

> **Este documento tiene prioridad sobre cualquier funcionalidad nueva del roadmap** (Órdenes de Compra, CxC, CxP, PDFs, ESC/POS, Electron). No se avanza a una fase hasta que la anterior cumpla TODOS sus criterios de aceptación.
>
> Fuente de los hallazgos: `AUDITORIA-SISTEMAS-FERREPRO.md` (ids S1…S11, F1…F11, D1…D8, Q1…Q5). Léelo completo antes de empezar. Lee también `AGENTS.md`.

---

## 0. Reglas de trabajo (obligatorias)

1. **Una fase a la vez, en orden.** Al terminar cada fase: ejecuta `pnpm typecheck && pnpm test`, reporta resultados y **detente para confirmación** antes de pasar a la siguiente.
2. **Antes de editar, verifica el hallazgo.** Para cada ID, confirma en el código (archivo y línea) que sigue vigente y repórtalo. Si ya está corregido o el hallazgo es incorrecto, dilo y sigue; no reescribas a ciegas.
3. **Cambios al esquema Prisma:** muestra el diff del `.prisma` y de la migración **antes de aplicarlo**. Nunca borres datos. Haz respaldo de `prisma/ferreteria.db` antes de cualquier migración.
4. **Cada corrección lleva test.** Un test que falle antes del cambio y pase después. Mantén los 54 tests actuales en verde.
5. **Prohibido imprimir o commitear secretos.** No muestres valores de `.env` en logs, respuestas ni commits. Los `.env` reales jamás van a git; solo `.env.example` con placeholders.
6. **Cambios mínimos y localizados.** No refactorices lo que no esté en la fase. Si ves algo fuera de alcance, anótalo en `docs/DEUDA-TECNICA.md` en vez de arreglarlo.
7. **Commits pequeños** por hallazgo (`fix(S3): ...`, `feat(F1): ...`). Si no es repo git, avisa y crea uno (`git init`) solo con confirmación.
8. **Idioma:** código en inglés o español según el estilo existente del archivo; mensajes de error al usuario en español.
9. Al cierre de cada fase, entrega un **reporte** en `docs/reportes/FASE-N.md`: qué cambió, archivos tocados, tests agregados, pendientes y riesgos residuales.

---

## FASE 0 — Cierre de la superficie de ataque (antes de usar con dinero real)

**Objetivo:** que nadie ajeno pueda entrar, y que no haya secretos ni credenciales conocidas.

### 0.1 Apagar el túnel público y restringir CORS/hosts (S1)
- Eliminar el script `tunnel` del `package.json` raíz (o moverlo a `scripts/dev-tunnel.md` con advertencia). Sacar `cloudflared.exe` del repo.
- `apps/web/vite.config.ts`: quitar `allowedHosts: true`; `host` solo `localhost` salvo variable de entorno explícita.
- `apps/api/src/app.ts`: reemplazar `cors({ origin: true })` por lista blanca leída de `CORS_ORIGIN` (separada por comas); rechazar el resto.
- Documentar en `docs/ACCESO-REMOTO.md` la alternativa segura (Tailscale o Cloudflare Tunnel **con Cloudflare Access**).

### 0.2 Secretos obligatorios y rotación (S3, S10)
- Crear `apps/api/src/config/env.ts` que cargue y **valide** variables al arrancar (zod). Requeridas: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SYNC_API_KEY` (mín. 32 caracteres, no pueden contener cadenas de desarrollo conocidas). Si faltan o son débiles → **el proceso no arranca** con mensaje claro.
- Eliminar TODOS los fallbacks literales en `auth.middleware.ts`, `auth.service.ts` y `sync.routes.ts`; usar `env.JWT_SECRET`, etc.
- Unificar a **un solo** `.env` (raíz) y borrar `apps/api/.env`; dejar `.env.example` con placeholders. Un único punto de carga en `server.ts`.
- Script `scripts/generate-secrets.mjs` que imprima valores nuevos (`crypto.randomBytes(48).toString('base64')`) para que el usuario los pegue; **no** los escribe solo ni los muestra en logs de CI.
- Avisar al usuario que los secretos actuales están comprometidos y deben rotarse (esto invalida las sesiones existentes).

### 0.3 Sin credenciales por defecto (S2)
- `LoginModal.tsx`: inputs vacíos; eliminar el botón/estado "demo" salvo bajo `import.meta.env.DEV`.
- `prisma/seed.ts`: no crear `admin123`/`cajero123` en producción. En `NODE_ENV=production` el seed no crea usuarios.
- **Asistente de primer arranque:** si no existe ningún usuario ADMIN, `GET /api/auth/setup-status` devuelve `{ needsSetup: true }` y `POST /api/auth/setup` (solo mientras no haya ADMIN) crea el primero con contraseña propia (mín. 12 caracteres). Después de creado, ese endpoint responde 403 para siempre. UI mínima en el frontend para este paso.
- Política de contraseñas en `usuario.service` (mín. 10-12, no triviales).

### 0.4 Proteger `/sync` (S4, S5)
- `GET /sync/status` y `POST /sync/retry`: `authenticateToken` + `authorizeRoles(ADMIN)`.
- `POST /sync/push` (modo nube): mantener `x-sync-api-key` con comparación **timing-safe** (`crypto.timingSafeEqual`); **dejar de aceptar la entidad `Usuario`** por sync (ignorar con warning), o exigir firma HMAC del cuerpo.

### 0.5 Rate-limit, helmet y validación (S6, S8, S9)
- Instalar `express-rate-limit` y `helmet`. Login: máx. 5 intentos / 15 min por IP+email, con respuesta 429 genérica.
- `express.json({ limit })`: definir el límite de forma explícita y documentar (las imágenes base64 de producto deben caber o se debe pasar a archivos en disco).
- Añadir validación de esquema con `zod` en los DTO de entrada de auth, usuarios, ventas y caja.
- `errorHandler`: nunca devolver `err.message` crudo; mensaje genérico + `requestId`, y log interno del detalle. Dejar `NODE_ENV=production` por defecto en el entorno empaquetado.

### 0.6 Sesiones revocables (S7, S11)
- `authenticateToken` debe verificar en BD que el usuario siga `activo` y tome el **rol actual** (con caché en memoria de 30-60 s para no castigar el rendimiento).
- Access token 15-30 min + refresh token real: el frontend debe guardar y usar `refreshToken` (renovación silenciosa ante 401). Evaluar guardar el refresh en cookie `httpOnly` + `sameSite=strict`.
- Eliminar el hack de migración de usuario en `getStoredUser()` (`api.ts`).

### 0.7 Backup automático inmediato (D1)
- Activar WAL en SQLite al iniciar (`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;`).
- Servicio `backup.service.ts`: copia consistente (`VACUUM INTO 'ruta'`) **diaria**, **al cerrar turno** y **al arrancar**, a una carpeta configurable (`BACKUP_DIR`) con retención de 30 días y verificación (`PRAGMA integrity_check`) de cada copia.
- Endpoints ADMIN: `POST /api/backup/now`, `GET /api/backup` (lista). Panel mínimo en Configuración.

### ✅ Criterios de aceptación de la Fase 0
- [ ] `grep` no encuentra fallbacks de secretos ni `admin123` en `apps/` (salvo tests aislados y `DEV`).
- [ ] La API **no arranca** sin secretos válidos (test de arranque).
- [ ] `/sync/status` y `/sync/retry` devuelven 401 sin token y 403 con CAJERO (tests de rutas con `supertest`).
- [ ] 6 logins fallidos seguidos → 429.
- [ ] Un usuario desactivado pierde acceso en la siguiente petición (test).
- [ ] Existe backup válido generado y verificado; el test lo restaura en una BD temporal.
- [ ] Origen no permitido en CORS es rechazado (test).
- [ ] Reporte `docs/reportes/FASE-0.md` entregado.

---

## FASE 1 — Integridad del dinero y de la caja

**Objetivo:** que el servidor sea la única fuente de verdad de precios, impuestos, tasas y totales, y que el cuadre de caja sea confiable.

### 1.1 El servidor calcula los montos (F1, F10)
- En `venta.service.crearVenta`: **ignorar** `precioUnitario`, `porcentajeImpuesto` y `tasaAplicada` del request. Leer precio de `Producto.precioVenta`, IVA de `Configuracion.ivaPorcentaje`, tasas VES/COP de `Configuracion`.
- Descuentos: campo explícito `descuento` por línea o global, con tope configurable por rol (CAJERO máx. X %; ADMIN sin tope) y registro de quién lo aplicó.
- Preparar `Producto.exentoIva Boolean @default(false)` y calcular IVA por línea.
- Rechazar tasas desactualizadas: agregar `Configuracion.tasaActualizadaEn` y bloquear cobro en VES/COP si supera el umbral configurable (default 24 h) con mensaje claro.

### 1.2 Pagos obligatorios y consistentes (F2)
- `pagos` obligatorio y no vacío. Validar: método habilitado en `metodosHabilitados`; moneda coincide con el método (`EFECTIVO_COP`⇒COP, `PAGO_MOVIL_VES`/`TARJETA_VES`⇒VES, `*_USD`⇒USD); suma de pagos ≥ total.
- Reemplazar tolerancia fija de $0.05 por una constante nombrada en `config/money.ts`.

### 1.3 Vuelto auditable y esperado de caja correcto (F3)
- `PagoVenta`: agregar `montoRecibido` y `vuelto` (en la **misma moneda** del pago, política ya definida). `montoMoneda` pasa a ser el **neto aplicado**.
- `calcularResumenTurno`: el efectivo esperado = Σ neto de pagos en efectivo + fondo inicial + ingresos manuales − egresos manuales − vuelto entregado por moneda. Documentar la fórmula en el código.
- Migración de datos: para ventas históricas `montoRecibido = montoMoneda` y `vuelto = 0`.

### 1.4 Cierre atómico y turno obligatorio (F4, F6)
- `cerrarTurno` dentro de `prisma.$transaction`; marcar el turno `CERRANDO`/bloqueado para que `crearVenta` falle durante el cierre.
- `crearVenta` debe **fallar** si no hay turno abierto del usuario/caja (mensaje claro). Asignar `turnoCajaId` dentro de la misma transacción de la venta.
- `calcularResumenTurno`: filtrar **solo** por `turnoCajaId` (eliminar el `OR` por rango de fechas).
- Un turno abierto por caja (`cajaNumero`) y un cajero por turno; quitar el `findFirst` global.

### 1.5 Anulación auditable (F5)
- `Venta`: agregar `motivoAnulacion`, `anuladaPorId`, `fechaAnulacion`.
- Si la venta pertenece a un turno **CERRADO**: solo ADMIN, y se registra un `MovimientoCaja` de ajuste en el turno vigente (el Z cerrado **no se modifica**). Test de este flujo.

### 1.6 Dinero sin flotantes (F7)
- Crear `apps/api/src/config/money.ts` con utilidades en **centavos enteros** (o `Decimal`) para suma, redondeo, conversión con tasa y COP entero. Reemplazar todos los `Math.round(x*100)/100` en venta y caja por estas utilidades.
- Tests de propiedad (varios montos/tasas) para asegurar que Σ líneas = subtotal y que la conversión inversa no pierde más de 1 unidad mínima.

### 1.7 Correlativo de comprobante (F9)
- Modelo `SecuenciaDocumento { serie, ultimoNumero }` e incremento dentro de la transacción de la venta. `Venta.numero` único (`B001-000123`). `generarComprobante` usa ese número; rotular el comprobante como **"NO FISCAL"** salvo que el usuario confirme lo contrario con su contador.

### ✅ Criterios de aceptación de la Fase 1
- [ ] Test: un request con `precioUnitario=0` o `porcentajeImpuesto=0` **no altera** el total calculado.
- [ ] Test: venta sin pagos o con pagos insuficientes/mal moneda → rechazada.
- [ ] Test: venta de $15 pagada con $20 efectivo → cuadre de caja correcto (esperado = +$15 neto).
- [ ] Test: no se puede vender sin turno abierto ni durante el cierre; dos cierres simultáneos → uno falla.
- [ ] Test: anular venta de turno cerrado exige ADMIN y genera ajuste en el turno vigente; el Z cerrado queda intacto.
- [ ] Todo el cálculo monetario del servidor pasa por `money.ts`.
- [ ] Numeración correlativa sin huecos bajo concurrencia (test).
- [ ] Reporte `docs/reportes/FASE-1.md` entregado.

---

## FASE 2 — Datos, sincronización y base del esquema

**Objetivo:** que el esquema sea una sola fuente de verdad, con migraciones, y que el sync sea fiable y completo.

### 2.1 Unificar esquema y migraciones (D7, D8)
- Decidir y documentar (`docs/DECISION-ESQUEMA.md`) UNA fuente: preferido, un `schema.prisma` base + generación del esquema cloud por script, o Postgres en ambos lados si es viable. Eliminar `schema.prisma` huérfano y mantener `supabase-schema.sql` solo si se genera automáticamente.
- Pasar de `db push` a **`prisma migrate`** con migraciones versionadas. Al arrancar la app se aplican las pendientes (`migrate deploy`) con respaldo previo automático.
- Quitar el hack `as unknown as PrismaClientLocal` en `lib/prisma.ts` si la unificación lo permite; en caso contrario, encapsularlo en un solo archivo con test.

### 2.2 Rediseño del sync (D2–D6)
- **Procesamiento por ítem:** cada `SyncQueue` item tiene su resultado; un fallo no marca fallidos los demás. Estados: `PENDIENTE`, `SINCRONIZADO`, `ERROR`, `MUERTO` (tras N intentos) con **reintento manual por ítem** desde la UI.
- Backoff real por ítem (`proximoIntentoEn`), no solo contador.
- `registrarSync` **no traga errores**: si no puede encolar, la transacción de negocio falla.
- Ampliar entidades sincronizadas: `TurnoCaja`, `MovimientoCaja`, `MovimientoInventario`, `TasaCambio`, y ahora `PagoVenta` con `montoRecibido/vuelto`.
- **Inventario por deltas:** sincronizar `MovimientoInventario` (eventos) y derivar `stockActual` en la nube; no enviar `stockActual` absoluto como verdad.
- Detección de conflictos con `version`/`updatedAt` (last-write-wins explícito y registrado en una tabla `SyncConflicto`).
- IDs de detalles/pagos siempre generados en origen (UUID); eliminar IDs derivados que colisionan (D6).
- Marcar `SINCRONIZADO` en lote dentro de una transacción.

### 2.3 Restauración desde la UI (D1)
- En Configuración: listar backups, **restaurar** (con confirmación fuerte + backup previo del estado actual) y **exportar** el `.db`.

### ✅ Criterios de aceptación de la Fase 2
- [ ] Una sola fuente de esquema documentada; migración inicial reproducible desde cero y desde la BD actual.
- [ ] Test: un ítem inválido en el lote no bloquea a los demás.
- [ ] Test: `registrarSync` fallido revierte la venta.
- [ ] Test: turnos, movimientos de caja y kárdex llegan a la nube (receptor idempotente).
- [ ] Test: dos aplicaciones del mismo lote no duplican datos.
- [ ] Restauración probada con una BD temporal.
- [ ] Reporte `docs/reportes/FASE-2.md` entregado.

---

## FASE 3 — Ajuste al negocio (ferretería real)

**Objetivo:** que el modelo de datos soporte cómo se vende de verdad en una ferretería de frontera.

### 3.1 Cantidades fraccionadas y unidades (F8)
- `stockActual`, `stockMinimo`, `cantidad` (detalle, kárdex) pasan a decimal (`Decimal(12,3)`); validar por `unidadMedida` si admite fracciones (`UND` no, `M`, `KG`, `L` sí).
- Catálogo de unidades y **presentaciones** (rollo = 100 m, saco = 50 kg) con factor de conversión; la venta puede ser en presentación o unidad base.
- Migrar datos existentes sin pérdida; actualizar POS, kárdex, alertas, reportes e importación/exportación CSV.

### 3.2 Roles y permisos finos
- Agregar rol `ENCARGADO` (inventario sin finanzas ni anulaciones). Matriz de permisos centralizada (`permissions.ts`): descuentos, anulaciones, ajustes de stock, cambio de tasa, ver costos y márgenes. Reemplazar `authorizeRoles` dispersos por `requirePermission(...)`.

### 3.3 Historial de tasas
- `TasaCambioHistorial` (moneda, tasa, fecha, usuario). Cada cambio de tasa registra historial y se sincroniza.

### ✅ Criterios de aceptación de la Fase 3
- [ ] Vender 2.5 m de cable y 0.5 kg de tornillos descuenta stock correctamente; `UND` sigue rechazando fracciones.
- [ ] Venta en presentación (1 rollo) descuenta 100 m y el kárdex lo refleja.
- [ ] Matriz de permisos con tests por rol.
- [ ] Reporte `docs/reportes/FASE-3.md` entregado.

---

## FASE 4 — Calidad, pruebas y mantenibilidad

### 4.1 Pruebas (Q1, Q3)
- Tests de rutas con `supertest` (matriz de roles por endpoint), del receptor de sync y de cierre de caja con vuelto.
- Smoke e2e con Playwright: login → abrir turno → vender con pago mixto (USD+VES+COP) → anular → cerrar turno.
- Eliminar `tx: any` y casts a `any` en repositorios (tipar el cliente de transacción). Meta: `grep -c "any"` en `apps/api/src` reducido y justificado.
- Cobertura mínima reportada (`vitest --coverage`), objetivo ≥ 70 % en services y middlewares.

### 4.2 Refactor del frontend (Q2)
- Dividir `ProductosView`, `PosView`, `CajaView`, `ConfiguracionView`, `VentasHistorialView` y `App.tsx` en componentes y hooks (`useCarrito`, `useCobro`, `useArqueo`, etc.), ninguno > ~400 líneas. Sin cambios de comportamiento; los tests e2e deben seguir verdes.

### 4.3 Higiene y CI (Q4, Q5)
- Un `README.md` operativo (instalar, respaldar, restaurar, rotar secretos, correr tests) y una carpeta `docs/`. Consolidar los informes de estado dispersos en uno solo vigente y archivar el resto en `docs/archivo/`.
- Mover fuera del árbol `stitch_*`, `test_stitch.js`, `cloudflared.exe`.
- GitHub Actions: `install → typecheck → lint → test` en cada push.

### ✅ Criterios de aceptación de la Fase 4
- [ ] CI verde con typecheck, lint y tests; e2e Playwright incluido.
- [ ] Ningún componente de vista supera ~400 líneas.
- [ ] README y docs consolidados.
- [ ] Reporte `docs/reportes/FASE-4.md` entregado.

---

## FASE 5 — Empaquetado Electron y despliegue (recién ahora)

> Solo se inicia con las Fases 0-2 aprobadas.

- **Antes de empaquetar:** reemplazar `bcrypt` (módulo nativo) por `bcryptjs`, o configurar `electron-rebuild`. Incluir los motores de Prisma en `asarUnpack`.
- Proceso principal `main.ts` que lanza la API como proceso hijo en `127.0.0.1` (**nunca** `0.0.0.0`) con puerto libre aleatorio y token interno entre renderer y API.
- `ferreteria.db` y `BACKUP_DIR` en `app.getPath('userData')`; las actualizaciones nunca tocan datos.
- Migraciones automáticas al iniciar con backup previo; si falla, no arranca y muestra pantalla de recuperación con restauración.
- `electron-builder` → instalador `.exe` (NSIS), firma de código si hay certificado, canal de auto-actualización.
- Variables de secretos generadas en el primer arranque y guardadas con `safeStorage` de Electron.
- Prueba en una PC limpia de Windows: instalar → primer arranque → vender → cerrar turno → actualizar versión → verificar que los datos persisten.

### ✅ Criterios de aceptación de la Fase 5
- [ ] Instalador funcional en Windows limpio; datos sobreviven a una actualización.
- [ ] La API no es accesible desde otra máquina de la red.
- [ ] Backup y restauración funcionan desde el instalador.
- [ ] Reporte `docs/reportes/FASE-5.md` entregado.

---

## FASE 6 — Funcionalidad del roadmap (en este orden revisado)

1. **Cuentas por Cobrar (fiado)** — límite y plazo por cliente, venta `A_CREDITO`, abonos multimoneda con recibo, estado de cuenta y cartera vencida.
2. **Órdenes de Compra y recepción** — con costo promedio ponderado.
3. **Cuentas por Pagar** — facturas de proveedor y calendario de vencimientos.
4. **PDF nativo en backend** (`/api/ventas/:id/pdf`).
5. **ESC/POS** (gaveta y corte).
6. **Reportes contables/fiscales** — solo tras validar requisitos con el contador (IGTF, exentos, factura fiscal).

Cada módulo debe nacer con: esquema + migración, sync incluido, permisos en la matriz, tests de servicio y de rutas, y una prueba e2e.

---

## Apéndice A — Mapa hallazgo → fase

| Hallazgo | Fase | | Hallazgo | Fase |
|---|---|---|---|---|
| S1 túnel/CORS | 0.1 | | F7 flotantes | 1.6 |
| S2 credenciales | 0.3 | | F8 fracciones | 3.1 |
| S3 secretos | 0.2 | | F9 correlativo | 1.7 |
| S4/S5 sync auth | 0.4 | | F10 IVA por ítem | 1.1 |
| S6/S8/S9 rate-limit/helmet/validación | 0.5 | | F11 capas | 4.1 |
| S7/S11 sesiones | 0.6 | | D1 backup | 0.7 / 2.3 |
| S10 .env duplicado | 0.2 | | D2–D6 sync | 2.2 |
| F1 precio/IVA/tasa | 1.1 | | D7/D8 esquema | 2.1 |
| F2 pagos | 1.2 | | Q1/Q3 tests/any | 4.1 |
| F3 vuelto | 1.3 | | Q2 componentes | 4.2 |
| F4/F6 cierre/turno | 1.4 | | Q4/Q5 docs/CI | 4.3 |
| F5 anulación | 1.5 | | | |

## Apéndice B — Primer mensaje sugerido para iniciar Code

> Lee `AGENTS.md`, `AUDITORIA-SISTEMAS-FERREPRO.md` y este archivo completo. Empieza SOLO por la **Fase 0**. Para cada punto 0.x: (1) confirma el hallazgo con archivo y línea, (2) implementa el cambio mínimo con su test, (3) haz un commit por hallazgo. No muestres valores de `.env`. Al terminar ejecuta `pnpm typecheck && pnpm test`, genera `docs/reportes/FASE-0.md` y detente a esperar mi confirmación antes de la Fase 1.
