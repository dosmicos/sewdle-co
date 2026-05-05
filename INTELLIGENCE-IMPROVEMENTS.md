# Ad Intelligence Page — Reporte de Mejoras

> Analisis realizado por: Analista de Producto (UX/UI), Analista de Marketing (Prophit System), Ingeniero Frontend
> Fecha: 2026-03-30

---

## 1. Estado Actual — Que hace bien la pantalla hoy

### Fortalezas

- **Product MVP Matrix integrada**: La clasificacion Champions / Growth Drivers / Hidden Gems / Underperformers es correcta segun el framework Prophit System. Las cards muestran ROAS, Spend, Revenue, Share of Spend y una recomendacion por producto.
- **Performance Rankings multi-dimensional**: Analiza 9 dimensiones (creative_type, sales_angle, product, audience_type, gender, advantage+, country, funnel_stage, offer_type). Esto es mas granular que la mayoria de herramientas.
- **Ad Lifecycle Table**: Muestra status (testing/scaling/mature/declining/inactive), days_active, spend, revenue, ROAS, CPA y days_to_fatigue. Esto permite identificar el ciclo de vida del creative.
- **Sync + Compute workflow**: El flujo "Sync Tags → Compute Intelligence" es claro y permite al usuario controlar cuando se actualizan los datos.
- **Period selector**: Permite cambiar entre 7d y 30d para los patterns.

---

## 2. Gaps vs Prophit System — Que falta segun el framework

### GAP CRITICO: ROAS como metrica principal en lugar de Contribution Margin

La pagina entera gira alrededor de **ROAS** como metrica de exito. Segun Taylor Holiday (Prophit System), esto es un error fundamental:

> "ROAS is a vanity metric. It tells you efficiency but not profitability. A 5x ROAS on a product with 20% margin is worse than a 2x ROAS on a product with 70% margin."

**Lo que falta:**
- **Contribution Margin por Ad/Product**: `Revenue - COGS - Ad Spend = CM`. Hoy no se muestra en ningun lugar.
- **CM% como metrica de ranking**: Los PatternCards ranquean por ROAS. Deberian ranquear por CM o al menos mostrar ambos.
- **MER (Marketing Efficiency Ratio)**: `Total Revenue / Total Ad Spend` a nivel general, no solo por dimension.
- **New Customer Revenue %**: Cuanto del revenue viene de nuevos vs returning customers por cada dimension.

### GAP: Jerarquia de metricas invertida

El Prophit System define esta jerarquia:
1. **Contribution Margin** (north star)
2. **Business Metrics** (AOV, CVR, LTV)
3. **Customer Metrics** (new vs returning, CAC)
4. **Channel Metrics** (ROAS, CPA, CTR)

La pagina actual SOLO muestra metricas de nivel 4 (Channel). No conecta el performance de ads con el impacto en el negocio real.

### GAP: Creative Diversification Score

No hay diagnostico de concentracion de spend. Si el 80% del budget esta en 1 solo creative, el riesgo es alto. Falta:
- **Concentration Index**: % de spend en top 1, top 3, top 5 creatives
- **Alert cuando 1 creative tiene >40% del spend total**
- **Recomendacion de cuantos creatives activos deberia haber** (benchmark: 5-10 activos por ad account)

### GAP: Lifecycle Incompleto

El Ad Lifecycle existe pero le falta:
- **Velocidad de fatiga promedio**: "Tus creatives se fatigan en promedio en X dias"
- **Alerta proactiva**: "3 creatives estan a 5 dias de fatigarse basado en el patron historico"
- **Pipeline de reemplazo**: "Tienes Y creatives en testing, necesitas Z para cubrir los que se estan fatigando"
- **Creative Velocity**: Cuantos creatives nuevos se lanzan por semana vs cuantos se retiran

### GAP: No hay diagnostico del "Spend Allocation Health"

Segun el Prophit System, el gasto debe distribuirse:
- **60-70%** en Champions (high ROAS + high volume)
- **20-30%** en Growth Drivers y testing
- **<10%** en Underperformers

