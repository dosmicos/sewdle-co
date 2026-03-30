---
name: prophit-system-dosmicos
description: Framework de Taylor Holiday (Common Thread Collective) para análisis financiero y de marketing de e-commerce. Usar SIEMPRE que se analicen métricas de Dosmicos, se hagan reportes de ads, se evalúe performance, se planifique forecasting, se analice inventario, se evalúen creativos, o se tomen decisiones de inversión en media. Aplica la jerarquía de métricas donde Contribution Margin es #1 y Channel ROAS es último.
---

# Prophit System — Framework de Análisis para Dosmicos

## Fuente
Taylor Holiday, fundador de Common Thread Collective (CTC). Ha gestionado más de $3 billones en revenue para marcas DTC. Su sistema se llama el Prophit System y está diseñado para generar crecimiento predecible y rentable en e-commerce.

## Contexto de Dosmicos
Dosmicos es una marca colombiana de ropa térmica infantil (ruanas, sleeping bags, ponchos, chaquetas, kits) que vende a mamás de niños 0-8 años. Opera 100% digital en Colombia y USA a través de dosmicos.co, dosmicos.com, Instagram, TikTok, y potencialmente Amazon.

---

## PRINCIPIO CENTRAL

> "Queremos generar crecimiento predecible y rentable. E-commerce es un negocio donde si quieres ganar plata, depende de comprar inventario con la expectativa de venderlo en un período fijo. Esa predictibilidad es lo que pone dinero en tu bolsillo. Si te equivocas en las estimaciones de inventario, no puedes producir dinero en la cuenta bancaria."

El sistema conecta tres áreas que normalmente están en silos: **Finance + Marketing + Operations**. La mayoría de marcas e-commerce las manejan por separado. El Prophit System las une.

---

## 1. JERARQUÍA DE MÉTRICAS

Las métricas tienen un orden de importancia estricto. Lo que está arriba gobierna las decisiones. Lo que está abajo es contexto de soporte. La mayoría de marcas cometen el error de gobernar su negocio desde la capa más baja (Facebook ROAS).

### Pirámide (de más a menos importante):

```
    ┌─────────────────┐
    │   CASH FLOW      │  ← CEO. 13-week cash flow forecast.
    │   (efectivo)     │     Primer tab del browser del CEO.
    ├─────────────────┤
    │  CONTRIBUTION    │  ← SCOREBOARD DIARIO para todo el equipo.
    │  MARGIN          │     La métrica #1 que todos deben ver.
    ├─────────────────┤
    │  BUSINESS        │  ← Revenue, Spend, MER, AOV.
    │  METRICS         │     Importan pero subordinadas al CM.
    ├─────────────────┤
    │  CUSTOMER        │  ← New vs Returning, Active File.
    │  METRICS         │     LA MÁS DESCUIDADA Y PELIGROSA.
    ├─────────────────┤
    │  CHANNEL         │  ← Facebook ROAS, Google ROAS, etc.
    │  METRICS         │     LA MENOS IMPORTANTE. Solo contexto.
    └─────────────────┘
```

### Regla de transparencia:
> "Si quieres que la gente en tu empresa afecte lo que más te importa, muéstrales esa métrica. No puedes pedirle a la gente que afecte cosas que no están mirando."

Toda la organización debería ver el Contribution Margin diariamente. Channel ROAS (Facebook ROAS, Triple Whale ROAS, etc.) NO debería gobernar el comportamiento de la organización porque es una métrica proxy que no correlaciona fuertemente con cash flow en la mayoría de los casos.

> "Veo fundadores atrapados en la parte más baja de la pirámide, obsesionados con Facebook ROAS, Google ROAS, sin realmente manejar hacia lo que les importa: el valor de la empresa, su obligación con los accionistas, su capacidad de distribuir capital."

---

## 2. CONTRIBUTION MARGIN (La Métrica #1)

### Fórmula:
```
CONTRIBUTION MARGIN = Net Sales − Product Cost − Variable Expenses − Ad Spend
```

