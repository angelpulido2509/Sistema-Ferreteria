# Addendum para Claude Code — Requerimientos de producto (facturación dual, multimoneda, reportes)
## Proyecto: FerrePro — complementa `INSTRUCCIONES-CODE-REMEDIACION-FERREPRO.md`

> **Precedencia:** este addendum NO reemplaza la remediación. La Fase 1 sigue siendo la prioridad. Lo único que se adelanta es lo marcado en la sección 1 (cambios a la migración de Fase 1 **antes de aplicarla**, para no migrar dos veces). Todo lo demás va después de que la Fase 1 esté aprobada.
> Reglas de trabajo iguales: verificar antes de editar, un commit por hallazgo, test que falla antes y pasa después, diff de esquema antes de aplicar, backup antes de migrar, nada de secretos en logs.

---

## 1. Cambios a la migración de Fase 1 (aún no aplicada)

Agregar al `schema.local.prisma` y a `20261001_fase1.sql`, y volver a ensayar sobre copia de la BD:

```diff
 enum MetodoPago {
+  NEQUI_COP            // billetera digital en pesos; NO es efectivo (no entra al cuadre físico)
 }

+enum TipoDocumento {
+  FACTURA              // fiscal: IVA sumado, registro fiscal
+  NOTA_ENTREGA         // sin IVA, control interno
+}

 model Venta {
+  tipoDocumento  TipoDocumento @default(NOTA_ENTREGA)
+  esPrueba       Boolean       @default(false)     // venta creada en modo pruebas
+  vueltoMoneda   Moneda?                           // moneda en que se entregó el vuelto
 }

 model Configuracion {
+  facturacionFiscalActiva Boolean @default(false)  // el módulo dual solo si el cliente lo pide
+  modoPruebas             Boolean @default(false)
+  logoPath                String?                  // ruta de archivo, NO base64 en BD
+  serieFactura            String  @default("F001")
+  serieNotaEntrega        String  @default("N001")
+  igtfActivo              Boolean @default(false)  // pendiente de confirmar con contador
+  igtfPorcentaje          Decimal @default(3)
 }

+model AuditoriaEvento {
+  id          String   @id @default(uuid())
+  entidad     String
+  entidadId   String?
+  accion      String            // ANULAR | PURGAR_PRUEBAS | CAMBIO_CONFIG ...
+  usuarioId   String
+  motivo      String
+  detalle     String?           // JSON con conteos/valores previos
+  fecha       DateTime @default(now())
+  @@map("auditoria_eventos")
+}
```

- `SecuenciaDocumento` ya existe en la Fase 1: úsala **una fila por serie** (`F001`, `N001`, y luego `C001` para cotizaciones). La nota de entrega **también lleva correlativo propio**, asignado en la transacción de la venta.
- Datos históricos: `tipoDocumento = NOTA_ENTREGA`, `esPrueba = false` (se marcarán de prueba con el script de la sección 5).
- La Fase 1 sigue calculando IVA desde la configuración; la regla por tipo de documento se implementa en la sección 3 (no dentro de la migración).

---

## 2. Decisiones sobre las preguntas abiertas del documento de requerimientos

| Pregunta | Decisión propuesta |
|---|---|
| ¿Nota de entrega con correlativo propio? | **Sí**, serie `N001`, sin huecos, no borrable. Un hueco en la numeración es una alerta de auditoría. |
| ¿Moneda del vuelto? | Se mantiene la política vigente: **vuelto en la misma moneda del efectivo recibido**. Solo los pagos en efectivo generan vuelto. Si hay varios efectivos, el cajero elige la moneda del vuelto entre las que recibió; el servidor lo convierte con la tasa congelada, lo limita al efectivo recibido en esa moneda y lo guarda en `vuelto` + `vueltoMoneda`. Nequi, Zelle, pago móvil y punto de venta **no generan vuelto** (se cobra el monto exacto). |
| ¿IGTF y exentos? | Quedan **apagados por defecto** (`igtfActivo=false`) hasta que el contador confirme. La estructura queda lista (`exentoIva` por producto, `igtfPorcentaje`). |
| ¿Máquina fiscal o imprenta digital? | Hasta que el contador lo confirme, el documento se rotula **"COMPROBANTE — NO VÁLIDO COMO FACTURA FISCAL"**. Una integración con proveedor/máquina fiscal autorizado es un módulo aparte, posterior. |
| ¿Reportes en PDF? | **Sí.** Se adelanta el endpoint PDF del backend (ver sección 6). |

---

## 3. Fase 1C — Documento dual, multimoneda y pagos mixtos

*(Después de aprobada la Fase 1.)*

