# Áurea Taller · Diseño Detallado de Pantallas (Fase 2 - Revisada y Ajustada)
**Fase 2 — Especificación de Pantallas (a a la p)**  
*Fecha: 28 de octubre de 2026*  
*Producto: «Áurea Taller» — Software de Gestión para Talleres de Joyería y Orfebrería*  
*Ecosistema: Áurea · Identidad: áurea · «GESTIÓN QUE BRILLA»*

---

## 1. Ajustes Transversales Incorporados en la Revisión

1. **Unificación Decimal y Tolerancia:**
   - Todo pesaje de metales preciosos se unifica en **3 decimales (`0,001 g`)** para coincidir con la precisión de balanza analítica de banco (ej. Ohaus / Sartorius) y una tolerancia estándar de calibración de **`±0,005 g`**.
   - Los pesos se expresan siempre con 3 decimales: `12,400 g`, `11,960 g`, `0,250 g`, `0,190 g`, `1,900 g`, `4,800 g`.
2. **Ubicación de Parámetros de Hardware:**
   - La configuración de puertos seriales y baudios (`Puerto COM4, 9600 baudios, 8-N-1`) se ubica estrictamente en el módulo **Configuración > Balanzas e Impresoras**. En la barra superior solo se muestra el estado semántico `Balanza Ohaus USB · Conectada`.
3. **Claridad en la Tarifa del Taller vs. Tarifa Comercial Áurea:**
   - **Tarifa del Taller (Anclada al Gramo Fino Puro 24k / Ley 999):** Se fija por gramo de oro fino puro (ej. `$ 610.000 COP / g fino`). A partir de allí se multiplican los factores de ley ($0,750$ para 18k $\rightarrow \$ 457.500\text{ COP/g}$; $0,585$ para 14k $\rightarrow \$ 356.850\text{ COP/g}$).
   - **Relación con la Joyería Minorista Áurea:** La tarifa comercial de tienda (vitrina) incluye mano de obra final, margen comercial, empaque e IVA (ej. `$ 580.000 / g en 18k`). La tarifa del taller para compra de retal corresponde al costo de materia prima refinable deduciendo merma de refino ($3\text{ a }5\,\%$). Cuando el taller termina una joya para stock de la tienda, la transfiere al costo real de producción.
4. **Corrección Semántica de Tokens:**
   - El color **violeta (`#64439A` / `#F1ECFA`)** se reserva **exclusivamente para deudas, cartera y saldos por cobrar**.
   - La cuenta de **Oro en Custodia de Clientes** utiliza **Azul Información (`#285B83` / `#EAF2FA`)** y bordes sutiles con insignia `[No es propio del taller]`.
5. **Navegación Limpia:**
   - Se eliminan letras y numeraciones de la barra lateral (de 232 px).
   - Se reemplaza «Detalle de Orden (T-0415)» por la ruta limpia «Órdenes».
   - La barra superior incluye: *Ruta breadcrumb, Turno de caja y cajero (`Turno #2 · Abierto · Don Carlos`), Tarifa en g fino, Balanza USB conectada, Campana de notificaciones con contador semaforizado y Usuario con rol*.

---

## 2. Pantalla e: Inventario de Oro en Bruto (Detalle Completo de los Ajustes)

- **Objetivo:** Registro del libro diario de metal en gramos brutos y finos, control de las 6 cuentas patrimoniales independientes, auditoría de traspasos y conciliación física con balanza.
- **Requisito que resuelve:** **Requisito 4** (Libro de oro, cuentas separadas, conteo físico y diferencias resaltadas) y **Requisito 1** (Origen de oro recibido como pago).
- **Las 6 Cuentas Patrimoniales Estandarizadas (Punto 2 y 3):**
  1. **Oro Propio del Taller:** Lingotes, granalla 24k y reserva propia de bodega (`412,850 g brutos · 309,638 g fino eq. · $ 188.879.180 COP`). Tarjeta destacada en verde profundo `#153F35`.
  2. **Oro de Clientes en Custodia:** Retales y joyas en depósito para fabricación o arreglo (`58,600 g brutos · 43,950 g fino eq.`). **Color: Azul Información `#285B83` / `#EAF2FA` con etiqueta `[No es propiedad del taller]`. NUNCA violeta.**
  3. **Recibido como Pago:** Oro recibido como parte de pago o anticipo de clientes (`7,100 g brutos · 5,325 g fino eq. · $ 3.248.250 COP`). Cuenta propia e independiente.
  4. **Oro en Proceso (Mesas):** Oro entregado a orfebres en bancos de trabajo (`84,200 g brutos · 63,150 g fino eq.`).
  5. **Limalla / Polvo / Scrap Recuperable:** Metal recogido de astilleros, pulidoras y filtros (`22,450 g brutos · 16,838 g fino eq. · $ 10.271.180 COP`).
  6. **Fundido / Aleado:** Botones, barras y lingotes obtenidos tras procesos de crisol y ligas (`39,880 g brutos · 29,910 g fino eq. · $ 18.245.100 COP`).

- **Corrección del Movimiento V-0892 (Punto 1):**
  - **Origen:** *Caja Mostrador* $\rightarrow$ **Destino:** *«Recibido como pago»* (Cuenta propia, corregido de la anterior etiqueta errónea «Chatarra Bodega»).
  - **Detalle de auditoría:** `1,900 g (18k) · 1,425 g fino eq. · Valorado a $ 869.250 COP · Registrado por Carlos Duque`.