### Por qué es la #1:
- Es el proxy diario más cercano al cash flow
- Cash flow tiene decisiones humanas (cuándo pagas facturas), así que no se puede trackear al día con precisión
- Contribution Margin sí se puede calcular diariamente
- Si CM es positivo en cada dólar marginal de ad spend → la señal es GASTAR MÁS
- Contribution Margin − OpEx = Profit

### TRAMPA CRÍTICA: No mezclar costos fijos en el análisis diario

> "Imaginemos que tengo un arriendo de oficina de $30,000/mes. Entonces pongo $1,000/día en mi estimación. Si genero $900 de contribution margin antes de ese costo fijo y le resto los $1,000, la señal me dice que tengo rentabilidad negativa. Lo que encuentro es que eso tiende a ser una señal para la gente de que necesitan cortar costos. Pero la realidad es que los costos fijos como porcentaje del revenue BAJAN a medida que el volumen SUBE. Frecuentemente la solución, asumiendo que estás generando contribution margin incremental positivo en tu media, es AUMENTAR el gasto. Pero el costo fijo crea una contra-señal que da la ilusión de pérdida."

**Regla:** Cuando defines tu meta de Contribution Margin, debe tener relación con tus costos fijos (CM − OpEx = Profit). Pero día a día, NO metas costos fijos en la vista porque crea señales falsas de "estamos perdiendo plata" cuando realmente la solución es gastar más, no menos.

### TRAMPA CRÍTICA: Returns de Shopify

> "Shopify reporta revenue por defecto en el dashboard bajo 'Total Sales'. Total Sales son el revenue de hoy MENOS las devoluciones de hoy. En enero, para la mayoría de negocios, diciembre fue grande, enero es pequeño. Muchas devoluciones de diciembre se procesan en enero. Entonces Total Sales en enero se ve terrible. Si miro mi MER diario incluyendo esas devoluciones, de repente pienso 'estamos siendo ineficientes, hay que cortar', pero realmente solo tienes un porcentaje más alto de returns apareciendo en ese P&L."

**Solución: Returns Accrual**
- NO usar las devoluciones procesadas hoy (son de pedidos viejos)
- Usar una estimación: si tu tasa de retorno es 10% y hiciste $1M en diciembre → accruar $3,333/día de returns durante diciembre
- Reconciliar al final del mes
- NUNCA dejar que returns lagged creen una señal falsa de ineficiencia

> "Shopify, si están escuchando, por favor actualicen de Total Sales a Order Revenue y saquen esto de la vista de la gente, porque es uno de los problemas más grandes que enfrentamos."

---

## 3. FOUR QUARTER ACCOUNTING

### Concepto:
Cualquier P&L se puede dividir en 4 categorías simples. Esto permite al CEO entender de un vistazo dónde se va la plata.

### Los 4 cuartos:

**1. Cost of Delivery (COGS + Shipping + Variables)**
- Target ideal: 25% (pero realista en e-commerce: 30-40%)
- Dos componentes principales:
  - **Product Cost:** típicamente 10-20% del revenue
  - **Shipping Cost:** debería ser máximo 10% del revenue
    - Si shipping es 20-30% del revenue → algo está mal
    - O no estás cobrando suficiente o tu 3PL te está destruyendo
    - Considerar la relación valor-peso del producto
    - Trackear "Net Shipping Cost" = Shipping Revenue − Shipping Cost
    - Meta: break-even o positivo en shipping
- Gross margin promedio en e-commerce: ~42% (58% COGS)

**2. CAC / Marketing (puro gasto en medios)**
- SOLO media spend variable (Meta, Google, TikTok, etc.)
- NO incluir salarios de marketing ni agencias (eso va en OpEx)
- Si creative es gasto variable → incluir aquí. Si es fijo → OpEx.
- Target depende del modelo de negocio:
  - **Alto LTV (consumibles, repurchase):** 20-25% — porque returning customers generan revenue futuro sin costo de adquisición
  - **Bajo LTV (hard goods, compra única):** 40-50% — porque cada mes tienes que re-adquirir
  - **Con el tiempo:** si tienes buen LTV y mantienes new customer acquisition constante, marketing como % del revenue BAJA año a año porque más revenue viene de returning customers

