import { ProductoRepository, productoRepository as defaultRepo, type ProductoFilters } from '../repositories/producto.repository.js';
import { CategoriaRepository, categoriaRepository as defaultCatRepo } from '../repositories/categoria.repository.js';
import type { ProductoDTO } from '@ferreteria/shared';

export interface CreateProductoInput {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  imagenUrl?: string | null;
  categoriaId: string;
  precioCompra: number;
  precioVenta: number;
  stockActual?: number;
  stockMinimo?: number;
  unidadMedida?: string;
  /** F10: producto exento de IVA */
  exentoIva?: boolean;
}

export interface UpdateProductoInput {
  codigo?: string;
  nombre?: string;
  descripcion?: string | null;
  imagenUrl?: string | null;
  categoriaId?: string;
  precioCompra?: number;
  precioVenta?: number;
  stockActual?: number;
  stockMinimo?: number;
  unidadMedida?: string;
  exentoIva?: boolean;
  activo?: boolean;
}

export class ProductoService {
  constructor(
    private repo: ProductoRepository = defaultRepo,
    private catRepo: CategoriaRepository = defaultCatRepo
  ) {}

  private mapToDTO(p: any): ProductoDTO {
    return {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      imagenUrl: p.imagenUrl || null,
      categoriaId: p.categoriaId,
      precioCompra: Number(p.precioCompra),
      precioVenta: Number(p.precioVenta),
      stockActual: p.stockActual,
      stockMinimo: p.stockMinimo,
      unidadMedida: p.unidadMedida,
      exentoIva: p.exentoIva ?? false,
      activo: p.activo,
      categoria: p.categoria ? {
        id: p.categoria.id,
        nombre: p.categoria.nombre,
        createdAt: p.categoria.createdAt,
        updatedAt: p.categoria.updatedAt,
      } : undefined,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  public async getAll(filters: ProductoFilters = {}): Promise<ProductoDTO[]> {
    const productos = await this.repo.findAll(filters);
    return productos.map(p => this.mapToDTO(p));
  }

  public async getById(id: string): Promise<ProductoDTO> {
    const producto = await this.repo.findById(id);
    if (!producto) {
      throw new Error(`Producto con ID ${id} no encontrado`);
    }
    return this.mapToDTO(producto);
  }

  public async getStockAlerts(): Promise<ProductoDTO[]> {
    const productos = await this.repo.findStockAlerts();
    return productos.map(p => this.mapToDTO(p));
  }

  public async create(data: CreateProductoInput): Promise<ProductoDTO> {
    if (!data.codigo || !data.nombre) {
      throw new Error('El código y el nombre del producto son obligatorios');
    }

    if (data.precioCompra < 0 || data.precioVenta < 0) {
      throw new Error('Los precios no pueden ser negativos');
    }

    if (data.precioVenta < data.precioCompra) {
      throw new Error('El precio de venta no puede ser menor al precio de compra');
    }

    // Validar categoría existente
    const categoria = await this.catRepo.findById(data.categoriaId);
    if (!categoria) {
      throw new Error(`La categoría con ID ${data.categoriaId} no existe`);
    }

    // Validar código único
    const existing = await this.repo.findByCodigo(data.codigo.trim().toUpperCase());
    if (existing) {
      throw new Error(`Ya existe un producto registrado con el código "${data.codigo.trim().toUpperCase()}"`);
    }

    const created = await this.repo.create(data);
    return this.mapToDTO(created);
  }

  public async update(id: string, data: UpdateProductoInput): Promise<ProductoDTO> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Producto con ID ${id} no encontrado`);
    }

    if (data.precioCompra !== undefined && data.precioCompra < 0) {
      throw new Error('El precio de compra no puede ser negativo');
    }

    if (data.precioVenta !== undefined && data.precioVenta < 0) {
      throw new Error('El precio de venta no puede ser negativo');
    }

    const precioCompraFinal = data.precioCompra !== undefined ? data.precioCompra : Number(existing.precioCompra);
    const precioVentaFinal = data.precioVenta !== undefined ? data.precioVenta : Number(existing.precioVenta);

    if (precioVentaFinal < precioCompraFinal) {
      throw new Error('El precio de venta no puede ser menor al precio de compra');
    }

    if (data.categoriaId !== undefined) {
      const categoria = await this.catRepo.findById(data.categoriaId);
      if (!categoria) {
        throw new Error(`La categoría con ID ${data.categoriaId} no existe`);
      }
    }

    if (data.codigo !== undefined) {
      const duplicate = await this.repo.findByCodigo(data.codigo.trim().toUpperCase());
      if (duplicate && duplicate.id !== id) {
        throw new Error(`Ya existe otro producto con el código "${data.codigo.trim().toUpperCase()}"`);
      }
    }

    const updated = await this.repo.update(id, data);
    return this.mapToDTO(updated);
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Producto con ID ${id} no encontrado`);
    }
    // Baja lógica
    await this.repo.softDelete(id);
  }

  public async ajustarStock(
    id: string,
    data: {
      tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
      cantidad: number;
      motivo: string;
    },
    usuarioId: string
  ): Promise<ProductoDTO> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Producto con ID ${id} no encontrado`);
    }

    if (data.cantidad <= 0 && data.tipo !== 'AJUSTE') {
      throw new Error('La cantidad debe ser mayor a cero');
    }

    let nuevoStock = existing.stockActual;
    if (data.tipo === 'ENTRADA') {
      nuevoStock = existing.stockActual + data.cantidad;
    } else if (data.tipo === 'SALIDA') {
      if (existing.stockActual < data.cantidad) {
        throw new Error(
          `Stock insuficiente para realizar la salida (stock actual: ${existing.stockActual}, solicitado: ${data.cantidad})`
        );
      }
      nuevoStock = existing.stockActual - data.cantidad;
    } else if (data.tipo === 'AJUSTE') {
      if (data.cantidad < 0) {
        throw new Error('El stock no puede ser negativo');
      }
      nuevoStock = data.cantidad;
    } else {
      throw new Error('Tipo de movimiento no válido. Debe ser ENTRADA, SALIDA o AJUSTE');
    }

    const { producto } = await this.repo.registrarMovimiento({
      productoId: id,
      tipo: data.tipo,
      cantidad: data.cantidad,
      nuevoStock,
      motivo: (data.motivo && data.motivo.trim()) || 'Ajuste manual de inventario',
      usuarioId,
    });

    return this.mapToDTO(producto);
  }

  public async getMovimientos(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Producto con ID ${id} no encontrado`);
    }
    return this.repo.getMovimientos(id);
  }
}

export const productoService = new ProductoService();