Hoy la pagina no muestra si la distribucion actual esta sana o no.

---

## 3. Problemas UX — Issues de usabilidad y jerarquia de informacion

### P1: Information Hierarchy invertida

Lo primero que ve el usuario al cargar la pagina es:
1. Header + Period selector
2. Product MVP Matrix (bueno)
3. Summary Cards (Best Audience, Best Creative, Rising Stars, Declining)
4. Performance Rankings (9 grids de dimension)
5. Ad Lifecycle Table

**Problema**: Las Summary Cards son demasiado genericas. "Best Audience: lookalike" no es actionable. El media buyer necesita ver primero: "Cuanto gaste, cuanto gane, y que debo hacer HOY."

### P2: Pattern Cards — Ruido sin accion

Las PatternCards muestran ranking por dimension pero:
- No hay **comparacion temporal** (esta semana vs la anterior)
- No hay **indicador de tendencia** (mejorando o empeorando?)
- No hay **accion sugerida** (que hago con esta informacion?)
- 9 cards x 5 items = 45 data points en pantalla. Es **information overload**.

### P3: No hay "Daily Pulse" o resumen ejecutivo

El media buyer necesita ver diariamente:
- Spend de ayer vs presupuesto diario
- ROAS/CM de ayer vs promedio semanal
- Top 3 ads por spend ayer (estan rindiendo?)
- Alertas (creatives fatigandose, spend fuera de rango)

Hoy la pagina es un analisis retrospectivo, no una herramienta diaria.

### P4: La tabla de Lifecycle no tiene filtros ni busqueda

20 ads hardcodeados, sin paginacion, sin filtro por status, sin search. Para una cuenta con 100+ ads activos, esto no escala.

### P5: No hay visualizaciones graficas

Todo es texto y numeros. No hay:
- Scatter plot de ROAS vs Spend (para ver Champions visualmente)
- Line chart de performance over time por creative
- Bar chart de spend allocation por dimension
- Heatmap de performance por dia/hora

### P6: Comparacion con competidores (Motion, Triple Whale, Northbeam)

| Feature | Motion | Triple Whale | Northbeam | Sewdle Intelligence |
|---------|--------|-------------|-----------|---------------------|
| Creative analytics visual | Si (thumbnails) | Si | Si | No |
| Contribution Margin | - | Si | Si | No |
| Creative fatigue detection | Si | - | - | Parcial (days_to_fatigue) |
| Spend pacing | - | Si | Si | No |
| Automated recommendations | Si (AI) | Si | - | No (solo static) |
| Creative thumbnails | Si | Si | Si | No |
| Performance over time chart | Si | Si | Si | No |
| Multi-platform (Meta+Google+TikTok) | Si | Si | Si | Solo Meta |

---

## 4. Mejoras Propuestas (priorizadas P0/P1/P2)

### P0 — Criticas (DEBEN estar)

#### P0-1: Daily Pulse / Executive Summary Section
**Que**: Una seccion hero al tope de la pagina con 4-6 KPIs grandes
**Datos**:
- Total Spend (hoy + periodo)
- Total Revenue (hoy + periodo)
- Blended ROAS (total revenue / total spend)
- Contribution Margin $ (revenue - COGS - spend)
- CM% (CM / Revenue)
- MER (Total Revenue / Total Marketing Spend)

**Donde**: Reemplazar las SummaryCards actuales. Nuevo componente `IntelligencePulse.tsx`
**Por que**: El media buyer abre esta pagina cada manana. Lo primero que necesita es "como estamos?"

#### P0-2: Contribution Margin en toda la pagina
**Que**: Agregar columna CM y CM% a:
- PatternCards (junto a ROAS)
- Lifecycle Table (nueva columna)
- MVP Matrix ProductCards

**Datos necesarios**: Se necesita `cogs_per_unit` o `margin_percentage` por producto. Si no existe, usar un input configurable o estimado.
**Donde**: Modificar `PerformancePattern` interface, `AdLifecycleSummary`, `ProductMVP`
**Por que**: Sin CM, toda decision de escalamiento esta basada en vanity metrics.

