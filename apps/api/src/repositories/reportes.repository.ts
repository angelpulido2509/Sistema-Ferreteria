import { prisma } from '../lib/prisma.js';
import { EstadoVenta } from '@ferreteria/shared';

export class ReportesRepository {
  public async getMetricasResumen() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Ventas de hoy
    const ventasHoy = await prisma.venta.findMany({
      where: {
        fecha: { gte: startOfToday },
        estado: EstadoVenta.COMPLETADA,
      },
      select: { total: true },
    });

    const totalVentasHoy = ventasHoy.length;
    const ingresosHoy = ventasHoy.reduce((acc, v) => acc + Number(v.total), 0);

    // Ventas del mes
    const ventasMes = await prisma.venta.findMany({
      where: {
        fecha: { gte: startOfMonth },
        estado: EstadoVenta.COMPLETADA,
      },
      select: { total: true },
    });

    const totalVentasMes = ventasMes.length;
    const ingresosMes = ventasMes.reduce((acc, v) => acc + Number(v.total), 0);
    const ticketPromedio = totalVentasMes > 0 ? ingresosMes / totalVentasMes : 0;

    // Productos con stock crítico
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      select: { stockActual: true, stockMinimo: true },
    });
    const productosCriticos = productos.filter((p) => p.stockActual <= p.stockMinimo).length;

    // Total de clientes
    const totalClientes = await prisma.cliente.count();

    return {
      ventasHoy: totalVentasHoy,
      ingresosHoy: Math.round(ingresosHoy * 100) / 100,
      ventasMes: totalVentasMes,
      ingresosMes: Math.round(ingresosMes * 100) / 100,
      ticketPromedio: Math.round(ticketPromedio * 100) / 100,
      productosCriticos,
      totalClientes,
    };
  }

  public async getVentasDiarias(dias: number = 30) {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    desde.setHours(0, 0, 0, 0);

    const ventas = await prisma.venta.findMany({
      where: {
        fecha: { gte: desde },
        estado: EstadoVenta.COMPLETADA,
      },
      include: {
        detalles: {
          select: { cantidad: true },
        },
      },
      orderBy: { fecha: 'asc' },
    });

    // Agrupar por fecha (YYYY-MM-DD)
    const agrupado: Record<
      string,
      { fecha: string; totalVentas: number; montoTotal: number; totalArticulos: number }
    > = {};

    for (const v of ventas) {
      const fechaKey = new Date(v.fecha).toISOString().split('T')[0]!;
      if (!agrupado[fechaKey]) {
        agrupado[fechaKey] = {
          fecha: fechaKey,
          totalVentas: 0,
          montoTotal: 0,
          totalArticulos: 0,
        };
      }

      agrupado[fechaKey].totalVentas += 1;
      agrupado[fechaKey].montoTotal += Number(v.total);
      const articulosEnVenta = v.detalles.reduce((sum, d) => sum + d.cantidad, 0);
      agrupado[fechaKey].totalArticulos += articulosEnVenta;
    }

    return Object.values(agrupado).map((item) => ({
      ...item,
      montoTotal: Math.round(item.montoTotal * 100) / 100,
    }));
  }

  public async getProductosMasVendidos(limite: number = 10) {
    // Obtenemos los detalles de ventas completadas
    const detalles = await prisma.detalleVenta.findMany({
      where: {
        venta: {
          estado: EstadoVenta.COMPLETADA,
        },
      },
      include: {
        producto: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
          },
        },
      },
    });

    // Agrupamos por producto
    const mapaProductos: Record<
      string,
      {
        productoId: string;
        codigo: string;
        nombre: string;
        cantidadVendida: number;
        totalGenerado: number;
      }
    > = {};

    for (const d of detalles) {
      let item = mapaProductos[d.productoId];
      if (!item) {
        item = {
          productoId: d.productoId,
          codigo: d.producto.codigo,
          nombre: d.producto.nombre,
          cantidadVendida: 0,
          totalGenerado: 0,
        };
        mapaProductos[d.productoId] = item;
      }

      item.cantidadVendida += d.cantidad;
      item.totalGenerado += Number(d.subtotalLinea);
    }

    return Object.values(mapaProductos)
      .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
      .slice(0, limite)
      .map((p) => ({
        ...p,
        totalGenerado: Math.round(p.totalGenerado * 100) / 100,
      }));
  }

  public async getStockCritico() {
    const productos = await prisma.producto.findMany({
      where: {
        activo: true,
      },
      include: {
        categoria: {
          select: { nombre: true },
        },
      },
      orderBy: {
        stockActual: 'asc',
      },
    });

    return productos
      .filter((p) => p.stockActual <= p.stockMinimo)
      .map((p) => ({
        productoId: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        categoria: p.categoria.nombre,
        stockActual: p.stockActual,
        stockMinimo: p.stockMinimo,
        unidadMedida: p.unidadMedida,
        deficiencia: p.stockMinimo - p.stockActual,
      }))
      .sort((a, b) => b.deficiencia - a.deficiencia);
  }
}

export const reportesRepository = new ReportesRepository();