> "El resultado mediano en Meta para adquisición de nuevo cliente en todo mi portafolio es como un 1.7x ROAS. Eso significa que el costo promedio de adquisición es como 55-60% del revenue."

**3. OpEx (costos fijos)**
- Salarios, software, oficina, todo lo fijo
- Target: 10-15% del revenue
- La tendencia es que esto BAJE cada año por AI y eficiencia
- **Benchmark actual de e-commerce excelente: 10-12%**

> "E-commerce no es un juego de muchos empleados de tiempo completo, oficinas grandes. Eso es lo que todos pensamos en COVID pero no es así. Es cuánta palanca puedes sacar de un equipo muy pequeño."

**Regla de staffing:**
> "La base de tu fuerza laboral de tiempo completo debería estar al 12% de tu MES DE MENOR REVENUE del año. Todo lo que esté por encima de eso debería ser staffing flexible."

**4. Profit (lo que queda)**
- Target: 15-25%
- Si logras 25%, estás matándola

### Escenario ideal: 25% / 25% / 25% / 25%
### Realidad e-commerce: ~35-40% COGS / 25-30% Marketing / 10-15% OpEx / 15-20% Profit

### Cómo usar:
> "Pídele a tu contador que te arme un chart de Four Quarter Accounting. Solo muéstrame esas 4 categorías cada mes. No necesito ver cada línea individual. Es muy confuso. Muéstrame mi costo total de delivery, mi opex total, mi CAC total, y mi profit total. Y mira dónde se está yendo mi profit — cuál de estos puedo atacar para crear palanca."

---

## 4. CUSTOMER METRICS (La Capa Más Descuidada)

### Revenue Layer Cake:
```
Total Revenue = New Customer Revenue + Existing Customer Revenue
```

Estos son los dos bloques fundamentales del forecast. Cada uno se modela por separado.

### Active Customer File:
- La mayoría de marcas asumen que su archivo de clientes crece infinitamente
- FALSO: la mayoría de tus clientes han lapsed y nunca van a volver
- **80% de los clientes que van a re-comprar lo hacen en los primeros 6-8 meses**
- Después de eso → churned/lapsed
- El Active Customer File = clientes que han comprado en los últimos 6-8 meses

> "Cuando ese archivo se encoge, lo que significa es que tu revenue de returning customers en el futuro va a encogerse también. Tienes que estar creciendo el número de clientes activos todo el tiempo para que el negocio mantenga crecimiento futuro."

### Métrica clave: AMER (Acquisition Marketing Efficiency Ratio)
```
AMER = New Customer Revenue / Ad Spend
```

- Es la eficiencia de tu inversión en adquirir clientes NUEVOS
- La relación entre spend y AMER sigue una curva: a más spend, menos eficiencia
- La pregunta es la pendiente de esa curva
- Modelar con regresión lineal + efecto estacional + consideración de AOV

### Errores comunes:
1. **Exprimir la esponja:** Sacar todo el revenue de la base existente sin adquirir nuevos → el negocio muere en 12-18 meses
2. **Ignorar NC-ROAS bajo vs ROAS general alto:** Si tu ROAS general se ve bien pero el NC-ROAS está mal → estás re-comprando clientes existentes, no adquiriendo nuevos
3. **No tener metas de new customer acquisition:** Siempre tener un target de cuántos clientes nuevos por mes

---

## 5. CHANNEL METRICS (La Menos Importante)

### Posición en la jerarquía:
> "Channel level metrics — esto es Facebook ROAS, Triple Whale ROAS, tu número de MTA. Esto gobierna la mayoría de las organizaciones. Es donde fuerzan a la mayoría de la gente a mirar. Es una métrica proxy. No está correlacionada fuertemente con cash flow en la mayoría de los casos."

### Sobre herramientas de atribución (Triple Whale, Northbeam, etc.):
> "No importa qué modelo de atribución uses, la asignación real de tus dólares ocurre basándose en el sistema de Meta, en esa vista de atribución. Eso es con lo que realmente te quieres quedar."

