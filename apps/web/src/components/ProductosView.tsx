import React, { useState, useEffect } from 'react';
import type { ProductoDTO, CategoriaDTO, MovimientoInventarioDTO } from '@ferreteria/shared';
import { api } from '../lib/api.js';

interface ProductosViewProps {
  productos: ProductoDTO[];
  categorias: CategoriaDTO[];
  onCrearProducto: (data: any) => Promise<void>;
  onActualizarProducto?: (id: string, data: any) => Promise<void>;
  onEliminarProducto?: (id: string) => Promise<void>;
  onAjustarStock?: (id: string, data: { tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE'; cantidad: number; motivo: string }) => Promise<void>;
  canManage: boolean;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

export const ProductosView: React.FC<ProductosViewProps> = ({
  productos,
  categorias,
  onCrearProducto,
  onActualizarProducto,
  onEliminarProducto,
  onAjustarStock,
  canManage,
  isModalOpen,
  setIsModalOpen,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string | 'todas'>('todas');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critico' | 'alerta' | 'optimo'>('all');
  const [selectedProduct, setSelectedProduct] = useState<ProductoDTO | null>(productos[0] || null);

  // Form state for creating product
  const [formCodigo, setFormCodigo] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formImagenUrl, setFormImagenUrl] = useState('');
  const [formCategoriaId, setFormCategoriaId] = useState<string>(categorias[0]?.id || '1');
  const [formPrecioCompra, setFormPrecioCompra] = useState<string>('');
  const [formPrecioVenta, setFormPrecioVenta] = useState<string>('');
  const [formStockActual, setFormStockActual] = useState<string>('0');
  const [formStockMinimo, setFormStockMinimo] = useState<string>('5');
  const [formUnidadMedida, setFormUnidadMedida] = useState('UND');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Estados para Editar Producto
  const [editingProduct, setEditingProduct] = useState<ProductoDTO | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editImagenUrl, setEditImagenUrl] = useState('');
  const [editCategoriaId, setEditCategoriaId] = useState('');
  const [editPrecioCompra, setEditPrecioCompra] = useState('');
  const [editPrecioVenta, setEditPrecioVenta] = useState('');
  const [editStockMinimo, setEditStockMinimo] = useState('');
  const [editUnidadMedida, setEditUnidadMedida] = useState('UND');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Estados para Eliminar Producto
  const [deletingProduct, setDeletingProduct] = useState<ProductoDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Estados para Ajuste Rápido de Stock
  const [adjustingProduct, setAdjustingProduct] = useState<ProductoDTO | null>(null);
  const [ajusteTipo, setAjusteTipo] = useState<'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ENTRADA');
  const [ajusteCantidad, setAjusteCantidad] = useState('1');
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [ajusteError, setAjusteError] = useState<string | null>(null);
  const [ajusteSubmitting, setAjusteSubmitting] = useState(false);

  // Estados para Modal de Kárdex
  const [kardexProduct, setKardexProduct] = useState<ProductoDTO | null>(null);
  const [kardexMovimientos, setKardexMovimientos] = useState<MovimientoInventarioDTO[]>([]);
  const [loadingKardex, setLoadingKardex] = useState(false);

  // Estados para Importar / Exportar Catálogo
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'exportar' | 'importar'>('exportar');
  const [exportScope, setExportScope] = useState<'todos' | 'filtrados'>('todos');
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Estados para Importación
  interface ParsedImportRow {
    codigo: string;
    nombre: string;
    descripcion: string;
    categoriaNombre: string;
    categoriaId: string;
    precioCompra: number;
    precioVenta: number;
    stockActual: number;
    stockMinimo: number;
    unidadMedida: string;
    imagenUrl: string;
    isValid: boolean;
    errors: string[];
    isUpdate: boolean;
    existingId?: string;
  }
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importFilter, setImportFilter] = useState<'todos' | 'validos' | 'errores'>('todos');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; failed: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Estados para Orden de Compra Automática
  const [isOrdenCompraModalOpen, setIsOrdenCompraModalOpen] = useState(false);

  // Cargar movimientos cuando se abre el modal de Kárdex
  useEffect(() => {
    if (kardexProduct) {
      setLoadingKardex(true);
      api.getMovimientosProducto(kardexProduct.id)
        .then(res => setKardexMovimientos(res))
        .catch(() => setKardexMovimientos([]))
        .finally(() => setLoadingKardex(false));
    }
  }, [kardexProduct]);

