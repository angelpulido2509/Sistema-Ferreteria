import { Router } from 'express';
import { ReportesController } from '../controllers/reportes.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import { RolUsuario } from '@ferreteria/shared';

const router: Router = Router();

// Todas las rutas de reportes requieren autenticación
router.use(authenticateToken);

// Métricas de resumen accesibles por todos los usuarios autenticados
router.get('/metricas', ReportesController.getMetricas);

// Reportes detallados accesibles por ADMIN
router.get(
  '/ventas-diarias',
  authorizeRoles(RolUsuario.ADMIN),
  ReportesController.getVentasDiarias
);

router.get(
  '/productos-mas-vendidos',
  authorizeRoles(RolUsuario.ADMIN),
  ReportesController.getProductosMasVendidos
);

router.get(
  '/stock-critico',
  authorizeRoles(RolUsuario.ADMIN),
  ReportesController.getStockCritico
);

export default router;