#### P0-3: Creative Concentration Alert
**Que**: Badge/alert que muestra:
- "Top creative tiene X% del spend total — ALTO RIESGO" (si >40%)
- "Tienes N creatives activos — necesitas al menos 5-10"

**Donde**: Nuevo componente `CreativeHealthAlert.tsx` arriba de la MVP Matrix
**Por que**: La dependencia de 1 creative es el error #1 de media buyers. Cuando ese creative se fatiga, todo el account cae.

#### P0-4: Trend Indicators en PatternCards
**Que**: Flecha verde/roja + % de cambio vs periodo anterior en cada PatternCard item
**Datos**: Comparar `period_type=7d` actual vs anterior (requiere almacenar historico)
**Donde**: Modificar `PatternCard` component
**Por que**: "Best creative type is VIDEO con 3.2x ROAS" no dice nada sin contexto. "VIDEO 3.2x ROAS (+15% vs semana pasada)" es actionable.

### P1 — Importantes

#### P1-1: Performance Over Time Chart
**Que**: Line chart (Recharts) mostrando ROAS y Spend por dia para los ultimos 7/30 dias
**Bonus**: Poder filtrar por dimension (ver solo "video" vs "image" over time)
**Donde**: Nuevo componente `PerformanceTrendChart.tsx`, insertar despues del Pulse
**Por que**: Las tendencias son mas importantes que los snapshots. Permite detectar fatiga antes de que sea critica.

#### P1-2: Scatter Plot para MVP Matrix
**Que**: Scatter plot interactivo con:
- Eje X: Share of Spend (%)
- Eje Y: ROAS (o CM%)
- Size del punto: Total Revenue
- Color: Classification (Champion=gold, Growth=green, Gem=violet, Under=red)
- Hover tooltip con nombre de producto y metricas

**Donde**: Nuevo componente `MVPScatterPlot.tsx`, como vista alternativa de la MVP Matrix
**Por que**: La matriz en cards es util pero el scatter plot permite ver outliers y clusters instantaneamente. Es el formato clasico de BCG Matrix / Prophit Product Analysis.

#### P1-3: Lifecycle Filters + Search + Pagination
**Que**:
- Tabs o pills para filtrar por status (All / Testing / Scaling / Mature / Declining)
- Search bar para buscar por nombre de ad
- Paginacion (20 per page)
- Sort por cualquier columna (clickeable headers)

**Donde**: Modificar seccion Lifecycle en `AdIntelligencePage.tsx`
**Por que**: Con 100+ ads, la tabla actual es inutilizable.

#### P1-4: Creative Fatigue Pipeline
**Que**: Mini dashboard que muestre:
```
Active Creatives: 12
├── Testing: 4 (avg 3 days)
├── Scaling: 5 (avg 12 days)
├── Mature: 2 (avg 28 days) ← approaching fatigue
└── Declining: 1 (avg 45 days) ← replace NOW

Avg Days to Fatigue: 21 days
Creative Velocity: 2.3 new/week
Pipeline Health: HEALTHY / AT RISK / CRITICAL
```

**Donde**: Nuevo componente `CreativePipeline.tsx`
**Por que**: Permite planificar produccion de creatives proactivamente en vez de reaccionar cuando todo cae.

#### P1-5: Spend Allocation Health Bar
**Que**: Stacked bar horizontal mostrando:
- % spend en Champions (target: 60-70%)
- % spend en Growth Drivers (target: 20-30%)
- % spend en Hidden Gems (target: 5-10%)
- % spend en Underperformers (target: <5%)
- Color verde si esta en rango, amarillo si esta cerca, rojo si esta fuera

**Donde**: Nuevo componente `SpendAllocationBar.tsx`, debajo de MVP Matrix
**Por que**: Responde la pregunta "estoy gastando mi presupuesto correctamente?"

### P2 — Nice-to-have

