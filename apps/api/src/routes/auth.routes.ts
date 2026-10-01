import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router: Router = Router();

router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.get('/me', authenticateToken, AuthController.getProfile);

// Asistente de primer arranque: sin JWT porque aún no existe ningún usuario ADMIN.
// POST /setup responde 403 en cuanto existe un ADMIN.
router.get('/setup-status', AuthController.setupStatus);
router.post('/setup', AuthController.setup);

export default router;
