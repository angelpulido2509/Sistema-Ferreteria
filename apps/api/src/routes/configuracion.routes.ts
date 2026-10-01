import { Router } from 'express';
import { ConfiguracionController } from '../controllers/configuracion.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import { RolUsuario } from '@ferreteria/shared';

const router: Router = Router();

router.use(authenticateToken);

// Cualquier usuario autenticado (ADMIN o CAJERO) puede consultar la configuración y tasas
router.get('/', ConfiguracionController.get);

// Solo ADMIN puede modificar tasas y parámetros del sistema
router.put('/', authorizeRoles(RolUsuario.ADMIN), ConfiguracionController.update);

export default router;
