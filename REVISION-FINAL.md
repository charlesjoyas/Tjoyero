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
