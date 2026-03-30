# Referencia: Fórmulas, Benchmarks y Diagnósticos
## Prophit System — Taylor Holiday / CTC

---

## FÓRMULAS COMPLETAS

### Contribution Margin
```
Contribution Margin ($) = Net Sales − Product Cost − Shipping Cost − Variable Expenses − Ad Spend
Contribution Margin (%) = Contribution Margin ($) / Net Sales × 100
```

### Net Sales (correcto)
```
Net Sales = Order Revenue − Returns Accrual
Returns Accrual = Revenue del período × Tasa de retorno histórica
NO usar: Total Sales de Shopify (incluye returns procesadas de otros períodos)
```

### MER (Marketing Efficiency Ratio)
```
MER = Total Revenue (todo el negocio) / Total Ad Spend
```

### AMER (Acquisition Marketing Efficiency Ratio)
```
AMER = New Customer Revenue / Ad Spend
```

### NC-ROAS (New Customer ROAS)
```
NC-ROAS = New Customer Revenue / Ad Spend
(Es lo mismo que AMER, diferentes nombres para lo mismo)
```

### NCPA (New Customer Purchase Acquisition Cost)
```
NCPA = Ad Spend / Number of New Customers
```

### Net Shipping Cost
```
Net Shipping Cost = Shipping Revenue (cobrado al cliente) − Shipping Cost (pagado al courier/3PL)
Meta: ≥ 0 (break-even o positivo)
```

### Active Customer File
```
Active Customers = Clientes que han comprado en los últimos 6-8 meses
Churned Customers = Clientes cuya última compra fue hace > 8 meses
Active File Growth = (Active Customers este mes − Active Customers mes pasado) / Active Customers mes pasado
```

### Four Quarter Accounting
```
Cost of Delivery % = (Product Cost + Shipping Cost + Variable Expenses) / Net Sales × 100
CAC % = Total Ad Spend / Net Sales × 100
OpEx % = Total Fixed Costs / Net Sales × 100
Profit % = 100% − Cost of Delivery % − CAC % − OpEx %
```

### Revenue Layer Cake
```
Total Revenue = New Customer Revenue + Returning Customer Revenue
New Customer % = New Customer Revenue / Total Revenue × 100
Returning Customer % = Returning Customer Revenue / Total Revenue × 100
```

### Peak Multiplier
```
Peak Multiplier = Revenue de la semana del peak / Revenue promedio de una semana normal
```

### Cash Conversion Cycle
```
CCC = Days Inventory Outstanding + Days Sales Outstanding − Days Payable Outstanding
CCC negativo = pagas al proveedor DESPUÉS de cobrar al cliente = IDEAL
```

### Product Efficiency (por SKU)
```
SKU ROAS = SKU Revenue / Ad Spend asignado al SKU
SKU Contribution Margin = SKU Revenue − SKU COGS − SKU Shipping − Ad Spend del SKU
```

### Staffing Rule
```
Max Fixed Payroll = Mes de menor revenue del año × 12%
Todo lo demás = flex staffing (freelancers, contractors, agencias, offshore)
```

---

## BENCHMARKS POR ETAPA DE NEGOCIO

### Marca nueva ($0-$1M)
| Métrica | Target |
|---------|--------|
| Canal | Meta solamente + Google Search básico |
| CM % | >15% (está bien ser bajo mientras aprenden) |
| OpEx % | <20% (equipo mínimo) |
| Focus | Product-market fit, encontrar el hero SKU |

### Marca en crecimiento ($1M-$10M)
| Métrica | Target |
|---------|--------|
| Canal | Meta heavy + Google |
| CM % | >20% |
| OpEx % | <15% |
| Focus | Escalar Meta, encontrar los 4 peaks, product expansion |

### Marca establecida ($10M-$100M)
| Métrica | Target |
|---------|--------|
| Canales | Meta + Google + Amazon + YouTube + TikTok Shops |
| CM % | >25% |
| OpEx % | <12% |
| Focus | Channel expansion, incrementality testing, product portfolio, retail |

---

## BENCHMARK DE SHIPPING

| Producto | Value-to-Weight Ratio | Shipping % Revenue |
|----------|----------------------|-------------------|
| Joyería, perfume | Excelente | <5% |
| Ropa (pequeña, ligera) | Buena | 8-12% |
| Ropa (abrigos, bulky) | Media | 12-18% |
| Hard goods (coolers, muebles) | Mala | 15-25%+ |
| Dosmicos (ruanas, sleeping bags) | Media-Buena | Target: <10% |

---

## ÁRBOL DE DIAGNÓSTICO

### Contribution Margin bajo — ¿Dónde está el problema?