- **Flujo de «Iniciar Conteo Físico y Conciliación» (Punto 4):**
  1. *Selección de cuenta:* Selector desplegable para auditar una cuenta específica (ej. *1. Oro Propio Taller*).
  2. *Lectura de saldo contable:* El sistema muestra el `Oro Esperado según Sistema: 412,850 g`.
  3. *Pesaje físico:* El bodeguero o auditor pesa la bandeja o crisol en la balanza USB conectada (lectura en vivo ej. `412,720 g`).
  4. *Cálculo de diferencia:* Muestra la diferencia calculada en tiempo real: `-0,130 g`.
  5. *Semáforo y estado semántico:* La diferencia se rotula estrictamente en ámbar (`#805000` / `#FFF3D6`) con la etiqueta **`[Por revisar]`**. Nunca se clasifica como ganancia ni como éxito automático.
  6. *Motivo de ajuste obligatorio:* Menú de causas estandarizadas (*«Merma volátil de soplete no asentada»*, *«Limalla retenida en paños de pulido»*, *«Corrección por calibración de balanza»*) + campo de texto libre para justificación detallada.
  7. *Confirmación y firma:* Botón `[Asentar Ajuste de Conciliación]` que graba el usuario, fecha/hora y genera el asiento contable de auditoría.

- **Filtros y Acción «Detalle» en Movimientos (Punto 5):**
  - Barra de filtros: **Cuenta** (las 6 cuentas), **Ley** (24k, 18k, 14k, 10k, Plata), **Responsable** (Bodeguero, Orfebres) y **Rango de Fechas** (Hoy, Esta semana, Mes actual, Personalizado).
  - Cada fila incluye el botón interactivo **«Detalle»**, que despliega un modal con la ruta contable completa, peso bruto, fino equivalente, conversión económica, orden asociada, notas y usuario responsable.

- **Estados de la Pantalla (Punto 5):**
  - **Normal:** 6 tarjetas con saldos, barra de filtros y tabla de movimientos cronológica.
  - **Vacío:** Caja ilustrada con mensaje: *«No hay movimientos registrados para este filtro. [Restablecer filtros]»*.
  - **Carga:** Esqueletos de tarjeta y tabla en gris `#EFEEE8` con animación de shimmer.
  - **Error:** Banner en rojo (`#FCEDEF` / `#A52D35`) explicando la falla de comunicación con la balanza USB o la base local, con botón de reintento.

---

## 3. Pantalla a: Inicio / Dashboard del Taller (Revisada)

- **Objetivo:** Vista ejecutiva y de control para el administrador y orfebre principal al iniciar jornada.
- **Requisito que resuelve:** Transversal a los 5 requisitos.
- **Componentes clave unificados:**
  - **5 Tarjetas KPI:**
    1. *Ventas Reconocidas Hoy (Reparaciones y Trabajos Entregados):* `$ 4.820.000 COP` (6 órdenes entregadas). **Destacada en verde profundo `#153F35` con texto blanco.**
    2. *Oro Propio Bodega:* `412,850 g brutos · 309,638 g fino eq. ($ 188.879.180 COP)`.
    3. *Oro en Mesas:* `84,200 g brutos · 63,150 g fino eq.` (4 orfebres activos).
    4. *Merma del Periodo:* `1,48 %` (Icono check verde · Normal frente a tolerancia $\le 2,00\,\%$).
    5. *Por Entregar Hoy:* `5 órdenes` (`$ 1.280.000 COP` saldo por cobrar).
  - **Panel «Requieren tu atención»:**
    - Alerta Ámbar: *«Orden T-0398 tiene 14,200 g en mesa de Carlos V. sin pesaje hace 4 días»*.
    - Alerta Rojo: *«Orden T-0412 (Cadena 18k) vence hoy a las 5:00 p. m. y sigue en pulido»*.
    - Alerta Violeta: *«Cliente Lucía Restrepo tiene saldo vencido de $ 95.000 COP de orden T-0402»*.
  - **Tabla de Órdenes Activas:** Consecutivo, cliente, trabajo, orfebre asignado, metal comprometido (en 3 decimales), estado y acción «Detalle».

---

## 4. Hojas Visuales: Componentes 2 al 7 (Punto 9)

En el prototipo interactivo (pestaña *«Componentes 2 al 7»*) se encuentran renderizados e interactivos:
- **Componente 2: Selector de Ley y Quilataje (`PurityKaratSelect`):** 6 píldoras (`24k`, `18k Nac`, `18k Ital`, `14k`, `10k`, `Plata 925`) con cálculo visible del factor fino decimal.
- **Componente 3: Bloque de Conversión (`GoldConversionBlock`):** Fórmula visible `12,400 g (18k) → 9,300 g fino → $ 5.673.000 COP` con tarifa y fecha de cotización.
- **Componente 4: Tarjetas de Cuenta de Oro (`GoldAccountCard`):** Las 6 cuentas estandarizadas con saldo bruto, fino y valoración.
- **Componente 5: Indicador de Merma (`LossIndicator`):** Liquidación exacta (`Entregado 12,400 g → Pieza 11,960 g + Limalla 0,250 g → Merma 0,190 g / 1,53 % Normal`) con semáforo y regla de absorción.
- **Componente 6: Línea de Tiempo (`OrderTimeline`):** Hitos con pesajes en 3 decimales y sellos de tiempo.
- **Componente 7: Tablero de Órdenes (`KanbanBoard`):** Columnas operativas con tarjetas de taller y saldos.
