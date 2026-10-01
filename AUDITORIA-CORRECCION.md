# Instrucciones para Antigravity — Auditoría y Corrección de Brechas Críticas
## Proyecto: Sistema Ferretería (FerrePro) — Guasdualito, Estado Apure

> **Este documento tiene prioridad sobre cualquier tarea nueva.** No se debe avanzar a Órdenes de Compra, Cuentas por Cobrar/Pagar, ni ninguna otra funcionalidad del roadmap hasta que las brechas descritas aquí queden confirmadas o corregidas. Lee `AGENTS.md`, `INSTRUCCIONES-ANTIGRAVITY-MULTIMONEDA.md`, `INSTRUCCIONES-ANTIGRAVITY-ARQUITECTURA-HIBRIDA.md` y `ESTADO-SISTEMA-FERRETERIA.md` antes de tocar código.

---

## 0. Motivo de esta auditoría

`ESTADO-SISTEMA-FERRETERIA.md` reporta como "✅ 100%" dos cosas que, al comparar contra las especificaciones ya entregadas, no parecen estar completas: el sistema multimoneda y la arquitectura híbrida local-first. Antes de seguir construyendo funcionalidades nuevas sobre esa base, se necesita **una auditoría honesta** de qué existe realmente, seguida de la corrección de lo que falte.

**No se pide reescribir nada a ciegas.** Se pide: (1) reportar el estado real de cada punto con evidencia (archivo y línea, o captura), (2) corregir lo que efectivamente esté incompleto.

---

## 1. Auditoría y corrección — Sistema Multimoneda

### 1.1 Qué se especificó originalmente

Según `INSTRUCCIONES-ANTIGRAVITY-MULTIMONEDA.md`, el sistema debe soportar **3 monedas y 5 métodos de pago específicos**, no genéricos:

| Método de pago | Moneda |
|---|---|
| Efectivo | Dólares (USD) |
| Efectivo | Pesos colombianos (COP) |
| Pago Móvil | Bolívares (VES) |
| Tarjeta | Bolívares (VES) |
| Zelle | Dólares (USD) |

### 1.2 Lo que reporta el estado actual

El POS actual solo menciona: "Efectivo ($), Efectivo (Bs.), Pago Móvil, Tarjeta, Transferencia Bancaria" — **sin peso colombiano y sin Zelle como método diferenciado**.

### 1.3 Qué reportar (antes de corregir)

- Confirmar si el enum `MetodoPago` en `schema.local.prisma` / `schema.cloud.prisma` incluye `EFECTIVO_COP` y `ZELLE_USD`, o si solo existen los métodos genéricos mencionados en el estado.
- Confirmar si existe el modelo `TasaCambio` con soporte para **tasa COP además de VES**, o si la configuración de Gestión solo tiene el campo único de "Tasa BCV" heredado de antes del multimoneda.
- Confirmar si `PagoVenta` guarda `tasaAplicada` congelada por línea de pago, o si el cálculo bimoneda es solo una conversión visual en el frontend sin persistencia por transacción.

### 1.4 Qué corregir si falta

- Agregar `EFECTIVO_COP` y `ZELLE_USD` al enum `MetodoPago` en ambos schemas (local y cloud), con la migración correspondiente mostrada como diff antes de aplicar.
- Agregar el campo/registro de tasa COP en el modelo de tasas de cambio y en la pestaña "Monedas y Tasas de Cambio" de `ConfiguracionView.tsx`.
- En el drawer de cobro del POS, agrupar visualmente los métodos por moneda como se especificó: Dólares (Efectivo USD, Zelle) / Bolívares (Pago Móvil, Tarjeta) / Pesos (Efectivo COP).
- Verificar que el vuelto se calcule y muestre en la misma moneda del pago recibido (política ya definida), no solo en USD/Bs como parece estar ahora.
- Actualizar el comprobante (`ComprobanteModal.tsx`) para reflejar los 3 símbolos de moneda cuando aplique, no solo $/Bs.

---

## 2. Auditoría y corrección — Arquitectura Híbrida Local-First

### 2.1 Qué se especificó originalmente

Según `INSTRUCCIONES-ANTIGRAVITY-ARQUITECTURA-HIBRIDA.md`, el POS debe hablar **siempre** con un backend Express embebido corriendo en `localhost`, respaldado por SQLite — nunca directo contra la nube, y nunca cayendo a "mocks en memoria" cuando no hay internet.

### 2.2 Lo que reporta el estado actual (contradicción detectada)

La tabla resumen marca "Sincronización Híbrida ✅ 100%", pero la sección de pendientes dice textualmente: *"Si se corta internet, el frontend puede usar mocks en memoria, pero las ventas no se guardan en una cola local persistente."*

