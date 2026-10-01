import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Único punto de carga del archivo .env (el de la raíz del monorepo).
 * Se importa primero en server.ts para que las variables existan antes de
 * evaluar cualquier otro módulo (p. ej. lib/prisma.ts lee RUNTIME_MODE al cargar).
 *
 * ENV_FILE permite apuntar a otro archivo (tests de arranque, instalador).
 * dotenv no sobrescribe variables ya definidas en el proceso.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// src/config -> ../../../../.env (raíz). En dist/config la profundidad es la misma.
const ROOT_ENV = path.resolve(__dirname, '../../../../.env');

dotenv.config({ path: process.env.ENV_FILE || ROOT_ENV, quiet: true });
