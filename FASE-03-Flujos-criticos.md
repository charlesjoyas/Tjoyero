# Áurea Taller · Flujos Críticos Operativos (Fase 3)
**Fase 3 — Flujos Críticos de Orfebrería y Taller**  
*Fecha: 28 de octubre de 2026*  
*Producto: «Áurea Taller» — Software de Gestión para Talleres de Joyería y Orfebrería*  
*Ecosistema: Áurea · Identidad: áurea · «GESTIÓN QUE BRILLA»*

---

## Índice de Flujos Críticos
1. [Flujo 1: Reparación simple cobrada en efectivo](#flujo-1-reparación-simple-cobrada-en-efectivo)
2. [Flujo 2: Reparación pagada en oro](#flujo-2-reparación-pagada-en-oro)
3. [Flujo 3: Fabricación a medida con oro del cliente y merma](#flujo-3-fabricación-a-medida-con-oro-del-cliente-y-merma)
4. [Flujo 4: Fabricación con oro del taller y salida a orfebre](#flujo-4-fabricación-con-oro-del-taller-y-salida-a-orfebre)
5. [Flujo 5: Conciliación y cierre de caja con arqueo de oro](#flujo-5-conciliación-y-cierre-de-caja-con-arqueo-de-oro)

---

### Flujo 1: Reparación simple cobrada en efectivo

**Caso real:** Lucía Restrepo trae una cadena cordón de oro 18k con un eslabón roto y broche vencido. Orden `T-0412`.

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Lucía Restrepo
    actor Mostrador as Receptor / Don Carlos
    participant Balanza as Balanza USB (Ohaus)
    participant Sistema as Áurea Taller
    actor Orfebre as Carlos Valencia (Mesa 1)

    Cliente->>Mostrador: Entrega cadena para reparar
    Mostrador->>Balanza: Coloca joya en el plato
    Balanza-->>Sistema: Transmite peso estable: 4,800 g
    Mostrador->>Sistema: Selecciona 18k Nacional (750) · Marca: «Oro en Custodia»
    Sistema-->>Sistema: Registra 4,800 g en cuenta «Custodia Clientes» (Azul #285B83)
    Mostrador->>Sistema: Presupuesto: M.O. $ 95.000 + Soldadura 18k $ 25.000 = $ 120.000 COP
    Mostrador->>Sistema: Anticipo en efectivo recibido: $ 50.000 COP (Saldo: $ 70.000)
    Sistema->>Mostrador: Imprime Recibo de Custodia Térmico (58/80 mm)
    Mostrador->>Cliente: Entrega recibo de custodia firmado
    Mostrador->>Orfebre: Asigna orden y entrega cadena + 0,100 g soldadura de bodega
    Orfebre->>Orfebre: Suelda eslabón, ajusta resorte de broche y pule al paño
    Orfebre->>Mostrador: Devuelve cadena lista y probada
    Mostrador->>Balanza: Pesa cadena terminada: 4,880 g (con aporte de soldadura)
    Mostrador->>Sistema: Marca estado: «Lista para Entrega»
    Sistema->>Cliente: Notificación automática WhatsApp: «Tu cadena está lista»
    Cliente->>Mostrador: Se presenta a retirar joya y paga saldo de $ 70.000 en efectivo
    Mostrador->>Sistema: Registra pago de $ 70.000 en efectivo y confirma entrega física
    Sistema-->>Sistema: Descarga custodia de 4,800 g · Emite Factura Venta V-0895
    Sistema-->>Sistema: Reconoce Venta V-0895 ($ 120.000 COP) e ingresa efectivo a Turno #2
    Mostrador->>Cliente: Entrega joya + Factura de Venta formal con garantía
```

- **Puntos clave de UX:**
  - El oro de la cliente nunca entra al patrimonio del taller; se mantiene en cuenta *Custodia Clientes* hasta la entrega.
  - La venta solo se reconoce contablemente al entregar la joya al cliente, descargando la soldadura consumida del inventario de insumos.

---

### Flujo 2: Reparación pagada en oro

**Caso real:** Roberto Gómez repara un anillo solitario (mano de obra $ 180.000 + rodio $ 40.000 = $ 220.000 COP) y paga entregando un arete huérfano de oro 18k.

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Roberto Gómez
    actor Mostrador as Don Carlos (Cajero)
    participant Balanza as Balanza USB
    participant Sistema as Áurea Taller

    Cliente->>Mostrador: Entrega solitario y ofrece pagar el arreglo con un arete de oro 18k
    Mostrador->>Balanza: Pesa solitario para custodia: 3,100 g (18k)
    Mostrador->>Sistema: Abre orden T-0422 (Arreglo + Rodio: $ 220.000 COP)
    Mostrador->>Balanza: Pesa arete entregado como pago: 0,650 g
    Balanza-->>Sistema: Lectura: 0,650 g
    Mostrador->>Sistema: Selecciona: 18k (0,750) · Marca: «Oro Recibido como Pago»
    Sistema-->>Sistema: 0,650 g × 0,750 = 0,488 g fino eq.
    Sistema-->>Sistema: 0,488 g × $ 610.000/g fino = $ 297.680 COP abonados
    Sistema->>Mostrador: Desglose visible: Cuenta $ 220.000 - Oro $ 297.680 = Vueltas $ 77.680 COP
    Mostrador->>Cliente: Explica matemática en pantalla y entrega vueltas de $ 77.680 en efectivo
    Sistema-->>Sistema: Ingresa 0,650 g a cuenta «Recibido como pago» (Lote #RP-041)
    Mostrador->>Sistema: Genera Comprobante de Cobro y Recibo de Custodia
```

- **Puntos clave de UX:**
  - El bloque `Peso → Fino → COP` se muestra de frente al cliente con la cotización del día visible.
  - El metal entra directamente a la cuenta patrimonial propia **«Recibido como pago»** (no a custodia ni a chatarra genérica).

---

### Flujo 3: Fabricación a medida con oro del cliente y merma

**Caso real:** Andrés Gómez encarga un par de argollas de matrimonio media caña en oro 18k (Orden `T-0415`). Aporta 5,200 g de oro propio en custodia; el taller suministra 7,200 g de oro de bodega para completar los 12,400 g requeridos. Orfebre: Pedro Martínez.

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Andrés Gómez
    actor Admin as Don Carlos (Taller)
    actor Orfebre as Pedro Martínez (Mesa 2)
    participant Balanza as Balanza USB
    participant Sistema as Áurea Taller

    Cliente->>Admin: Entrega joya vieja: 5,200 g oro 18k en custodia
    Admin->>Sistema: Crea orden T-0415: Base requerida 12,400 g (18k)
    Sistema-->>Sistema: Origen de base: 5,200 g (Custodia cliente) + 7,200 g (Oro propio taller)
    Admin->>Sistema: Registra Salida de Fabricación a Pedro M.: 12,400 g entregados
    Admin->>Orfebre: Entrega metal pesado en sobre + Ficha técnica de banco
    Orfebre->>Orfebre: Funde, lamina, forja argollas, graba y pule
    Orfebre->>Admin: Retorna con argollas terminadas y limalla del cajón de cuero
    Admin->>Balanza: Pesa argollas terminadas: 11,960 g
    Admin->>Balanza: Pesa limalla recuperada de astillero: 0,250 g
    Admin->>Sistema: Ingresa pesajes de retorno en módulo de liquidación de merma
    Sistema-->>Sistema: Merma Neta: 12,400 - (11,960 + 0,250) = 0,190 g (1,53 %)
    Sistema->>Admin: Semáforo Verde: «Normal · Dentro de tolerancia (1,53 % vs 2,00 % máx)»
    Sistema-->>Sistema: Regla de absorción: Excedente absorbido por Taller en costo
    Sistema-->>Sistema: Ingresa 0,250 g a cuenta «Limalla / Scrap»
    Admin->>Sistema: Pasa orden a «Lista para Entrega»
    Admin->>Cliente: Entrega argollas terminadas
    Sistema->>Admin: Factura final V-0892: Mano de obra ($ 450.000) + Oro taller aportado 2,000 g neto ($ 915.000)
    Note over Sistema,Cliente: El oro del cliente (5,200 g) se transformó en la joya y NO se cobra como venta.
    Cliente->>Admin: Cancela saldo de $ 665.000 COP
    Sistema-->>Sistema: Formaliza Venta V-0892 y cierra orden T-0415
```

- **Puntos clave de UX:**
  - El orfebre no puede cerrar la orden sin que el encargado de bodega pese por separado la joya terminada y la limalla de astillero.
  - La limalla se acredita a la cuenta 5 (*Limalla / Scrap*) para posterior refino.
  - La orden discrimina el oro del cliente (no facturable) del oro vendido por el taller.

---

### Flujo 4: Fabricación con oro del taller y salida a orfebre (Stock propio)

**Caso real:** Fabricación de 3 sortijas solitario en oro 18k para vitrina comercial.

1. **Apertura de Ficha de Producción:**
   - Encargado de producción selecciona modelo catálogo `REF-SOL-18K`.
   - BOM: 15,000 g oro 18k bodega + 3 esmeraldas colombianas 0,20 ct + 0,300 g soldadura.
2. **Salida de Bodega a Mesa:**
   - Se pesan 15,000 g en balanza USB del lote de granalla 18k de la cuenta *1. Oro Propio Taller*.
   - Se crea el movimiento de salida a producción a la mesa de Pedro Martínez. El saldo pasa a la cuenta *4. En Proceso*.
3. **Control de Etapas:**
   - Pedro Martínez marca en su tablet de banco: *Fundición completada* $\rightarrow$ *Armado completado* $\rightarrow$ *Engaste completado* $\rightarrow$ *Pulido final*.
4. **Devolución y Liquidación:**
   - Retorno: 3 sortijas terminadas pesan `14,480 g` + limalla recogida `0,310 g`.
   - Merma neta: `15,000 - (14,480 + 0,310) = 0,210 g (1,40 %)`. Semáforo Verde Normal.
5. **Costo de Producción Unitario y Transferencia a Minorista:**
   - Costo total: Metal consumido ($ 6.855.000) + Merma real ($ 96.075) + Gemas ($ 900.000) + Mano de obra Pedro M. ($ 360.000) = `$ 8.211.075 COP` ($ 2.737.025 COP por sortija).
   - El administrador presiona **`[Transferir a Joyería Minorista Áurea]`**: Se generan automáticamente los 3 códigos de barras en el POS minorista con su costo exacto y precio de vitrina sugerido ($ 4.200.000 COP c/u).

---

### Flujo 5: Conciliación y cierre de caja con arqueo de oro

**Caso real:** Cierre de turno de la tarde (Turno #2, Don Carlos).

```mermaid
sequenceDiagram
    autonumber
    actor Cajero as Don Carlos (Cajero)
    participant Balanza as Balanza USB
    participant Sistema as Áurea Taller
    actor Bodeguero as Jorge (Encargado de Bóveda)

    Cajero->>Sistema: Clic en «Cerrar Turno / Iniciar Arqueo Dual»
    
    rect rgb(240, 245, 240)
    Note over Cajero,Sistema: FASE 1: ARQUEO DE EFECTIVO
    Sistema->>Cajero: Muestra resumen esperado: Base $ 300.000 + Ventas $ 2.450.000 - Gastos $ 120.000 = $ 2.630.000
    Cajero->>Sistema: Digita conteo físico de billetes y monedas: $ 2.630.000 COP
    Sistema-->>Sistema: Diferencia en efectivo: $ 0 COP (Exacto)
    end

    rect rgb(255, 248, 235)
    Note over Cajero,Sistema: FASE 2: ARQUEO DE ORO EN CAJA
    Sistema->>Cajero: Esperado en sobre de oro recibido hoy: 7,100 g (18k) · 5,325 g fino eq.
    Cajero->>Balanza: Coloca sobre con los retales de oro recibidos como pago
    Balanza-->>Sistema: Lectura estable en vivo: 7,100 g
    Sistema-->>Sistema: Diferencia en oro: 0,000 g (Bolsa cuadrada)
    end

    Cajero->>Bodeguero: Entrega sobre de oro de 7,100 g firmado
    Bodeguero->>Sistema: Confirma recepción física en bóveda de seguridad
    Sistema-->>Sistema: Traspasa 7,100 g de «Caja» a cuenta «Oro en Bóveda / Bodega»
    Cajero->>Sistema: Confirma cierre formal del Turno #2
    Sistema->>Cajero: Imprime Acta Térmica de Arqueo Dual (Efectivo + Oro)
```

- **Puntos clave de UX:**
  - El arqueo dual obliga a cerrar dos balances independientes: nunca se mezcla dinero con oro.
  - Si existiera una diferencia en oro (ej. faltante de `0,050 g`), el sistema no permite el cierre simple; exige registrar el incidente en el log de auditoría con la etiqueta **«Por revisar»** y notifica al administrador.
