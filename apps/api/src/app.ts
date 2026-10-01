import express, { type Application } from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';

export function createApp(): Application {
  const app = express();

  // Middlewares globales
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Rutas de la API
  app.use('/api', routes);

  // Manejador centralizado de errores
  app.use(errorHandler);

  return app;
}
