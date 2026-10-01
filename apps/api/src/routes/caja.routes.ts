import { Router } from 'express';
import { CajaController } from '../controllers/caja.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import { RolUsuario } from '@ferreteria/shared';

const router: Router = Router();

// Todas las rutas de caja requieren token JWT
router.use(authenticateToken);

// Consultar turno activo
router.get('/turno-activo', CajaController.getTurnoActivo);

// Apertura de caja (ADMIN y CAJERO)
router.post('/abrir', authorizeRoles(RolUsuario.ADMIN, RolUsuario.CAJERO), CajaController.abrirTurno);

// Registrar ingreso / egreso manual
router.post('/movimiento', authorizeRoles(RolUsuario.ADMIN, RolUsuario.CAJERO), CajaController.registrarMovimiento);

// Resumen del turno (Reporte X parcial)
router.get('/resumen/:id', authorizeRoles(RolUsuario.ADMIN, RolUsuario.CAJERO), CajaController.calcularResumen);

// Cierre de turno y arqueo ciego (Reporte Z)
router.post('/cerrar', authorizeRoles(RolUsuario.ADMIN, RolUsuario.CAJERO), CajaController.cerrarTurno);

// Historial de turnos cerrados (solo ADMIN)
router.get('/historial', authorizeRoles(RolUsuario.ADMIN), CajaController.getHistorial);

// Detalle de un turno por ID
router.get('/:id', authorizeRoles(RolUsuario.ADMIN, RolUsuario.CAJERO), CajaController.getById);

export default router;
