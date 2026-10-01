import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import categoriaRoutes from './categoria.routes.js';
import productoRoutes from './producto.routes.js';
import proveedorRoutes from './proveedor.routes.js';
import clienteRoutes from './cliente.routes.js';
import ventaRoutes from './venta.routes.js';
import reportesRoutes from './reportes.routes.js';
import usuarioRoutes from './usuario.routes.js';
import configuracionRoutes from './configuracion.routes.js';
import syncRoutes from './sync.routes.js';
import cajaRoutes from './caja.routes.js';
import backupRoutes from './backup.routes.js';

const router: Router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/categorias', categoriaRoutes);
router.use('/productos', productoRoutes);
router.use('/proveedores', proveedorRoutes);
router.use('/clientes', clienteRoutes);
router.use('/ventas', ventaRoutes);
router.use('/caja', cajaRoutes);
router.use('/reportes', reportesRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/configuracion', configuracionRoutes);
router.use('/sync', syncRoutes);
router.use('/backup', backupRoutes);

export default router;
