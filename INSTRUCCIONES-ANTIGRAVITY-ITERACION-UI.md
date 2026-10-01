# Instrucciones para Antigravity — Iteración de Diseño: Minimalismo y Simplificación de Flujos
## Proyecto: Sistema Ferretería (FerrePro)

> Este documento es una **iteración sobre lo ya implementado** (ver resumen de estado previo del proyecto). No es un rediseño desde cero — es un ajuste dirigido. Lee `AGENTS.md` y `documento-maestro-ferreteria.md` antes de tocar código. **No refactorices módulos que no se mencionan aquí.**

---

## 0. Principio general de esta iteración

El feedback del cliente es claro: el sistema está **visualmente sobrecargado**. Hay demasiados elementos compitiendo por atención al mismo tiempo (badges, KPIs, gráficos, marcas de agua, colores). El objetivo de esta ronda es **reducir ruido visual sin eliminar funcionalidad** — aplicar el principio de "divulgación progresiva" (progressive disclosure): mostrar lo esencial primero, y que el detalle esté a un clic de distancia, no todo en pantalla a la vez.

El sistema es usado por personas **sin experiencia previa en este tipo de software**. Cada pantalla debe poder entenderse sin necesitar explicación previa.

---

## 1. Módulos que NO se tocan (feedback positivo confirmado)

- ✅ **Punto de Venta (POS)** — el cliente lo considera simple y bien logrado. **No modificar su estructura ni densidad visual.**
- ✅ **Inventario / Productos** — considerado "perfecto". **No modificar.**
- ✅ **Dashboard / Tablero de control** — bien valorado en general (ver ajuste puntual del logo en sección 2, que es lo único a corregir ahí).

Cualquier cambio de estilo global (tipografía, espaciado, paleta) que se aplique en las secciones siguientes debe **mantener consistencia visual** con estos tres módulos — es decir, ellos son la referencia de "cómo se ve bien", no al revés.

---

## 2. Corrección puntual: Logotipo ilegible en el sidebar

**Problema:** el logo ubicado arriba a la izquierda del sidebar (`bg-inverse-surface`, azul noche oscuro) no tiene suficiente contraste con el fondo — se pierde visualmente.

**Solución esperada:**
- Envolver el logo en un contenedor con **fondo propio de alto contraste** (chip/tarjeta), no dejarlo flotando directo sobre el azul oscuro. Ejemplo: fondo blanco o `surface-container-lowest` (`#ffffff`), con padding pequeño (`space-xs` o `space-sm`) y `border-radius` consistente con la escala Stitch ya definida (`lg: 0.25rem` o `xl: 0.5rem`).
- Si el logo tiene variante en color claro/oscuro, usar la versión que mejor contraste dé sobre fondo claro.
- Verificar legibilidad en ambos tamaños de sidebar (si existe versión colapsada/expandida).

---

## 3. Rediseño de la sección Contactos (Clientes/Proveedores)

**Problema:** visualmente no está alineada con el resto del sistema (Dashboard, POS, Inventario ya tienen una identidad visual consistente; Contactos se quedó atrás).

**Instrucciones:**
- Adoptar el mismo lenguaje visual que Inventario: misma estructura de tarjetas de resumen arriba (ej. "Total Clientes", "Total Proveedores", "Clientes con crédito activo" — máximo 3, no más), misma tipografía de tabla, mismos badges de estado.
- Reutilizar los mismos tokens de Tailwind ya definidos (colores, espaciado, radios) — **no introducir nuevos tokens de color** para este módulo.
- Selector de subpestañas Clientes/Proveedores: mantenerlo, pero simplificar su estilo visual para que combine con el resto (evitar que se vea como un componente aparte).
- Priorizar información esencial en la tabla (nombre, contacto, última compra/orden) y mover detalles secundarios (dirección completa, histórico extendido) a un panel lateral o modal al hacer clic — mismo patrón que el "Kárdex Rápido" de Inventario.

---

## 4. Reducción general de sobrecarga visual (aplicar donde corresponda, respetando sección 1)