**Esto es contradictorio.** Si el backend local SQLite estuviera realmente en medio (como se diseñó), el frontend nunca tendría que recurrir a mocks — SQLite responde siempre, con o sin internet.

### 2.3 Qué reportar (antes de corregir)

- Confirmar contra qué URL apunta el frontend (`apps/web`) actualmente: ¿`http://localhost:4000` (backend local embebido) o directamente la URL del backend en la nube (Render/Railway)?
- Confirmar si existe la tabla `SyncQueue` (o el `SyncLog` mencionado en el reporte — aclarar si son la misma cosa o algo distinto) con los campos de `estado`, `intentos` y `ultimoError` especificados, o si es solo un registro de auditoría sin lógica de reintento.
- Confirmar si el proyecto tiene ya configurado `electron-builder`, un `main.ts`/`main.js` de proceso principal de Electron, o cualquier archivo de empaquetado — **el documento de arquitectura híbrida no fue mencionado ni una vez en el reporte de estado**, lo cual sugiere que esta parte pudo no haberse ejecutado todavía.
- Confirmar dónde vive físicamente el archivo `ferreteria.db` actualmente: ¿en la raíz del proyecto (como aparece en el árbol de carpetas del reporte) o en la ruta de datos de usuario (`app.getPath('userData')`) como se especificó? Si está en la raíz del proyecto, **no sobrevivirá una actualización del ejecutable ni funcionará correctamente una vez empaquetado.**

### 2.4 Qué corregir si falta

- Si el frontend apunta a la nube directamente: redirigir todas las llamadas del POS al backend local embebido (`localhost:4000` o el puerto que corresponda), eliminando cualquier lógica de "mocks en memoria" como plan de contingencia — el backend local SQLite es la contingencia.
- Si `SyncQueue`/`SyncLog` no tiene lógica de reintento con backoff y estados (`PENDIENTE`, `SINCRONIZADO`, `ERROR`), implementarla según la sección 4 de `INSTRUCCIONES-ANTIGRAVITY-ARQUITECTURA-HIBRIDA.md`.
- Si no existe empaquetado con Electron: implementarlo siguiendo la sección 6 de ese mismo documento (instalador `.exe`, backend como proceso hijo, `ferreteria.db` en `userData`).
- Mover `ferreteria.db` a la ruta correcta de datos de usuario si actualmente vive en la raíz del proyecto.

---

## 3. Reordenamiento de prioridad — Cierre de Caja

El roadmap actual coloca "Cierre de Caja / Arqueo" en 0% de avance, en tercer lugar de prioridad ALTA. **Se reclasifica como la siguiente prioridad después de resolver las secciones 1 y 2 de este documento** — no antes, porque el arqueo depende de que el multimoneda esté completo (debe contar efectivo físico por separado en USD y COP) y de que la arquitectura local esté realmente operativa (el cierre de caja debe poder hacerse sin internet, en el mostrador).

No se pide implementarlo todavía en esta iteración — solo se deja establecido el orden correcto para la siguiente.

---

## 4. Formato de respuesta esperado de Antigravity

Antes de escribir una sola línea de código de corrección, responder con una tabla de auditoría como esta, honesta y verificada contra el código real (no contra lo que "debería" estar):

| Punto auditado | Estado real encontrado | Evidencia (archivo/línea) | Acción requerida |
|---|---|---|---|
| Enum `MetodoPago` incluye COP y Zelle | ... | ... | ... |
| Modelo de tasas soporta COP | ... | ... | ... |
| `PagoVenta` congela tasa aplicada | ... | ... | ... |
| Frontend POS apunta a backend local | ... | ... | ... |
| `SyncQueue` tiene reintentos/estados | ... | ... | ... |
| Empaquetado Electron existe | ... | ... | ... |
| Ubicación real de `ferreteria.db` | ... | ... | ... |

Solo después de esta tabla, proceder con las correcciones de la sección 1.4 y 2.4, módulo por módulo, mostrando diffs de schema antes de migrar, como en toda iteración anterior.

---

## 5. Definición de "hecho" para esta auditoría

- Existe una tabla de auditoría verificada contra el código real, sin ambigüedades.
- Los 5 métodos de pago reales (con COP y Zelle) funcionan en el POS y se reflejan en el comprobante.
- El frontend habla exclusivamente con el backend local embebido; no existen mocks en memoria como plan de contingencia.
- `SyncQueue` tiene lógica de reintento real y visible en el panel de sincronización.
- Queda confirmado (o corregido) si el empaquetado Electron existe y si `ferreteria.db` vive en la ruta correcta.
- Ningún test de los 30 existentes se rompe como resultado de estas correcciones.
