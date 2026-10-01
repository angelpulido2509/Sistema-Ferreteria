# Instrucciones para Antigravity — Sistema Multimoneda
## Proyecto: Sistema Ferretería (FerrePro) — Guasdualito, Estado Apure

> Esta es una iteración funcional nueva, no solo visual. Lee `AGENTS.md`, `documento-maestro-ferreteria.md` y `REPORTE-ESTADO-PROYECTO.md` antes de empezar. **El paso 1 de esta instrucción es un prerrequisito bloqueante** — no se puede avanzar al multimoneda sin resolverlo primero.

---

## 0. Contexto de negocio (importante para las decisiones técnicas)

La ferretería opera en **Guasdualito, Estado Apure**, zona fronteriza con Colombia. En esta zona circulan y se usan comercialmente **tres monedas simultáneamente**:

| Método de pago | Moneda | Tipo |
|---|---|---|
| Efectivo | Peso colombiano (COP) | Físico |
| Efectivo | Dólar (USD) | Físico |
| Pago móvil | Bolívar (VES) | Digital/bancario |
| Tarjeta | Bolívar (VES) | Digital/bancario |
| Zelle | Dólar (USD) | Digital/transferencia |

Una sola venta puede pagarse combinando más de un método (ya existe la pestaña "Mixto" en el POS actual) — por lo tanto **una venta puede tener pagos en más de una moneda a la vez**.

---

## 1. PRERREQUISITO BLOQUEANTE — Persistir Configuración en backend

Antes de tocar monedas: el módulo de Gestión (`ConfiguracionView.tsx`) actualmente guarda todo en `localStorage` (confirmado en `REPORTE-ESTADO-PROYECTO.md`, sección 5.1). Esto rompe el requisito RF17 (misma información en desktop y móvil en tiempo real) en cuanto se agreguen tasas de cambio, porque cada dispositivo tendría su propia tasa.

**Implementar:**
- Modelo `Configuracion` en `prisma/schema.prisma` (tabla de fila única o con `id` fijo) que incluya todos los campos ya existentes en las 4 pestañas de Gestión (Datos de la Ferretería, Finanzas, Usuarios ya tiene su propio modelo, Inventario/POS/Impresión).
- Endpoints `GET /api/configuracion` y `PUT /api/configuracion` (protegido con `authorizeRoles(RolUsuario.ADMIN)`).
- Migrar `ConfiguracionView.tsx` para leer/escribir contra la API (React Query) en vez de `localStorage`. Se puede mantener `localStorage` únicamente como caché temporal para lectura offline, nunca como fuente de verdad.

---

## 2. Modelo de datos — Monedas, Tasas y Métodos de Pago

### 2.1 Moneda ancla (funcional)

Los precios de productos y los reportes de valor de inventario se manejan **en USD como moneda funcional interna**. Bs y COP son monedas de **presentación/cobro**, derivadas por tasa de cambio configurada. Esto evita re-cotizar el catálogo cada vez que cambia una tasa.

> Si el cliente prefiere anclar en Bs o COP en vez de USD, este es el único parámetro que cambia — el resto del diseño no depende de cuál sea la moneda ancla, solo de que exista una.

### 2.2 Cambios en `schema.prisma`

```prisma
enum Moneda {
  USD
  VES
  COP
}

enum MetodoPago {
  EFECTIVO_USD
  EFECTIVO_COP
  PAGO_MOVIL_VES
  TARJETA_VES
  ZELLE_USD
}

model TasaCambio {
  id            Int      @id @default(autoincrement())
  moneda        Moneda   // moneda que se está cotizando (VES o COP)
  tasaRespectoUSD Decimal @db.Decimal(18, 4) // cuántas unidades de esa moneda equivalen a 1 USD
  actualizadoEn DateTime @updatedAt
  actualizadoPor Int?    // usuario_id (FK a Usuario)

  @@unique([moneda])
}

model Venta {
  // ...campos existentes...
  monedaFuncional   Moneda   @default(USD)
  totalUsd          Decimal  @db.Decimal(12, 2) // total de la venta en la moneda ancla
  pagos             PagoVenta[]
}

model PagoVenta {
  id              Int        @id @default(autoincrement())
  venta           Venta      @relation(fields: [ventaId], references: [id])
  ventaId         Int
  metodoPago      MetodoPago
  moneda          Moneda
  montoMoneda     Decimal    @db.Decimal(18, 2) // monto recibido en la moneda del pago
  tasaAplicada    Decimal?   @db.Decimal(18, 4) // tasa vigente al momento del cobro (null si moneda = ancla)
  equivalenteUsd  Decimal    @db.Decimal(12, 2) // conversión a la moneda ancla, para cuadre contable
}
```

**Regla crítica de auditoría:** `tasaAplicada` se guarda **congelada en el momento de la venta**, nunca se recalcula después. Si la tasa BCV o del paralelo cambia mañana, las ventas de ayer deben seguir mostrando la tasa con la que realmente se cobraron. Esto es indispensable para que el cuadre de caja histórico sea correcto.

---

## 3. Extensión del módulo de Gestión (`ConfiguracionView.tsx`, pestaña "Finanzas")

Renombrar la pestaña actual "Finanzas y Tasa BCV" a **"Monedas y Tasas de Cambio"** y ampliar su contenido:

