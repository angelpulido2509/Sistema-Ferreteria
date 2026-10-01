import { Router } from 'express';
import { ProductoController } from '../controllers/producto.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import { RolUsuario } from '@ferreteria/shared';

const router: Router = Router();

// Todas las consultas requieren autenticación
router.use(authenticateToken);

// Alertas de stock crítico
router.get('/alertas-stock', ProductoController.getStockAlerts);

router.get('/', ProductoController.getAll);
router.get('/:id', ProductoController.getById);

// Operaciones de escritura restringidas a ADMIN
router.post('/', authorizeRoles(RolUsuario.ADMIN), ProductoController.create);
router.put('/:id', authorizeRoles(RolUsuario.ADMIN), ProductoController.update);
router.delete('/:id', authorizeRoles(RolUsuario.ADMIN), ProductoController.delete);

// Ajuste de stock y consulta de movimientos (kárdex)
router.post('/:id/ajuste', authorizeRoles(RolUsuario.ADMIN), ProductoController.ajustarStock);
router.get('/:id/movimientos', ProductoController.getMovimientos);

export default router;
