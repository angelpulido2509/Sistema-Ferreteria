import { Router } from 'express';
import { ProveedorController } from '../controllers/proveedor.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import { RolUsuario } from '@ferreteria/shared';

const router: Router = Router();

// Rutas autenticadas
router.use(authenticateToken);

router.get('/', ProveedorController.getAll);
router.get('/:id', ProveedorController.getById);

// Rutas restringidas a ADMIN
router.post('/', authorizeRoles(RolUsuario.ADMIN), ProveedorController.create);
router.put('/:id', authorizeRoles(RolUsuario.ADMIN), ProveedorController.update);
router.delete('/:id', authorizeRoles(RolUsuario.ADMIN), ProveedorController.delete);

export default router;
