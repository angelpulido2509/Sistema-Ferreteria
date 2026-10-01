# Reporte — Fase 1: Integridad del dinero y de la caja

**Fecha:** 2026-10-01 · **Rama:** `main` · **Estado:** completada, pendiente de aprobación
**Commits:** `7beb7fe` … `b4bf43f` (11 commits)

## ⚠ Acciones del dueño

1. **Confirmar las tasas antes de cobrar en Bs o pesos.** Tras la migración, `tasaActualizadaEn` quedó vacía a propósito. Las ventas en VES/COP están **bloqueadas** hasta que un ADMIN guarde la pestaña *Configuración → Finanzas*. En USD se sigue cobrando. La tasa vence a las **12 h**.
2. **Abrir turno para vender.** Cada cajero necesita su propio turno abierto, y no puede haber dos turnos abiertos en la misma caja. El turno de prueba "Caja 1" quedó abierto en la BD.
3. **Pendientes de la Fase 0 sin confirmar:** rotar los secretos del `.env` y cambiar las contraseñas `admin123`/`cajero123`.
4. **Contador:** todo comprobante sale rotulado **"COMPROBANTE — NO VÁLIDO COMO FACTURA FISCAL"**. En esta fase se cobra IVA de Configuración en todos los documentos; la regla por tipo de documento (FACTURA/NOTA_ENTREGA) es la sección 3 del addendum.

## Decisiones tomadas en esta fase

| Tema | Decisión | Origen |
|---|---|---|
| (a) Ventas sin turno | La migración **se detiene y las lista** si encuentra alguna. No se borran: las ventas reales se anulan (addendum §5, que reemplaza el borrado físico elegido antes). Hoy hay 0. | Dueño + addendum |
| (b) Tope de descuento CAJERO | **10 %** por línea (`Configuracion.descuentoMaxCajeroPct`). ADMIN sin tope. | Dueño |
| (c) Vigencia de la tasa | **12 h** (`Configuracion.tasaVigenciaHoras`). | Dueño |
| Ventas históricas | Las 3 existentes son **de prueba**: `esPrueba = true`, serie **T001-000001…3**; F001 y N001 en 0. | Dueño |
| Vuelto | Solo de efectivo, en la moneda elegida entre las recibidas en efectivo, sin superar lo recibido; electrónicos exactos. | Addendum §2 |
| Series | `F001` (factura), `N001` (nota de entrega), `T001` (pruebas). En la Fase 1 todo es NOTA_ENTREGA → N001. | Addendum §1 |

## Migración (aplicada a `prisma/ferreteria.db`)

- **Respaldo previo verificado:** `prisma/backups/ferreteria-20261001-153918-000-pre-fase1.db`. Además existe la copia manual del dueño.
- **Archivos:** `prisma/migraciones-local/20261001_fase1.sql`, aplicado con `node scripts/migrar-fase1.mjs prisma/ferreteria.db --historicas-son-prueba`.
- **Ejecución:** una transacción. Ensayada antes en copias, en tres casos: normal, venta sin turno (el script se detiene sin cambios) y segunda ejecución (el script se niega).
- **Verificación:**
  - `integrity_check` ok y sin violaciones de FK;
  - esquema idéntico a `schema.local.prisma`;
  - mismas filas en las 11 tablas;
  - 2 eventos ANULAR recuperados del kárdex;
  - evento MARCAR_PRUEBAS registrado.
- **Datos reales leídos con el código nuevo:** los 4 Z cerrados recalculados coinciden con los guardados (0; 0; 0; 52,20).

## Resumen por hallazgo