### 3.1 Tipo de documento y cálculo de IVA (servidor)
- Con `facturacionFiscalActiva=false`: todo es `NOTA_ENTREGA` y la UI **no pregunta** nada.
- Con el módulo activo: `tipoDocumento` es obligatorio en el request. `FACTURA` ⇒ IVA de `Configuracion` (por línea, respetando `exentoIva`) sumado al total; `NOTA_ENTREGA` ⇒ IVA 0. El servidor recalcula siempre; ignora cualquier total del cliente.
- **Punto de diseño crítico:** el total depende del tipo de documento y los pagos deben cubrir ese total. Por eso el POS debe pedir el tipo **antes** de fijar los montos de pago (selector en la parte superior del drawer de cobro que recalcula el total). Si el tipo cambia, se reinician los pagos ya cargados.
- `FACTURA` exige cliente con RIF/cédula válido (no "Consumidor Final" genérico, salvo que el contador indique lo contrario).
- Si `igtfActivo`, el IGTF se calcula en el servidor solo sobre los pagos en divisas (`EFECTIVO_USD`, `ZELLE_USD`) y se muestra como línea separada.

### 3.2 Totales en tres monedas y pagos mixtos
- El carrito muestra el total en USD, VES y COP con las tasas de `Configuracion` (la UI las lee del servidor; nunca editables por el cajero). Mostrar fecha/hora de la tasa; si está vencida (>12 h), avisar y bloquear cobro en VES/COP.
- Métodos: `EFECTIVO_USD`, `ZELLE_USD`, `EFECTIVO_COP`, `NEQUI_COP`, `TARJETA_VES` (rotulado "Punto de venta"), `PAGO_MOVIL_VES`. Cada método fija su moneda (validación del servidor).
- Algoritmo de saldo: cada pago convierte a USD con su tasa congelada; el saldo restante se muestra en las tres monedas; la venta **solo se emite** cuando Σ pagos (neto) ≥ total. Redondeo: USD y VES a 2 decimales, COP entero, todo vía `money.ts`; el último pago absorbe el residuo de redondeo (máx. 1 unidad mínima de la moneda).
- `NEQUI_COP`, `ZELLE_USD`, `PAGO_MOVIL_VES`, `TARJETA_VES` van a la columna de "no efectivo" del Z: el cuadre físico solo cuenta efectivo.
- Referencia obligatoria (mín. 4 caracteres) para Zelle, Nequi, pago móvil y punto de venta.

### 3.3 Criterios de aceptación
- [ ] Test: el mismo carrito da total distinto como FACTURA y como NOTA_ENTREGA, y el servidor ignora el total del cliente.
- [ ] Test: pago mixto USD + VES + COP + Nequi que cubre exacto; uno que queda corto por 1 centavo se rechaza.
- [ ] Test: Nequi/Zelle no generan vuelto ni afectan el efectivo esperado.
- [ ] Test: correlativos `F001-…` y `N001-…` independientes, sin huecos bajo concurrencia.
- [ ] Con el módulo apagado, la API rechaza `tipoDocumento=FACTURA`.

---

## 4. Fase 1D — Personalización por cliente

- Configuración (solo ADMIN): logotipo, nombre comercial, razón social, RIF, dirección, teléfono, interruptor "Facturación fiscal", interruptor "Modo de pruebas". Cada opción con nombre claro y texto de ayuda de una línea.
- **Logo:** subir PNG/JPG (máx. 1 MB; validar tipo por contenido, no por extensión). **No aceptar SVG** (riesgo de scripts). Guardar como archivo en la carpeta de datos del usuario (`userData`/`BACKUP_DIR`-hermana), servirlo por un endpoint autenticado y **no** como base64 dentro de la BD ni del JSON.
- Esos datos alimentan: comprobante, factura, nota de entrega, cotización y reportes. Un solo componente/plantilla de encabezado reutilizado en todos.
- Validar formato de RIF (`J-########-#`) en el servidor.
- Cada cambio en Configuración (tasas, interruptores, datos fiscales) escribe un `AuditoriaEvento`.

---

## 5. Ventas de prueba y borrado controlado

> Sustituye cualquier idea de "borrar ventas" a secas. Principio: **las ventas reales nunca se borran, se anulan.** Solo se purga lo que fue creado explícitamente como prueba.

1. **Modo pruebas** (interruptor ADMIN, con confirmación y motivo): mientras está activo, toda venta nueva se guarda con `esPrueba=true`, un banner rojo permanente lo indica en la UI y en cualquier comprobante impreso ("PRUEBA — SIN VALOR").
2. Las ventas `esPrueba` **no cuentan** en cierre de caja (Z), reportes, kárdex real, cola de sync ni numeración fiscal (usan una serie `T001` aparte para no abrir huecos en `F001/N001`).
3. **Purga:** `POST /api/ventas/purgar-pruebas` (solo ADMIN, solo filas `esPrueba=true`, exige motivo). Borra ventas, detalles, pagos y movimientos asociados, y escribe un `AuditoriaEvento` con conteo y quién la ejecutó. El stock de pruebas no se tocó, así que no hay nada que revertir.
4. **Datos actuales:** script one-shot `scripts/marcar-ventas-prueba.mjs` (backup previo, lista lo que marcará, pide confirmación escrita) para convertir las ventas de prueba existentes en `esPrueba=true`, y luego purgarlas con el endpoint. Si esas ventas ya descontaron stock real, el script debe **revertir el stock y el kárdex** de forma explícita y reportarlo.
5. **Protecciones:** una venta `FACTURA` real nunca se borra ni se edita (solo anulación con motivo, usuario y fecha; si el turno está cerrado, ajuste en el turno vigente). Las `NOTA_ENTREGA` reales tampoco se borran, solo se anulan. Anular no libera el número.
6. Tests: CAJERO recibe 403; intento de purgar una venta real devuelve 400; la purga deja auditoría; el modo pruebas no altera el Z ni los reportes.