- **Reducir cantidad de badges/etiquetas simultáneas por vista.** Si una tarjeta ya comunica el dato principal, no repetirlo con badge adicional al lado.
- **Limitar el número de colores de acento visibles por pantalla** a 2-3 máximo (además de neutros). Actualmente hay demasiados acentos compitiendo (terracota, azul control, azul noche, error, etc. todos visibles a la vez en ciertas vistas).
- **Aumentar espacio en blanco** entre secciones — usar la escala `space-lg`/`space-xl` ya definida en vez de agrupar todo con `space-sm`.
- **Simplificar gráficos secundarios**: donde haya micro-gráficos decorativos (sparklines, marcas de agua numéricas gigantes de fondo) que no aporten información accionable, evaluar removerlos u ocultarlos detrás de un toggle "Ver detalle".
- Este principio aplica especialmente a vistas que **no fueron mencionadas como "perfectas"** por el cliente (es decir: Contactos, y cualquier vista nueva que se agregue de aquí en adelante).

---

## 5. Simplificación de flujos para usuarios sin experiencia técnica

- **Lenguaje simple en la interfaz**: evitar términos técnicos sin explicación. Si se usa un término como "SKU" o "Stock Crítico", agregar un ícono de ayuda (`?`) con tooltip explicando el concepto en una frase simple (ver explicación en la sección 6 para redactar esos tooltips).
- **Flujos de máximo 3 pasos** para las acciones más comunes: registrar una venta, agregar un producto, agregar un contacto. Si un flujo actual requiere más pasos, evaluar cómo comprimirlo (ej. combinar campos relacionados en un mismo formulario en vez de pantallas separadas).
- **Textos de botones orientados a la acción**, no genéricos: en vez de "Guardar", usar "Registrar Producto" o "Confirmar Venta" — que el usuario nunca tenga que adivinar qué va a pasar al hacer clic.
- **Estados vacíos con guía**: cuando una tabla no tiene datos (ej. cero productos, cero clientes), mostrar un mensaje simple con un botón claro de "¿Cómo empiezo?" en vez de una tabla vacía sin contexto.
- **Confirmaciones antes de acciones irreversibles** (anular venta, eliminar producto) con lenguaje humano: "¿Seguro que quieres anular esta venta? Esta acción no se puede deshacer" — no solo un modal técnico.

---

## 6. Copys de ayuda sugeridos (tooltips)

Usar estos textos (o adaptarlos, manteniendo el tono simple) en los `?` de ayuda contextual:

- **SKU**: "Es el código único de este producto en tu inventario. Cada variante (tamaño, marca, presentación) tiene su propio SKU."
- **Stock Crítico**: "Este producto está por debajo (o muy cerca) de la cantidad mínima que definiste. Es momento de pedir más al proveedor."
- **Stock Mínimo**: "La cantidad más baja que quieres tener de este producto antes de recibir una alerta para reponerlo."
- **Kárdex**: "El historial de entradas y salidas de este producto: cada venta, compra o ajuste que afectó su cantidad disponible."

---

## 7. Proceso de trabajo esperado para esta iteración

1. Antes de escribir código, mostrar una propuesta visual breve (puede ser un mockup simple o descripción de cambios) del sidebar (logo) y de Contactos, para validar antes de implementar.
2. Implementar cambios **módulo por módulo**: primero logo (cambio pequeño y aislado), luego Contactos, luego pase general de reducción de sobrecarga en las vistas no confirmadas como "perfectas".
3. No modificar Dashboard, POS ni Inventario salvo que se indique explícitamente en una futura instrucción.
4. Después de cada módulo, confirmar con capturas de pantalla o descripción del resultado antes de continuar al siguiente — este proyecto avanza por iteraciones validadas, no por cambios masivos de una vez.
5. Mantente atento a que estas instrucciones se irán actualizando con nuevas recomendaciones a medida que el cliente valide cada entrega — este documento es vivo, no una especificación cerrada.

---

## 8. Definición de "hecho" para esta iteración

- El logo se lee con claridad en el sidebar sin importar el fondo oscuro.
- Contactos usa los mismos componentes visuales (tarjetas, tabla, badges) que Inventario.
- Las vistas ajustadas tienen visiblemente menos elementos compitiendo por atención (menos badges, menos colores simultáneos, más espacio en blanco).
- Los términos técnicos clave tienen tooltip de ayuda.
- POS, Inventario y Dashboard permanecen sin cambios estructurales.