| ID | Verificado en | Cambio | Commit |
|---|---|---|---|
| F7 | `Math.round(x*100)/100` en `venta.service.ts:155,181,211-212`, caja y reportes; tolerancia $0,05 en `:195` | `money.ts` (shared + `apps/api/src/config/money.ts`): unidades mínimas enteras, BigInt, half-up; `TOLERANCIA_PAGO_CENTAVOS_USD = 1`. Ventas, caja y reportes migrados. | `f619bc8`, `75861bd` |
| F1, F10 | `venta.service.ts:129-136` (precio del request), `:152` (IVA 0,16 fijo del request), `:168-179` (tasa del request) | Precio de BD (revalidado en la transacción), IVA de Configuración por línea, `exentoIva`, descuentos con tope por rol y autor, tasas de Configuración con vigencia; confirmación explícita de tasas. El POS usa el mismo cálculo. | `8cf7f02` |
| F2 | `:159` `pagos` opcional; sin validar método ni moneda | Pagos obligatorios, método habilitado, moneda del método (incluye `NEQUI_COP`). | `c0e70e4` |
| F3 | `caja.service.ts:243-262` sumaba lo recibido; el POS (`PosView.tsx:322-329`) enviaba lo recibido y el vuelto solo existía en pantalla | `montoRecibido` + `vuelto` + neto; `vueltoMoneda`; fórmula del esperado documentada; vuelto en el Z; POS y comprobante actualizados. | `1bf702c`, `882c9ff` |
| F4, F6 | `cerrarTurno` sin transacción; `crearVenta:203-216` `findFirst` global fuera de la transacción y turno opcional; resumen con `OR` por fechas | Turno obligatorio tomado dentro de la transacción; un turno por cajero y por caja; cierre atómico con `CERRANDO`; resumen solo por `turnoCajaId`; escrituras serializadas en modo local. | `909a271` |
| F5 | `venta.repository.ts:184-188` solo cambiaba el estado | Motivo, autor y fecha en la venta + `AuditoriaEvento`; turno cerrado: solo ADMIN y egreso de ajuste en el turno vigente; Z intacto y reproducible. | `3ad600f` |
| F9 | `generarComprobante:255` `FAC-${uuid}` | `SecuenciaDocumento` dentro de la transacción (sin huecos); número `N001-000001`; leyenda NO FISCAL; la web muestra el correlativo real. | `8b00f72` |
| F11 (parcial) | `venta.service` consultaba el turno con Prisma directo | Esa consulta pasó al repositorio, dentro de la transacción. | `909a271` |

## Criterios de aceptación

- [x] Un request con `precioUnitario=0` o `porcentajeImpuesto=0` no altera el total: `venta.precios.it` y la prueba manual (total $13,92).
- [x] Venta sin pagos, con pagos insuficientes o con moneda incorrecta → rechazada: `venta.pagos.it`, `venta.service.it` y la prueba manual.
- [x] Venta de $15 pagada con $20 en efectivo → el esperado de caja sube $15 netos: `venta.vuelto.it`.
- [x] No se puede vender sin turno abierto ni durante el cierre; de dos cierres simultáneos, uno falla: `caja.turno.it` (pool real + WAL: 24 ventas concurrentes con el cierre; 3 cierres simultáneos; estable en 5 corridas) y la prueba manual.
- [x] Anular una venta de turno cerrado exige ADMIN y genera el ajuste en el turno vigente; el Z cerrado queda intacto: `venta.anulacion.it` y la prueba manual.
- [x] Todo el cálculo monetario del servidor pasa por `money.ts`. Un grep confirma que no queda `Math.round`/`toFixed`/`parseFloat` monetario fuera de él; solo `toFixed` para formatear mensajes.
- [x] Numeración correlativa sin huecos bajo concurrencia: `venta.correlativo.it` (30 ventas de 2 cajeros con 6 fallidas intercaladas → N001-000001…030).
- [x] Este reporte.

## Verificación

- `pnpm -r typecheck`: sin errores (shared, api, web).
- `pnpm -r test`: **185 tests** en 29 archivos. Al cierre de la Fase 0 eran 126.
- `pnpm -r build`: OK.
- **Prueba manual contra la API real** (`tsx src/server.ts`, SQLite nueva, `NODE_ENV=production`, secretos en memoria): **25/25 comprobaciones**. Cubre:
  - setup y tasas sin confirmar (bloqueo de VES);
  - venta sin turno → 400;
  - venta con precio e IVA alterados → total del servidor;
  - vuelto en USD y COP;
  - descuento sobre el tope y descuento válido;
  - resumen X con el neto;
  - comprobante NO FISCAL;
  - dos cierres simultáneos;
  - Z cuadrado con el vuelto;
  - anulación de un turno cerrado: CAJERO 403, ADMIN sin turno 400, ADMIN con turno → ajuste;
  - Z intacto y correlativo que no reutiliza números.

  La prueba manual detectó un defecto (el Z no exponía el vuelto) que se corrigió en `882c9ff`.