#### P2-1: Creative Thumbnails en Lifecycle Table
**Que**: Mostrar thumbnail del creative (imagen/video preview) junto al nombre del ad
**Datos necesarios**: URL del creative ya existe en `meta_ad_creatives` table
**Donde**: Columna adicional en Lifecycle table
**Por que**: El media buyer reconoce ads visualmente, no por nombre.

#### P2-2: AI Recommendations Engine
**Que**: Seccion "What to do next" con recomendaciones generadas:
- "Escala [Ad X] — scaling con 3.5x ROAS, solo tiene 5% del spend"
- "Pausa [Ad Y] — declining por 7 dias, ROAS bajo 1.0x"
- "Lanza mas creatives tipo VIDEO — es tu formato con mejor CM"
- "Reduce spend en [Producto Z] — underperformer con -15% CM"

**Donde**: Nuevo componente `AIRecommendations.tsx`
**Por que**: Convierte data en acciones. El diferenciador vs Motion/Triple Whale.

#### P2-3: Heatmap de Performance por Dia/Hora
**Que**: Heatmap mostrando ROAS/CPA por dia de la semana y hora del dia
**Donde**: Nuevo componente `PerformanceHeatmap.tsx`
**Por que**: Permite optimizar dayparting y scheduling de ads.

#### P2-4: Export a PDF/CSV
**Que**: Boton para exportar el Intelligence report como PDF o los datos como CSV
**Donde**: Boton en el header
**Por que**: Los clientes/jefes piden reportes. Hoy hay que hacer screenshots.

#### P2-5: Comparison Mode
**Que**: Poder comparar 2 periodos side by side (esta semana vs anterior, este mes vs anterior)
**Donde**: Selector dual de periodos en el header
**Por que**: "Mejoramos o empeoramos?" es la pregunta mas basica que la pagina no responde hoy.

---

## 5. Mockups en Texto — Wireframes ASCII

