# Instrucciones para Google Antigravity
## Proyecto: Sistema de Ventas e Inventario — Ferretería

Este documento explica cómo configurar y trabajar con **Google Antigravity** (IDE/CLI agéntico de Google) específicamente para este proyecto. Es complementario a `AGENTS.md` (reglas generales del proyecto, válidas para cualquier agente) — aquí van los ajustes **propios de Antigravity**.

---

## 1. Jerarquía de archivos que Antigravity respeta

| Archivo | Alcance | Prioridad |
|---|---|---|
| `AGENTS.md` (raíz del repo) | Este proyecto — también lo leen Cursor, Claude Code y Codex | Base |
| `GEMINI.md` (raíz del repo) | Exclusivo de Antigravity | **Sobrescribe** a `AGENTS.md` si hay conflicto |
| `.agents/rules/*.md` | Reglas no-raíz (por carpeta/módulo) | Se suman a `AGENTS.md` |
| `~/.gemini/AGENTS.md` | Todos tus proyectos (global) | La más baja prioridad |

**Recomendación para este proyecto:** usar solo `AGENTS.md` (ya creado) como fuente única. No crear `GEMINI.md` a menos que necesites una instrucción que aplique *solo* cuando trabajas con Antigravity y no con otros agentes (por ejemplo, algo relativo a su modo de ejecución particular).

---

## 2. Perfil de autonomía recomendado por fase

Antigravity permite elegir cuánta libertad le das al agente. Ajusta el perfil según en qué fase del plan de desarrollo estés (ver `documento-maestro-ferreteria.md`, sección 11):

| Fase del proyecto | Perfil de autonomía sugerido | Motivo |
|---|---|---|
| Fase 0 — Setup | **Review-driven development** | Estás definiendo la estructura base, quieres revisar cada decisión. |
| Fase 1-2 — Backend/Frontend base | **Review-driven development** | Es donde se define el modelo de datos y la API; errores aquí son costosos. |
| Fase 3 — Facturación | **Review-driven development** (checkpoints obligatorios en lógica de stock/pagos) | Es la lógica de negocio más crítica y sensible a bugs. |
| Fase 4-5 — PWA / Reportes | **Agent-driven development** | Trabajo más mecánico (UI, configuración de manifest, reportes) donde puedes soltar más control. |
| Fase 6 — QA | **Review-driven development** | Necesitas validar manualmente cada corrección. |
| Fase 7 — Deploy | **Secure mode** | Estás tocando credenciales, variables de entorno y producción — máxima restricción. |

---

## 3. Configuración de MCP (Model Context Protocol)

Antigravity guarda su configuración de servidores MCP en:

```
~/.antigravity/mcp_config.json
```

(o `~/.gemini/config/mcp_config.json` según la versión instalada — revisa en **Manage MCP servers → View raw config** dentro del IDE).

### Servidores MCP recomendados para este proyecto

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://usuario:password@localhost:5432/ferreteria_db"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "TU_TOKEN_AQUI"
      }
    }
  }
}
```

> ⚠️ No subas tokens ni cadenas de conexión reales a este archivo si lo vas a versionar. Usa variables de entorno o un `.env` ignorado por Git y referencia el valor desde ahí.

---

## 4. Flujo de trabajo recomendado dentro de Antigravity

1. Abre el proyecto como **workspace** en Antigravity (no como carpeta suelta) para que detecte `AGENTS.md` automáticamente.
2. Antes de pedir cualquier feature, confirma en el chat del agente que leyó `AGENTS.md` y `documento-maestro-ferreteria.md`.
3. Trabaja **módulo por módulo**, siguiendo el orden del plan de fases (Inventario → Proveedores/Clientes → Facturación → PWA → Reportes). No le pidas "haz todo el sistema" de una vez — los agentes rinden mejor con tareas acotadas.
4. Usa el modo **Review-driven** para revisar cada diff de `schema.prisma` antes de aplicar una migración.
5. Pide explícitamente que el agente **corra los tests** después de cada feature, no solo que los escriba.

---

## 5. Prompts de ejemplo para arrancar cada módulo

```
"Usando AGENTS.md y la sección 5 del documento maestro (modelo de datos),
genera el schema.prisma completo para Producto, Categoria, Proveedor,
Cliente, Venta, DetalleVenta y MovimientoInventario. Muéstrame el diff
antes de aplicar la migración."
```

```
"Implementa el módulo de Ventas siguiendo la sección 6 de AGENTS.md
(reglas de negocio no negociables). Incluye el endpoint POST /api/ventas
con descuento automático de stock y su test correspondiente en Vitest."
```

```
"Configura vite-plugin-pwa en /apps/web con manifest.json (nombre,
ícono, display: standalone) para que la app sea instalable en Android/iOS
según la sección 9 del documento maestro."
```

---

## 6. Checklist antes de pedirle un deploy al agente

- [ ] Variables de entorno de producción configuradas en Render/Vercel (no en el código).
- [ ] Perfil de autonomía cambiado a **Secure mode**.
- [ ] Migraciones de Prisma probadas en un entorno de staging, no directo a producción.
- [ ] Revisar manualmente el PR de deploy antes de aprobar el merge a `main`.