---

## 6. Fase 4B — Reportes y cotizaciones con marca (después de Fase 1C/1D)

- **PDF en el backend** (`pdf-lib` o `puppeteer`): endpoints `/api/ventas/:id/pdf`, `/api/cotizaciones/:id/pdf`, `/api/reportes/*/pdf`. Encabezado común: logo, nombre, RIF, dirección y teléfono tomados de Configuración.
- **Cotizaciones:** modelo `Cotizacion` + `DetalleCotizacion`, serie `C001`, vigencia (días), estado (`BORRADOR`, `ENVIADA`, `ACEPTADA`, `VENCIDA`), **sin efecto en stock ni en caja**, convertible a venta (el servidor recalcula precios y tasas al convertir; la cotización muestra la fecha y la tasa usada).
- **Vista de dueño:** consolida facturas y notas de entrega (excluye `esPrueba`), ingresos y gastos, con filtro por tipo y por rango de fechas. Muestra el desglose por moneda y por método de pago; montos en las tres monedas usando la **tasa congelada** de cada pago (nunca la actual) para ventas históricas.
- **Reporte fiscal:** solo `tipoDocumento=FACTURA`, rango de fechas, totales de base imponible, IVA, IGTF (si aplica), anuladas listadas aparte; exportable a PDF y CSV. Inmutable: no se genera a partir de datos editables.
- **Gastos:** hoy solo existen los egresos de caja. Antes de prometer "ingresos y gastos" definir un módulo mínimo de gastos (categoría, monto, moneda, fecha, soporte) o dejar claro en el reporte que solo incluye egresos de caja.
- Tests: totales del reporte = suma de documentos; el reporte fiscal no incluye notas ni pruebas; el PDF contiene los datos de Configuración.

---

## 7. Límites y advertencias (leer antes de implementar)

1. **Validez fiscal.** Este sistema no es, por sí mismo, una máquina fiscal ni un proveedor autorizado de facturación. Mientras el contador no confirme el mecanismo, `FACTURA` es un documento interno con la leyenda indicada en la sección 2. No presentarlo al usuario como factura legalmente válida.
2. **Diseño que no oculte ventas.** El módulo dual es legítimo como separación de documentos, pero **no debe construirse como mecanismo para dejar ventas fuera del registro**. Por eso: toda venta real queda registrada con correlativo y sin posibilidad de borrado; la vista de dueño y los reportes de auditoría muestran ambos tipos; la anulación deja rastro; no se implementa ninguna función de "ocultar", "excluir de reportes" ni "borrar" una venta real. Qué documento corresponde emitir en cada operación es una obligación del negocio y de su contador; si el cliente pide que el sistema ayude a *no* declarar ventas gravadas, Code debe negarse y decírselo al usuario.
3. **Diferencia de precio por tipo de documento.** Que la nota de entrega sea "sin IVA" cambia el total que paga el cliente según el documento elegido. Documentarlo al contador antes de salir a producción.
4. No se aplican estos cambios a la nube hasta la Fase 2 (sync): anotar en `docs/DEUDA-TECNICA.md` que `tipoDocumento`, series, `esPrueba` y `AuditoriaEvento` no viajan aún.

---

## 8. Orden de ejecución revisado

| Orden | Qué | Dependencia |
|---|---|---|
| 1 | Aplicar la migración de Fase 1 **con los cambios de la sección 1** y terminar Fase 1 (1.1–1.7) | Aprobación del diff |
| 2 | Fase 1C: documento dual, 3 monedas, pagos mixtos | Fase 1 |
| 3 | Fase 1D: personalización y logo | Fase 1 |
| 4 | Sección 5: modo pruebas, purga y limpieza de datos actuales | 1C |
| 5 | Fase 2: unificar esquema y sync (incluir los campos nuevos) | 1C/1D |
| 6 | Fase 4B: reportes, cotizaciones y PDF | 1C + Fase 2 recomendable |
| 7 | CxC (fiado) y cantidades fraccionadas | Fase 3 |
| 8 | Electron | Fases 0-2 |

## 9. Mensaje sugerido para Code

> Lee `INSTRUCCIONES-CODE-ADDENDUM-REQUERIMIENTOS.md`. Antes de aplicar la migración de Fase 1, incorpora los cambios de la sección 1 (NEQUI_COP, `TipoDocumento`, `esPrueba`, `vueltoMoneda`, campos de Configuración, `AuditoriaEvento`), vuelve a ensayar sobre una copia y muéstrame el diff actualizado. No implementes aún las secciones 3–6; hazlas después de aprobar la Fase 1, en el orden de la sección 8. Respeta los límites de la sección 7.
