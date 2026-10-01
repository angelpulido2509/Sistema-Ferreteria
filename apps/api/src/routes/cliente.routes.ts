import { Router } from 'express';
import { ClienteController } from '../controllers/cliente.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import { RolUsuario } from '@ferreteria/shared';

const router: Router = Router();

// Rutas autenticadas
router.use(authenticateToken);

router.get('/', ClienteController.getAll);
router.get('/:id', ClienteController.getById);

// Creación y edición permitida a ADMIN y CAJERO (en caja se registran clientes)
router.post('/', authorizeRoles(RolUsuario.ADMIN, RolUsuario.CAJERO), ClienteController.create);
router.put('/:id', authorizeRoles(RolUsuario.ADMIN, RolUsuario.CAJERO), ClienteController.update);

// Eliminación restringida a ADMIN
router.delete('/:id', authorizeRoles(RolUsuario.ADMIN), ClienteController.delete);

export default router;
