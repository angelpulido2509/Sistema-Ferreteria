# AGENTS.md
## Configuración de Agentes de Codificación — Proyecto Sistema Ferretería

> Este archivo es leído automáticamente por agentes de codificación compatibles con el estándar `AGENTS.md`: **Google Antigravity, Cursor, Claude Code y OpenAI Codex**. Colócalo en la **raíz del repositorio**. Cualquier agente que trabaje en este proyecto debe leerlo antes de tocar código.

---

## 1. Contexto del proyecto

Sistema de gestión de ventas e inventario para una ferretería. Arquitectura cliente-servidor: **un solo backend/API**, consumido por dos frontends (web desktop y PWA móvil) que comparten la misma base de datos. Ver `documento-maestro-ferreteria.md` para el análisis y diseño completo — **todo agente debe leer ese documento antes de generar código de arquitectura o modelo de datos.**

---

## 2. Stack tecnológico (obligatorio, no improvisar otro)

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TailwindCSS + `vite-plugin-pwa` |
| Estado remoto / fetching | TanStack Query (React Query) |
| Backend | Node.js + Express (TypeScript) |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Autenticación | JWT + bcrypt |
| PDF (facturas) | Puppeteer o pdf-lib |
| Hosting backend | Render / Railway |
| Hosting frontend | Vercel |
| DB gestionada | Neon / Supabase |

No introducir librerías fuera de esta lista sin justificarlo explícitamente en el PR/commit.

---

## 3. Estructura de carpetas esperada

```
/apps
  /web        -> Frontend React + PWA (única UI, responsiva)
  /api        -> Backend Express + Prisma
/packages
  /shared     -> Tipos TypeScript compartidos (DTOs, enums)
/prisma
  schema.prisma
/docs
  documento-maestro-ferreteria.md
  AGENTS.md
  INSTRUCCIONES-ANTIGRAVITY.md
```

Monorepo gestionado con **pnpm workspaces**. No crear repos separados para frontend/backend.

---

## 4. Convenciones de código

- **TypeScript estricto** (`strict: true`) en frontend y backend. Nada de `any` sin comentario justificando por qué.
- **Nombres en español para entidades de negocio** (Producto, Cliente, Proveedor, Venta), **nombres en inglés para código técnico** (controllers, services, utils).
- Backend organizado por **capas**: `routes -> controllers -> services -> repositories (Prisma)`. No lógica de negocio dentro de los controllers.
- Toda respuesta de la API sigue el formato:
  ```json
  { "success": true, "data": {}, "error": null }
  ```
- Commits en formato **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- Un componente React = una responsabilidad. Extraer hooks (`useProductos`, `useVentas`, etc.) para lógica de datos, nunca fetch directo dentro del JSX.

---

## 5. Reglas de negocio no negociables

1. **Nunca** descontar stock antes de confirmar el pago/venta.
2. Toda venta debe generar registro en `MOVIMIENTO_INVENTARIO` (tipo `SALIDA`).
3. Anular una venta **revierte** el stock y queda auditado (usuario + fecha + motivo).
4. Los precios se manejan siempre como `decimal`, nunca `float`, para evitar errores de redondeo monetario.
5. Ningún endpoint de escritura (`POST/PUT/DELETE`) puede ejecutarse sin token JWT válido, excepto `/api/auth/login`.
6. Los roles (`ADMIN`, `CAJERO`, `INVENTARIO`) se validan en middleware, no dentro de cada controller manualmente.

---

## 6. Testing

- Backend: **Vitest** o **Jest** para servicios y lógica de negocio (mínimo cobertura en módulo de Ventas e Inventario, por ser crítico).
- Frontend: **Vitest + Testing Library** para componentes de formularios críticos (creación de venta, edición de producto).
- Todo endpoint de facturación debe tener al menos un test de: venta exitosa, venta con stock insuficiente, anulación de venta.

---

## 7. Qué NO debe hacer un agente sin confirmación humana

- Cambiar el modelo de datos (`schema.prisma`) sin antes mostrar el diff propuesto.
- Instalar dependencias nuevas fuera del stack definido en la sección 2.
- Ejecutar migraciones destructivas (`prisma migrate reset`) en cualquier entorno que no sea local.
- Hacer `git push --force` a `main`.
- Modificar archivos dentro de `/docs` (son fuente de verdad del análisis, se editan manualmente).

---

## 8. Definición de "hecho" (Definition of Done)

Una tarea se considera completa cuando:
- El código compila sin errores de TypeScript.
- Pasan los tests relevantes.
- El endpoint/feature fue probado manualmente contra la API real (no solo mock).
- Se actualizó la documentación de endpoints si se agregó/cambió una ruta.
