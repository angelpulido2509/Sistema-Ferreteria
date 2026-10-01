// Debe ser el primer import: carga el .env raíz antes de evaluar el resto de módulos.
import './config/dotenv.js';
import { getEnv, EnvValidationError, type Env } from './config/env.js';
import { createApp, parseCorsOrigins } from './app.js';
import { syncService } from './services/sync.service.js';

function cargarConfiguracion(): Env {
  try {
    return getEnv();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

const env = cargarConfiguracion();
const app = createApp({ corsOrigins: parseCorsOrigins(env.CORS_ORIGIN) });

app.listen(env.PORT, () => {
  console.log(`🚀 Servidor API de Ferretería corriendo en http://localhost:${env.PORT}`);
  console.log(`📡 Healthcheck disponible en http://localhost:${env.PORT}/api/health`);
  syncService.startBackgroundWorker();
});
