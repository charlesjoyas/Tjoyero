# Revisión final de Áurea Taller — 4 de noviembre de 2026

La revisión se ejecutó con bases de datos temporales y usuarios ficticios. No se modificaron los registros reales del taller.

## Piedras preciosas — implementación y verificación

Actualización de recepción: el presupuesto ahora permite seleccionar, editar y quitar piedras del taller antes de crear la orden. El precio total modifica el presupuesto y el impuesto una sola vez, conservando otros insumos. El guardado es atómico e idempotente junto con la salida de inventario. Se verificaron también permisos de recepción, varios lotes, falta de existencias, cambios de precio y conservación del borrador de piedras del cliente al cerrar los modales. Se corrigió el desbordamiento móvil de la nueva tabla. Se repitieron las pruebas completas de Node y los recorridos de gemas, recepción general, pérdida de respuesta, metales, mano de obra, formato numérico y responsive.

- Inventario propio por piedra individual o lote: unidades, quilates, costo, precio, talla, medidas, certificado y fotografía. Custodia del cliente separada, sin contabilizarla como patrimonio o venta.
- Salidas a trabajos, montaje y desmontaje, recuperación física, devolución al cliente e incidentes. No se aprueba calidad con piedras pendientes; la pérdida de una piedra del cliente exige constancia del incidente y comunicación.
- Peso bruto recibido separado del metal neto. Un peso pendiente o estimado no genera oro en el libro; asignar requiere confirmar el neto y detallar la custodia.
- Precios incluidos una vez en el presupuesto, impuesto exacto, costos conservados y protección de anticipos. Cuarenta salidas y devoluciones con costo de un billón de COP y quilates impares conservaron exactamente unidades, peso y costo.
- Entregas y traslados conservan el vínculo con las piedras. Una venta reversada devuelve las gemas dentro de su pieza, sin regresarlas automáticamente a bodega. La producción propia con gemas identificadas se registra individualmente.
- Reversión y eliminación de entradas seguras, vista previa de unidades / quilates / costos, copias y restauración validadas. No hay compensaciones duplicadas.
- Comprobantes y Excel de inventario, piedras por trabajo y gemas de cada traslado. Quilates exportados como números con tres decimales.
- Diez pruebas nuevas del dominio y una nueva prueba con el emulador Turso verifican permisos, límites, conservación, reintentos, persistencia, custodia, incidentes, reversiones y copias corruptas. El recorrido nuevo de navegador verifica además fotos, formularios, impresión, dos exportaciones y vista previa en escritorio y móvil.
- El estado actual de producción pasó la nueva validación mediante una única consulta SELECT de solo lectura.

## Última revisión a profundidad — 4 de noviembre

Se recorrieron recepción y presupuestos, categorías, compras, proveedores, inventarios, trabajos con varios metales, fundición, insumos, calidad, ventas y entregas, cobros y devoluciones, gastos, turnos de caja, honorarios, valoración, reversiones, eliminación, respaldos, usuarios, permisos, impresión y Excel.

Se corrigieron tres problemas reproducidos durante esta revisión:

- Una orden en mesa sin pieza terminada no podía cerrarse aunque todo el retorno estuviera en limalla o se documentara la pérdida total. El cierre administrativo ahora registra esa situación sin crear gramos; un retorno normal sin pieza continúa bloqueado.
- La reversión completa mostraba un campo de soporte bancario de 200 caracteres pero admitía solo 150 en su devolución interna. Ambos límites ahora coinciden.
- Las copias con consumos nulos o con costos y cantidades que no coincidían con los movimientos de insumos podían producir un error interno o alterar el costo informado. Se validan los vínculos y se rechazan con un error de datos antes de reemplazar la operación.

Evidencia final:

- 115 pruebas de Node aprobadas; ninguna falla o prueba omitida.
- 20 recorridos de navegador aprobados. Incluyen piedras preciosas, los últimos módulos, funcionamiento sin recursos externos, pérdidas de conexión y recuperación, exportaciones reales y PDF en Chrome/Edge.
- 20 vistas en anchos de 1440, 1024, 768, 390, 360 y 320 píxeles, sin desbordamientos ni errores de ejecución.
- Simulación nueva de diez jornadas: 606 operaciones, 53 órdenes, 30 compras, 59 eliminaciones y 99 reversiones. Se concilian después de cada operación los metales y propietarios, mesas, custodias, lotes, insumos, efectivo y valoración. Los diez cierres permanecen intactos. Efectivo final comprobado: 1.363.000 COP.
- Se mantienen las simulaciones anteriores de cinco y diez jornadas, la carga de 3.000 órdenes/3.000 pagos y las pruebas de concurrencia, idempotencia, fallos de almacenamiento y copias mayores de 4,5 MB.
- La estructura real de producción pasó la validación en modo de solo lectura. No se realizaron operaciones comerciales ni devoluciones en la base real.