### Recomendación práctica:
1. Usa la data reportada por Meta (7-day click) como tu fuente principal
2. Corre incrementality studies (geo holdouts) para encontrar el efecto causal real
3. Si Meta reporta un ROAS de 1.0 y tu incrementality study dice 1.2 → crea un "factor" multiplicador
4. Mide la plataforma con ese ajuste
5. Asegúrate de que el setting de optimización de Meta coincide con lo que estás midiendo

### Cuándo hacer incrementality tests:
- Cuando expandes a un canal nuevo (YouTube, TikTok, AppLovin)
- Cuando tu media mix se diversifica más allá de Meta solo
- **Si estás solo en Meta:** exporta tu 7-day click ROAS y tu AMER diariamente, haz CORREL() en un spreadsheet → debe ser 0.78+ de correlación

---

## 6. DAILY FORECASTING (Ejecución)

> "Soy un enorme proponente de tener una expectativa diaria de todo lo que estás haciendo. No por el sake de tener razón, sino para entender dónde estás equivocado."

### Por qué diario:
- Si sabes en el día 5 que vas atrasado, tienes muchos más días para corregir que si lo descubres en el día 22
- Fuerza al equipo a evaluar qué creen que va a pasar con cada acción que proponen
- "¿Por qué debemos mandar este email un martes? ¿Qué crees que va a pasar?"

### Dos ritmos simultáneos:
> "Somebody needs to be planning the moment in June — the big thing that's coming. And somebody needs to worry about tomorrow. They can't be the same person."

1. **Ritmo diario:** ejecución, optimización, ajustes tácticos → la tarea de Cowork cada mañana
2. **Ritmo de planificación:** el peak del próximo trimestre, la próxima historia grande, el producto nuevo → trabajo humano estratégico

---

## 7. MARKETING CALENDAR & EVENT EFFECT MODEL

### Concepto central:
> "El forecast financiero de la organización en un negocio de producto de consumo debería salir del departamento de marketing. Porque imagina que en enero pasado lanzamos un producto nuevo. Si yo soy el departamento de finanzas, sin el calendario de marketing, y voy a construir un plan financiero, digo 'oh, enero fue increíble'. Pero luego miro el calendario de marketing y ¿sabes qué no está ahí? Ese lanzamiento de producto. La acción que creó esa realidad ya no existe."

### Unidades de crecimiento:
Cada acción de marketing es una "unidad de crecimiento":
- Lanzar un ad
- Enviar un email / SMS
- Publicar en orgánico
- Colaboración con influencer
- Lanzamiento de producto
- Promoción / sale
- PR hit
- Cambio en el website

### Qué registrar:
Para cada evento, registrar:
- Fecha
- Tipo de evento
- Descripción
- Impacto esperado
- Impacto real en revenue (después)
- Impacto en eficiencia de media
- Impacto en existing customer revenue
- Impacto en organic demand

### Patrones de revenue existente:
> "En la mayoría de negocios, email y SMS son un trigger para mover revenue de clientes existentes. Si miro mi calendario durante la semana, el revenue de existing customers sube en los días que envío email y SMS."

---

## 8. PROGRESSIVE PEAKING (4 Peaks por Año)

### Por qué los peaks son tan importantes:

> "Piensa en Meta. Cada día la realidad en Meta es que somos market takers. Hay un precio para el inventario que nosotros no fijamos. Es una dinámica de oferta y demanda. Yo no puedo fijar el precio del mercado. Llego cada día con mis dólares y le digo 'aquí Meta' y me dan el CPM que esté asignado a ese ad en ese momento."

> "Mi capacidad de crear arbitraje es basada en el precio que pago y la tasa de conversión sobre ese precio. CTR × Conversion Rate = valor que capturo."

### La mecánica del peak:
- **Black Friday:** el CPM SUBE porque todos están gastando más → pero tu conversion rate también sube → no ganas nada único relativo a tu competencia
- **Peak que TÚ creas en mayo, abril, junio:** el CPM del mercado se mantiene CONSTANTE → pero TU conversion rate sube → **arbitraje puro**

> "Cuando yo creo un peak en el medio de mayo, en abril, en junio, cuando nadie más tiene un peak, el precio del mercado de ad inventory se mantiene constante. Mi conversion rate sube. Así es como creas momentos donde puedes elegir capturar más valor marginal para ti o aumentar el volumen sustancialmente porque has creado arbitraje contra el precio del mercado."