```
CM bajo
├── Cost of Delivery alto (>40%)
│   ├── Product Cost alto → Negociar con proveedor, buscar alternativas
│   ├── Shipping Cost alto → ¿Cobrando shipping? ¿Value-to-weight malo? ¿3PL caro?
│   └── Returns altas → ¿Producto no cumple expectativas? ¿Sizing mal comunicado?
│
├── CAC / Marketing alto (>30% sin buen LTV)
│   ├── AMER degradándose mes a mes
│   │   ├── ¿Más competencia? → Product innovation, nuevas stories, peaks
│   │   ├── ¿Creative fatigue? → Nuevas historias, NO solo iterar hooks
│   │   └── ¿Audiencia saturada? → Expandir targeting, nuevos canales
│   │
│   ├── Ads gastando en SKUs sin stock → Pausar ads, maximizar margin del batch
│   │
│   └── Ads gastando en underperformers → Reasignar a champions y hidden gems
│
├── OpEx alto (>15%)
│   ├── Demasiados FTEs para el revenue → Flex staffing, offshore, AI
│   ├── Software innecesario → Auditar subscripciones
│   └── Oficina cara → ¿Necesaria? Remote work
│
└── Revenue bajo (no hay suficiente volumen)
    ├── ¿Product-market fit? → ¿Se vende orgánicamente?
    ├── ¿Peak calendar vacío? → Crear 4 peaks por año
    ├── ¿Customer file encogiendo? → Priorizar new customer acquisition
    └── ¿Categoría estancada? → Product expansion
```

### ROAS de ads bajo — ¿Es realmente un problema?

```
ROAS bajo en un ad
├── ¿Contribution Margin del negocio está bien?
│   ├── SÍ → El ROAS bajo del ad puede no ser un problema real
│   │   └── ¿El revenue está llegando por otro canal? (Amazon, organic, email)
│   │
│   └── NO → Sí hay un problema. Diagnosticar:
│       ├── CTR alto + Conv baja → Problema de landing page, NO del ad
│       ├── CTR bajo + CPM normal → Problema de creative
│       ├── CPM alto → Audiencia saturada o demasiada competencia
│       ├── Hook Rate bajo → Primeros 3 segundos del video no atrapan
│       └── ATC alto + Compras bajas → Problema de checkout (shipping, payment)
```

---

## CALENDARIO DE PEAKS — TEMPLATE PARA DOSMICOS

### Estructura de un peak:

**6-8 semanas antes:**
- Definir el concepto y la historia
- Preparar el producto (¿hay edición limitada? ¿bundle? ¿producto nuevo?)
- Asegurar inventario

**4 semanas antes:**
- Briefing de creativos
- Producción de contenido (UGC, video, carruseles)
- Preparar email/SMS sequences

**2 semanas antes:**
- Early access campaign (lead gen, email capture)
- Teaser en orgánico
- Configurar ads

**Semana del peak:**
- Launch
- Múltiples touchpoints: ads + email + SMS + organic + influencer
- Monitorear diariamente vs expectation
- Optimizar en tiempo real

**Post-peak:**
- Medir: Revenue, CM, New Customers, Peak Multiplier
- Registrar como marketing event
- ¿Qué funcionó? ¿Qué no? → Input para el próximo peak

---

## INVENTORY-MEDIA DECISION MATRIX

| Días de inventario | Media strategy |
|-------------------|----------------|
| >120 días | 🔴 LIQUIDAR: funnel especial, descuento agresivo, liquidador |
| 90-120 días | 🟡 DESCUENTO: bajar precio, ads a ROAS 0.8-1.0 |
| 60-90 días | 🟡 MONITOREAR: ¿está vendiendo? Si no, planificar liquidación |
| 30-60 días | 🟢 NORMAL: correr ads al target normal |
| <30 días (y reorder toma >30) | ⚠️ PROTEGER: subir ROAS target o pausar ads |
| <15 días (y reorder toma >30) | 🔴 PAUSAR ADS: vender orgánicamente a full margin |

---

## SPEND & AMER CURVE — CÓMO INTERPRETAR

```
AMER (eje Y)
  ^
4x│ *
  │   *
3x│      *
  │         *
2x│            *  *
  │                  *  *
1x│                        *  *  *
  │
  └──────────────────────────────── Spend (eje X)
```

- Cada punto es un mes
- A más spend → menos eficiencia (curva descendente)
- La pendiente de la curva varía por marca y temporada
- **El punto óptimo:** donde el área bajo la curva (total CM) se maximiza
- Si la curva es muy empinada → el mercado tiene mucha competencia
- Si la curva es relativamente plana → hay espacio para escalar