La balanza física sigue excluida. La impresión se verifica como salida PDF del navegador, sin certificar una impresora física. Los casos ejecutados no demuestran ausencia absoluta de errores en cualquier entorno.

## Correcciones realizadas

- **Restauración:** una copia reemplaza el estado completo, sin mezclar gastos o reversiones que no existían en ella. Se valida antes de restaurar y se rechazan configuraciones o contadores dañados.
- **Reintentos después de restaurar:** las respuestas guardadas de operaciones anteriores a la restauración dejan de aceptarse como confirmaciones vigentes. Repetir la propia restauración con la misma clave no vuelve a ejecutarla.
- **Redondeos:** cálculo exacto a pesos enteros de impuestos, consumos fraccionados de insumos y reparto del costo de lotes. La vista previa del impuesto utiliza el mismo cálculo que el servidor.
- **Inventario de piezas:** unidades, peso y costo disponibles concilian con las transferencias vigentes; las transferencias reversadas se conservan sin descontarse otra vez.
- **Honorarios:** se impide registrar un pago acumulado por encima del límite monetario admitido por la aplicación.
- **Recepción:** la fabricación propia se identifica como producción interna y no permite capturar una custodia ficticia del cliente. Los importes fuera de rango se señalan en los formularios.

## Evidencia de verificación

- 73 pruebas de servidor, dominio, almacenamiento y API.
- Simulación adicional de diez jornadas: 473 operaciones, 40 órdenes, 41 reversiones y 33 registros de gastos. Inventario y caja se concilian después de cada operación mediante cálculos independientes.
- Otra simulación de cinco jornadas: 724 intentos, con 105 rechazos esperados por reglas de negocio.
- Prueba de volumen con 3.000 órdenes y 3.000 pagos.
- Reintentos, concurrencia, permisos, saldos insuficientes, fallos de almacenamiento y recuperación tras reinicio.
- Recorridos de recepción, producción, compras, ventas, gastos, caja, categorías, metales por orden, honorarios, inventario, comprobantes y reversiones.
- 20 vistas en anchos de 1440, 1024, 768, 390, 360 y 320 píxeles.
- Comprobantes de 58/80 mm y verificaciones de acceso en Chrome y Edge.
- Persistencia y restauración con el SDK real de libSQL contra un emulador HTTP local; copias mayores de 4,5 MB a través de la interfaz.

Los casos ejecutados terminan sin fallos. Las pruebas no equivalen a una garantía de ausencia absoluta de errores en cualquier entorno.

## Alcance

La balanza física queda fuera de esta revisión, según lo acordado. No se simulan ventas, gastos ni devoluciones sobre la base de datos de producción. La publicación se hace únicamente en `charlesjoyas/Tjoyero`; la preparación de Vercel incluye los módulos utilizados por el servidor.

## Eliminar operaciones desde Reversiones

Se incorpora un botón rojo para eliminar operaciones vigentes o registros ya reversados. Exige la palabra ELIMINAR, vista previa y confirmación. Primero se compensa la operación cuando corresponde; después desaparece de sus listados y exportaciones. Una reversión ya realizada no genera otra devolución. Los originales y sus compensaciones quedan retenidos para conciliación y auditoría, con un registro de eliminación ligado a la reversión correspondiente.

Se verifican confirmaciones, permisos de administrador, dependencias, compra, pagos a proveedor, gastos, caja, libro de metales, insumos, entrega, etapas y órdenes completas. Las pruebas de navegador comprueban la retirada de registros, Excel, auditoría y pantallas móviles. Se comprueba también la devolución de un gasto entre turnos, manteniendo el cierre anterior y el dinero del turno actual, y la persistencia e idempotencia con libSQL.

## Valor monetario del Libro de metales — 4 de noviembre de 2026

Se muestran el valor general, el metal propio y el de clientes, el desglose por metal y el total en cada ubicación. Las existencias detalladas incluyen una columna de valor estimado por ley y propietario. La valoración usa el fino de cada metal y su tarifa actual en Configuración; no duplica traslados, no suma pesos finos entre metales distintos y no incorpora pérdidas ni metal ya entregado.

Se calculan los importes con enteros de precisión arbitraria y se distribuye el redondeo para que los detalles concilien con los subtotales y el total. Los metales sin tarifa se identifican y la valoración queda marcada como parcial. Las pruebas verifican propiedad, distintas tarifas, movimientos internos, cifras grandes y diseño en móvil. Consultar la valoración no modifica el inventario.