### La pregunta que siempre debes hacer:
> "¿Por qué alguien necesita comprar esto HOY? No por qué necesita comprarlo. ¿Por qué necesita comprarlo HOY? Y entre más puedas responder esa pregunta, más palanca vas a crear contra ese mercado."

### Estructura: 4 peaks, 1 por trimestre
Esto balancea el cash flow y mantiene un ritmo consistente.

### Ejemplos del masterclass:

**APL (zapatos):**
- Peaks naturales: Black Friday + Mother's Day
- Peak creado: International Women's Day en marzo
- Contaron historias de clientas increíbles, destacaron influencers, celebraron mujeres
- Ahora es un peak anual del calendario de la marca

**Born Primitive (fitness apparel):**
- Problema: leggings pegan en invierno, mueren en verano
- Solución: footwear para verano + D-Day 75th Anniversary
- Sponsorearon veteranos viajando a Normandía
- Edición limitada: 500 unidades, alto price point, drop de 3 días
- Esos 3 días fueron los más grandes de todo su calendario
- Siguiente: Veterans Day → pagaron $10M en deuda médica de veteranos
- Fox & Friends los cubrió múltiples veces
- 3 semanas después: Black Friday más grande de su historia
- Porque adquirieron un montón de clientes nuevos en noviembre que convirtieron en Black Friday

### Amplificación progresiva:
> "Los peaks se convierten en una amplificación progresiva del negocio en total. Si puedes crear un momento grande de adquisición de nuevos clientes en octubre o noviembre, ese grupo va a sobre-performar para ti en esos momentos de peak de realización de valor."

### Para Dosmicos, los peaks podrían ser:
- **Q1:** Hot Days (marzo) ✓ ya existe
- **Q2:** Día de la Madre (mayo) — peak natural para ropa de bebé
- **Q3:** Temporada de frío / Back to School (julio-agosto)
- **Q4:** Black Friday / Navidad (noviembre-diciembre)

---

## 9. PRODUCT-LED GROWTH

### El problema:
> "Si estás en un negocio con una categoría de producto donde toda la competencia ya entró y estás gritándole a tu equipo de Meta 'haz la eficiencia mejor, haz más creativo, resuelve el problema con el ad creative', probablemente les estás pidiendo que logren algo que el mercado ha eliminado."

### La solución: Product expansion
> "A veces lo que tienes que reconocer es que este negocio puede ser un negocio de $10M al año y que el crecimiento no va a venir de llevar eso de 10 a 12 o 12 a 15. Es ir: leggings son 10, ¿qué más puedo agregar que sea 5? ¿Cómo me meto en zapatos? ¿En swimwear?"

### Product MVP Matrix:
Para cada producto, evaluar en 3 dimensiones:
1. **Margin:** ¿Mejora mi perfil de gross margin?
2. **Volume:** ¿Hay velocidad de ventas y tendencia de categoría creciente?
3. **Popularity:** ¿Qué tan eficientemente puedo desplegar media para venderlo?

### 4 categorías de productos:

**🏆 Champions** — Alto volumen + Alta eficiencia
- Son los hero SKUs. Proteger.
- Si se acerca el stock-out → SUBIR eficiencia target o PAUSAR ads
- "Lo peor que puedes hacer es pagar un alto CAC para mover inventario que está por quedarse sin stock"

**📈 Growth Drivers** — Eficiencia creciente + Volumen creciendo
- Oportunidad de escalar. Hacer un bet desproporcionado.
- "Hemos visto una tendencia, pero solo hemos ido 10% cada mes. Este mes vamos a hacer un 50% de crecimiento porque hay señales de que hay más oportunidad."

**💎 Hidden Gems** — Buen revenue + Poco ad spend
- "Estoy vendiendo $30,000 al mes de sports bras y solo gasté $1,000. ¿Qué pasa si aumento la inversión?"
- Oportunidad subestimada.

**⚠️ Underperformers** — Alto gasto + Bajo retorno
- Candidatos a liquidación o repricing
- Crear funnel de liquidación: unlisted PDP + ads a baja eficiencia + excluir existing customers

