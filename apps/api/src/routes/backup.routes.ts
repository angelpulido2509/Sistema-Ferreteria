import { Router } from 'express';
import { RolUsuario } from '@ferreteria/shared';
import { BackupController } from '../controllers/backup.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router: Router = Router();

// Respaldos de la BD: solo ADMIN.
router.use(authenticateToken, authorizeRoles(RolUsuario.ADMIN));

router.get('/', BackupController.listar);
router.post('/now', BackupController.crearAhora);

export default router;