- **Moneda funcional del negocio**: selector (por defecto USD, ver sección 2.1). Advertencia visible: "Cambiar esto no recalcula ventas anteriores."
- **Tasa VES por USD**: campo editable (reemplaza el campo único "Tasa BCV" actual).
- **Tasa COP por USD**: campo nuevo editable.
- Mostrar junto a cada tasa la fecha/hora de última actualización y quién la actualizó (usar `actualizadoEn` / `actualizadoPor`).
- **Métodos de pago activos**: en vez de la lista genérica actual, mostrar cada método ya asociado a su moneda fija (no editable la moneda, es una relación de negocio fija):
  - Efectivo (COP)
  - Efectivo (USD)
  - Pago Móvil (Bs)
  - Tarjeta (Bs)
  - Zelle (USD)

  Cada uno con un toggle de activo/inactivo únicamente (el dueño puede desactivar Zelle si un día no lo usa, por ejemplo, pero no puede cambiarle la moneda).
- Guardar todo contra `PUT /api/configuracion` (ver sección 1) — no `localStorage`.

---

## 4. Cambios en el Punto de Venta (POS) — únicamente el drawer de cobro

> **No tocar el resto de `PosView.tsx`** (grilla de productos, búsqueda, etc. — sigue "congelado" por instrucción previa). Solo se extiende la sección de cobro.

- Las pestañas de método de cobro pasan de (`Efectivo`, `Tarjeta`, `Transf.`, `Mixto`) a los 5 métodos reales de la sección 2.2, agrupados visualmente por moneda para que el cajero entienda rápido:
  - **Dólares:** Efectivo USD · Zelle
  - **Bolívares:** Pago Móvil · Tarjeta
  - **Pesos:** Efectivo COP
- Al seleccionar un método, mostrar el monto a cobrar **ya convertido a esa moneda** usando la tasa vigente (traída de `/api/configuracion`), sin que el cajero tenga que calcular nada.
- **Pago mixto (más de un método en una venta):** permitir agregar varias líneas de pago (una por método usado), cada una guardándose como un registro `PagoVenta`. El sistema valida que la suma de los `equivalenteUsd` de todas las líneas cubra el `totalUsd` de la venta.
- **Política de vuelto:** el vuelto se calcula y se entrega **en la misma moneda en que se recibió ese pago específico**. No hacer conversión automática de vuelto entre monedas — evita errores de cálculo cruzado. Mostrar el vuelto claramente etiquetado con su moneda (ej. "Vuelto: $2.00 USD" o "Vuelto: 15.000 COP").
- Validación: si el cajero intenta cobrar sin que exista una tasa configurada para una moneda distinta al ancla, bloquear ese método de pago y mostrar mensaje: "Configura la tasa de [moneda] en Gestión antes de usar este método."

---

## 5. Cambios en Historial de Ventas y Comprobante

- **`VentasHistorialView.tsx`**: en la tabla de ventas, si una venta tuvo pagos en más de una moneda, mostrar un badge pequeño "Pago mixto" con tooltip que liste el desglose (ej. "USD 10.00 + COP 20.000").
- **`ComprobanteModal.tsx`**: mostrar el desglose de pago línea por línea con su moneda y tasa aplicada en ese momento (para que el cliente vea exactamente cuánto pagó en cada moneda y a qué tasa). El total en la moneda ancla (USD) se muestra como referencia contable.
- **Arqueo de caja / cierre de turno**: debe mostrar el efectivo físico a contar **separado por moneda** (cuánto efectivo USD, cuánto efectivo COP), ya que son billetes físicos distintos que se cuentan por separado — no sumarlos en un solo número. Los métodos digitales (Pago Móvil, Tarjeta, Zelle) se muestran aparte, agrupados por moneda, ya que no requieren conteo físico.

---

## 6. Reportes / Dashboard

- El Dashboard (**no modificar su estructura**, solo el cálculo subyacente) debe seguir mostrando los KPIs de ventas en la moneda ancla (USD) para que las comparaciones entre días tengan sentido, aunque las ventas individuales se hayan cobrado en distintas monedas.
- Opcional (Fase 2, no implementar ahora): un desglose de "ingresos por moneda" en el reporte ejecutivo descargable.

---

## 7. Tests requeridos para esta iteración

Extender la suite de `venta` en `apps/api`:
- Venta pagada 100% en un solo método/moneda distinta al ancla → conversión correcta.
- Venta con pago mixto (2+ métodos) → suma de equivalentes cubre el total, cada `PagoVenta` guarda su tasa congelada.
- Venta con pago insuficiente (suma de equivalentes menor al total) → debe rechazarse.
- Cambio de tasa en Configuración **no** debe alterar el `tasaAplicada` de ventas ya registradas (test de regresión explícito para esto, es la regla más importante de esta sección).
- Endpoint `/api/configuracion` protegido: un `CAJERO` no puede modificar tasas, solo `ADMIN`.

---

## 8. Proceso de trabajo esperado

1. Implementar y validar el paso 1 (persistencia backend de Configuración) **antes** de tocar cualquier cosa de monedas — es la base de todo lo demás.
2. Migrar `schema.prisma` (sección 2.2) y mostrar el diff antes de aplicar la migración.
3. Extender Gestión (sección 3), validar con capturas antes de continuar.
4. Extender el drawer de cobro del POS (sección 4) — sin tocar el resto de esa vista.
5. Extender Historial/Comprobante (sección 5).
6. Correr y ampliar tests (sección 7) antes de dar por cerrada la iteración.
7. Confirmar cada módulo con el cliente antes de pasar al siguiente, como en iteraciones anteriores.

---

## 9. Definición de "hecho"

- La configuración de tasas y monedas vive en PostgreSQL, visible igual en escritorio y móvil.
- Se puede cobrar una venta con los 5 métodos de pago reales, incluyendo pagos mixtos.
- Cada pago guarda su tasa congelada al momento de la transacción.
- El arqueo de caja separa efectivo físico por moneda (USD / COP) de los métodos digitales (Bs).
- Tests nuevos pasan, ninguno de los tests existentes (30/30 previos) se rompe.