### Layout General Propuesto

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✦ Intelligence                    [7d ▾] [30d]    [Sync] [Compute]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Total     │ │Total     │ │Blended   │ │Contrib.  │ │  MER     │ │
│  │Spend     │ │Revenue   │ │ROAS      │ │Margin    │ │          │ │
│  │COP 12.5M │ │COP 38.2M │ │ 3.06x   │ │COP 8.7M │ │  2.1x   │ │
│  │▲ +8% wow │ │▲ +12% wow│ │▲ +0.3x  │ │▲ +15%   │ │▼ -0.1x  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                          DAILY PULSE                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ⚠ CREATIVE HEALTH                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ⚠ Top creative "Video_Promo_March" has 52% of total spend      ││
│  │ ✓ 8 active creatives (healthy: 5-10 recommended)               ││
│  │ ⚠ 2 creatives approaching fatigue (est. 5 days remaining)      ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PERFORMANCE TREND                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │     $                                                    ROAS  ││
│  │  3.5x ─ ─ ─ ─ ─ ╮                                             ││
│  │  3.0x ─ ─ ─╱─ ─ ─ ╲─ ─ ─ ╮                                   ││
│  │  2.5x ─ ╱─ ─ ─ ─ ─ ─ ─ ─ ╲─ ─                               ││
│  │  2.0x ╱─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─                                ││
│  │       Mon  Tue  Wed  Thu  Fri  Sat  Sun                        ││
│  │  [All ▾] [Video] [Image] [Carousel]          ── ROAS ── Spend ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PRODUCT MVP MATRIX        [Cards ▾] [Scatter Plot]                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ 🏆       │ │ 📈       │ │ 💎       │ │ ⚠        │              │
│  │Champions │ │Growth    │ │Hidden    │ │Under-    │              │
│  │  (3)     │ │Drivers(2)│ │Gems (1) │ │perf.(2)  │              │
│  │          │ │          │ │          │ │          │              │
│  │ Product A│ │ Product D│ │ Product F│ │ Product G│              │
│  │ 3.2x CM%│ │ 2.1x CM%│ │ 4.1x CM%│ │ 0.8x CM%│              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│                                                                     │
│  SPEND ALLOCATION HEALTH                                           │
│  ████████████████████████░░░░░░░░░░░░░ ██░ ░░                     │
│  Champions 62%  ✓     GrowthD 25%  ✓   Gems 8%  Under 5%  ✓      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CREATIVE PIPELINE                                                  │
│  ┌───────────┬────────────┬───────────┬──────────────┐             │
│  │ Testing:4 │ Scaling:5  │ Mature:2  │ Declining:1  │             │
│  │ avg 3d    │ avg 12d    │ avg 28d ⚠ │ avg 45d 🔴   │             │
│  └───────────┴────────────┴───────────┴──────────────┘             │
│  Avg Fatigue: 21d │ Velocity: 2.3/wk │ Pipeline: ✓ HEALTHY        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PATTERN RANKINGS (Top dimensions only, collapsible)               │
│  ┌─ Creative Type ─┐ ┌─ Audience Type ──┐ ┌─ Funnel Stage ───┐   │
│  │ #1 Video  3.2x  │ │ #1 Lookalike 2.8x│ │ #1 TOF    2.5x   │   │
│  │    ▲ +15% wow   │ │    ▲ +8% wow     │ │    ▼ -3% wow     │   │
│  │ #2 Image  2.1x  │ │ #2 Interest 2.1x │ │ #2 BOF    3.8x   │   │
│  │    ▼ -5% wow    │ │    ▼ -12% wow    │ │    ▲ +22% wow    │   │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘   │
│  [Show all 9 dimensions ▾]                                         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AD LIFECYCLE   [All] [Testing] [Scaling] [Mature] [Declining]     │
│                                            [Search: ___________]   │
│  ┌─────┬──────────────┬────────┬───────┬────────┬──────┬───────┐  │
│  │Thumb│ Ad Name      │ Status │ Days  │ Spend  │ ROAS │Fatigue│  │
│  ├─────┼──────────────┼────────┼───────┼────────┼──────┼───────┤  │
│  │ 🖼  │ Video_Promo  │SCALING │  12   │COP 2.3M│ 3.2x │  -   │  │
│  │ 🖼  │ Image_Sale   │DECLINING│  45  │COP 1.8M│ 1.1x │ 38d  │  │
│  └─────┴──────────────┴────────┴───────┴────────┴──────┴───────┘  │
│                                          [< 1 2 3 ... 8 >]        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Scatter Plot MVP Matrix (Vista Alternativa)

```
ROAS │
     │
4.0x │                              ● Hidden Gem F
     │                                (small dot, high ROAS)
3.0x │    ● Champion A
     │         (large dot)      ● Champion B
     │                               (large dot)
2.0x │              ● Growth D
     │                    (medium dot)
     │
1.0x │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ breakeven ─ ─ ─ ─ ─ ─ ─
     │        ● Underperformer G
0.5x │              (medium dot, red)
     │
     └────────────────────────────────────────────── Share of Spend %
          5%      15%      25%      35%      45%

● Gold = Champion   ● Green = Growth Driver
● Violet = Hidden Gem   ● Red = Underperformer
Size = Total Revenue
```

---

## 6. Plan de Implementacion

### Fase 1 — Foundation (P0, ~2-3 dias)

| # | Tarea | Archivos | Dependencia |
|---|-------|----------|-------------|
| 1.1 | Crear `IntelligencePulse.tsx` — KPI cards con trend indicators | `src/components/finance-dashboard/IntelligencePulse.tsx` | Necesita query a `ad_metrics_daily` agregado |
| 1.2 | Agregar hook `useIntelligencePulse.ts` — fetch spend/revenue/ROAS agregados con comparacion periodo anterior | `src/hooks/useIntelligencePulse.ts` | Puede usar tablas existentes |
| 1.3 | Crear `CreativeHealthAlert.tsx` — concentration + fatigue alerts | `src/components/finance-dashboard/CreativeHealthAlert.tsx` | Usa datos de `useAdIntelligence` |
| 1.4 | Agregar CM calculado a `PerformancePattern` y `PatternCard` | Modificar `useAdIntelligence.ts`, `AdIntelligencePage.tsx` | Necesita campo `margin_percentage` en producto o config |
| 1.5 | Agregar trend arrows a PatternCards | Modificar `PatternCard` en `AdIntelligencePage.tsx` | Necesita patterns del periodo anterior |
| 1.6 | Reorganizar layout de `AdIntelligencePage.tsx` | `src/pages/AdIntelligencePage.tsx` | Despues de 1.1-1.5 |

