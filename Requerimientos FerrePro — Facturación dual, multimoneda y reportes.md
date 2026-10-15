# Requerimientos FerrePro — Facturación dual, multimoneda y reportes

Oct 1, 2026 · @angel

## Resumen

FerrePro debe ser fácil de usar y configurable por cada cliente: marca propia, facturación fiscal o nota de entrega, totales en tres monedas y reportes con formato profesional. Este documento junta lo acordado en la conversación y lo ordena junto con los hallazgos de la auditoría del 2026-10-01.

La auditoría concluyó que la base es buena, pero que el sistema aún no está listo para dinero real ni para Internet. Por eso la sección 7 lista lo que hay que corregir antes o junto con estas funciones.

## Personalización por cliente

Desde la sección de Configuración, el cliente adapta el sistema a su negocio sin ayuda técnica. Los datos que cargue deben aparecer en facturas, notas de entrega, cotizaciones y reportes.

- Logotipo de la empresa
- Nombre comercial de la ferretería
- RIF de la empresa
- Dirección y demás datos de la empresa
- Interruptor para activar o desactivar la facturación fiscal (sección 3)

El sistema debe seguir siendo lo más simple y amigable posible: cada opción con nombre claro y sin pasos técnicos.

## Facturación dual: factura fiscal y nota de entrega

El administrador activa o desactiva este módulo desde Configuración, y solo se habilita a petición del cliente. Con el módulo apagado, la pregunta no aparece en el punto de venta y todo se registra como nota de entrega.

Con el módulo activo, el flujo en el punto de venta es: agregar productos al carrito, pulsar Pagar, elegir los métodos de pago y, al emitir el documento, elegir el tipo.

|  | Factura fiscal | Nota de entrega |
| --- | --- | --- |
| IVA | 16 % sumado al total | Sin IVA |
| Dónde se guarda | Registro de facturación fiscal, para los reportes al SENIAT | Ventas normales, solo control interno |
| Uso | Cliente que pide factura | Control de ingresos y gastos |

Ambos tipos de venta se ven juntos en los reportes del dueño. El registro fiscal debe poder consultarse por separado para declarar.

Dos puntos a validar con el contador: el IGTF sobre pagos en divisas y los productos exentos de IVA. Hoy el sistema aplica un 16 % único y no calcula IGTF.

## Multimoneda y pagos mixtos

El carrito muestra el total exacto en dólares, bolívares y pesos colombianos al mismo tiempo, calculado con las tasas ya configuradas. La moneda real de cobro se define después, según el método de pago que use el cliente.

Métodos de pago previstos:

- Efectivo en dólares (divisas)
- Zelle
- Efectivo en pesos colombianos
- Nequi
- Punto de venta en bolívares
- Pago móvil en bolívares

Una venta puede pagarse con varios métodos y monedas a la vez, por ejemplo la mitad en bolívares y la mitad en pesos. El sistema descuenta cada pago del total con la tasa de su moneda hasta saldar la venta, y no permite cerrarla si los pagos no cubren el total.

La tasa de cada pago queda congelada, como ya hace el sistema. La tasa debe salir siempre de la configuración del servidor, no del cajero.

## Módulo de reportes y cotizaciones

La ferretería es grande y entrega cotizaciones y reportes a sus clientes, así que todo documento sale con formato limpio y la marca del negocio.

- Encabezado con logotipo, nombre y datos de la empresa (RIF, dirección), tomados de Configuración
- Cotizaciones con ese mismo formato
- Vista de dueño que consolida todo: ventas fiscales y notas de entrega, ingresos y gastos
- Reporte fiscal separado, con las ventas registradas para el SENIAT
- Montos visibles en las tres monedas cuando aplique

Los reportes solo son confiables si el servidor calcula precios, IVA y tasas (sección 7). Conviene construirlos después de esa corrección.

## Administración: ventas de prueba y usuarios

