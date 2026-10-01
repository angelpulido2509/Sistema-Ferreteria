# Deuda técnica registrada

Hallazgos vistos durante la remediación que quedaron **fuera del alcance** de la fase en curso.
Cada entrada indica dónde se vio y la fase sugerida.

| # | Vista en | Descripción | Fase sugerida |
|---|---|---|---|
| DT-01 | Fase 0 | **El cliente generado de Prisma carga por su cuenta el `.env` raíz** al instanciarse (no sobrescribe variables ya definidas). Es el mismo archivo que carga `config/dotenv.ts`, pero es un segundo punto de carga: con `ENV_FILE` apuntando a otro archivo, las variables ausentes se completan desde el `.env` raíz. Se resuelve pasando `datasourceUrl` explícito o con Prisma 7 (sin autocarga). | 2.1 |
| DT-02 | Fase 0 | `auth.service.login` responde "Usuario inactivo" **antes** de comprobar la contraseña: permite saber si un correo corresponde a una cuenta desactivada. Comprobar la contraseña primero y unificar el mensaje. | 4.1 |
| DT-03 | Fase 0 | Los refresh tokens no rotan ni tienen lista de revocación en servidor. Logout solo borra la cookie; un refresh token robado sirve hasta 7 días **salvo** que el usuario se desactive (refresh revalida en BD). Evaluar rotación + tabla de sesiones. | 2 / 5 |
| DT-04 | Fase 0 | El access token sigue en `localStorage` (legible ante XSS). Mitigado con vida de 30 min. Alternativa: mantenerlo solo en memoria y renovarlo con la cookie al recargar. | 4.2 |
| DT-05 | Fase 0 | El candado de `setupInicial` es en memoria (un proceso). Si la API en la nube corre en varias instancias, dos setups simultáneos podrían crear dos ADMIN. Usar restricción en BD. | 2.1 |
| DT-06 | Fase 0 | Imágenes de producto como data URL base64 dentro del JSON y de la BD (límite 8 MB). Redimensionar en el cliente y/o guardar en disco. El frontend no avisa antes de enviar archivos grandes (la API responde 413). | 3 / 4.2 |
| DT-07 | Fase 0 | El outbox local sigue encolando `Usuario`; la nube ahora lo ignora (S5). Definir si la nube necesita usuarios (login en la nube) y cómo provisionarlos. | 2.2 |
| DT-08 | Fase 0 | Muchos controllers responden 500 con `error.message`. Quedó saneado de forma central (`sanitizeServerErrors`), pero lo correcto es lanzar errores tipados y mapearlos en un solo lugar. | 4.1 |
| DT-09 | Fase 0 | `VentaService` consultaba Prisma directamente y su test **leía la BD real** (`prisma/ferreteria.db`) porque Prisma autocargaba el `.env`. Se aisló con un mock; el problema de fondo es F11. | 1.4 / 4.1 |
| DT-10 | Fase 0 | El frontend no tiene infraestructura de tests (Vitest + Testing Library). `LoginModal`, `SetupModal` y `BackupPanel` no tienen tests de componente. | 4.1 |
| DT-11 | Fase 0 | `test_stitch.js` contiene una **API key de Google** en texto plano. Se excluyó de git; hay que **rotarla** en Google Cloud y sacar el archivo del árbol. | 4.3 (rotar ya) |
| DT-12 | Fase 0 | `corepack` no puede lanzar pnpm 12.4.2 (busca `bin/pnpm.cjs`, pnpm 12 trae `.mjs`), por lo que `pnpm typecheck` / `pnpm test` fallan desde la raíz. Workaround: `node %LOCALAPPDATA%\node\corepack\v1\pnpm\12.4.2\bin\pnpm.mjs -r test`. Actualizar corepack o fijar otra versión de pnpm. | 4.3 |
| DT-13 | Fase 0 | Promover un CAJERO a ADMIN sin cambiar contraseña conserva una contraseña de 10 caracteres (la política exige 12 a ADMIN). | 3.2 |
| DT-14 | Fase 0 | `authorizeRoles` devuelve en el 403 la lista de roles requeridos. Menor; unificar mensaje. | 3.2 |
| DT-15 | Fase 0 | `cloudflared.exe` permanece en la carpeta del proyecto por decisión del dueño (ignorado por git; el script `tunnel` se eliminó). | — |
| DT-16 | Fase 0 | Con WAL activo, copiar `ferreteria.db` a mano sin sus archivos `-wal`/`-shm` puede perder transacciones recientes. Usar siempre los respaldos del sistema (Configuración → Operaciones). | 2.3 (documentar en README) |
| DT-17 | Fase 1 | **Los campos nuevos no viajan a la nube** (addendum §7.4): `numero`, `tipoDocumento`, series, `esPrueba`, `vueltoMoneda`, `montoRecibido`/`vuelto`, descuentos, IVA por línea, auditoría de anulación y `AuditoriaEvento`. `schema.cloud.prisma` y Supabase no se modificaron; el receptor de sync solo escribe los campos que ya conocía. | 2.1 / 2.2 |
| DT-18 | Fase 1 | Las ventas **offline** se envían al reconectar y el servidor las valida en ese momento: usan la tasa vigente al sincronizar (no la del momento de la venta) y necesitan turno abierto del cajero. Si la tasa venció o no hay turno, quedan rechazadas en la cola local. | 2.2 |
| DT-19 | Fase 1 | Las ventas `esPrueba` (las 3 históricas, serie T001) todavía cuentan en reportes y en el resumen de caja; excluirlas es parte del addendum §5. | Addendum §5 |
| DT-20 | Fase 1 | La venta de prueba T001-000001 descontó stock real: **CABL-001, 1 unidad**. No se revirtió en la migración; lo hará la purga de pruebas del addendum §5. | Addendum §5 |
| DT-21 | Fase 1 | El Dashboard muestra filas fijas de "ventas recientes" (`#VTA-2024-0941…`, datos de maqueta) y Configuración tiene un "prefijo correlativo" local sin efecto: el correlativo real es `Configuracion.serieNotaEntrega`. | 4.2 |
| DT-22 | Fase 1 | Sin UI todavía para: marcar un producto `exentoIva`, editar `tasaVigenciaHoras` y `descuentoMaxCajeroPct` (solo por API), aplicar descuentos en el POS, cobrar con Nequi y ver el aviso de tasa vencida en el POS (hoy solo en Configuración; el POS muestra el error al confirmar). | 1C / 1D |
| DT-23 | Fase 1 | "Un turno abierto por caja y por cajero" se valida en código dentro de una transacción serializada, no con un índice único parcial (Prisma no los modela). Con varios procesos sobre la misma BD (nube) podría violarse. | 2.1 (migraciones SQL) |
| DT-24 | Fase 1 | `transaccionEscritura` encola las escrituras dentro de **un** proceso (necesario con SQLite). Ejecutar varias instancias de la API sobre el mismo archivo SQLite no está soportado. | 5 (Electron: un proceso) |
| DT-25 | Fase 1 | Tolerancia de pago de 1 centavo (`TOLERANCIA_PAGO_CENTAVOS_USD`). El addendum §3.3 pide rechazar un faltante de 1 centavo, con el último pago absorbiendo el residuo de redondeo: revisar al implementar 1C. | 1C |
| DT-26 | Fase 1 | La migración de la Fase 1 se aplica con `scripts/migrar-fase1.mjs` (SQL a mano + `prisma db execute`); no está en el historial de `prisma migrate`. Debe integrarse como migración base cuando se adopte `prisma migrate`. | 2.1 |
| DT-27 | Fase 1 | `prisma format`/`validate` pueden colgarse esperando el chequeo de versión en red: usar `CHECKPOINT_DISABLE=1`. | 4.3 |