### Qué problema resuelve tu producto nuevo:
> "Cuando vas a hacer product development, hay una pregunta real: ¿qué problema estoy tratando de resolver? ¿Tengo un problema de IBIDA? ¿Un problema de crecimiento? ¿Un problema de cash flow?"

- **Problema de cash flow:** necesito un producto de verano si mis ventas pegan en invierno (suavizar la curva de revenue)
- **Problema de volumen:** necesito entrar en una categoría que está creciendo rápido
- **Problema de margen:** necesito un producto con mejor margin para poder ser más agresivo en marketing

### Dynamic Pricing por SKU:
> "Nike y Comfort venden el mismo zapato a diferente precio dependiendo del color porque la demanda no es la misma. El bright pink cuesta menos que el negro porque la demanda no es igual."

- Si un color/talla se agota mucho antes que los demás → había un mismatch de precio y demanda
- Cuando se agota un SKU popular, la conversion rate del ad se desploma → Meta mata el ad
- "Meta no trackea tu inventario. No entiende que cuando el inventario se repone, debería volver a gastar en ese ad."
- Usar herramientas como Intelligems para price testing

---

## 10. INVENTORY-INFORMED MEDIA

### Principio:
Cada PO (Purchase Order) es un batch. Tu trabajo es maximizar el valor marginal de cada batch de inventario.

### Regla de inventario bajo:
Si un SKU tiene pocos días de inventario y toma X días reordenar:
- Si días_inventario < días_para_reordenar → SUBIR eficiencia target significativamente O PAUSAR ads
- Dejar que se venda orgánicamente a full margin
- NO pagar CAC alto para agotar inventario que no puedes reponer

### Regla de inventario viejo (Aged Inventory):
Clasificar inventario en 4 grados:
- **A Grade:** < 30 días outstanding → Saludable
- **B Grade:** 30-60 días → Monitorear
- **C Grade:** 60-90 días → Planificar liquidación
- **D Grade:** > 90 días → Liquidar AHORA

> "Nada es peor que pagar una tarifa de almacenamiento por poner en estantes inventario que no tienes plan de vender. No hay ads corriendo. No hay emails planeados. Solo está ahí y le pagas a alguien por guardarlo. Eso es literalmente tu cash como founder sentado en un estante sin plan de venderse."

### Tácticas de liquidación:
1. **Funnel de liquidación:** PDP unlisted (no aparece en el website), correr ads a eficiencia baja (ROAS 0.8-1.0), excluir existing customers
2. **Descuento agresivo:** la cantidad de descuento debe ser proporcional a los días de inventario outstanding
3. **Liquidadores profesionales:** tener relación con empresas de liquidación
4. **Narrativa:** si no afecta la marca, crear una historia alrededor ("sale de fin de temporada")

### Reunión semanal obligatoria:
> "Si eres un negocio de apparel deberías tener una reunión de inventario con tu media buyer cada semana. Deberías estar mirando cuántos días de inventario hay en los mejores SKUs. ¿Dónde están yendo mis ads? ¿En qué estoy gastando?"

---

## 11. CONSTRAINT AS SUPERPOWER

> "No capitular a la eficiencia de adquisición. Es muy difícil tener a tu equipo de marketing viniendo a decirte 'no creo que podamos hacer esto, este target no funciona'. Y founders y CFOs frecuentemente no saben. Piensan que son razonables. Y dicen 'ok, podemos bajar el estándar'. NO. No bajes el estándar. Resuelve el problema."

### Lo que NO hacer:
- Bajar el ROAS target cuando el equipo dice "no podemos"
- Bajar el CPA target
- Aceptar "la macro economía está difícil" como excusa
- Aceptar "los CPMs subieron" como excusa

### Lo que SÍ hacer:
- Forzar al equipo a resolver el problema de otra forma
- El constraint desbloquea creatividad: mejor storytelling, mejores peaks, product innovation, channel expansion
- Si alguien decide internamente que no puede → quizás necesitas a alguien más que lo intente

> "60% de los dólares de media gastados nunca fueron rentables. Nunca pagaron de vuelta en ningún período de tiempo. Eso es falta de constraint."

