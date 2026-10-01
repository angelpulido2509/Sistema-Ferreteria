import { Router } from 'express';
import { CategoriaController } from '../controllers/categoria.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import { RolUsuario } from '@ferreteria/shared';

const router: Router = Router();

// Todas las rutas de categorías requieren autenticación
router.use(authenticateToken);

router.get('/', CategoriaController.getAll);
router.get('/:id', CategoriaController.getById);

// Rutas de mutación restringidas a ADMIN
router.post('/', authorizeRoles(RolUsuario.ADMIN), CategoriaController.create);
router.put('/:id', authorizeRoles(RolUsuario.ADMIN), CategoriaController.update);
router.delete('/:id', authorizeRoles(RolUsuario.ADMIN), CategoriaController.delete);

export default router;
