# API — endpoints modificados o nuevos (Fases 0 y 1)

Formato de respuesta en todos los casos: `{ "success": boolean, "data": ..., "error": string | null }`.
Todas las rutas requieren `Authorization: Bearer <token>` salvo las marcadas como **públicas**.
Los errores 5xx nunca exponen el detalle interno: `"Error interno del servidor (ref: <requestId>)"`.

## Autenticación

| Método y ruta | Acceso | Notas |
|---|---|---|
| `POST /api/auth/login` | pública, rate-limit 5 fallos / 15 min por IP+email | Responde `{ token, usuario }`. El refresh token va **solo** en la cookie httpOnly `ferrepro_rt` (Path `/api/auth`, SameSite Strict). Access token ≤ 30 min. |
| `POST /api/auth/refresh` | pública (usa la cookie) | Devuelve un access token nuevo si el usuario sigue activo. |
| `POST /api/auth/logout` | pública | Borra la cookie del refresh token (funciona con el token ya vencido). |
| `GET /api/auth/setup-status` | pública | `{ needsSetup }`: true si no existe ningún ADMIN. |
| `POST /api/auth/setup` | pública, solo sin ADMIN | `{ nombre, email, password }` (mín. 12). Crea el primer ADMIN; después responde 403. |
| `GET /api/auth/me` | autenticado | Perfil vigente. |

## Ventas

### `POST /api/ventas` — ADMIN, CAJERO

```json
{
  "clienteId": "…",
  "items": [{ "productoId": "…", "cantidad": 2, "descuentoPorcentaje": 5 }],
  "pagos": [
    { "metodoPago": "ZELLE_USD", "moneda": "USD", "montoRecibido": 10, "referencia": "1234" },
    { "metodoPago": "EFECTIVO_COP", "moneda": "COP", "montoRecibido": 20000 }
  ],
  "vueltoMoneda": "COP"
}
```

- **El servidor calcula todos los montos**: precio de `Producto.precioVenta`, IVA de
  `Configuracion.ivaPorcentaje` por línea (0 si `Producto.exentoIva`) y tasas de `Configuracion`.
  `precioUnitario`, `porcentajeImpuesto` y `tasaAplicada` se aceptan por compatibilidad pero **se ignoran**.
- `descuentoPorcentaje` (0–100) por línea: CAJERO hasta `Configuracion.descuentoMaxCajeroPct`; ADMIN sin tope.
- `pagos` obligatorio y no vacío. Método habilitado en `metodosHabilitados` y moneda del método:
  `EFECTIVO_USD`/`ZELLE_USD` → USD, `EFECTIVO_COP`/`NEQUI_COP` → COP, `PAGO_MOVIL_VES`/`TARJETA_VES` → VES.
- `montoRecibido` = lo que entrega el cliente (`montoMoneda` se acepta como alias). Σ pagos ≥ total − 1 centavo.
- Vuelto: solo de pagos en **efectivo**, en `vueltoMoneda` (obligatoria si hubo efectivo en dos monedas),
  sin superar el efectivo recibido en esa moneda. Los electrónicos se cobran exactos.
- Cobro en VES/COP bloqueado si la tasa no fue confirmada o venció (`tasaVigenciaHoras`).
- Requiere un **turno de caja abierto del usuario**; la venta queda en ese turno.
- Respuesta: `VentaDTO` con `numero` (`N001-000123`), `tipoDocumento`, detalle con descuento e IVA por
  línea y pagos con `montoRecibido`, `vuelto` y `montoMoneda` (neto).

### `POST /api/ventas/:id/anular` — ADMIN

`{ "motivo": "…" }` obligatorio. Guarda `motivoAnulacion`, `anuladaPorId`, `fechaAnulacion` y un
`AuditoriaEvento`. Si la venta es de un turno cerrado, el efectivo neto se registra como egreso de
ajuste en el turno vigente (de quien anula o el abierto en la misma caja); si no hay ninguno: 400.

### `GET /api/ventas/:id/comprobante`

`comprobante.numero` es el correlativo y `comprobante.leyenda` =
`"COMPROBANTE — NO VÁLIDO COMO FACTURA FISCAL"`. Los pagos incluyen `montoRecibido` y `vuelto`.

## Caja

| Método y ruta | Acceso | Cambio |
|---|---|---|
| `GET /api/caja/turno-activo` | autenticado | Devuelve el turno abierto **del usuario** (antes, uno global). |
| `POST /api/caja/abrir` | ADMIN, CAJERO | Rechaza si el usuario ya tiene un turno abierto o si la caja (`cajaNumero`) ya lo tiene. |
| `POST /api/caja/movimiento` | ADMIN, CAJERO | Solo en el turno propio (ADMIN: cualquiera). |
| `POST /api/caja/cerrar` | ADMIN, CAJERO | Atómico. CAJERO solo su turno. Un segundo cierre simultáneo responde 400. |
| `GET /api/caja/resumen/:id` | ADMIN, CAJERO | Solo ventas del turno. Nuevo `vueltoEntregado` y `ventasPorMetodo.nequiCop`. Esperado = fondo + recibido en efectivo − vuelto + ingresos − egresos. |

`TurnoCajaDTO` incluye `vueltoUsd/Cop/Ves` y el estado transitorio `CERRANDO`.

## Configuración

`PUT /api/configuracion` (ADMIN) acepta además `tasaVigenciaHoras` (1–168), `descuentoMaxCajeroPct`
(0–100) y `confirmarTasas: true`. La tasa queda confirmada (`tasaActualizadaEn`) si cambia su valor o
con `confirmarTasas`; guardar otros datos no renueva una tasa vencida.

## Sincronización y respaldos

| Método y ruta | Acceso |
|---|---|
| `GET /api/sync/status`, `POST /api/sync/retry` | ADMIN |
| `POST /api/sync/push` | `x-sync-api-key` (comparación en tiempo constante); ignora la entidad `Usuario` |
| `GET /api/backup`, `POST /api/backup/now` | ADMIN |