---

## 12. STORY, NOT ITERATION

> "Nuestra industria ha colapsado alrededor de la peor idea de estrategia creativa de la historia, que es iteración. Hacer un ad, mirar los resultados, crear un cambio, iterar, iterar, iterar, iterar. Lo que estás haciendo es optimizar para el máximo local — un rango muy estrecho de cambio potencial. Cambios pequeños = cambio pequeño en resultado."

### El problema con iteración:
- La mayoría del workflow creativo es: hacer ads → analizar datos (mal) → hacer un cambio → intentar de nuevo → repetir
- Esto optimiza un máximo local
- Nunca va a producir un resultado más grande que cualquier cosa que hayas hecho antes

### La alternativa: Historias que importen
- Inversión en crear stories que rompan el modelo
- Desasociarse del máximo local
- Generar un retorno mayor que cualquier cosa anterior
- No dice que no se puede iterar, pero la mayoría del esfuerzo debe ir a stories, no a hooks

### "Crea para la audiencia de tu audiencia":
> "No estoy creando solo para el espectador final. Quiero darles algo que puedan decir sobre sí mismos al mundo. Quiero darles un contenido que quieran mostrar a sus amigos, que los haga cool en el group chat."

- ¿Qué contenido haría que mi cliente quiera compartirlo en DMs?
- ¿Qué haría que una mamá quiera repostearlo en sus stories?
- ¿Cómo hago que mi cliente sea un héroe en su mundo?

### Formato de ad — Image vs Video:
> "Odio esa pregunta. Puedes tener un gran ad de imagen y un gran ad de video. Los formatos en sí mismos son irrelevantes. Tu trabajo es entregar la comunicación como sea necesario."

La pregunta correcta: **"¿Qué es todo lo que alguien necesita saber para hacer una compra?"**
- Si necesitan saber muchas cosas (ej: impresora 3D) → el funnel entero debe cubrir esas preguntas
- Si es un ad de imagen estática → tu landing page tiene que ser increíble
- Si es un video largo que responde todo → puedes llevarlos directo a checkout
- Para productos simples → imagen estática puede ser altamente efectiva

### Sobre replicar formatos:
> "Tu replicación de una idea que funciona es la degradación de su valor. Quieres encontrar lo que nadie más está haciendo. La vaca morada. Si te encuentras como un creative shop que trata de replicar la performance de otros, tu yield siempre va a ser subordinado."

### Sobre AI creative:
> "Permitir que la AI trabaje independientemente de las personas fue lo que más performó en el estudio. Tenemos nociones preconcebidas sobre qué va a funcionar. Tenemos sesgos. Tenemos miedos. La AI no tiene esa limitación si le permites optimizar para un resultado específico."

---

## 13. CHANNEL STRATEGY 2026

### Para marcas sub $10M:
- Quédate en Meta. No necesitas ir más allá.
- Sprinkle de Google Search básico.
- Ir muy duro en Meta.

### Para marcas $10M-$100M:
El playbook 2026:

1. **Meta** — Motor principal de demanda. 85%+ del spend para la mayoría.
2. **Google** — #2. Branded search es un tax, no creación de demanda.
3. **Amazon** — 40-50% de TODO e-commerce ocurre en Amazon. Expandir distribución.
4. **AppLovin** — #3-4 en share of wallet. Ads unskippables en mobile gaming. 3-5% del budget.
5. **YouTube** — Cada dólar en YouTube genera valor igual en Amazon como en .com.
6. **TikTok Shops** — Red de afiliados. Correr neutral o leve pérdida. Flywheel de atención.
7. **CTV** — Poderoso cuando tienes distribución amplia (web + Amazon + retail). Difícil si eres solo .com.

### Regla crítica de medición:
> "No puedes expandir distribución y continuar midiendo tu media exclusivamente en .com. Si expandiste a Amazon y tu media se mide solo en .com, tu eficiencia va a parecer que cae y vas a cortar el gasto y vas a ahogar todo el motor."

### Sobre Amazon Ads:
> "Amazon ads son un tax. No son creación de demanda. Son una defensa contra que otros overtaken el SERP. Es la capacidad de Amazon de sacar tu demanda. Es un finger en el hole que mantiene tu funnel tight pero no crea nueva demanda."

