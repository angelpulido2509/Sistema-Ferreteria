import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { loginRateLimiter, authPublicRateLimiter } from '../middlewares/rateLimit.middleware.js';
import { loginSchema, refreshSchema, setupSchema } from '../schemas/auth.schema.js';

const router: Router = Router();

router.post('/login', loginRateLimiter, validateBody(loginSchema), AuthController.login);
router.post('/refresh', authPublicRateLimiter, validateBody(refreshSchema), AuthController.refresh);
// Sin JWT a propósito: debe poder cerrar sesión con el access token ya expirado.
router.post('/logout', AuthController.logout);
router.get('/me', authenticateToken, AuthController.getProfile);

// Asistente de primer arranque: sin JWT porque aún no existe ningún usuario ADMIN.
// POST /setup responde 403 en cuanto existe un ADMIN.
router.get('/setup-status', AuthController.setupStatus);
router.post('/setup', authPublicRateLimiter, validateBody(setupSchema), AuthController.setup);

export default router;
