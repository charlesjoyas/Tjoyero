# Revisión final de Áurea Taller — 3 de noviembre de 2026

La revisión se ejecutó con bases de datos temporales y usuarios ficticios. No se modificaron los registros reales del taller.

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
