import { Router } from 'express';
import { VentaController } from '../controllers/venta.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import { RolUsuario } from '@ferreteria/shared';
import { validateBody } from '../middlewares/validate.middleware.js';
import { crearVentaSchema, anularVentaSchema } from '../schemas/venta.schema.js';

const router: Router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

router.get('/', VentaController.getAll);
router.get('/:id', VentaController.getById);
router.get('/:id/comprobante', VentaController.obtenerComprobante);

// Creación de venta permitida a ADMIN y CAJERO
router.post('/', authorizeRoles(RolUsuario.ADMIN, RolUsuario.CAJERO), validateBody(crearVentaSchema), VentaController.crear);

// Anulación de venta restringida exclusivamente a ADMIN
router.post('/:id/anular', authorizeRoles(RolUsuario.ADMIN), validateBody(anularVentaSchema), VentaController.anular);

export default router;
