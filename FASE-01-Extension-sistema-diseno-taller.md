# Áurea Taller · Extensión del Sistema de Diseño y Arquitectura de Navegación
**Fase 1 — Especificación para Aprobación**  
*Fecha: 28 de octubre de 2026*  
*Producto: Software de Gestión de Talleres de Joyería y Orfebrería («Áurea Taller»)*  
*Ecosistema: Áurea (Joyería Minorista / Taller / Mayorista)*  
*Marca: áurea · «GESTIÓN QUE BRILLA»*

---

## 1. Supuestos Operativos y Técnicos para Validación

Antes de avanzar a las pantallas (Fase 2), dejamos explícitos los 4 supuestos operativos críticos solicitados:

1. **Regla de Reconocimiento de Venta de Reparaciones:**
   - *Propuesta estándar:* La venta se reconoce formalmente en el momento de la **ENTREGA de la pieza al cliente** (momento en que se emite la factura/comprobante de venta y se descuenta el inventario de materiales consumidos).
   - *Manejo de anticipos/abonos previos:* Todo anticipo recibido antes de la entrega ingresa como pasivo en cartera («Anticipo por trabajo en curso»), exactamente igual que en el sistema de ventas minoristas.
   - *Alternativa configurable en Configuración:* El taller puede alternar la regla entre `[Al entregar]` o `[Al cobrar el 100 %]`. En todas las vistas de la orden se muestra la insignia de la regla activa.

2. **Base de Cálculo de la Merma (Bruto vs. Fino):**
   - *Propuesta estándar de orfebrería:* La merma operativa se calcula **sobre el peso en gramos de la misma ley de trabajo (peso bruto de la aleación)**, porque el orfebre trabaja con 18k o 14k físicos. Sin embargo, para efectos contables y balances de bodega, el sistema convierte simultáneamente toda merma a **gramos de oro fino (24k)** a fin de consolidar mermas de diferentes leyes sin distorsión.
   - *Fórmula visible e inmutable:*  
     $$\text{Merma Neta} = \text{Oro Entregado} - (\text{Pieza Terminada} + \text{Limalla/Polvo Recuperable})$$  
     $$\text{Merma \%} = \left(\frac{\text{Merma Neta}}{\text{Oro Entregado}}\right) \times 100$$
   - Se discrimina siempre: **Merma Recuperable** (limalla, astillero, raspaduras, crisol) vs. **Merma Definitiva** (volatilización al soplete, decapado químico, pulido al paño no recuperable).

3. **Valoración del Oro Recibido como Medio de Pago:**
   - *Propuesta estándar:* Se liquida a la **Tarifa Oficial de Compra de Chatarra/Retal del Día** establecida en el taller para esa jornada (fijada por el Administrador a primera hora).
   - *Edición autorizada:* El cajero o receptor puede editar la tarifa unitaria únicamente si tiene el permiso `Ajustar valoración de metales` y el sistema exige seleccionar/escribir un **motivo obligatorio** (ej. *«Oro bajo con impurezas de soldadura previa (-3 %)»* o *«Acuerdo comercial cliente VIP»*), el cual queda grabado con sello de tiempo en el log de auditoría.
   - *Separación patrimonial estricta:*
     - **Oro recibido como pago:** Pasa a ser activo/propiedad del taller y engrosa el saldo de *Oro Propio (Chatarra/Retal en Bodega)*.
     - **Oro del cliente en custodia:** NO es propiedad del taller ni abona dinero; se custodia en una cuenta de orden transitoria asignada a la orden de trabajo hasta su entrega.

4. **Manejo de IVA e Impuestos:**
   - *Propuesta estándar en Colombia:* En reparaciones y confección a medida con oro del cliente, el IVA (19 %) se aplica **únicamente sobre el servicio de mano de obra y los insumos/materiales nuevos suministrados por el taller** (soldadura, piedras, rodio, oro adicional del taller). El oro aportado por el cliente o recibido como forma de pago no causa IVA sobre su valor intrínseco.
   - *Soporte para régimen simplificado / no responsable:* Configuración conmutador para talleres no obligados a facturar IVA, mostrando comprobante comercial limpio con desglose de mano de obra y materiales.

---

## 2. Identidad Visual Heredada (Tokens del Ecosistema Áurea)

