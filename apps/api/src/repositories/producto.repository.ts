import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client-local';
import { registrarSync } from '../lib/syncQueue.js';
import { OperacionSync } from '@ferreteria/shared';

export interface ProductoFilters {
  categoriaId?: string;
  search?: string;
  soloActivos?: boolean;
}

export class ProductoRepository {
  public async findAll(filters: ProductoFilters = {}) {
    const where: any = {};

    if (filters.soloActivos !== false) {
      where.activo = true;
    }

    if (filters.categoriaId) {
      where.categoriaId = filters.categoriaId;
    }

    if (filters.search) {
      where.OR = [
        { nombre: { contains: filters.search } },
        { codigo: { contains: filters.search } },
      ];
    }

    return prisma.producto.findMany({
      where,
      include: {
        categoria: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  public async findById(id: string) {
    return prisma.producto.findUnique({
      where: { id },
      include: {
        categoria: true,
      },
    });
  }

  public async findByCodigo(codigo: string) {
    return prisma.producto.findUnique({
      where: { codigo },
      include: {
        categoria: true,
      },
    });
  }

  public async findStockAlerts() {
    const productos = await prisma.producto.findMany({
      where: {
        activo: true,
      },
      include: {
        categoria: true,
      },
      orderBy: { stockActual: 'asc' },
    });

    return productos.filter(p => p.stockActual <= p.stockMinimo);
  }

  public async create(data: {
    codigo: string;
    nombre: string;
    descripcion?: string | null;
    imagenUrl?: string | null;
    categoriaId: string;
    precioCompra: number | Prisma.Decimal;
    precioVenta: number | Prisma.Decimal;
    stockActual?: number;
    stockMinimo?: number;
    unidadMedida?: string;
    exentoIva?: boolean;
  }) {
    const producto = await prisma.producto.create({
      data: {
        codigo: data.codigo.trim().toUpperCase(),
        nombre: data.nombre.trim(),
        descripcion: data.descripcion ? data.descripcion.trim() : null,
        imagenUrl: data.imagenUrl ? data.imagenUrl.trim() : null,
        categoriaId: data.categoriaId,
        precioCompra: new Prisma.Decimal(data.precioCompra.toString()),
        precioVenta: new Prisma.Decimal(data.precioVenta.toString()),
        stockActual: data.stockActual ?? 0,
        stockMinimo: data.stockMinimo ?? 5,
        unidadMedida: data.unidadMedida ? data.unidadMedida.trim().toUpperCase() : 'UND',
        exentoIva: data.exentoIva ?? false,
      },
      include: {
        categoria: true,
      },
    });

    await registrarSync('Producto', producto.id, OperacionSync.CREAR, producto as unknown as Record<string, unknown>);
    return producto;
  }

  public async update(
    id: string,
    data: {
      codigo?: string;
      nombre?: string;
      descripcion?: string | null;
      imagenUrl?: string | null;
      categoriaId?: string;
      precioCompra?: number | Prisma.Decimal;
      precioVenta?: number | Prisma.Decimal;
      stockActual?: number;
      stockMinimo?: number;
      unidadMedida?: string;
      exentoIva?: boolean;
      activo?: boolean;
    }
  ) {
    const updateData: any = {};

    if (data.codigo !== undefined) updateData.codigo = data.codigo.trim().toUpperCase();
    if (data.nombre !== undefined) updateData.nombre = data.nombre.trim();
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion ? data.descripcion.trim() : null;
    if (data.imagenUrl !== undefined) updateData.imagenUrl = data.imagenUrl ? data.imagenUrl.trim() : null;
    if (data.categoriaId !== undefined) updateData.categoriaId = data.categoriaId;
    if (data.precioCompra !== undefined) updateData.precioCompra = new Prisma.Decimal(data.precioCompra.toString());
    if (data.precioVenta !== undefined) updateData.precioVenta = new Prisma.Decimal(data.precioVenta.toString());
    if (data.stockActual !== undefined) updateData.stockActual = data.stockActual;
    if (data.stockMinimo !== undefined) updateData.stockMinimo = data.stockMinimo;
    if (data.unidadMedida !== undefined) updateData.unidadMedida = data.unidadMedida.trim().toUpperCase();
    if (data.exentoIva !== undefined) updateData.exentoIva = data.exentoIva;
    if (data.activo !== undefined) updateData.activo = data.activo;

    const producto = await prisma.producto.update({
      where: { id },
      data: updateData,
      include: {
        categoria: true,
      },
    });

    await registrarSync('Producto', producto.id, OperacionSync.ACTUALIZAR, producto as unknown as Record<string, unknown>);
    return producto;
  }

  public async softDelete(id: string) {
    const producto = await prisma.producto.update({
      where: { id },
      data: { activo: false },
    });

    await registrarSync('Producto', producto.id, OperacionSync.ACTUALIZAR, producto as unknown as Record<string, unknown>);
    return producto;
  }

  public async registrarMovimiento(data: {
    productoId: string;
    tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
    cantidad: number;
    nuevoStock: number;
    motivo: string;
    usuarioId: string;
  }) {
    return prisma.$transaction(async tx => {
      const producto = await tx.producto.update({
        where: { id: data.productoId },
        data: { stockActual: data.nuevoStock },
        include: { categoria: true },
      });

      const movimiento = await tx.movimientoInventario.create({
        data: {
          productoId: data.productoId,
          tipo: data.tipo as any,
          cantidad: data.cantidad,
          motivo: data.motivo,
          usuarioId: data.usuarioId,
        },
      });

      await registrarSync('Producto', producto.id, OperacionSync.ACTUALIZAR, producto as unknown as Record<string, unknown>, tx);
      await registrarSync('MovimientoInventario', movimiento.id, OperacionSync.CREAR, movimiento as unknown as Record<string, unknown>, tx);

      return { producto, movimiento };
    });
  }

  public async getMovimientos(productoId: string) {
    return prisma.movimientoInventario.findMany({
      where: { productoId },
      include: {
        usuario: {
          select: { id: true, nombre: true, email: true },
        },
      },
      orderBy: { fecha: 'desc' },
      take: 50,
    });
  }
}

export const productoRepository = new ProductoRepository();
