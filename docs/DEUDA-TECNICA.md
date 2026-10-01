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
