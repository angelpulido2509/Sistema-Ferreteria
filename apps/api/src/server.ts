import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './app.js';
import { syncService } from './services/sync.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno buscando en apps/api o en la raíz
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = createApp();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor API de Ferretería corriendo en http://localhost:${PORT}`);
  console.log(`📡 Healthcheck disponible en http://localhost:${PORT}/api/health`);
  syncService.startBackgroundWorker();
});