| Token | Hex / Valor | Rol en el Taller Joyero |
|---|---|---|
| `canvas` | `#F6F5F1` | Fondo general de la aplicación |
| `surface` | `#FFFFFF` | Tarjetas de órdenes, tablas de pesaje y formularios |
| `surface-subtle` | `#EFEEE8` | Fondos de controles, pestañas inactivas y cabeceras de tabla |
| `text-primary` | `#202B27` | Títulos, lecturas de balanza e importes principales |
| `text-secondary` | `#59665F` | Etiquetas de ley, metadatos y sellos de tiempo |
| `border-subtle` | `#DCDDD6` | Líneas divisorias de tarjetas y tablas |
| `border-control` | `#7D8981` | Bordes de campos de entrada y botones secundarios |
| `brand-primary` | `#153F35` | Verde profundo: acción principal, navegación activa y KPI destacado (máx 1 por pantalla) |
| `brand-hover` | `#0D3028` | Estado hover de botones primarios |
| `brand-soft` | `#E6EEEA` | Fondos de badges activos y selecciones de mesa |
| `accent-champagne`| `#B49A69` | Champán satinado: acentos de marca, línea editorial «GESTIÓN QUE BRILLA» |
| `accent-ink` | `#725A2F` | Texto sobre fondos champán |
| `success-ink` / `bg`| `#176344` / `#EAF5EE`| Merma normal (<2%), peso balanceado, orden lista, sincronizado |
| `warning-ink` / `bg`| `#805000` / `#FFF3D6`| Merma por revisar (2-3.5%), oro en mesa > 3 días, existencia baja |
| `danger-ink` / `bg` | `#A52D35` / `#FCEDEF`| Merma fuera de rango (>3.5%), faltante en balanza, trabajo urgente |
| `info-ink` / `bg` | `#285B83` / `#EAF2FA`| Información de balanza USB conectada, datos de cliente |
| `debt-ink` / `bg` | `#64439A` / `#F1ECFA`| Saldos pendientes por cobrar al entregar, anticipos en custodia |
| `focus-ring` | `#2568B2` | Anillo de accesibilidad para teclado (3 px) |

- **Tipografía:** Georgia para la marca `áurea` e introducciones solemnes; Inter para todos los datos de pesaje, títulos operativos y botones. Formato numérico estricto con **números tabulares** (`font-variant-numeric: tabular-nums`).
- **Formatos:**
  - Moneda: `$ 1.850.000` (COP)
  - Pesaje: `3,25 g` (2 decimales en recepción general; 3 decimales `3,254 g` en balanza analítica de banco)
  - Porcentaje de merma: `1,50 %`
  - Fechas: `28 oct 2026`, con hora `28 oct 2026, 11:15 a. m.`

---

## 3. Extensión de Componentes Especializados para Taller

Se incorporan 7 nuevos componentes de orfebrería al sistema de diseño base:

### Componente 1: Campo de Peso Profesional (`WeightInput`)
- **Objetivo:** Captura ergonómica y a prueba de errores de pesos de metales preciosos en mostrador o mesa de trabajo.
- **Anatomía:**
  - Contenedor con altura táctil de **52 px** (mínimo de 48-56 px para interacción con guantes o dedos de operario).
  - Selector de modo: `[Balanza USB]` vs `[Manual]`.
  - Sufijo tipográfico inmutable `g`.
  - Badge de estado de balanza en vivo: `Ohaus USB · Estable` (verde) o `Manual` (ámbar).
  - Botón de un toque para **Tarar balanza (0,00 g)**.
  - Conmutador rápido de decimales: `2 decimales (0,01 g)` vs `3 decimales (0,001 g)`.
  - Botón de **Capturar/Congelar lectura**.
- **Comportamiento UX y Errores:**
  - Si el usuario digita un peso manual existiendo balanza conectada, se requiere confirmación para evitar omisiones de calibración.
  - Alerta de tolerancia: si el peso oscila o la balanza reporta inestabilidad, el campo se tiñe de advertencia antes de permitir el guardado.

### Componente 2: Selector Rápido de Ley y Quilataje (`PurityKaratSelect`)
- **Objetivo:** Asignar la pureza del metal con un solo toque sin riesgo de digitación errónea de factores.
- **Píldoras preconfiguradas:**
  - `24k (999)` → Factor: 1,0000
  - `18k Nacional (750)` → Factor: 0,7500
  - `18k Italiano (750)` → Factor: 0,7500 (aleación blanca o amarilla refinada)
  - `14k (585)` → Factor: 0,5850
  - `10k (417)` → Factor: 0,4170
  - `Plata 925` → Factor: 0,9250
  - `Ley Libre / Ensayo` → Campo numérico milesimal editable (ej. 712 milésimas para oro antiguo ensayado a la piedra de toque).
- **Feedback:** Muestra en tiempo real el factor multiplicador fino asociado.

### Componente 3: Bloque de Conversión «Peso → Fino → Valor» (`GoldConversionBlock`)
- **Objetivo:** Cumplir de forma estricta el **Requisito Funcional 1** mostrando la matemática completa del metal en cualquier pantalla.
- **Estructura en 3 pasos secuenciales:**
  1. `Peso Bruto`: Gramos ingresados + Ley seleccionada.
  2. `Factor y Fino Equivalente`: Gramos de oro puro 24k calculados automáticamente sin intervención manual.
  3. `Valoración Comercial COP`: Valor en pesos resultante de multiplicar los gramos finos por la tarifa del día.