---

## 14. CASH FLOW ERA

### Tres eras del e-commerce:
1. **COVID era (2020-2021):** Abundancia. Capital gratis. Aprendimos a CRECER. Desplegar capital rápido.
2. **Austerity era (2022-2023):** Capital desapareció. iOS 14. Aprendimos FINANZAS. Contribution margin. Forecast.
3. **Cash Flow era (2024-2026):** Fusión de skills. Channel distribution. Product development. Cash conversion cycle.

### Vendor as Lender:
> "Necesitas entender el costo de capital en tu ecosistema. Tu proveedor en China probablemente tiene acceso a capital más barato que tú gracias a subsidios gubernamentales de manufactura. Si les dices 'te pago 2 puntos más en mi gross margin pero necesito mejores terms', para ellos ese cálculo puede tener sentido."

**Tácticas:**
- Negociar net terms más largos con proveedores (30→60→90→120 días)
- Ideal: pagar al proveedor con dinero del cliente (negative cash conversion cycle)
- Consignment: el proveedor te da el inventario y le pagas cuando vendes
- Pre-orders: si no puedes conseguir net terms, pide al cliente que pague por adelantado
- Negociar terms con TODOS: Meta, agencias, 3PLs, software, etc.

### Cash Conversion Cycle ideal:
```
Si toma 90 días manufacturar tu producto
Y tienes terms de 120 días
= Recibes el producto, lo vendes, y pagas con el dinero del cliente
= Negative Cash Conversion Cycle = 🏆
```

---

## 15. BENCHMARKS RÁPIDOS

| Métrica | Excelente | Bueno | Atención | Malo |
|---------|-----------|-------|----------|------|
| Contribution Margin % | >25% | >20% | >15% | <15% |
| Cost of Delivery % | <30% | <35% | <40% | >40% |
| Product Cost % | <15% | <20% | <25% | >25% |
| Shipping Cost % | <8% | <10% | <15% | >15% |
| OpEx % | <10% | <12% | <15% | >20% |
| Profit % | >25% | >20% | >15% | <10% |
| Gross Margin | >65% | >58% | >50% | <42% |
| MER median Meta | ~1.7x | | | |
| Revenue per Employee | >$1M | >$500K | >$250K | <$250K |

---

## REGLAS DE DECISIÓN PARA EL REPORTE DIARIO DE COWORK

### Si Contribution Margin > meta:
→ ¿Hay hidden gems para escalar?
→ ¿El active customer file está creciendo? (no solo exprimir existentes)
→ ¿Hay peaks próximos para preparar?

### Si Contribution Margin < meta:
→ ¿Cuál de los 4 cuartos es el problema?
→ COGS alto → ¿producto de bajo margen vendiendo mucho? ¿shipping destruyendo margin?
→ CAC alto → ¿ads ineficientes? ¿competencia subió? Necesita nueva historia, no iteración
→ OpEx alto → ¿costos fijos que no se justifican?
→ Si CM incremental por dólar de ad spend es positivo → GASTAR MÁS, no menos

### Si Active Customer File encoge:
→ 🔴 ALERTA MÁXIMA
→ Priorizar new customer acquisition
→ El revenue futuro de returning customers va a caer

### Si un SKU se va a quedar sin stock:
→ SUBIR eficiencia target o PAUSAR ads para ese SKU
→ Maximizar el marginal value del batch restante

### Si un SKU tiene >90 días de inventario:
→ Liquidar: funnel especial, descuento, o liquidador externo
→ Convertir ese inventario muerto en cash para comprar inventario bueno

### Si AMER se degrada mes a mes:
→ Probablemente es competencia creciendo, no un problema de ads
→ SOLUCIÓN: product innovation, stories, peaks
→ NO SOLUCIÓN: iterar hooks

### Para planning de peaks:
→ Pregunta: "¿Por qué alguien necesita comprar esto HOY?"
→ Si no puedes responder → no tienes un peak, tienes un día normal
→ Conectar a momentos culturales relevantes para el ICP de Dosmicos