## Órdenes de compra de oro por categoría — 4 de noviembre de 2026

Se integra la compra de una o varias categorías activas de oro en una orden con proveedor, documento, vencimiento, peso recibido y precio por gramo de cada categoría. La confirmación ingresa el metal inmediatamente a bodega por su ley y registra una cuenta por pagar, sin descontar caja hasta pagar al proveedor. El importe se calcula de forma exacta sobre los gramos recibidos y se conserva el fino en el libro de metales. El catálogo puede modificarse o eliminar categorías sin cambiar el historial de las compras.

La orden ofrece comprobante y exportación Excel; los totales de la orden aparecen una sola vez en el archivo. Las reversiones devuelven cada ley, bloquean pagos vigentes o existencias insuficientes y no dejan ingresos parciales. Se conserva la compra manual de otros metales y el cálculo de las compras anteriores.

Verificación: 89 pruebas de Node aprobadas, incluida la persistencia con el SDK de libSQL, reintentos sin duplicar inventario y restauración. El recorrido de navegador verifica categorías personalizadas e inactivas, varios renglones, totales, inventario inmediato, comprobante, Excel y pantallas de 320 px.

## Reversión completa de órdenes con producción

Se corrige el selector que solo ofrecía órdenes recibidas. «Orden de trabajo completa» incluye todas las órdenes no anuladas, con revisión de retorno para las que siguen en mesa, devolución del saldo neto abonado y cierre de la custodia. La recuperación del metal propio conserva su ley y metal; no se borran las pérdidas, insumos ni honorarios reales. Si existía una entrega de venta se compensa en la misma transacción; las transferencias de producción propia deben devolverse antes del cierre. Las reversiones anteriores y las devoluciones ya realizadas no se duplican.

Se verifican órdenes en calidad como T-0001, ventas entregadas, retorno multimetal, pagos bancarios, idempotencia, persistencia con libSQL, vista previa sin escritura y uso del formulario en móvil. T-0001 se simuló con una copia en memoria de la base real, sin guardarla en producción, y quedó en estado anulado en la simulación.

## Varios metales propios en una pieza

Asignar a mesa permite añadir y quitar aportes con metal, ley, peso y origen independientes. El inventario, las tarifas históricas, el retorno, la entrega y sus reversiones conservan cada composición, sin sumar gramos de plata como si fueran oro. La merma crítica se comprueba por metal, además de mostrar el total de la orden. La producción propia conserva su composición en existencias, traslados parciales y soportes Excel.

Se comprueban saldos insuficientes sin guardados parciales, duplicados, múltiples leyes, aportes posteriores, propiedad del cliente, reintentos, persistencia y restauración con libSQL, y compatibilidad de las órdenes existentes. Las pruebas de navegador recorren asignación, retorno, entrega y traslados de piezas mixtas, incluyen pantallas de 320 px y verifican la composición descargada en Excel. La base real se validó en modo de solo lectura.

## Revisión de exportaciones a Excel

- Se sustituyen las seis descargas CSV existentes por archivos `.xlsx`: libro de metales, cobros, gastos, ventas, auditoría y soporte individual de traslados.
- Celdas numéricas sumables, importes en pesos enteros con dos decimales visibles, bruto con tres y fino con seis. Fechas reales con hora de Bogotá y textos que conservan sus ceros iniciales sin ejecutar fórmulas.
- Se corrige la descarga incompleta de auditoría: obtiene todo el período en páginas de 1.000 registros, con permisos de administrador o contabilidad, sin depender de los últimos 2.000 eventos cargados en pantalla.
- Se respetan filtros de cuenta, metal, ley, propietario, fechas, categorías y medio de pago según la sección. Los cobros incorporan cliente, soporte bancario, responsable y turno; los traslados conservan su costo histórico exacto y su estado de reversión.
- Encabezados fijos, autofiltros, columnas con formato y hojas válidas cuando no hay datos. Se indican períodos invertidos y datos inválidos; un error al cargar el generador permite reintentar.
- Verificación: 76 pruebas de Node aprobadas y siete recorridos de navegador, incluidos todos los archivos descargados, auditoría de más de 2.200 eventos, reversados, textos con aspecto de fórmula, reintento, nube y 20 vistas en seis anchos. Las pruebas abren los `.xlsx` generados y comprueban sus celdas y tipos; no se ha hecho una prueba manual en Microsoft Excel de escritorio.
- El bundle oficial de ExcelJS 4.4.0 queda incluido localmente con licencia MIT y script de reproducción que verifica su SHA-512. El build y el paquete de Vercel incluyen los archivos nuevos sin incorporar datos del taller ni credenciales.
