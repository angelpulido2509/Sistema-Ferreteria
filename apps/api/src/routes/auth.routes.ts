import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router: Router = Router();

router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.get('/me', authenticateToken, AuthController.getProfile);

export default router;
