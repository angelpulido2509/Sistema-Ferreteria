import { Router } from 'express';
import { UsuarioController } from '../controllers/usuario.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import { RolUsuario } from '@ferreteria/shared';
import { validateBody } from '../middlewares/validate.middleware.js';
import { crearUsuarioSchema, actualizarUsuarioSchema } from '../schemas/usuario.schema.js';

const router: Router = Router();

// Todas las rutas de usuarios requieren autenticación y rol ADMIN
router.use(authenticateToken);
router.use(authorizeRoles(RolUsuario.ADMIN));

router.get('/', UsuarioController.getAll);
router.post('/', validateBody(crearUsuarioSchema), UsuarioController.create);
router.put('/:id', validateBody(actualizarUsuarioSchema), UsuarioController.update);
router.delete('/:id', UsuarioController.deactivate);

export default router;