### Fase 2 — Visualizaciones (P1, ~2-3 dias)

| # | Tarea | Archivos | Dependencia |
|---|-------|----------|-------------|
| 2.1 | Crear `PerformanceTrendChart.tsx` con Recharts | `src/components/finance-dashboard/PerformanceTrendChart.tsx` | Necesita datos diarios (ya existen en `ad_metrics_daily`) |
| 2.2 | Crear `MVPScatterPlot.tsx` con Recharts ScatterChart | `src/components/finance-dashboard/MVPScatterPlot.tsx` | Usa datos de `useProductMVP` |
| 2.3 | Crear `CreativePipeline.tsx` — mini dashboard de pipeline | `src/components/finance-dashboard/CreativePipeline.tsx` | Usa datos de `useAdIntelligence` lifecycles |
| 2.4 | Crear `SpendAllocationBar.tsx` — stacked bar de allocation | `src/components/finance-dashboard/SpendAllocationBar.tsx` | Usa datos de `useProductMVP` |
| 2.5 | Agregar filtros/search/paginacion a Lifecycle table | Modificar `AdIntelligencePage.tsx` | Independiente |

### Fase 3 — Polish (P2, ~2-3 dias)

| # | Tarea | Archivos | Dependencia |
|---|-------|----------|-------------|
| 3.1 | Creative thumbnails en Lifecycle table | Modificar `AdIntelligencePage.tsx` | Necesita URL de `meta_ad_creatives` |
| 3.2 | AI Recommendations component | `src/components/finance-dashboard/AIRecommendations.tsx` | Requiere edge function nueva |
| 3.3 | Performance Heatmap | `src/components/finance-dashboard/PerformanceHeatmap.tsx` | Necesita datos hourly (no existe aun) |
| 3.4 | Export PDF/CSV | Boton en header + logica de export | Independiente |
| 3.5 | Comparison Mode (dual period) | Modificar header + hooks | Despues de Fase 1 |

### Dependencia de datos / backend

| Dato | Estado | Accion necesaria |
|------|--------|------------------|
| `ad_metrics_daily` (spend, revenue, ROAS por dia) | Existe | Agregar query agregada con comparacion WoW |
| `performance_patterns` (patterns por dimension) | Existe | Agregar almacenamiento de periodo anterior para trends |
| `ad_lifecycle` (status, days, fatigue) | Existe | Agregar calculo de pipeline health y velocidad |
| `margin_percentage` / COGS por producto | NO EXISTE | Agregar campo a tabla de productos o crear config table |
| Creative thumbnail URLs | Existe en `meta_ad_creatives` | Join en query de lifecycle |
| Datos hourly (para heatmap) | NO EXISTE | Fase 3, requiere cambio en sync de Meta |

---

## Resumen Ejecutivo

La pagina de Ad Intelligence tiene buenas bases (MVP Matrix, multi-dimensional patterns, lifecycle tracking) pero tiene 3 problemas criticos:

1. **No hay Contribution Margin** — toda decision se basa en ROAS, una vanity metric
2. **No hay contexto temporal** — snapshots sin tendencias ni comparaciones
3. **No es una herramienta diaria** — falta un "Daily Pulse" que el media buyer abra cada manana

Las mejoras P0 (Daily Pulse, CM, Creative Health, Trend Indicators) transformarian esta pagina de un "nice analytics view" a una **herramienta de decision diaria** alineada con el Prophit System.

La prioridad maxima es agregar Contribution Margin como metrica. Sin esto, escalar ads con buen ROAS pero mal margen es literalmente perder dinero mas rapido.
