# Reporte — Fase 0: Cierre de la superficie de ataque

**Fecha:** 2026-10-01 · **Rama:** `main` (repo git creado en esta fase) · **Estado:** completada, pendiente de aprobación

## ⚠ Acciones obligatorias del dueño antes de usar el sistema

1. **Rotar los secretos.** Los valores actuales del `.env` eran idénticos a los del código fuente y
   se consideran comprometidos. Con este cambio **la API no arranca** hasta rotarlos:
   ```
   node scripts/generate-secrets.mjs
   ```
   Pegar las tres líneas en el `.env` raíz (`SYNC_API_KEY` debe ser igual en la nube). Esto cierra
   todas las sesiones abiertas. Cambiar también `JWT_EXPIRES_IN` a `30m` (si no, se acota solo con un aviso).
2. **Cambiar las contraseñas de las cuentas existentes.** Comprobado sobre una copia de la BD real:
   `admin@ferreteria.com` y `cajero@ferreteria.com` **siguen con `admin123` / `cajero123`**. Como ya
   existe un ADMIN, el asistente de primer arranque no aparece. Entrar como admin → Configuración →
   Usuarios → editar ambos (la nueva política exige 12 caracteres para ADMIN y 10 para CAJERO, con letras y números).
3. **Rotar la API key de Google** que está escrita en `test_stitch.js` (se excluyó de git, pero estuvo en disco y en el túnel).
4. Recomendado: definir `BACKUP_DIR` en otro disco o USB.

## Resumen por hallazgo

| ID | Verificado en | Cambio | Commit |
|---|---|---|---|
| S1 | `package.json:15`, `vite.config.ts:36-38`, `app.ts:10-13` | Script `tunnel` eliminado; Vite solo en `localhost` (salvo `VITE_DEV_HOST`); CORS con lista blanca de `CORS_ORIGIN` y 403 al resto; `docs/ACCESO-REMOTO.md` | `0788bbd` |
| S3, S10 | fallbacks en `auth.middleware.ts:36`, `auth.service.ts:34-35,66-67`, `sync.routes.ts:14`, `sync.service.ts:72`; secretos del `.env` = fallbacks; dos `.env` con `DATABASE_URL` distinto | `config/env.ts` (zod) exige secretos ≥32 caracteres sin cadenas de desarrollo; la API no arranca si fallan. Un solo `.env` (raíz), cargado en `config/dotenv.ts`. `apps/api/.env` borrado. `.env.example` raíz. `scripts/generate-secrets.mjs` | `caeaace` |
| S2 | `LoginModal.tsx:10-11,59-90`, `seed.ts:36-61`; **además** un botón "Cambiar rol" en `App.tsx:538-556` (no listado en la auditoría) que entraba como admin con `admin123` para cualquier usuario | Login vacío, demo solo con `import.meta.env.DEV`; seed sin usuarios salvo `NODE_ENV=development`; `GET /api/auth/setup-status` + `POST /api/auth/setup` (403 cuando ya existe un ADMIN); `SetupModal`; política de contraseñas | `9cbfbfc`, `668c128` |
| S4, S5 | `sync.routes.ts:55,76` sin auth; `sync.service.ts:267-281` aceptaba `Usuario` | `/sync/status` y `/sync/retry` solo ADMIN; `x-sync-api-key` comparada con `timingSafeEqual`; el receptor ignora `Usuario` con warning | `3c85cfe` |
| S6, S8, S9 | sin rate-limit, helmet ni zod; `errorHandler` devolvía `err.message`; `express.json()` sin límite | Login 5 fallos/15 min por IP+email → 429 genérico; helmet; body 8 MB explícito; esquemas zod (auth, usuarios, ventas, caja); 5xx genérico con `ref` (requestId), detalle solo en log; `NODE_ENV=production` por defecto | `89b900b` |
| S7, S11 | middleware solo validaba firma (8 h); frontend no usaba refresh; hack en `api.ts:49-55` | El middleware revalida en BD (activo + rol actual, caché 30 s invalidada al editar); access token ≤ 30 min; refresh en cookie httpOnly SameSite=Strict; `POST /auth/logout`; renovación silenciosa en el frontend; hack eliminado | `c19fbdc` |
| D1 | sin backup ni WAL | WAL al arrancar; `VACUUM INTO` al arrancar, al cerrar turno y cada 24 h; verificación `integrity_check`; retención 30 días; `GET /api/backup`, `POST /api/backup/now` (ADMIN); panel en Configuración → Operaciones | `c5aa9bb` |