  const handleOpenEdit = (prod: ProductoDTO) => {
    setEditingProduct(prod);
    setEditCodigo(prod.codigo);
    setEditNombre(prod.nombre);
    setEditDescripcion(prod.descripcion || '');
    setEditImagenUrl(prod.imagenUrl || '');
    setEditCategoriaId(prod.categoriaId);
    setEditPrecioCompra(String(prod.precioCompra));
    setEditPrecioVenta(String(prod.precioVenta));
    setEditStockMinimo(String(prod.stockMinimo));
    setEditUnidadMedida(prod.unidadMedida || 'UND');
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setEditError(null);

    const pCompra = parseFloat(editPrecioCompra);
    const pVenta = parseFloat(editPrecioVenta);
    const sMinimo = parseInt(editStockMinimo, 10);

    if (isNaN(pCompra) || isNaN(pVenta)) {
      setEditError('Introduce precios válidos');
      return;
    }
    if (pVenta < pCompra) {
      setEditError('El precio de venta no puede ser menor al precio de compra');
      return;
    }

    setEditSubmitting(true);
    try {
      const updateData = {
        codigo: editCodigo.trim().toUpperCase(),
        nombre: editNombre.trim(),
        descripcion: editDescripcion.trim() || null,
        imagenUrl: editImagenUrl.trim() || null,
        categoriaId: editCategoriaId,
        precioCompra: pCompra,
        precioVenta: pVenta,
        stockMinimo: isNaN(sMinimo) ? 5 : sMinimo,
        unidadMedida: editUnidadMedida.trim().toUpperCase() || 'UND',
      };

      if (onActualizarProducto) {
        await onActualizarProducto(editingProduct.id, updateData);
      } else {
        await api.updateProducto(editingProduct.id, updateData);
      }
      setEditingProduct(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al actualizar producto');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      if (onEliminarProducto) {
        await onEliminarProducto(deletingProduct.id);
      } else {
        await api.deleteProducto(deletingProduct.id);
      }
      if (selectedProduct?.id === deletingProduct.id) {
        setSelectedProduct(null);
      }
      setDeletingProduct(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar producto');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleAjusteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    setAjusteError(null);

    const cant = parseInt(ajusteCantidad, 10);
    if (isNaN(cant) || cant < 0) {
      setAjusteError('Introduce una cantidad válida');
      return;
    }
    if (ajusteTipo !== 'AJUSTE' && cant <= 0) {
      setAjusteError('La cantidad debe ser mayor a 0');
      return;
    }
    if (ajusteTipo === 'SALIDA' && cant > adjustingProduct.stockActual) {
      setAjusteError(`Stock insuficiente para salida (stock actual: ${adjustingProduct.stockActual})`);
      return;
    }

    setAjusteSubmitting(true);
    try {
      const data = {
        tipo: ajusteTipo,
        cantidad: cant,
        motivo: ajusteMotivo.trim() || 'Ajuste manual de inventario',
      };
      if (onAjustarStock) {
        await onAjustarStock(adjustingProduct.id, data);
      } else {
        await api.ajustarStock(adjustingProduct.id, data);
      }
      setAdjustingProduct(null);
    } catch (err) {
      setAjusteError(err instanceof Error ? err.message : 'Error al registrar ajuste');
    } finally {
      setAjusteSubmitting(false);
    }
  };

  // KPIs
  const criticalProducts = productos.filter(p => p.stockActual <= p.stockMinimo);
  const totalSKUs = productos.length > 0 ? productos.length : 485;
  const criticosCount = criticalProducts.length;
  const optimosCount = productos.filter(p => p.stockActual > p.stockMinimo * 1.5).length;
  const proximosCount = productos.filter(p => p.stockActual > p.stockMinimo && p.stockActual <= p.stockMinimo * 1.5).length;

  // Utilidad para escapar CSV
  const escapeCSV = (str: string | number | null | undefined): string => {
    if (str === null || str === undefined) return '';
    const val = String(str).replace(/"/g, '""');
    if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
      return `"${val}"`;
    }
    return val;
  };

  // Función para Exportar Catálogo a CSV (Compatible con Excel mediante BOM UTF-8)
  const handleExportCSV = () => {
    const targetList = exportScope === 'filtrados' ? filteredProductos : productos;
    const headers = [
      'Código',
      'Nombre',
      'Categoría',
      'Precio Compra',
      'Precio Venta',
      'Stock Actual',
      'Stock Mínimo',
      'Unidad de Medida',
      'Descripción',
      'URL Imagen'
    ];

    const rows = targetList.map(p => [
      escapeCSV(p.codigo),
      escapeCSV(p.nombre),
      escapeCSV(p.categoria?.nombre || categorias.find(c => c.id === p.categoriaId)?.nombre || ''),
      Number(p.precioCompra).toFixed(2),
      Number(p.precioVenta).toFixed(2),
      p.stockActual,
      p.stockMinimo,
      escapeCSV(p.unidadMedida || 'UND'),
      escapeCSV(p.descripcion || ''),
      escapeCSV(p.imagenUrl || '')
    ].join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `catalogo_ferreteria_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportSuccessMsg(`¡Catálogo descargado con éxito! (${targetList.length} productos)`);
    setTimeout(() => setExportSuccessMsg(null), 4000);
  };

  // Función para Descargar Plantilla CSV de Ejemplo
  const handleDownloadTemplate = () => {
    const headers = [
      'Código',
      'Nombre',
      'Categoría',
      'Precio Compra',
      'Precio Venta',
      'Stock Actual',
      'Stock Mínimo',
      'Unidad de Medida',
      'Descripción',
      'URL Imagen'
    ];
    const sampleRows = [
      ['MART-001', 'Martillo Tubular 16oz', 'Herramientas Manuales', '12.50', '18.00', '25', '5', 'UND', 'Mango ergonómico anti-impacto', 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=300'],
      ['TAL-002', 'Taladro Percutor 650W 1/2"', 'Herramientas Eléctricas', '35.00', '55.00', '10', '3', 'UND', 'Velocidad variable y reversa', ''],
      ['TOR-003', 'Tornillo Drywall 6x1-1/4" (Caja 1000u)', 'Fijaciones y Tornillos', '4.20', '8.50', '50', '10', 'CAJ', 'Punta broca fosfatizado negro', ''],
      ['PIN-004', 'Esmalte Sintético Blanco Brillante (1 Gal)', 'Pinturas y Acabados', '14.00', '24.00', '15', '4', 'GAL', 'Alta resistencia al exterior', '']
    ];
    const csvContent = '\uFEFF' + [headers.join(','), ...sampleRows.map(r => r.map(c => escapeCSV(c)).join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_importacion_productos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parser robusto para líneas CSV considerando comillas dobles
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Manejador de carga de archivo CSV para Importación
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let content = event.target?.result as string;
        if (!content) throw new Error('El archivo está vacío');
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }

        const lines = content.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          throw new Error('El archivo debe contener una fila de encabezados y al menos una fila de productos');
        }

        const rawHeaders = parseCSVLine(lines[0]).map(h => 
          h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        );

        const colMap = {
          codigo: rawHeaders.findIndex(h => h.includes('cod') || h.includes('sku')),
          nombre: rawHeaders.findIndex(h => h.includes('nom') || h.includes('prod') || h.includes('item')),
          categoria: rawHeaders.findIndex(h => h.includes('cat') || h.includes('fam')),
          precioCompra: rawHeaders.findIndex(h => h.includes('comp') || h.includes('cost')),
          precioVenta: rawHeaders.findIndex(h => h.includes('vent') || h.includes('prec') || h.includes('pvp')),
          stockActual: rawHeaders.findIndex(h => (h.includes('stock') && !h.includes('min')) || h.includes('cant') || h.includes('exist')),
          stockMinimo: rawHeaders.findIndex(h => h.includes('min')),
          unidadMedida: rawHeaders.findIndex(h => h.includes('unid') || h.includes('med') || h.includes('um')),
          descripcion: rawHeaders.findIndex(h => h.includes('desc') || h.includes('det') || h.includes('not')),
          imagenUrl: rawHeaders.findIndex(h => h.includes('img') || h.includes('foto') || h.includes('url'))
        };

        if (colMap.codigo === -1 || colMap.nombre === -1) {
          throw new Error('El archivo debe incluir al menos las columnas "Código" y "Nombre"');
        }

        const parsed: ParsedImportRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cells = parseCSVLine(lines[i]);
          if (cells.length === 0 || cells.every(c => c === '')) continue;

          const codigo = (colMap.codigo !== -1 ? cells[colMap.codigo] || '' : '').trim().toUpperCase();
          const nombre = (colMap.nombre !== -1 ? cells[colMap.nombre] || '' : '').trim();
          const catStr = (colMap.categoria !== -1 ? cells[colMap.categoria] || '' : '').trim();
          const pCompraStr = (colMap.precioCompra !== -1 ? cells[colMap.precioCompra] || '' : '').replace('$', '').trim();
          const pVentaStr = (colMap.precioVenta !== -1 ? cells[colMap.precioVenta] || '' : '').replace('$', '').trim();
          const sActualStr = (colMap.stockActual !== -1 ? cells[colMap.stockActual] || '' : '0').trim();
          const sMinimoStr = (colMap.stockMinimo !== -1 ? cells[colMap.stockMinimo] || '' : '5').trim();
          const uMedida = (colMap.unidadMedida !== -1 ? cells[colMap.unidadMedida] || 'UND' : 'UND').trim().toUpperCase() || 'UND';
          const desc = (colMap.descripcion !== -1 ? cells[colMap.descripcion] || '' : '').trim();
          const imgUrl = (colMap.imagenUrl !== -1 ? cells[colMap.imagenUrl] || '' : '').trim();

          const errors: string[] = [];
          if (!codigo) errors.push('Falta el Código / SKU');
          if (!nombre) errors.push('Falta el Nombre del producto');

          const pCompra = parseFloat(pCompraStr);
          const pVenta = parseFloat(pVentaStr);
          const sActual = parseInt(sActualStr, 10);
          const sMinimo = parseInt(sMinimoStr, 10);

          if (isNaN(pCompra) || pCompra < 0) errors.push('Precio compra inválido');
          if (isNaN(pVenta) || pVenta < 0) errors.push('Precio venta inválido');
          if (!isNaN(pCompra) && !isNaN(pVenta) && pVenta < pCompra) {
            errors.push('Precio venta menor a compra');
          }

          let matchedCatId = categorias[0]?.id || '1';
          if (catStr) {
            const found = categorias.find(c => 
              c.nombre.toLowerCase().trim() === catStr.toLowerCase().trim() ||
              c.id === catStr
            );
            if (found) matchedCatId = found.id;
          }

          const existing = productos.find(p => p.codigo.toUpperCase() === codigo);

          parsed.push({
            codigo,
            nombre,
            descripcion: desc,
            categoriaNombre: catStr || (categorias.find(c => c.id === matchedCatId)?.nombre || 'General'),
            categoriaId: matchedCatId,
            precioCompra: isNaN(pCompra) ? 0 : pCompra,
            precioVenta: isNaN(pVenta) ? 0 : pVenta,
            stockActual: isNaN(sActual) ? 0 : sActual,
            stockMinimo: isNaN(sMinimo) ? 5 : sMinimo,
            unidadMedida: uMedida,
            imagenUrl: imgUrl,
            isValid: errors.length === 0,
            errors,
            isUpdate: !!existing,
            existingId: existing?.id
          });
        }

        setImportRows(parsed);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Error al leer el archivo CSV');
        setImportRows([]);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // Procesar Importación por lotes
  const handleExecuteImport = async () => {
    const rowsToProcess = importRows.filter(r => r.isValid && (updateExisting || !r.isUpdate));
    if (rowsToProcess.length === 0) return;

    setImportProgress({ current: 0, total: rowsToProcess.length });
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i];
      setImportProgress({ current: i + 1, total: rowsToProcess.length });
      try {
        const payload = {
          codigo: row.codigo,
          nombre: row.nombre,
          descripcion: row.descripcion || undefined,
          imagenUrl: row.imagenUrl || undefined,
          categoriaId: row.categoriaId,
          precioCompra: row.precioCompra,
          precioVenta: row.precioVenta,
          stockActual: row.stockActual,
          stockMinimo: row.stockMinimo,
          unidadMedida: row.unidadMedida
        };

        if (row.isUpdate && row.existingId) {
          if (onActualizarProducto) {
            await onActualizarProducto(row.existingId, payload);
          } else {
            await api.updateProducto(row.existingId, payload);
          }
          updated++;
        } else {
          if (onCrearProducto) {
            await onCrearProducto(payload);
          } else {
            await api.createProducto(payload);
          }
          created++;
        }
      } catch (_err) {
        failed++;
      }
    }

    setImportProgress(null);
    setImportResult({ created, updated, failed });
    setImportRows([]);
    setImportFileName(null);
  };

  // Exportar Orden de Compra para productos críticos
  const handleExportPurchaseOrder = () => {
    const headers = [
      'Código',
      'Producto',
      'Categoría',
      'Stock Actual',
      'Stock Mínimo',
      'Cantidad Sugerida a Pedir',
      'Costo Estimado Unitario ($)',
      'Subtotal Estimado ($)'
    ];

    const rows = criticalProducts.map(p => {
      const sugerido = Math.max((p.stockMinimo * 2) - p.stockActual, 1);
      const subtotal = sugerido * Number(p.precioCompra);
      return [
        escapeCSV(p.codigo),
        escapeCSV(p.nombre),
        escapeCSV(p.categoria?.nombre || ''),
        p.stockActual,
        p.stockMinimo,
        sugerido,
        Number(p.precioCompra).toFixed(2),
        subtotal.toFixed(2)
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `orden_compra_automatica_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filter products
  const filteredProductos = productos.filter(p => {
    const matchesSearch =
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategoria === 'todas' || p.categoriaId === selectedCategoria;
    
    let matchesStatus = true;
    if (statusFilter === 'critico') matchesStatus = p.stockActual <= p.stockMinimo;
    else if (statusFilter === 'alerta') matchesStatus = p.stockActual > p.stockMinimo && p.stockActual <= p.stockMinimo * 1.5;
    else if (statusFilter === 'optimo') matchesStatus = p.stockActual > p.stockMinimo * 1.5;

    return matchesSearch && matchesCat && matchesStatus;
  });

  const activeProduct = selectedProduct || filteredProductos[0] || productos[0] || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const pCompra = parseFloat(formPrecioCompra);
    const pVenta = parseFloat(formPrecioVenta);
    const sActual = parseInt(formStockActual, 10);
    const sMinimo = parseInt(formStockMinimo, 10);

    if (isNaN(pCompra) || isNaN(pVenta)) {
      setFormError('Introduce precios válidos');
      return;
    }
    if (pVenta < pCompra) {
      setFormError('El precio de venta no puede ser menor al precio de compra');
      return;
    }

    setSubmitting(true);
    try {
      await onCrearProducto({
        codigo: formCodigo.trim().toUpperCase(),
        nombre: formNombre.trim(),
        descripcion: formDescripcion.trim() || undefined,
        imagenUrl: formImagenUrl.trim() || undefined,
        categoriaId: formCategoriaId,
        precioCompra: pCompra,
        precioVenta: pVenta,
        stockActual: isNaN(sActual) ? 0 : sActual,
        stockMinimo: isNaN(sMinimo) ? 5 : sMinimo,
        unidadMedida: formUnidadMedida.trim().toUpperCase() || 'UND',
      });

      setFormCodigo('');
      setFormNombre('');
      setFormDescripcion('');
      setFormImagenUrl('');
      setFormPrecioCompra('');
      setFormPrecioVenta('');
      setFormStockActual('0');
      setFormStockMinimo('5');
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al registrar producto');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full gap-space-lg animate-fade-in">
      {/* Header Sección exactamente como en Stitch 3_Gestin_de_Inventario_y_Productos.html */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              Catálogo de Inventario y Productos
            </h1>
          </div>
          <p className="font-body-md text-body-md text-secondary mt-space-2xs">
            Control centralizado de existencias, precios de compra/venta, categorías y alertas de stock mínimo.
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-wrap shrink-0">
          <button
            onClick={() => {
              const target = activeProduct || filteredProductos[0] || productos[0];
              if (target) {
                setAdjustingProduct(target);
                setAjusteTipo('ENTRADA');
                setAjusteCantidad('1');
                setAjusteMotivo('');
                setAjusteError(null);
              }
            }}
            className="flex items-center gap-space-xs px-space-md py-space-xs h-9 bg-surface-container text-on-surface font-label-md text-label-md rounded shadow-sm hover:bg-surface-container-high transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-lg text-secondary">tune</span>
            <span>Ajuste de Stock Manual</span>
          </button>
          <button
            onClick={() => {
              setExportSuccessMsg(null);
              setImportResult(null);
              setImportError(null);
              setIsImportExportModalOpen(true);
            }}
            className="flex items-center gap-space-xs px-space-md py-space-xs h-9 bg-surface-container text-on-surface font-label-md text-label-md rounded shadow-sm hover:bg-surface-container-high transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-lg text-secondary">swap_vert</span>
            <span>Importar / Exportar</span>
          </button>
          {canManage && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-space-xs px-space-md py-space-xs h-9 bg-primary text-on-primary font-label-md text-label-md rounded shadow-sm hover:bg-primary-container transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span>Registrar Nuevo Producto</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Inventory Status Bento Summary (Exact Stitch layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
        {/* Total Catálogo SKUs */}
        <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Total Catálogo SKUs</span>
            <span className="font-display-md text-display-md text-on-surface font-bold mt-space-2xs">{totalSKUs}</span>
            <div className="flex items-center gap-space-xs mt-space-2xs">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span className="font-body-sm text-body-sm text-secondary">{categorias.length || 6} familias activas</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded bg-primary-fixed flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-2xl">category</span>
          </div>
        </div>

        {/* Nivel Óptimo */}
        <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Nivel Óptimo</span>
            <span className="font-display-md text-display-md text-tertiary font-bold mt-space-2xs">{optimosCount}</span>
            <div className="flex items-center gap-space-xs mt-space-2xs">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>
              <span className="font-body-sm text-body-sm text-secondary">86.8% del catálogo</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center text-tertiary">
            <span className="material-symbols-outlined text-2xl">check_circle</span>
          </div>
        </div>

        {/* Próximos a Mínimo */}
        <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Próximos a Mínimo</span>
            <span className="font-display-md text-display-md text-primary-container font-bold mt-space-2xs">{proximosCount}</span>
            <div className="flex items-center gap-space-xs mt-space-2xs">
              <span className="w-2 h-2 rounded-full bg-primary-container"></span>
              <span className="font-body-sm text-body-sm text-secondary">Reordenar preventivo</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded bg-primary-fixed flex items-center justify-center text-primary-container">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
        </div>

        {/* Stock Crítico / Agotado */}
        <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Stock Crítico / Agotado</span>
            <span className="font-display-md text-display-md text-error font-bold mt-space-2xs">{criticosCount}</span>
            <div className="flex items-center gap-space-xs mt-space-2xs">
              <span className="w-2 h-2 rounded-full bg-error"></span>
              <span className="font-body-sm text-body-sm text-error font-semibold">Requiere OC urgente</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded bg-error-container flex items-center justify-center text-error">
            <span className="material-symbols-outlined text-2xl">error</span>
          </div>
        </div>
      </div>

      {/* Advanced Filters & Fast Search Bar */}
      <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col xl:flex-row gap-space-md items-stretch xl:items-center justify-between">
        {/* Live SKU / Barcode / Name Search */}
        <div className="relative flex-1 min-w-[260px]">
          <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-secondary text-lg">
            barcode_scanner
          </span>
          <input
            className="w-full pl-10 pr-space-md py-space-xs h-9 bg-surface-container-low text-on-surface font-body-sm text-body-sm rounded outline-none placeholder:text-secondary focus:bg-surface-container-lowest"
            id="liveSearchInput"
            placeholder="Escanear código de barras, SKU o escribir descripción..."
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Selectors Group */}
        <div className="flex flex-wrap items-center gap-space-sm">
          {/* Category Filter */}
          <div className="flex items-center bg-surface-container-low rounded px-space-sm h-9">
            <span className="material-symbols-outlined text-secondary text-base mr-space-xs">folder_open</span>
            <select
              className="bg-transparent text-on-surface font-label-md text-label-md outline-none cursor-pointer pr-space-xs"
              value={selectedCategoria}
              onChange={e => setSelectedCategoria(e.target.value)}
            >
              <option value="todas">Todas las Categorías</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>

          {/* Supplier Filter */}
          <div className="flex items-center bg-surface-container-low rounded px-space-sm h-9">
            <span className="material-symbols-outlined text-secondary text-base mr-space-xs">local_shipping</span>
            <select
              className="bg-transparent text-on-surface font-label-md text-label-md outline-none cursor-pointer pr-space-xs"
              value={selectedSupplier}
              onChange={e => setSelectedSupplier(e.target.value)}
            >
              <option value="all">Todos los Proveedores</option>
              <option value="ferremayoreo">FerreMayoreo C.A.</option>
              <option value="andinos">Suministros Industriales Andinos</option>
              <option value="tuboplast">Distribuidora TuboPlast</option>
              <option value="canteras">Canteras & Cementos Nac.</option>
              <option value="electromateriales">Electromateriales C.A.</option>
            </select>
          </div>

          {/* Stock Status Filter */}
          <div className="flex items-center bg-surface-container-low rounded px-space-sm h-9">
            <span className="material-symbols-outlined text-secondary text-base mr-space-xs">filter_alt</span>
            <select
              className="bg-transparent text-on-surface font-label-md text-label-md outline-none cursor-pointer pr-space-xs"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
            >
              <option value="all">Estado: Todos</option>
              <option value="critico">Solo Críticos (&lt; mín)</option>
              <option value="alerta">Próximos a Mínimo</option>
              <option value="optimo">Nivel Óptimo</option>
            </select>
          </div>

          <button
            onClick={() => {
              setSearch('');
              setSelectedCategoria('todas');
              setSelectedSupplier('all');
              setStatusFilter('all');
            }}
            className="p-space-xs h-9 w-9 flex items-center justify-center rounded bg-surface-container-low hover:bg-surface-container text-secondary transition-colors"
            title="Limpiar Filtros"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">restart_alt</span>
          </button>

          {canManage && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-space-xs px-space-md py-space-xs h-9 bg-primary text-on-primary rounded font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm"
              type="button"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>Nuevo Producto</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout: Table (Grid) + Quick Kardex Drawer View */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Dense Logistics Inventory Grid */}
        <div className="xl:col-span-8 2xl:col-span-9 bg-surface-container-lowest rounded shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-space-sm px-space-md">Código / SKU</th>
                  <th className="py-space-sm px-space-md">Producto & Categoría</th>
                  <th className="py-space-sm px-space-sm">Proveedor</th>
                  <th className="py-space-sm px-space-sm text-center">Unidad</th>
                  <th className="py-space-sm px-space-sm text-right">Compra</th>
                  <th className="py-space-sm px-space-sm text-right">Venta / Margen</th>
                  <th className="py-space-sm px-space-md">Stock vs Mínimo</th>
                  <th className="py-space-sm px-space-md text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y-0 text-on-surface font-body-sm text-body-sm">
                {filteredProductos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-space-2xl text-center text-secondary">
                      No se encontraron productos.
                    </td>
                  </tr>
                ) : (
                  filteredProductos.map(prod => {
                    const isCritico = prod.stockActual <= prod.stockMinimo;
                    const isAlerta = prod.stockActual > prod.stockMinimo && prod.stockActual <= prod.stockMinimo * 1.5;
                    const margen = prod.precioCompra > 0 
                      ? Math.round(((prod.precioVenta - prod.precioCompra) / prod.precioCompra) * 100)
                      : 45;
                    const isSelected = activeProduct?.id === prod.id;
                    const pctStock = Math.min(100, Math.round((prod.stockActual / Math.max(1, prod.stockMinimo * 2)) * 100));

                    return (
                      <tr
                        key={prod.id}
                        onClick={() => setSelectedProduct(prod)}
                        className={`transition-colors group cursor-pointer ${
                          isCritico
                            ? 'bg-error-container/10 hover:bg-error-container/20'
                            : isAlerta
                            ? 'bg-primary-fixed/20 hover:bg-primary-fixed/30'
                            : 'hover:bg-surface-container-low/50'
                        } ${isSelected ? 'ring-1 ring-inset ring-primary/40' : ''}`}
                      >
                        <td className="py-space-sm px-space-md font-label-md text-label-md text-primary font-mono whitespace-nowrap">
                          {prod.codigo}
                        </td>
                        <td className="py-space-sm px-space-md">
                          <div className="flex items-center gap-space-sm">
                            <div className="w-10 h-10 shrink-0 bg-surface-container rounded overflow-hidden flex items-center justify-center border border-surface-container relative">
                              {prod.imagenUrl ? (
                                <img
                                  src={prod.imagenUrl}
                                  alt={prod.nombre}
                                  className="w-full h-full object-cover"
                                  onError={e => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : null}
                              <span className={`material-symbols-outlined text-xl text-primary ${prod.imagenUrl ? 'hidden' : ''}`}>hardware</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-label-md text-label-md text-on-surface truncate font-semibold">
                                {prod.nombre}
                              </span>
                              <span className="font-body-sm text-body-sm text-secondary">
                                {prod.categoria?.nombre || 'Herramientas Eléctricas'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-space-sm px-space-sm text-secondary truncate max-w-[120px]">
                          FerreMayoreo C.A.
                        </td>
                        <td className="py-space-sm px-space-sm text-center">
                          <span className="px-space-xs py-space-2xs bg-surface-container rounded font-label-sm text-label-sm text-on-surface">
                            {prod.unidadMedida}
                          </span>
                        </td>
                        <td className="py-space-sm px-space-sm text-right font-mono font-medium">
                          ${Number(prod.precioCompra).toFixed(2)}
                        </td>
                        <td className="py-space-sm px-space-sm text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-on-surface">
                              ${Number(prod.precioVenta).toFixed(2)}
                            </span>
                            <span className="font-label-sm text-label-sm text-tertiary font-semibold">
                              +{margen}%
                            </span>
                          </div>
                        </td>
                        <td className="py-space-sm px-space-md">
                          <div className="flex flex-col gap-space-2xs w-36">
                            <div className="flex items-center justify-between font-label-sm text-label-sm">
                              <span className={`font-mono font-bold ${isCritico ? 'text-error' : 'text-on-surface'}`}>
                                {prod.stockActual} <span className="font-normal text-secondary">/ {prod.stockMinimo} mín</span>
                              </span>
                              <span
                                className={`px-space-xs py-space-2xs rounded font-bold text-[10px] ${
                                  isCritico
                                    ? 'bg-error text-on-error'
                                    : isAlerta
                                    ? 'bg-primary-container text-on-primary'
                                    : 'bg-surface-container text-tertiary'
                                }`}
                              >
                                {isCritico ? 'CRÍTICO' : isAlerta ? 'ALERTA' : 'ÓPTIMO'}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isCritico ? 'bg-error' : isAlerta ? 'bg-primary-container' : 'bg-tertiary'
                                }`}
                                style={{ width: `${pctStock}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-space-sm px-space-md text-center">
                          <div className="flex items-center justify-center gap-space-2xs">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedProduct(prod);
                                setKardexProduct(prod);
                              }}
                              className="p-space-2xs hover:bg-tertiary-fixed/30 text-tertiary rounded transition-colors"
                              title="Ver Kárdex / Movimientos"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-base">receipt_long</span>
                            </button>
                            {canManage && (
                              <>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedProduct(prod);
                                    handleOpenEdit(prod);
                                  }}
                                  className="p-space-2xs hover:bg-primary-fixed/40 text-primary rounded transition-colors"
                                  title="Editar Producto"
                                  type="button"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedProduct(prod);
                                    setAdjustingProduct(prod);
                                    setAjusteTipo('ENTRADA');
                                    setAjusteCantidad('1');
                                    setAjusteMotivo('');
                                    setAjusteError(null);
                                  }}
                                  className="p-space-2xs hover:bg-surface-container rounded text-secondary hover:text-on-surface transition-colors"
                                  title="Ajuste Rápido de Stock"
                                  type="button"
                                >
                                  <span className="material-symbols-outlined text-base">swap_vert</span>
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setDeletingProduct(prod);
                                    setDeleteError(null);
                                  }}
                                  className="p-space-2xs hover:bg-error-container/40 text-error rounded transition-colors"
                                  title="Eliminar Producto"
                                  type="button"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination & Rows Controls */}
          <div className="bg-surface-container-lowest p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-md border-t border-surface-container">
            <div className="flex items-center gap-space-sm text-secondary font-body-sm text-body-sm">
              <span>
                Mostrando <strong>1 - {filteredProductos.length}</strong> de <strong>{totalSKUs}</strong> productos
              </span>
              <span className="hidden sm:inline">|</span>
              <div className="flex items-center gap-space-xs">
                <span>Filas por página:</span>
                <select className="bg-surface-container-low px-space-xs py-space-2xs rounded text-on-surface font-label-sm text-label-sm outline-none">
                  <option>10</option>
                  <option>25</option>
                  <option>50</option>
                  <option>100</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-space-xs">
              <button
                className="px-space-sm py-space-xs rounded bg-surface-container-low text-secondary hover:bg-surface-container disabled:opacity-40 transition-colors flex items-center justify-center"
                disabled
                type="button"
              >
                <span className="material-symbols-outlined text-base">first_page</span>
              </button>
              <button
                className="px-space-sm py-space-xs rounded bg-surface-container-low text-secondary hover:bg-surface-container disabled:opacity-40 transition-colors flex items-center justify-center"
                disabled
                type="button"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <button className="px-space-sm py-space-xs rounded bg-primary text-on-primary font-label-sm text-label-sm font-bold" type="button">
                1
              </button>
              <button className="px-space-sm py-space-xs rounded bg-surface-container-low text-on-surface font-label-sm text-label-sm hover:bg-surface-container" type="button">
                2
              </button>
              <button className="px-space-sm py-space-xs rounded bg-surface-container-low text-on-surface font-label-sm text-label-sm hover:bg-surface-container" type="button">
                3
              </button>
              <span className="px-space-xs text-secondary font-label-sm text-label-sm">...</span>
              <button className="px-space-sm py-space-xs rounded bg-surface-container-low text-secondary hover:bg-surface-container transition-colors flex items-center justify-center" type="button">
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
              <button className="px-space-sm py-space-xs rounded bg-surface-container-low text-secondary hover:bg-surface-container transition-colors flex items-center justify-center" type="button">
                <span className="material-symbols-outlined text-base">last_page</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Live Product Inspection / Quick Kárdex View */}
        <div className="xl:col-span-4 2xl:col-span-3 flex flex-col gap-space-md">
          {/* Selected Item Detail Card */}
          <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col gap-space-md relative overflow-hidden">
            <div className="flex items-center justify-between pb-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-xl">manage_search</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Kárdex Rápido</h3>
              </div>
              <span className="font-mono text-label-sm text-label-sm bg-surface-container px-space-xs py-space-2xs rounded text-secondary" id="kardexSku">
                {activeProduct?.codigo || 'HERR-TAL-001'}
              </span>
            </div>

            <div className="flex flex-col gap-space-xs bg-surface-container-low p-space-md rounded">
              <div className="flex items-start gap-space-sm">
                {activeProduct?.imagenUrl && (
                  <div className="w-14 h-14 rounded bg-surface-container overflow-hidden shrink-0 border border-surface-container">
                    <img
                      src={activeProduct.imagenUrl}
                      alt={activeProduct.nombre}
                      className="w-full h-full object-cover"
                      onError={e => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-label-sm text-label-sm text-secondary uppercase" id="kardexCategory">
                    {activeProduct?.categoria?.nombre || 'Herramientas Eléctricas'}
                  </span>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold leading-snug" id="kardexName">
                    {activeProduct?.nombre || 'Taladro Percutor DeWalt 1/2" 20V Max'}
                  </h4>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-space-sm mt-space-xs pt-space-xs">
                <div>
                  <span className="font-body-sm text-body-sm text-secondary block">Stock Disponible</span>
                  <span className="font-display-md text-display-md font-bold text-on-surface" id="kardexStock">
                    {activeProduct?.stockActual || 18}
                  </span>
                  <span className="font-body-sm text-body-sm text-secondary" id="kardexUnit">
                    {activeProduct?.unidadMedida || 'Unidades'}
                  </span>
                </div>
                <div>
                  <span className="font-body-sm text-body-sm text-secondary block">Punto de Reorden</span>
                  <span className="font-display-md text-display-md font-bold text-primary-container" id="kardexMin">
                    {activeProduct?.stockMinimo || 5}
                  </span>
                  <span className="font-body-sm text-body-sm text-secondary">Mínimo sugerido</span>
                </div>
              </div>
            </div>

            {/* Mini Visual Inventory Flow Diagram */}
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Flujo de Stock (Últimos 14 Días)
                </span>
                <span className="font-label-sm text-label-sm text-tertiary font-bold">+12 Salidas netas</span>
              </div>
              <div className="w-full h-16 bg-surface-container-low rounded p-space-xs flex items-end justify-between gap-1">
                <div className="w-full bg-tertiary/20 rounded-t h-[40%]" title="Día 1: 24 unid"></div>
                <div className="w-full bg-tertiary/30 rounded-t h-[48%]" title="Día 2: 24 unid"></div>
                <div className="w-full bg-tertiary/40 rounded-t h-[52%]" title="Día 3: 23 unid"></div>
                <div className="w-full bg-primary/40 rounded-t h-[35%]" title="Día 4: Salida -4"></div>
                <div className="w-full bg-primary/50 rounded-t h-[28%]" title="Día 5: Salida -2"></div>
                <div className="w-full bg-primary-container/80 rounded-t h-[75%]" title="Día 6: Entrada +10 (OC-492)"></div>
                <div className="w-full bg-tertiary/40 rounded-t h-[70%]" title="Día 7: 28 unid"></div>
                <div className="w-full bg-primary/40 rounded-t h-[60%]" title="Día 8: Salida -3"></div>
                <div className="w-full bg-primary/50 rounded-t h-[50%]" title="Día 9: Salida -4"></div>
                <div className="w-full bg-tertiary/40 rounded-t h-[48%]" title="Día 10: 21 unid"></div>
                <div className="w-full bg-primary/40 rounded-t h-[42%]" title="Día 11: Salida -2"></div>
                <div className="w-full bg-tertiary/50 rounded-t h-[42%]" title="Día 12: 19 unid"></div>
                <div className="w-full bg-primary/60 rounded-t h-[38%]" title="Día 13: Salida -1"></div>
                <div className="w-full bg-primary rounded-t h-[36%]" title="Hoy: 18 unid"></div>
              </div>
            </div>

            {/* Recent Kárdex Ledger Entries */}
            <div className="flex flex-col gap-space-xs">
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                Últimos Movimientos Registrados
              </span>
              <div className="flex flex-col gap-space-2xs">
                {/* Entry 1 */}
                <div className="p-space-xs bg-surface-container-low rounded flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <div className="w-7 h-7 rounded bg-error/10 text-error flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-sm">arrow_upward</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-md text-label-md text-on-surface leading-tight">
                        Venta Mostrador #0921
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">Hoy, 10:45 AM • Caja 01</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-error text-body-md">-1 Unid</span>
                    <span className="block font-body-sm text-body-sm text-secondary font-mono">$125.00</span>
                  </div>
                </div>

                {/* Entry 2 */}
                <div className="p-space-xs bg-surface-container-low rounded flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <div className="w-7 h-7 rounded bg-error/10 text-error flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-sm">arrow_upward</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-md text-label-md text-on-surface leading-tight">
                        Venta Mostrador #0914
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">Ayer, 04:12 PM • Caja 02</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-error text-body-md">-2 Unid</span>
                    <span className="block font-body-sm text-body-sm text-secondary font-mono">$250.00</span>
                  </div>
                </div>

                {/* Entry 3 */}
                <div className="p-space-xs bg-surface-container-low rounded flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <div className="w-7 h-7 rounded bg-tertiary/10 text-tertiary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-sm">arrow_downward</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-md text-label-md text-on-surface leading-tight">
                        Entrada Proveedor OC-492
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">18 Oct • FerreMayoreo C.A.</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-tertiary text-body-md">+10 Unid</span>
                    <span className="block font-body-sm text-body-sm text-secondary font-mono">$850.00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fast Context Actions */}
            <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
              <button
                onClick={() => {
                  if (activeProduct) {
                    setKardexProduct(activeProduct);
                  }
                }}
                className="w-full flex items-center justify-center gap-space-xs px-space-md py-space-xs bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md rounded transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-base">receipt_long</span>
                <span>Kárdex Completo</span>
              </button>
              <button
                onClick={() => {
                  if (activeProduct) {
                    setAdjustingProduct(activeProduct);
                    setAjusteTipo('ENTRADA');
                    setAjusteCantidad('1');
                    setAjusteMotivo('Ingreso rápido de stock');
                    setAjusteError(null);
                  }
                }}
                className="w-full flex items-center justify-center gap-space-xs px-space-md py-space-xs bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md rounded transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Ingreso Stock</span>
              </button>
            </div>
          </div>

          {/* Quick Supply Alert Banner */}
          <div className="p-space-md bg-inverse-surface text-inverse-on-surface rounded shadow-md flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary-fixed-dim text-lg">local_shipping</span>
                <span className="font-label-md text-label-md text-inverse-on-surface font-bold">
                  Generación de Orden de Compra
                </span>
              </div>
              <span className="font-label-sm text-label-sm bg-error text-on-error px-space-xs py-space-2xs rounded font-bold">
                {criticalProducts.length} Críticos
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary-fixed-dim leading-snug">
              {criticalProducts.length > 0 
                ? `Existen ${criticalProducts.length} producto${criticalProducts.length > 1 ? 's' : ''} que han descendido por debajo del stock de seguridad mínimo requerido para mostrador.`
                : 'Todos los productos tienen niveles de inventario dentro del margen de seguridad requerido.'}
            </p>
            <button
              onClick={() => setIsOrdenCompraModalOpen(true)}
              className="w-full h-8 flex items-center justify-center gap-space-xs bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md rounded transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-base">auto_fix_high</span>
              <span>Sugerir Orden Automática</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal para Crear Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-surface-container-lowest border border-surface-container rounded shadow-2xl p-space-lg relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-space-md pb-space-sm border-b border-surface-container">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-2xl">add_box</span>
                Registrar Nuevo Producto
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-secondary hover:text-on-surface transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {formError && (
              <div className="mb-space-md p-space-sm rounded bg-error-container text-error font-body-sm text-body-sm flex items-center gap-space-xs font-semibold">
                <span className="material-symbols-outlined text-base">error</span>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-space-md font-body-sm text-body-sm">
              <div className="grid grid-cols-2 gap-space-md">
                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Código / SKU *</label>
                  <input
                    required
                    type="text"
                    value={formCodigo}
                    onChange={e => setFormCodigo(e.target.value)}
                    placeholder="Ej: HERR-TAL-001"
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Categoría *</label>
                  <select
                    value={formCategoriaId}
                    onChange={e => setFormCategoriaId(e.target.value)}
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  >
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Nombre del Producto *</label>
                <input
                  required
                  type="text"
                  value={formNombre}
                  onChange={e => setFormNombre(e.target.value)}
                  placeholder="Ej: Taladro Percutor DeWalt 1/2 20V"
                  className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Descripción</label>
                <input
                  type="text"
                  value={formDescripcion}
                  onChange={e => setFormDescripcion(e.target.value)}
                  placeholder="Especificaciones o notas adicionales"
                  className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Imagen del Producto (Opcional)</label>
                <div className="flex items-start gap-space-md p-space-sm bg-surface-container-low rounded border border-surface-container">
                  <div className="w-16 h-16 rounded bg-surface-container flex items-center justify-center shrink-0 overflow-hidden border border-surface-container relative">
                    {formImagenUrl ? (
                      <img src={formImagenUrl} alt="Vista previa" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-2xl text-secondary">image</span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-space-2xs">
                    <div className="flex items-center gap-space-xs">
                      <label className="cursor-pointer px-space-sm py-1 bg-surface-container hover:bg-surface-container-high text-on-surface rounded font-label-sm text-label-sm font-semibold flex items-center gap-1 transition-colors">
                        <span className="material-symbols-outlined text-base">upload_file</span>
                        <span>Subir Imagen</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => {
                                setFormImagenUrl(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {formImagenUrl && (
                        <button
                          type="button"
                          onClick={() => setFormImagenUrl('')}
                          className="px-space-xs py-1 text-error hover:bg-error-container/20 rounded font-label-sm text-label-sm transition-colors"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    <input
                      type="url"
                      value={formImagenUrl}
                      onChange={e => setFormImagenUrl(e.target.value)}
                      placeholder="O pega URL de la imagen (https://...)"
                      className="w-full px-space-xs py-1 bg-surface-container-lowest border border-surface-container rounded text-on-surface text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-space-md">
                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Precio Compra ($) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPrecioCompra}
                    onChange={e => setFormPrecioCompra(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Precio Venta ($) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPrecioVenta}
                    onChange={e => setFormPrecioVenta(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-space-md">
                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Stock Inicial</label>
                  <input
                    type="number"
                    min="0"
                    value={formStockActual}
                    onChange={e => setFormStockActual(e.target.value)}
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Stock Mínimo</label>
                  <input
                    type="number"
                    min="1"
                    value={formStockMinimo}
                    onChange={e => setFormStockMinimo(e.target.value)}
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Unidad</label>
                  <input
                    type="text"
                    value={formUnidadMedida}
                    onChange={e => setFormUnidadMedida(e.target.value)}
                    placeholder="Unid, Saco, Tubo"
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary uppercase"
                  />
                </div>
              </div>

              <div className="pt-space-md border-t border-surface-container flex items-center justify-end gap-space-sm">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-space-md py-space-xs rounded text-secondary hover:bg-surface-container transition-colors font-label-md text-label-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-space-lg py-space-xs rounded bg-primary hover:bg-primary-container text-on-primary transition-colors font-label-md text-label-md shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Editar Producto */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-surface-container-lowest border border-surface-container rounded shadow-2xl p-space-lg relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-space-md pb-space-sm border-b border-surface-container">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-2xl">edit</span>
                Editar Producto: {editingProduct.codigo}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-secondary hover:text-on-surface transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {editError && (
              <div className="mb-space-md p-space-sm rounded bg-error-container text-error font-body-sm text-body-sm flex items-center gap-space-xs font-semibold">
                <span className="material-symbols-outlined text-base">error</span>
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-space-md font-body-sm text-body-sm">
              <div className="grid grid-cols-2 gap-space-md">
                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Código / SKU *</label>
                  <input
                    required
                    type="text"
                    value={editCodigo}
                    onChange={e => setEditCodigo(e.target.value)}
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Categoría *</label>
                  <select
                    value={editCategoriaId}
                    onChange={e => setEditCategoriaId(e.target.value)}
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  >
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Nombre del Producto *</label>
                <input
                  required
                  type="text"
                  value={editNombre}
                  onChange={e => setEditNombre(e.target.value)}
                  className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Descripción</label>
                <input
                  type="text"
                  value={editDescripcion}
                  onChange={e => setEditDescripcion(e.target.value)}
                  placeholder="Especificaciones o notas adicionales"
                  className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Imagen del Producto</label>
                <div className="flex items-start gap-space-md p-space-sm bg-surface-container-low rounded border border-surface-container">
                  <div className="w-16 h-16 rounded bg-surface-container flex items-center justify-center shrink-0 overflow-hidden border border-surface-container relative">
                    {editImagenUrl ? (
                      <img src={editImagenUrl} alt="Vista previa" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-2xl text-secondary">image</span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-space-2xs">
                    <div className="flex items-center gap-space-xs">
                      <label className="cursor-pointer px-space-sm py-1 bg-surface-container hover:bg-surface-container-high text-on-surface rounded font-label-sm text-label-sm font-semibold flex items-center gap-1 transition-colors">
                        <span className="material-symbols-outlined text-base">upload_file</span>
                        <span>{editImagenUrl ? 'Cambiar Imagen' : 'Subir Imagen'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => {
                                setEditImagenUrl(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {editImagenUrl && (
                        <button
                          type="button"
                          onClick={() => setEditImagenUrl('')}
                          className="px-space-xs py-1 text-error hover:bg-error-container/20 rounded font-label-sm text-label-sm transition-colors"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    <input
                      type="url"
                      value={editImagenUrl}
                      onChange={e => setEditImagenUrl(e.target.value)}
                      placeholder="O pega URL de la imagen (https://...)"
                      className="w-full px-space-xs py-1 bg-surface-container-lowest border border-surface-container rounded text-on-surface text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-space-md">
                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Precio Compra ($) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPrecioCompra}
                    onChange={e => setEditPrecioCompra(e.target.value)}
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Precio Venta ($) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPrecioVenta}
                    onChange={e => setEditPrecioVenta(e.target.value)}
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-space-md">
                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Stock Mínimo Alerta</label>
                  <input
                    type="number"
                    min="1"
                    value={editStockMinimo}
                    onChange={e => setEditStockMinimo(e.target.value)}
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Unidad de Medida</label>
                  <input
                    type="text"
                    value={editUnidadMedida}
                    onChange={e => setEditUnidadMedida(e.target.value)}
                    placeholder="UND, KG, MTS"
                    className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary uppercase"
                  />
                </div>
              </div>

              <div className="pt-space-md border-t border-surface-container flex items-center justify-end gap-space-sm">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-space-md py-space-xs rounded text-secondary hover:bg-surface-container transition-colors font-label-md text-label-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-space-lg py-space-xs rounded bg-primary hover:bg-primary-container text-on-primary transition-colors font-label-md text-label-md shadow-sm disabled:opacity-50"
                >
                  {editSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Eliminar / Desactivar Producto */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-surface-container-lowest border border-surface-container rounded shadow-2xl p-space-lg relative">
            <div className="flex items-center gap-space-sm text-error mb-space-md">
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  ¿Eliminar Producto?
                </h3>
                <span className="font-mono text-label-sm text-label-sm text-secondary">
                  {deletingProduct.codigo}
                </span>
              </div>
            </div>

            <p className="font-body-sm text-body-sm text-secondary mb-space-md">
              Estás a punto de eliminar el producto <strong className="text-on-surface">{deletingProduct.nombre}</strong>. El producto será desactivado del catálogo para ventas y reportes operativos.
            </p>

            {deleteError && (
              <div className="mb-space-md p-space-sm rounded bg-error-container text-error font-body-sm text-body-sm flex items-center gap-space-xs font-semibold">
                <span className="material-symbols-outlined text-base">error</span>
                {deleteError}
              </div>
            )}

            <div className="pt-space-md border-t border-surface-container flex items-center justify-end gap-space-sm">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="px-space-md py-space-xs rounded text-secondary hover:bg-surface-container transition-colors font-label-md text-label-md"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteSubmitting}
                className="px-space-lg py-space-xs rounded bg-error hover:bg-error/90 text-on-error transition-colors font-label-md text-label-md shadow-sm disabled:opacity-50 flex items-center gap-space-xs"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                <span>{deleteSubmitting ? 'Eliminando...' : 'Sí, Eliminar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Ajuste Rápido de Stock */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-surface-container-lowest border border-surface-container rounded shadow-2xl p-space-lg relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-space-md pb-space-sm border-b border-surface-container">
              <div>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-2xl">tune</span>
                  Ajuste de Stock
                </h3>
                <span className="font-body-sm text-body-sm text-secondary">
                  {adjustingProduct.nombre} ({adjustingProduct.codigo})
                </span>
              </div>
              <button
                onClick={() => setAdjustingProduct(null)}
                className="text-secondary hover:text-on-surface transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {ajusteError && (
              <div className="mb-space-md p-space-sm rounded bg-error-container text-error font-body-sm text-body-sm flex items-center gap-space-xs font-semibold">
                <span className="material-symbols-outlined text-base">error</span>
                {ajusteError}
              </div>
            )}

            <form onSubmit={handleAjusteSubmit} className="space-y-space-md font-body-sm text-body-sm">
              <div className="bg-surface-container-low p-space-sm rounded flex items-center justify-between">
                <span className="text-secondary font-label-sm text-label-sm">Stock Actual en Sistema:</span>
                <span className="font-mono font-bold text-headline-sm text-on-surface">
                  {adjustingProduct.stockActual} {adjustingProduct.unidadMedida}
                </span>
              </div>

              <div>
                <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Tipo de Movimiento *</label>
                <div className="grid grid-cols-3 gap-space-xs">
                  <button
                    type="button"
                    onClick={() => setAjusteTipo('ENTRADA')}
                    className={`py-space-xs px-space-xs rounded text-center font-label-sm text-label-sm font-bold border transition-all flex flex-col items-center gap-1 ${
                      ajusteTipo === 'ENTRADA'
                        ? 'bg-tertiary text-on-tertiary border-tertiary shadow-sm'
                        : 'bg-surface-container-low text-secondary border-surface-container hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    <span>Entrada (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAjusteTipo('SALIDA')}
                    className={`py-space-xs px-space-xs rounded text-center font-label-sm text-label-sm font-bold border transition-all flex flex-col items-center gap-1 ${
                      ajusteTipo === 'SALIDA'
                        ? 'bg-error text-on-error border-error shadow-sm'
                        : 'bg-surface-container-low text-secondary border-surface-container hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">remove_circle</span>
                    <span>Salida (-)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAjusteTipo('AJUSTE')}
                    className={`py-space-xs px-space-xs rounded text-center font-label-sm text-label-sm font-bold border transition-all flex flex-col items-center gap-1 ${
                      ajusteTipo === 'AJUSTE'
                        ? 'bg-primary text-on-primary border-primary shadow-sm'
                        : 'bg-surface-container-low text-secondary border-surface-container hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">published_with_changes</span>
                    <span>Fijar (=)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">
                  {ajusteTipo === 'AJUSTE' ? 'Nuevo Stock Total *' : 'Cantidad a Modificar *'}
                </label>
                <input
                  required
                  type="number"
                  min={ajusteTipo === 'AJUSTE' ? '0' : '1'}
                  value={ajusteCantidad}
                  onChange={e => setAjusteCantidad(e.target.value)}
                  className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary font-mono text-base font-bold"
                />
              </div>

              <div className="bg-primary-fixed/20 p-space-sm rounded flex items-center justify-between border border-primary/20">
                <span className="text-secondary font-label-sm text-label-sm">Stock Resultante:</span>
                <span className="font-mono font-bold text-headline-sm text-primary">
                  {ajusteTipo === 'ENTRADA'
                    ? adjustingProduct.stockActual + (parseInt(ajusteCantidad, 10) || 0)
                    : ajusteTipo === 'SALIDA'
                    ? Math.max(0, adjustingProduct.stockActual - (parseInt(ajusteCantidad, 10) || 0))
                    : (parseInt(ajusteCantidad, 10) || 0)
                  } {adjustingProduct.unidadMedida}
                </span>
              </div>

              <div>
                <label className="block font-label-sm text-label-sm text-secondary mb-space-2xs">Motivo del Ajuste *</label>
                <input
                  required
                  type="text"
                  value={ajusteMotivo}
                  onChange={e => setAjusteMotivo(e.target.value)}
                  placeholder="Ej: Recepción proveedor, Merma, Conteo físico..."
                  className="w-full px-space-sm py-space-xs bg-surface-container-low border border-surface-container rounded text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-space-md border-t border-surface-container flex items-center justify-end gap-space-sm">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-space-md py-space-xs rounded text-secondary hover:bg-surface-container transition-colors font-label-md text-label-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ajusteSubmitting}
                  className="px-space-lg py-space-xs rounded bg-primary hover:bg-primary-container text-on-primary transition-colors font-label-md text-label-md shadow-sm disabled:opacity-50"
                >
                  {ajusteSubmitting ? 'Registrando...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Visualizar Kárdex Completo */}
      {kardexProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-surface-container-lowest border border-surface-container rounded shadow-2xl p-space-lg relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container shrink-0">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-tertiary text-2xl">receipt_long</span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Historial de Movimientos / Kárdex
                  </h3>
                  <div className="flex items-center gap-space-xs mt-0.5">
                    <span className="font-mono text-label-sm text-label-sm bg-surface-container px-space-xs py-0.5 rounded text-secondary">
                      {kardexProduct.codigo}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface font-medium">
                      {kardexProduct.nombre}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setKardexProduct(null)}
                className="text-secondary hover:text-on-surface transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-space-sm py-space-sm shrink-0">
              <div className="bg-surface-container-low p-space-xs rounded text-center">
                <span className="font-label-sm text-label-sm text-secondary block">Stock Actual</span>
                <span className="font-mono font-bold text-headline-sm text-on-surface">
                  {kardexProduct.stockActual} <span className="text-sm font-normal text-secondary">{kardexProduct.unidadMedida}</span>
                </span>
              </div>
              <div className="bg-surface-container-low p-space-xs rounded text-center">
                <span className="font-label-sm text-label-sm text-secondary block">Stock Mínimo</span>
                <span className="font-mono font-bold text-headline-sm text-primary-container">
                  {kardexProduct.stockMinimo} <span className="text-sm font-normal text-secondary">{kardexProduct.unidadMedida}</span>
                </span>
              </div>
              <div className="bg-surface-container-low p-space-xs rounded text-center">
                <span className="font-label-sm text-label-sm text-secondary block">Precio Venta</span>
                <span className="font-mono font-bold text-headline-sm text-on-surface">
                  ${Number(kardexProduct.precioVenta).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 min-h-[220px]">
              {loadingKardex ? (
                <div className="flex items-center justify-center h-48 text-secondary font-body-sm text-body-sm">
                  <span className="material-symbols-outlined animate-spin text-2xl mr-space-xs">progress_activity</span>
                  Cargando movimientos...
                </div>
              ) : kardexMovimientos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-secondary gap-space-xs">
                  <span className="material-symbols-outlined text-3xl opacity-40">history_toggle_drop</span>
                  <span className="font-body-sm text-body-sm">No se han registrado movimientos recientes para este producto.</span>
                  <button
                    type="button"
                    onClick={() => {
                      const prod = kardexProduct;
                      setKardexProduct(null);
                      setAdjustingProduct(prod);
                      setAjusteTipo('ENTRADA');
                      setAjusteCantidad('1');
                      setAjusteMotivo('Ingreso inicial de stock');
                    }}
                    className="mt-space-xs px-space-md py-space-xs bg-primary text-on-primary rounded font-label-md text-label-md shadow-sm"
                  >
                    Registrar Primer Movimiento
                  </button>
                </div>
              ) : (
                <table className="w-full text-left border-collapse font-body-sm text-body-sm">
                  <thead>
                    <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider sticky top-0">
                      <th className="py-space-xs px-space-sm">Fecha</th>
                      <th className="py-space-xs px-space-sm">Tipo</th>
                      <th className="py-space-xs px-space-sm text-right">Cantidad</th>
                      <th className="py-space-xs px-space-sm">Motivo</th>
                      <th className="py-space-xs px-space-sm">Usuario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {kardexMovimientos.map(m => {
                      const isEntrada = m.tipo === 'ENTRADA';
                      const isSalida = m.tipo === 'SALIDA';
                      return (
                        <tr key={m.id} className="hover:bg-surface-container-low/40">
                          <td className="py-space-xs px-space-sm font-mono text-secondary whitespace-nowrap">
                            {new Date(m.fecha).toLocaleString()}
                          </td>
                          <td className="py-space-xs px-space-sm">
                            <span
                              className={`px-space-xs py-0.5 rounded font-bold text-[11px] ${
                                isEntrada
                                  ? 'bg-tertiary-fixed text-tertiary'
                                  : isSalida
                                  ? 'bg-error-container text-error'
                                  : 'bg-primary-fixed text-primary'
                              }`}
                            >
                              {m.tipo}
                            </span>
                          </td>
                          <td className={`py-space-xs px-space-sm text-right font-mono font-bold ${
                            isEntrada ? 'text-tertiary' : isSalida ? 'text-error' : 'text-primary'
                          }`}>
                            {isEntrada ? `+${m.cantidad}` : isSalida ? `-${m.cantidad}` : `${m.cantidad}`}
                          </td>
                          <td className="py-space-xs px-space-sm text-on-surface">
                            {m.motivo}
                          </td>
                          <td className="py-space-xs px-space-sm text-secondary font-label-sm text-label-sm">
                            {m.usuario?.nombre || 'Sistema'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-space-md border-t border-surface-container flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-space-xs px-space-md py-space-xs rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
              >
                <span className="material-symbols-outlined text-base">print</span>
                <span>Imprimir Kárdex</span>
              </button>
              <button
                type="button"
                onClick={() => setKardexProduct(null)}
                className="px-space-lg py-space-xs rounded bg-primary hover:bg-primary-container text-on-primary transition-colors font-label-md text-label-md shadow-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal para Importar / Exportar Catálogo */}
      {isImportExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl bg-surface-container-lowest border border-surface-container rounded-lg shadow-2xl p-space-lg relative max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container shrink-0">
              <div className="flex items-center gap-space-xs">
                <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl">swap_vert</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Importar y Exportar Catálogo
                  </h3>
                  <p className="font-body-sm text-body-sm text-secondary">
                    Gestión masiva de inventario mediante archivos CSV compatibles con Microsoft Excel.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportExportModalOpen(false)}
                className="text-secondary hover:text-on-surface transition-colors p-1 rounded hover:bg-surface-container"
                type="button"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Selector de Pestañas */}
            <div className="flex items-center gap-space-xs pt-space-md pb-space-sm border-b border-surface-container shrink-0">
              <button
                type="button"
                onClick={() => setImportExportTab('exportar')}
                className={`flex items-center gap-space-xs px-space-md py-space-xs rounded font-label-md text-label-md transition-colors ${
                  importExportTab === 'exportar'
                    ? 'bg-primary text-on-primary font-bold shadow-sm'
                    : 'bg-surface-container-low text-secondary hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-lg">file_download</span>
                <span>Exportar Catálogo (Excel / CSV)</span>
              </button>
              <button
                type="button"
                onClick={() => setImportExportTab('importar')}
                className={`flex items-center gap-space-xs px-space-md py-space-xs rounded font-label-md text-label-md transition-colors ${
                  importExportTab === 'importar'
                    ? 'bg-primary text-on-primary font-bold shadow-sm'
                    : 'bg-surface-container-low text-secondary hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-lg">file_upload</span>
                <span>Importar Productos (Carga Masiva)</span>
              </button>
            </div>

            {/* Contenido de Pestañas */}
            <div className="overflow-y-auto flex-1 py-space-md space-y-space-md">
              {/* TAB 1: EXPORTAR */}
              {importExportTab === 'exportar' && (
                <div className="space-y-space-md">
                  {exportSuccessMsg && (
                    <div className="p-space-sm rounded bg-tertiary-fixed text-on-tertiary-fixed font-body-sm text-body-sm flex items-center gap-space-xs font-semibold animate-fade-in">
                      <span className="material-symbols-outlined text-xl text-tertiary">check_circle</span>
                      <span>{exportSuccessMsg}</span>
                    </div>
                  )}

                  <div className="bg-surface-container-low p-space-md rounded-lg border border-surface-container space-y-space-sm">
                    <h4 className="font-label-lg text-label-lg font-bold text-on-surface flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-primary text-lg">download</span>
                      Descargar archivo del catálogo
                    </h4>
                    <p className="font-body-sm text-body-sm text-secondary">
                      El archivo se generará con formato UTF-8 (BOM) para garantizar que los caracteres con tildes y la letra ñ se visualicen de forma nativa e impecable en Microsoft Excel, Google Sheets y LibreOffice.
                    </p>

                    <div className="pt-space-xs space-y-space-xs">
                      <span className="font-label-sm text-label-sm text-secondary font-bold block">
                        Selecciona el alcance de la exportación:
                      </span>
                      <label className="flex items-center gap-space-xs p-space-xs rounded hover:bg-surface-container cursor-pointer border border-transparent hover:border-surface-container">
                        <input
                          type="radio"
                          name="exportScope"
                          value="todos"
                          checked={exportScope === 'todos'}
                          onChange={() => setExportScope('todos')}
                          className="text-primary focus:ring-primary"
                        />
                        <div className="flex flex-col">
                          <span className="font-label-md text-label-md text-on-surface font-semibold">
                            Todos los productos registrados ({productos.length} items)
                          </span>
                          <span className="font-body-sm text-body-sm text-secondary">
                            Exporta el inventario completo registrado en el sistema.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-center gap-space-xs p-space-xs rounded hover:bg-surface-container cursor-pointer border border-transparent hover:border-surface-container">
                        <input
                          type="radio"
                          name="exportScope"
                          value="filtrados"
                          checked={exportScope === 'filtrados'}
                          onChange={() => setExportScope('filtrados')}
                          className="text-primary focus:ring-primary"
                        />
                        <div className="flex flex-col">
                          <span className="font-label-md text-label-md text-on-surface font-semibold">
                            Solo los productos del filtro actual ({filteredProductos.length} items)
                          </span>
                          <span className="font-body-sm text-body-sm text-secondary">
                            Aplica la búsqueda por texto y categoría activa actualmente en la tabla.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="bg-surface-container-lowest p-space-md rounded-lg border border-surface-container">
                    <span className="font-label-sm text-label-sm text-secondary font-bold uppercase tracking-wider block mb-space-xs">
                      Columnas incluidas en el archivo:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {['Código/SKU', 'Nombre', 'Categoría', 'Precio Compra ($)', 'Precio Venta ($)', 'Stock Actual', 'Stock Mínimo', 'Unidad Medida', 'Descripción', 'URL Imagen'].map((col, idx) => (
                        <span key={idx} className="px-space-xs py-0.5 rounded bg-surface-container font-mono text-label-sm text-secondary">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-space-sm pt-space-xs">
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="flex items-center gap-space-xs px-space-lg py-space-sm rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow transition-all hover:scale-[1.01]"
                    >
                      <span className="material-symbols-outlined text-xl">file_download</span>
                      <span>Descargar Catálogo (.CSV / Excel)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: IMPORTAR */}
              {importExportTab === 'importar' && (
                <div className="space-y-space-md">
                  {importResult && (
                    <div className="p-space-md rounded-lg bg-tertiary-fixed text-on-tertiary-fixed font-body-sm text-body-sm space-y-1 animate-fade-in border border-tertiary/30">
                      <div className="flex items-center gap-space-xs font-bold text-base text-tertiary">
                        <span className="material-symbols-outlined text-xl">check_circle</span>
                        <span>¡Importación completada con éxito!</span>
                      </div>
                      <p>
                        Se crearon <strong>{importResult.created}</strong> productos nuevos y se actualizaron <strong>{importResult.updated}</strong> productos existentes.
                        {importResult.failed > 0 && <span className="text-error font-semibold"> ({importResult.failed} filas con error omitidas)</span>}
                      </p>
                    </div>
                  )}

                  {importError && (
                    <div className="p-space-sm rounded bg-error-container text-error font-body-sm text-body-sm flex items-center gap-space-xs font-semibold animate-fade-in">
                      <span className="material-symbols-outlined text-xl">error</span>
                      <span>{importError}</span>
                    </div>
                  )}

                  {/* Paso 1: Descargar Plantilla */}
                  <div className="bg-surface-container-low p-space-md rounded-lg border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
                    <div>
                      <h4 className="font-label-lg text-label-lg font-bold text-on-surface flex items-center gap-space-xs">
                        <span className="material-symbols-outlined text-primary text-lg">description</span>
                        Paso 1: Descarga la plantilla oficial
                      </h4>
                      <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                        Utiliza esta plantilla con los encabezados exactos y ejemplos para asegurar una importación limpia y sin errores.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md rounded shadow-sm shrink-0 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg text-primary">download</span>
                      <span>Descargar Plantilla CSV</span>
                    </button>
                  </div>

                  {/* Paso 2: Cargar Archivo */}
                  <div className="bg-surface-container-low p-space-md rounded-lg border border-surface-container space-y-space-sm">
                    <h4 className="font-label-lg text-label-lg font-bold text-on-surface flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-primary text-lg">upload_file</span>
                      Paso 2: Selecciona o arrastra tu archivo CSV
                    </h4>

                    <div className="relative border-2 border-dashed border-surface-container hover:border-primary rounded-lg p-space-lg text-center transition-colors bg-surface-container-lowest flex flex-col items-center justify-center cursor-pointer">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <span className="material-symbols-outlined text-4xl text-primary mb-space-xs">
                        folder_zip
                      </span>
                      {importFileName ? (
                        <div className="flex flex-col items-center">
                          <span className="font-label-md text-label-md font-bold text-primary">
                            {importFileName}
                          </span>
                          <span className="font-body-sm text-body-sm text-secondary mt-0.5">
                            Archivo cargado. Haz clic para seleccionar otro archivo.
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="font-label-md text-label-md font-bold text-on-surface">
                            Arrastra tu archivo .CSV aquí o haz clic para examinar
                          </span>
                          <span className="font-body-sm text-body-sm text-secondary mt-0.5">
                            Compatible con hojas exportadas desde Excel o Google Sheets en formato .CSV
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-space-xs flex items-center gap-space-xs">
                      <input
                        type="checkbox"
                        id="updateExistingCheckbox"
                        checked={updateExisting}
                        onChange={e => setUpdateExisting(e.target.checked)}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <label htmlFor="updateExistingCheckbox" className="font-body-sm text-body-sm text-on-surface select-none cursor-pointer">
                        Actualizar productos existentes si el <strong>Código / SKU</strong> ya está registrado en el inventario.
                      </label>
                    </div>
                  </div>

                  {/* Paso 3: Previsualización de Datos */}
                  {importRows.length > 0 && (
                    <div className="space-y-space-sm animate-fade-in">
                      <div className="flex items-center justify-between flex-wrap gap-space-sm">
                        <div>
                          <h4 className="font-label-lg text-label-lg font-bold text-on-surface flex items-center gap-space-xs">
                            <span className="material-symbols-outlined text-primary text-lg">preview</span>
                            Previsualización de Filas ({importRows.length} detectadas)
                          </h4>
                          <span className="font-body-sm text-body-sm text-secondary">
                            Revisa el estado de validación antes de confirmar la importación.
                          </span>
                        </div>

                        <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded">
                          <button
                            type="button"
                            onClick={() => setImportFilter('todos')}
                            className={`px-space-xs py-0.5 rounded font-label-sm text-label-sm transition-colors ${
                              importFilter === 'todos' ? 'bg-surface-container font-bold text-on-surface' : 'text-secondary'
                            }`}
                          >
                            Todos ({importRows.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setImportFilter('validos')}
                            className={`px-space-xs py-0.5 rounded font-label-sm text-label-sm transition-colors ${
                              importFilter === 'validos' ? 'bg-tertiary-fixed text-tertiary font-bold' : 'text-secondary'
                            }`}
                          >
                            Válidos ({importRows.filter(r => r.isValid).length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setImportFilter('errores')}
                            className={`px-space-xs py-0.5 rounded font-label-sm text-label-sm transition-colors ${
                              importFilter === 'errores' ? 'bg-error-container text-error font-bold' : 'text-secondary'
                            }`}
                          >
                            Con Errores ({importRows.filter(r => !r.isValid).length})
                          </button>
                        </div>
                      </div>

                      <div className="border border-surface-container rounded-lg overflow-x-auto max-h-64 bg-surface-container-lowest">
                        <table className="w-full text-left border-collapse font-body-sm text-body-sm">
                          <thead className="bg-surface-container-low text-secondary font-label-sm text-label-sm sticky top-0 uppercase tracking-wider">
                            <tr>
                              <th className="py-2 px-3">Estado</th>
                              <th className="py-2 px-3">Código</th>
                              <th className="py-2 px-3">Nombre</th>
                              <th className="py-2 px-3">Categoría</th>
                              <th className="py-2 px-3 text-right">P. Compra</th>
                              <th className="py-2 px-3 text-right">P. Venta</th>
                              <th className="py-2 px-3 text-right">Stock</th>
                              <th className="py-2 px-3">Detalle / Error</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-container">
                            {importRows
                              .filter(r => {
                                if (importFilter === 'validos') return r.isValid;
                                if (importFilter === 'errores') return !r.isValid;
                                return true;
                              })
                              .map((row, idx) => (
                                <tr key={idx} className={`hover:bg-surface-container-low/30 ${!row.isValid ? 'bg-error-container/10' : ''}`}>
                                  <td className="py-1.5 px-3 whitespace-nowrap">
                                    {!row.isValid ? (
                                      <span className="px-2 py-0.5 rounded bg-error-container text-error font-bold text-[11px] flex items-center gap-1 w-fit">
                                        <span className="material-symbols-outlined text-xs">error</span> Error
                                      </span>
                                    ) : row.isUpdate ? (
                                      <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary font-bold text-[11px] flex items-center gap-1 w-fit">
                                        <span className="material-symbols-outlined text-xs">sync</span> Actualizar
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-tertiary font-bold text-[11px] flex items-center gap-1 w-fit">
                                        <span className="material-symbols-outlined text-xs">add_circle</span> Nuevo
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-3 font-mono font-semibold text-on-surface">{row.codigo || '—'}</td>
                                  <td className="py-1.5 px-3 font-medium text-on-surface">{row.nombre || '—'}</td>
                                  <td className="py-1.5 px-3 text-secondary">{row.categoriaNombre}</td>
                                  <td className="py-1.5 px-3 text-right font-mono">${row.precioCompra.toFixed(2)}</td>
                                  <td className="py-1.5 px-3 text-right font-mono font-bold text-on-surface">${row.precioVenta.toFixed(2)}</td>
                                  <td className="py-1.5 px-3 text-right font-mono">{row.stockActual} {row.unidadMedida}</td>
                                  <td className="py-1.5 px-3 text-secondary text-xs">
                                    {row.errors.length > 0 ? (
                                      <span className="text-error font-medium">{row.errors.join(', ')}</span>
                                    ) : (
                                      <span className="text-tertiary">Correcto</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Progreso de Importación */}
                      {importProgress && (
                        <div className="p-space-sm bg-surface-container-low rounded border border-surface-container space-y-1">
                          <div className="flex items-center justify-between text-body-sm font-label-md text-on-surface">
                            <span>Importando productos al catálogo...</span>
                            <span className="font-mono font-bold">{importProgress.current} / {importProgress.total}</span>
                          </div>
                          <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all duration-150"
                              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-space-sm pt-space-xs">
                        <button
                          type="button"
                          disabled={importProgress !== null || importRows.filter(r => r.isValid && (updateExisting || !r.isUpdate)).length === 0}
                          onClick={handleExecuteImport}
                          className="flex items-center gap-space-xs px-space-lg py-space-sm rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-xl">file_upload</span>
                          <span>
                            {importProgress ? 'Importando...' : `Confirmar e Importar (${importRows.filter(r => r.isValid && (updateExisting || !r.isUpdate)).length} productos)`}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-space-md border-t border-surface-container flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsImportExportModalOpen(false)}
                className="px-space-md py-space-xs rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Sugerencia de Orden de Compra Automática */}
      {isOrdenCompraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-4xl bg-surface-container-lowest border border-surface-container rounded-lg shadow-2xl p-space-lg relative max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container shrink-0">
              <div className="flex items-center gap-space-xs">
                <div className="w-10 h-10 rounded-full bg-error-container text-error flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">local_shipping</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Orden de Compra Sugerida (Reabastecimiento)
                  </h3>
                  <p className="font-body-sm text-body-sm text-secondary">
                    Cálculo automático de unidades requeridas para reponer existencias por encima del stock de seguridad.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOrdenCompraModalOpen(false)}
                className="text-secondary hover:text-on-surface transition-colors p-1 rounded hover:bg-surface-container"
                type="button"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Resumen KPIs de Reabastecimiento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm py-space-md shrink-0">
              <div className="bg-surface-container-low p-space-sm rounded-lg border border-surface-container text-center">
                <span className="font-label-sm text-label-sm text-secondary block">Productos Críticos</span>
                <span className="font-display-sm text-display-sm font-bold text-error">
                  {criticalProducts.length}
                </span>
                <span className="font-body-sm text-body-sm text-secondary block mt-0.5">con stock menor al mínimo</span>
              </div>
              <div className="bg-surface-container-low p-space-sm rounded-lg border border-surface-container text-center">
                <span className="font-label-sm text-label-sm text-secondary block">Unidades Sugeridas a Pedir</span>
                <span className="font-display-sm text-display-sm font-bold text-primary">
                  {criticalProducts.reduce((acc, p) => acc + Math.max((p.stockMinimo * 2) - p.stockActual, 1), 0)}
                </span>
                <span className="font-body-sm text-body-sm text-secondary block mt-0.5">para alcanzar buffer óptimo</span>
              </div>
              <div className="bg-surface-container-low p-space-sm rounded-lg border border-surface-container text-center">
                <span className="font-label-sm text-label-sm text-secondary block">Inversión Estimada Total</span>
                <span className="font-display-sm text-display-sm font-bold text-on-surface">
                  ${criticalProducts.reduce((acc, p) => {
                    const cant = Math.max((p.stockMinimo * 2) - p.stockActual, 1);
                    return acc + (cant * Number(p.precioCompra));
                  }, 0).toFixed(2)}
                </span>
                <span className="font-body-sm text-body-sm text-secondary block mt-0.5">a costo de compra unitario</span>
              </div>
            </div>

            {/* Tabla de Productos Críticos */}
            <div className="overflow-y-auto flex-1 min-h-[220px] border border-surface-container rounded-lg">
              {criticalProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-52 text-secondary gap-space-xs">
                  <span className="material-symbols-outlined text-4xl text-tertiary">check_circle</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    ¡Inventario en Nivel Óptimo!
                  </span>
                  <p className="font-body-sm text-body-sm text-secondary text-center max-w-md">
                    No existen productos que requieran orden de compra urgente en este momento. Todos los SKUs superan el stock de seguridad.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse font-body-sm text-body-sm">
                  <thead className="bg-surface-container-low text-secondary font-label-sm text-label-sm sticky top-0 uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Código</th>
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3">Categoría</th>
                      <th className="py-2 px-3 text-right">Stock Actual</th>
                      <th className="py-2 px-3 text-right">Stock Mínimo</th>
                      <th className="py-2 px-3 text-right">Cant. Sugerida</th>
                      <th className="py-2 px-3 text-right">Costo Unit.</th>
                      <th className="py-2 px-3 text-right">Subtotal Estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {criticalProducts.map(p => {
                      const sugerido = Math.max((p.stockMinimo * 2) - p.stockActual, 1);
                      const subtotal = sugerido * Number(p.precioCompra);
                      return (
                        <tr key={p.id} className="hover:bg-surface-container-low/30">
                          <td className="py-2 px-3 font-mono font-bold text-primary">{p.codigo}</td>
                          <td className="py-2 px-3 font-medium text-on-surface">{p.nombre}</td>
                          <td className="py-2 px-3 text-secondary">{p.categoria?.nombre || 'General'}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-error">
                            {p.stockActual} {p.unidadMedida}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-secondary">
                            {p.stockMinimo} {p.unidadMedida}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-primary bg-primary-fixed/10">
                            +{sugerido} {p.unidadMedida}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-secondary">
                            ${Number(p.precioCompra).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-on-surface">
                            ${subtotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-space-md border-t border-surface-container flex items-center justify-between shrink-0">
              <div className="flex items-center gap-space-xs">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-space-xs px-space-md py-space-xs rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  <span>Imprimir Orden</span>
                </button>
                {criticalProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportPurchaseOrder}
                    className="flex items-center gap-space-xs px-space-md py-space-xs rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">file_download</span>
                    <span>Descargar Orden en CSV</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsOrdenCompraModalOpen(false)}
                className="px-space-lg py-space-xs rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
