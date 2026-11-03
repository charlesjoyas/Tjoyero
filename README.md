# Áurea Taller

## Despliegue en Vercel

El proyecto incluye un build público y una API serverless con persistencia en **Turso/libSQL**, independientes del archivo SQLite local. Sigue [VERCEL.md](VERCEL.md) para configurar las tres variables privadas, publicar y migrar una instalación existente sin sobrescribir un destino con datos. La versión de nube requiere internet; el modo local sigue disponible.

Aplicación local para un taller de joyería y orfebrería. Interfaz en español, importes en COP y fechas operativas en `America/Bogota`. El servidor y SQLite funcionan sin dependencias de terceros ni acceso a internet.

La interfaz usa **formato colombiano** en formularios, tablas, resúmenes, comprobantes y CSV: miles con punto y decimales con coma (`1.234.567,00`). Los campos agrupan los miles al escribir y completan los decimales al salir. Los importes se muestran con dos decimales `,00` y siguen guardándose en pesos enteros; los gramajes tienen tres decimales y el fino conserva hasta seis. Documentos, teléfonos, códigos, fechas e identificadores conservan su formato. El separador decimal del teclado numérico también se interpreta como coma.

## Iniciar

1. Ejecuta **INICIAR-TALLER.cmd** o `node server.cjs` con Node.js 24 o superior.
2. Abre [el taller](http://127.0.0.1:4183).
3. Crea el primer administrador. No hay contraseña predeterminada ni datos de ejemplo.
4. En **Configuración**, registra los datos del negocio, tarifas por gramo fino, impuestos aplicables, tolerancias y condiciones de custodia. Las tarifas empiezan en cero y deben ser fijadas por el taller.
5. Registra clientes y orfebres. Ingresa las existencias iniciales desde **Libro de metales → Conteo / saldo inicial**, con soporte y motivo.
6. Abre un turno desde **Caja y turnos** antes de cobrar o pagar en efectivo. Puedes abrirlo **solo en efectivo**, **solo en oro** o **mixto**. La base de oro admite varias leyes y se traslada desde el oro propio ya registrado en bodega.

## Recorrido de una orden

**Nueva orden → asignación a mesa → avances / consumos → pesaje de pieza y limalla → control de calidad → cobro completo → entrega.**

Al recibir un trabajo, **Estimar mano de obra** calcula un sugerido por horas o gramos usando el costo unitario del taller, los costos indirectos, un recargo sobre costo y un cobro mínimo. El usuario decide cuándo aplicarlo al presupuesto y puede ajustar el cobro. El desglose queda guardado en la orden; los impuestos se calculan en el presupuesto y el metal y los insumos se cotizan por separado. No utiliza tarifas de mercado predeterminadas.

En recepción, **Añadir metal a cobrar** registra el nombre o descripción y el precio total de cada metal vendido en ese trabajo. Los renglones aparecen en el mismo formulario, en el detalle y en el comprobante; se suman una sola vez al total de metal vendido. Se pueden editar o quitar y no modifican el catálogo, las tarifas generales ni el inventario. Cada orden conserva su propio detalle. La recepción separa la pieza del cliente del presupuesto. Para mover inventario propio se registran los gramos en Asignar a mesa: salen del origen elegido y pasan a producción. El detalle de la orden indica si existe esa salida; el retorno posterior registra la pieza, limalla y merma.

- La recepción conserva cliente, descripción, estado, piedras, fotografía opcional, ley, peso, medidas, presupuesto y fecha prometida.
- El metal recibido con la pieza es **custodia**, sin abono monetario. El metal como pago se registra después, desde **Registrar abono**.
- Las salidas y aportes adicionales requieren existencias de la misma ley y metal. Ninguna cuenta admite saldo negativo.
- El retorno separa pieza, limalla y pérdida definitiva. Las proporciones de propiedad de una mezcla se distribuyen según los aportes, conservando los miligramos de cada propietario. La limalla del cliente se devuelve con la entrega.
- La merma física no genera cobros adicionales automáticos. El presupuesto debe recoger el acuerdo con el cliente; una modificación requiere motivo y queda en el historial.
- Los anticipos se aplican al saldo. El reconocimiento de la venta ocurre al entregar, después de calidad y pago completo.
- Los pagos aceptan efectivo, transferencia y metal simultáneamente; registran tarifa, fino, valor, vueltas y turno. El exceso se devuelve en efectivo si hay fondos.
- Un administrador puede anular cobros del turno abierto original si sus medios siguen disponibles. Para anticipos de turnos anteriores, puede registrar una devolución en efectivo o transferencia. No se borran comprobantes.
- Las anulaciones de órdenes se permiten antes de asignar producción y después de devolver los anticipos y la custodia.

## Inventarios y administración

- **Libro de metales:** bodega propia, custodia, recibido como pago, base de oro en caja, mesas, limalla, fundido y piezas terminadas propias. Se separan oro, plata y platino, leyes y propietarios.
- **Precisión:** bruto en miligramos enteros; fino en microgramos enteros; valoración en pesos enteros calculada sobre el fino sin redondeo previo. Ley libre de 1 a 1.000 milésimas. La ley 999 usa factor 0,999, mientras que fino puro usa 1.000.
- **Fundiciones:** entrada, liga sin el metal precioso, peso de salida y ley ensayada. No se permite crear más metal fino del que entró. La cuenta de limalla propia puede refinarse; la limalla de clientes conserva su propietario.
- **Piedras e insumos:** existencias, entradas, mínimos, costos y consumo por orden. La entrada de insumos requiere soporte; no crea por sí misma una cuenta por pagar ni una salida de caja.
- **Compras:** ingreso de metal con proveedor, documento y vencimiento. Los pagos de proveedor se registran aparte; efectivo se descuenta de un turno abierto.
- **Orfebres:** asignaciones, avances, merma ponderada y liquidación de honorarios de trabajos retornados.
- **Producción propia:** crea una cuenta interna, recibe piezas aprobadas en inventario y registra salidas parciales o completas al minorista, con soporte CSV. Estas salidas son transferencias físicas, no ventas de taller.
- **Caja:** apertura en efectivo, oro o ambos, cobros, gastos, devoluciones y pagos. La base de oro pasa de bodega a la cuenta «Base de oro en caja» sin crear ingresos ni duplicar patrimonio. El modo indica la base de apertura, no restringe los medios de cobro durante la jornada. El cierre cuenta efectivo y cada combinación de metal y ley, incluyendo la base inicial más el recaudo; registra diferencias y quién recibe el metal de vuelta en bodega. No se puede cobrar en un turno cerrado.
- **Reportes:** ventas al entregar, impuestos, costos y margen estimados, rendimiento de orfebres y auditoría. Los costos usan la tarifa histórica de la orden; no son un sistema contable fiscal ni un método de costo por lote de compras.
- **Exportación:** CSV UTF-8 con separador `;`, compatible con Excel. Incluye protección frente a fórmulas provenientes de texto del usuario.
- **Comprobantes:** recepción, cobro, devolución, entrega y arqueo. Vista previa e impresión del navegador en 58/80 mm o guardado como PDF.
- **Análisis operativo:** indicadores locales calculados a partir de los registros, sin proveedor de IA externo.
- **WhatsApp:** prepara un mensaje editable y abre WhatsApp para que el operador lo revise y lo envíe. No envía mensajes automáticamente.

## Acceso

El primer acceso crea el administrador. Las contraseñas requieren un mínimo de **4 caracteres**, sin exigencia de mayúsculas, símbolos o mezclas de caracteres. Los formularios permiten mostrar u ocultar la contraseña. El administrador puede crear usuarios con roles **administrador**, **recepción y caja**, **producción y bodega**, **contabilidad** y **consulta**.

Todos los usuarios autenticados pueden consultar datos de operación, incluidos sus importes. El rol controla las modificaciones; reportes, auditoría, usuarios, configuración, restauración y ajustes tienen permisos específicos comprobados por el servidor. No se ofrece aislamiento por sucursal o por orfebre. Las sesiones duran doce horas y las contraseñas se guardan con sal y scrypt.

Los cambios se guardan como transacciones SQLite; cada operación conserva auditoría. Los reintentos con la misma clave no duplican registros y una revisión antigua se rechaza para evitar sobrescribir cambios de otra sesión.

## Datos y respaldo

- Base: `data/taller.sqlite`, con WAL y sincronización completa.
- Copia automática: `data/backups/taller-AAAA-MM-DD.json`, al iniciar o antes de la primera modificación del día. Es una copia del estado de inicio de esa jornada; no sustituye una copia al terminar.
- Copia manual: **Configuración → Descargar copia**. Incluye operación y auditoría, con suma de comprobación.
- Restauración: requiere administrador y contraseña, valida la copia y guarda una copia previa. Conserva los accesos actuales e incorpora la auditoría importada.
- Para conservar también usuarios y contraseñas, detén el servidor y copia **toda la carpeta `data`**, incluidos archivos SQLite auxiliares si existen. No copies solo el archivo principal mientras el servidor está escribiendo.
- Los datos no están cifrados en disco. Protege el acceso a este computador y a las copias que contienen datos de clientes.
- Las fotografías se comprimen a JPEG de hasta 1.200 px y se almacenan con la orden. Las copias de restauración admiten hasta 25 MB por solicitud; una colección de fotografías que supere ese límite debe recuperarse mediante la copia completa de `data` con el servidor detenido.

## Equipos y conexiones externas

La balanza tiene un adaptador **Web Serial** para Chrome/Edge sobre localhost o HTTPS. Conecta un puerto con velocidad seleccionable y formato 8-N-1. Admite líneas de texto que incluyan peso y unidad (`g`, `mg`, `kg`), con señal de estabilidad `ST` o `S`. No se envían órdenes genéricas de tara a equipos sin conocer su protocolo. Existe captura manual con tres decimales. **La compatibilidad real debe probarse con el modelo físico del taller.**

La impresión usa el diálogo del navegador. Debes configurar el papel y comprobar márgenes con la impresora física.

**No se incluye facturación electrónica DIAN, sincronización en la nube, envío automático por WhatsApp, conexión a DeepSeek ni escritura automática en otro sistema Áurea.** Los comprobantes son comerciales, las transferencias al minorista producen soportes CSV y el análisis es local. Estas integraciones requieren proveedor, protocolo, credenciales y pruebas externas. La configuración de impuestos la define el negocio con su responsable contable.

Para acceder desde otro dispositivo puedes usar el túnel existente después de configurar el administrador. El servidor escucha en `127.0.0.1` por defecto. Para una red privada configura `HOST` explícitamente y restringe el acceso mediante el firewall de la red; no hay HTTPS incorporado.

## Comprobación técnica

El resultado de la revisión de despliegue, su alcance y las condiciones verificadas están en [REVISION-DESPLIEGUE.md](REVISION-DESPLIEGUE.md).

```powershell
node --test tests/*.test.cjs
```

Las pruebas usan bases temporales independientes. Cubren reparación y fabricación mixta, conservación de propiedad, pagos con oro y vueltas, insumos, compras, fundición, producción propia, transferencias, devoluciones, caja, permisos, reintentos, conflictos, respaldo y reinicio. Incluyen 75 distribuciones de metal con leyes y miligramos distintos.

Prueba adicional de interfaz, con Playwright disponible en `NODE_PATH` y Microsoft Edge instalado:

```powershell
node tests/browser-smoke.cjs
```

Verifica el recorrido completo en navegador, navegación, filtros, descarga de copia y vista móvil; guarda capturas en `test-results`.

`node tests/responsive-review.cjs` revisa las 17 vistas existentes en anchos de 320, 360, 390, 768, 1.024 y 1.440 px, con registros e importes grandes. También comprueba que Atrás respete los cambios sin guardar, que los formularios no se cierren durante un guardado y que una sesión vencida regrese al acceso sin un modal bloqueándolo. Usa el mismo entorno Playwright de la prueba de interfaz.

La simulación `tests/daily-use.test.cjs`, incluida en las pruebas automáticas, recorre cinco jornadas con cuatro roles, 65 órdenes, 120 comprobantes, saldos calculados de forma independiente, arqueos, producción propia, un reinicio y cobros simultáneos de dos operadores. Guarda un resumen sin datos reales en `test-results/daily-use.json`. `node tests/daily-browser.cjs` comprueba además el descarte de fotos entre recepciones y las interrupciones durante el guardado; también usa Playwright y datos temporales.

Una orden con insumos ya consumidos se considera actividad de producción y no puede anularse como trabajo sin iniciar. Los pagos con metal requieren una tarifa positiva. Las cantidades de insumos admiten hasta seis decimales; las entradas de peso de metal conservan su límite de tres.

Las pruebas `tests/failure-recovery.test.cjs` y `node tests/failure-recovery-browser.cjs` fuerzan datos malformados, treinta cobros simultáneos, restricciones de consulta, copias inválidas, cierres de un turno antiguo, pérdida de respuestas y reintentos después de otra operación. Los borradores conservan los valores digitados sin redondear entradas inválidas y la identificación de los envíos pendientes sobrevive a la reconstrucción del formulario. Todas estas pruebas usan bases temporales.

## Código

| Archivo | Responsabilidad |
| --- | --- |
| `domain.cjs` | Validaciones y operaciones de taller |
| `server.cjs` | HTTP, SQLite, sesiones, permisos, auditoría y respaldo |
| `app.js` | Interfaz y formularios conectados a la API |
| `numbers.js` | Formato colombiano, lectura de números y agrupación durante la edición |
| `transport.js` / `transfers.cjs` | Transferencias autenticadas de archivos grandes |
| `api/index.js` / `cloud-storage.cjs` | API de Vercel y persistencia Turso |
| `storage-schema.cjs` | Esquema compartido de datos y sesiones |
| `scripts/` | Build público, migración y recuperación de copias de nube |
| `styles.css` | Diseño adaptable y formatos de impresión |
| `tests/` | Pruebas con datos aislados |
| `referencia/` | Prototipo original, conservado sin publicarse desde el servidor |

Los documentos `FASE-01/02/03` y la hoja de componentes se conservan como referencia de diseño. Describen también propuestas que no equivalen a integraciones implementadas. Este README describe el comportamiento actual.