Dependencias nuevas (fuera del stack de AGENTS.md §2, exigidas por las instrucciones): `zod`, `helmet`,
`express-rate-limit`, `supertest` (dev) — commit `f8d9911`.

## Criterios de aceptación

- [x] `grep` no encuentra fallbacks de secretos ni `admin123` en `apps/` — solo quedan en tests, en bloques `DEV` (eliminados del build: verificado con grep sobre `apps/web/dist`) y en la lista negra de `passwordPolicy.ts`.
- [x] La API no arranca sin secretos válidos — `config/env.test.ts` lanza `src/server.ts` real con secretos débiles: exit 1, mensaje sin valores.
- [x] `/sync/status` y `/sync/retry`: 401 sin token, 403 CAJERO — `routes/sync.routes.test.ts`.
- [x] 6 logins fallidos → 429 — `app.security.test.ts` y prueba manual.
- [x] Usuario desactivado pierde acceso en la siguiente petición — `routes/auth.sessions.test.ts` y prueba manual.
- [x] Backup válido generado, verificado y restaurado en BD temporal — `services/backup.service.test.ts` (SQLite real).
- [x] Origen no permitido en CORS rechazado — `app.cors.test.ts` y prueba manual.
- [x] Este reporte.

## Verificación

- `pnpm -r typecheck`: sin errores (shared, api, web).
- `pnpm -r test`: **126 tests en verde** (54 originales + 72 nuevos), 20 archivos.
- `pnpm -r build`: OK.
- **Prueba manual contra la API real** (`tsx src/server.ts`, SQLite nueva, `NODE_ENV=production`, secretos
  aleatorios en memoria): **29/29 comprobaciones** — CORS, helmet, setup (débil 400 → 201 → 403), login con
  cookie httpOnly, token de 30 min, refresh, sync 401/403/200, contraseña débil de cajero 400, zod 400,
  desactivación inmediata, backup al arrancar + manual, push con key de desarrollo 401, 429 al 6.º fallo,
  logout, WAL activo. Seed en producción: no creó usuarios.

## Tests agregados

`app.cors.test.ts` (5), `config/env.test.ts` (10, incluye arranque real), `services/passwordPolicy.test.ts` (5),
`services/auth.setup.test.ts` (5), `routes/auth.routes.test.ts` (4), `routes/sync.routes.test.ts` (9),
`app.security.test.ts` (11), `routes/auth.sessions.test.ts` (10), `lib/authUserCache.test.ts` (4),
`services/backup.service.test.ts` (7), `routes/backup.routes.test.ts` (2).

Tests existentes modificados: `sync.service.test.ts` (usaba una key de 13 caracteres), `venta.service.test.ts`
(se le añadió mock de Prisma: **antes consultaba la BD real**), `auth.service.test.ts` (usa `getEnv()`),
`caja.service.test.ts` (mock del servicio de backup).

## Cambios de comportamiento a tener en cuenta

- Rutas públicas nuevas sin JWT (excepciones justificadas a AGENTS.md §5.5): `GET /auth/setup-status`,
  `POST /auth/setup` (solo sin ADMIN, con rate-limit), `POST /auth/refresh` (ya existía; usa la cookie) y
  `POST /auth/logout` (debe funcionar con el token vencido).
- La respuesta de login ya no incluye `refreshToken` en el cuerpo.
- Crear un usuario con un rol inexistente ahora da 400 (antes se convertía en CAJERO en silencio).
- El acceso desde otro equipo de la LAN requiere `VITE_DEV_HOST`, agregar el origen a `CORS_ORIGIN` y, por http, `COOKIE_SECURE=false` (ver `docs/ACCESO-REMOTO.md`).
- La primera vez que arranque, la BD real pasa a modo WAL (aparecen `ferreteria.db-wal` y `-shm`, ignorados por git).

## Pendientes y riesgos residuales

Ver `docs/DEUDA-TECNICA.md` (DT-01 a DT-16). Los más relevantes: Prisma autocarga el `.env` (DT-01),
refresh tokens sin rotación (DT-03), access token en `localStorage` (DT-04), API key de Google expuesta (DT-11)
y `pnpm` vía corepack roto en esta PC (DT-12).