## Tests

**Infraestructura nueva:** tests de integración contra **SQLite real** (`*.it.test.ts`). Se crea una BD plantilla con `prisma db push` una vez por versión del esquema (`src/test/globalSetup.ts`) y cada archivo la copia a una carpeta temporal (`src/test/sqliteTestDb.ts`). Nunca tocan `prisma/ferreteria.db`.

**Archivos nuevos:**

| Archivo | Tests |
|---|---|
| `config/money.test.ts` | 10, de propiedad con semilla fija |
| `venta.precios.it` | 10 |
| `venta.service.it` | 8 |
| `configuracion.tasas.it` | 4 |
| `venta.pagos.it` | 9 |
| `venta.vuelto.it` | 8 |
| `caja.turno.it` | 7 |
| `caja.service.it` | 10 |
| `venta.anulacion.it` | 7 |
| `venta.correlativo.it` | 3 |
| `reportes.money.it` | 1 |

**Reemplazados:**
- `venta.service.test.ts` fijaba el comportamiento inseguro con mocks (aceptaba precio y tasa del cliente). Lo reemplaza `venta.service.it`, con los mismos 7 escenarios más uno.
- `caja.service.test.ts` usaba mocks que no podían representar transacciones ni turnos por cajero. Lo reemplaza `caja.service.it`, con los mismos 10 escenarios.

Cada test nuevo se corrió primero contra el código anterior y falló. En F1 se hizo con una variante temporal de la firma vieja, para ver el fallo de lógica (`expected 0 to be 20`). En F7, el caso de reportes ($2,01 / 2 → $1,00 en lugar de $1,01) se encontró por búsqueda: mi primer supuesto (5,005) no reproducía el error y se descartó.

## Hallazgo nuevo durante la fase

Con el pool real de Prisma, **6 o más transacciones de escritura simultáneas se bloqueaban ~22 s** y salían con "Socket timeout". La que tenía el bloqueo de SQLite no podía ejecutar su siguiente consulta mientras las demás esperaban dentro del *busy handler*. Se resolvió con `lib/transaccion.ts`, que encola las transacciones interactivas de escritura en modo local (SQLite admite un solo escritor); en la nube (PostgreSQL) pasan directo. Resultado: 24 ventas concurrentes con un cierre se resuelven en ~40–80 ms.

## Cambios de comportamiento visibles

- **Antes de vender:** abrir turno, propio y uno por caja.
- **Cobro en VES/COP:** requiere tasas confirmadas hace menos de 12 h.
- **El POS:**
  - muestra un selector de moneda de vuelto cuando hay efectivo en dos monedas;
  - bloquea el cobro si sobra dinero en pagos electrónicos;
  - ya no muestra "Orden #VTA-2024-0943".
- **Documentos:** comprobantes e historial muestran el correlativo real (`N001-…`; las históricas, `T001-…`).
- **Turnos:** el CAJERO ya no puede cerrar el turno de otro ni registrar movimientos en él.
- **API:** las rutas que cambiaron están documentadas en `docs/API-ENDPOINTS.md`.

## Pendientes y riesgos residuales

Están en `docs/DEUDA-TECNICA.md`, DT-17 a DT-27. Los más relevantes:
- los campos nuevos no se sincronizan a la nube (DT-17, Fase 2);
- las ventas offline se validan con la tasa del momento de sincronizar (DT-18);
- las ventas de prueba siguen contando en reportes, y la venta T001-000001 descontó 1 rollo de CABL-001 de stock real (DT-19 y DT-20, addendum §5);
- la regla de "un turno por caja" se valida solo en código, no en BD (DT-23);
- tolerancia de 1 centavo pendiente de revisar en 1C (DT-25).

**Siguiente paso** (addendum §8): Fase 1C (documento dual, tres monedas, pagos mixtos), después de tu aprobación.