- **Auditoría visible:**
  - Indicación explícita de la tarifa aplicada: `Tarifa del día: $ 610.000/g fino ($ 457.500/g 18k)`.
  - Nombre del usuario que fijó la cotización y hora de actualización.
- **Selector de Naturaleza del Metal:**
  - Píldora Verde: `Oro Recibido como Pago (Propiedad del Taller)` → Abona a la cuenta y entra a Chatarra.
  - Píldora Violeta: `Oro del Cliente en Custodia (No es Propiedad del Taller)` → Queda en depósito de orden sin generar abono en dinero.

### Componente 4: Tarjeta de Cuenta de Oro (`GoldAccountCard`)
- **Objetivo:** Representar fielmente las cuentas separadas del **Libro de Oro (Requisito Funcional 4)**.
- **Cuentas estandarizadas:**
  1. *Bodega · Oro Propio (Chatarra y Lingotes)* (Tarjeta destacada en `#153F35`).
  2. *En Proceso (Mesas de Orfebres)*.
  3. *Custodia de Clientes (Trabajos en marcha)*.
  4. *Limalla, Polvo y Scrap Recuperable*.
- **Datos visibles por tarjeta:**
  - Gramos brutos totales (ej. `412,85 g`).
  - Gramos finos equivalentes (ej. `309,64 g fino eq.`).
  - Valoración en COP a la tarifa del día.
  - Alerta integrada de stock mínimo o retención prolongada.

### Componente 5: Indicador de Merma con Semáforo (`LossIndicator`)
- **Objetivo:** Controlar el **Requisito Funcional 5** con liquidación transparente de metal por orfebre y orden.
- **Fórmula desplegada:**
  $$\text{Entregado } 12,40\text{ g} \longrightarrow \text{Devuelto } 11,96\text{ g} + \text{Limalla } 0,25\text{ g} \longrightarrow \text{Merma Neta } 0,19\text{ g } (1,53\,\%)$$
- **Semáforo obligatorio de 3 niveles (Icono + Palabra + Color):**
  - **Normal** (`#176344` / `#EAF5EE`): Merma $\le$ umbral configurado (ej. $\le 2,0\,\%$). Check verde.
  - **Por revisar** (`#805000` / `#FFF3D6`): Desviación leve ($2,1\,\%$ a $3,5\,\%$). Triángulo de advertencia.
  - **Fuera de rango** (`#A52D35` / `#FCEDEF`): Merma excesiva ($> 3,5\,\%$). Octágono de alerta crítica.
- **Cláusula de Absorción visible:**
  - Indica expresamente quién asume el faltante por encima del umbral: `[Taller en costo]` o `[Descuento en liquidación a Orfebre]` o `[Cobro a Cliente con autorización]`.

### Componente 6: Línea de Tiempo de la Orden (`OrderTimeline`)
- **Objetivo:** Trazabilidad ininterrumpida y pesaje en cada traspaso de custodia (**Requisitos 2 y 3**).
- **Hitos estándar:**
  1. *Recepción y Pesaje de Entrada:* Peso inicial, estado de joyas, gemas recibidas, firma de custodia.
  2. *Asignación y Salida de Metal a Mesa:* Gramos de base asignados del taller + gramos del cliente.
  3. *Control de Etapas de Fabricación:* Fundición, forjado, soldadura, engaste, pulido.
  4. *Retorno y Pesaje Final:* Pesaje de joya terminada + pesaje de limalla del astillero.
  5. *Control de Calidad:* Verificación de medidas, ley, brillo y ensamble.
  6. *Entrega al Cliente y Facturación:* Reconocimiento contable de la venta y cobro del saldo.

### Componente 7: Tablero de Órdenes de Taller (`KanbanBoard`)
- **Objetivo:** Gestión visual de la carga de trabajo en tablets de supervisión y bancos de trabajo.
- **Columnas operativas:**
  1. *Recibidas / Por Iniciar*
  2. *En Mesa de Trabajo (Con Orfebre)*
  3. *Control de Calidad / Acabado Final*
  4. *Listas para Entrega y Venta*
  5. *Entregadas / Facturadas*
- **Anatomía de la Tarjeta:**
  - Consecutivo de orden (ej. `T-0412 · Reparación`) y prioridad visual.
  - Descripción de la joya y cliente.
  - Orfebre asignado y banco/mesa de trabajo.
  - Gramos de oro en custodia o en proceso.
  - Fecha prometida de entrega y semáforo de tiempo restante.
  - Saldo pendiente por cobrar en violeta (`#64439A`).

---

## 4. Estructura de Navegación de Áurea Taller

### Arquitectura de la Barra Lateral (Sidebar de 232 px)