Las ventas actuales son datos de prueba y el administrador debe poder borrarlas, ahora y en futuras pruebas. Para que esto no ponga en riesgo ventas reales, se propone:

- Solo el rol ADMIN puede borrar ventas
- El borrado funciona como modo de pruebas, claramente señalado, para no usarlo por accidente con ventas reales
- Cada borrado o anulación guarda quién, cuándo y por qué
- Las ventas fiscales ya declaradas quedan protegidas: se anulan, no se borran

También hay un nuevo usuario administrador. Su contraseña debe asignarla el propio administrador desde el sistema, con un mínimo de 10 a 12 caracteres. No conviene dejar `admin123` ni credenciales prellenadas, como indica la auditoría.

## Prerrequisitos de la auditoría

Estos puntos condicionan las funciones nuevas. Sin ellos, las facturas y reportes se verían bien pero los números se podrían manipular.

| Prioridad | Qué corregir | Por qué importa |
| --- | --- | --- |
| Crítica | Apagar el túnel público, rotar secretos y quitar credenciales prellenadas | Hoy cualquiera con la URL podría entrar como ADMIN |
| Crítica | El servidor decide precio, IVA y tasa; ignora lo que manda el cliente | Evita ventas a $0, IVA 0 o tasas inventadas |
| Alta | Exigir pagos que cubran el total y guardar el vuelto aparte | El cuadre de caja hoy cuenta el monto recibido, no el neto |
| Alta | Cierre de turno atómico y prohibir vender sin turno abierto | Una venta puede quedar fuera del cierre Z |
| Alta | Anulación con motivo, usuario y fecha en la venta | Hoy solo queda en el movimiento de inventario |
| Alta | Backup automático de la base de datos | Hoy no existe respaldo real |
| Media | Proteger `/sync/status` y `/sync/retry`, y limitar intentos de login | Endpoints abiertos y login sin freno |

## Recomendaciones adicionales

1. **Vuelto multimoneda.** Con pagos mixtos en tres monedas, definir en qué moneda se da el vuelto y registrarlo por separado del monto recibido, para que el cuadre de caja no se rompa.
2. **Numeración correlativa real.** Hoy el comprobante sale con un prefijo sobre un UUID, no con un correlativo. Con factura fiscal hace falta una secuencia por serie, asignada dentro de la misma transacción de la venta.
3. **Cuentas por cobrar (fiado).** En una ferretería de frontera el crédito a clientes y contratistas es parte central del flujo de caja. Se recomienda priorizarlo por encima de órdenes de compra y PDFs.
4. **Cantidades fraccionadas y unidades.** Cable por metro, pintura por litro o tornillos al peso exigen cantidades no enteras. Conviene resolverlo antes de cargar más inventario real.
5. **Tasa de cambio.** Guardar historial de tasas y avisar si lleva horas sin actualizarse, para que no se cobre con una tasa vencida.

## Orden de ejecución y preguntas abiertas

Orden sugerido, de primero a último:

1. Seguridad básica: apagar el túnel, rotar secretos, quitar `admin123`, backup automático
2. Servidor decide precio, IVA y tasa; pagos obligatorios; vuelto por separado
3. Cierre de turno atómico, turno obligatorio y anulación auditable
4. Personalización por cliente en Configuración (logo, nombre, RIF, dirección)
5. Módulo de facturación dual, con correlativo real
6. Totales en tres monedas en el carrito y pagos mixtos validados
7. Módulo de reportes y cotizaciones con formato de marca
8. Cuentas por cobrar y cantidades fraccionadas

Preguntas abiertas:

- [ ] ¿La nota de entrega también debe llevar numeración correlativa propia?
- [ ] ¿En qué moneda se da el vuelto cuando el pago fue en otra?
- [ ] ¿El contador confirma IGTF y productos exentos de IVA?
- [ ] ¿Se necesita factura fiscal con máquina fiscal o imprenta digital autorizada, o el documento será un comprobante interno?
- [ ] ¿Los reportes también deben exportarse a PDF?
