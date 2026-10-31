# Revisión de despliegue · Áurea Taller

Fecha: 30 de octubre de 2026, America/Bogota.

Resultado: sin fallos conocidos en los escenarios ejecutados. La aplicación local pasa las verificaciones funcionales y de recuperación descritas aquí. Esto no constituye una garantía de ausencia de cualquier error futuro ni una certificación de un instalador Windows que todavía no se ha construido.

## Entorno y alcance

- Windows; Node.js 24.22.1; SQLite incluido en Node.
- Interfaz en Microsoft Edge y comprobaciones adicionales en Google Chrome.
- Bases temporales y directorios con espacios; sin modificar registros reales.
- La balanza física queda fuera del alcance solicitado.

## Evidencia

- `node --test tests/*.test.cjs`: **33 pruebas aprobadas**, ninguna fallida.
- Siete programas de navegador aprobados: `browser-smoke.cjs`, `daily-browser.cjs`, `responsive-review.cjs`, `numeric-format-browser.cjs`, `shift-opening-browser.cjs`, `failure-recovery-browser.cjs` y `deployment-browser.cjs`.
- Simulación de cinco jornadas: 724 intentos, 105 bloqueos esperados, 65 órdenes, 120 comprobantes y conciliación independiente de dinero y metal.
- Treinta cobros concurrentes: un solo abono persistido; los reintentos no duplican registros.
- Volumen: 3.000 órdenes y 3.000 cobros; consulta, respaldo de aproximadamente 4,95 MB y modificación posterior correctos; efectivo conciliado en 4.000.000 COP.
- Diecisiete pantallas en anchos 320, 360, 390, 768, 1.024 y 1.440 px: sin desbordamientos detectados.
- PDF de 58 y 80 mm en Chrome y Edge, con descripción extensa y máximo importe admitido: sin desbordamiento horizontal del comprobante.
- La interfaz no solicita recursos de internet para su operación local; se bloquearon las solicitudes externas durante la comprobación de despliegue.
- Despliegue limpio: copia de los archivos del programa sin `node_modules` ni herramientas de desarrollo, usando Node.js instalado.
- Cierre abrupto del proceso, recuperación del WAL, conservación de sesiones y reintentos después del reinicio: correctos.
- Copia completa de datos a otra ubicación: usuarios y contraseñas conservados, acceso correcto y `PRAGMA quick_check` de SQLite en estado `ok`.
- Archivo superior al límite: rechazo HTTP 413 y servidor disponible después.
- Espacio de SQLite agotado artificialmente: rechazo HTTP 507, sin orden parcial ni cambio de revisión, integridad conservada y guardado correcto al recuperar capacidad.
- Puerto ocupado: segundo proceso finaliza con error controlado y el servidor original continúa disponible.
- Roles, solicitudes malformadas, copias inválidas y acceso a archivos de datos desde HTTP: rechazo verificado.

## Correcciones de esta revisión

1. El acceso antiguo solo empieza después de que el servidor principal consiga escuchar; un fallo de puerto cierra los recursos del intento fallido.
2. El mensaje de arranque muestra el puerto efectivo, incluso cuando el sistema lo asigna automáticamente.
3. Una reversión automática de SQLite por falta de espacio ya no oculta el error original con un segundo intento de reversión.
4. La falta de espacio devuelve un mensaje específico y HTTP 507; se puede reintentar después de recuperar capacidad.

## Condiciones del despliegue final

La entrega actual se ejecuta con Node.js 24 o superior. El repositorio contiene un lanzador CMD; no contiene todavía un instalador Windows final con el runtime empaquetado. La validación del instalador y su primera ejecución en el computador del cliente se hace sobre ese artefacto cuando exista. Los resultados de esta revisión cubren la aplicación y su despliegue local con Node instalado.

Se validó la generación de PDF y la llamada al diálogo de impresión del navegador. No se imprimió en una impresora física del cliente. Conserva respaldos fuera del computador de operación; la recuperación de una carpeta completa se comprobó con el servidor detenido.