La navegación se estructura en **4 grupos funcionales**, reflejando el flujo de valor de la orfebrería:

```
+-----------------------------------------------------------+
|  [áurea] taller            «GESTIÓN QUE BRILLA»           |
|  Sede: Taller Central - Calle 12 # 4-22                   |
+-----------------------------------------------------------+
|  OPERACIÓN                                                |
|  * Inicio / Mesa de Taller (Dashboard)                    |
|  * Recepción y Órdenes de Trabajo (Listado y Tablero)     |
|  * Caja y Turnos (Arqueo de Efectivo y Oro)               |
+-----------------------------------------------------------+
|  PRODUCCIÓN                                               |
|  * Fabricaciones a Medida (Fichas Técnicas y Etapas)      |
|  * Libro de Oro en Bruto (Cuentas de Bodega y Balanzas)   |
|  * Fundición y Aleaciones (Crisoles y Ensayos)            |
|  * Orfebres (Cuentas Corrientes y Rendimiento)            |
+-----------------------------------------------------------+
|  CONTROL                                                  |
|  * Clientes y Custodias (Historial y Joyas en Depósito)   |
|  * Compras y Proveedores (Metales, Piedras, Herramientas) |
|  * Reportes y Mermas (Ventas de Taller, Utilidad, Merma)  |
+-----------------------------------------------------------+
|  SISTEMA                                                  |
|  * Asistente IA (DeepSeek - Análisis de Taller)           |
|  * Configuración (Tarifas de Oro, Tolerancias, Permisos)  |
+-----------------------------------------------------------+
|  [●] Guardado local y en servidor · 19:24:41              |
+-----------------------------------------------------------+
```

### Barra Superior (Topbar de 72 px de altura)

De izquierda a derecha, contiene los datos críticos en vivo:
1. **Ruta jerárquica (Breadcrumb):** Contexto actual (ej. `Producción > Libro de Oro > Movimientos de Bodega`).
2. **Estado de Turno / Caja:** `Turno #2 · Abierto · Don Carlos (Cajero)`.
3. **Tarifa Oficial del Día (Destacada):**
   - `Oro 24k Fino: $ 610.000/g · 18k: $ 457.500/g (Act. hoy 8:15 a. m.)`.
   - Botón de acceso rápido para consultar o ajustar con motivo autorizado.
4. **Estado de Balanza:**
   - Indicador dinámico: `Balanza Ohaus USB · Conectada (Puerto COM4) · 3 dec.`.
5. **Centro de Notificaciones:**
   - Contador semaforizado que discrimina:
     - *Alertas de merma fuera de rango.*
     - *Oro retenido en mesa de orfebre por más de 3 días sin registrar avance.*
     - *Órdenes con fecha prometida para hoy o vencidas.*
6. **Usuario y Rol:** Avatar, nombre del operario y menú desplegable de perfil / desconexión.

### Pie de Barra Lateral (Persistencia y Sincronización)
- Muestra el estado real del almacenamiento del taller:
  - `[● Verde] Sincronizado: Base de datos local SQLite + Servidor Cloud Áurea`.
  - En caso de corte de internet en el taller: `[▲ Ámbar] Modo Local: Operando sin conexión. 3 transacciones pendientes de sincronizar`.

### Destinos de Inicio por Rol de Usuario

| Rol | Pantalla Inicial | Enfoque Primario de Trabajo |
|---|---|---|
| **Dueño / Administrador** | *Inicio / Dashboard de Taller* | Utilidad neta, merma consolidada, oro total en custodia vs propio, ventas del día. |
| **Recepción / Mostrador** | *Recepción y Órdenes de Trabajo* | Recibir joyas, pesar en balanza, presupuestar, cobrar anticipos y entregar piezas listas. |
| **Orfebre / Operario** | *Mi Mesa de Trabajo (Filtro por orfebre)* | Ver órdenes asignadas, registrar limalla y solicitar salidas de oro a bodega. |
| **Encargado de Bodega de Oro**| *Libro de Oro en Bruto* | Entregar oro a orfebres, conciliar balanzas, recibir chatarra y registrar fundiciones. |
| **Contador / Auxiliar** | *Reportes y Caja* | Facturación de reparaciones, arqueos de oro y efectivo, liquidación de mano de obra. |

---

## 5. Próximo Paso (Fase 2)

Con la aprobación de esta **Fase 1** (lenguaje visual, tokens, los 7 componentes de orfebrería y la navegación), pasaremos de inmediato a detallar una a una las **16 pantallas de la Fase 2 (a hasta p)**, indicando para cada una:
- Objetivo concreto
- Componentes utilizados
- Jerarquía de información
- Estados de UI (vacío, carga, error)
- Comportamiento responsive (Desktop / Tablet de banco / Móvil)
- Requisito funcional que resuelve (1 al 5)
