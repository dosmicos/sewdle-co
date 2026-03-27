Aplica el framework Prophit System de Taylor Holiday (CTC) para analisis financiero y de marketing de Dosmicos. $ARGUMENTS

# Prophit System — Framework de Analisis para Dosmicos

## Fuente
Taylor Holiday, fundador de Common Thread Collective (CTC). Ha gestionado mas de $3 billones en revenue para marcas DTC. Su sistema se llama el Prophit System y esta disenado para generar crecimiento predecible y rentable en e-commerce.

## Contexto de Dosmicos
Dosmicos es una marca colombiana de ropa termica infantil (ruanas, sleeping bags, ponchos, chaquetas, kits) que vende a mamas de ninos 0-8 anos. Opera 100% digital en Colombia y USA a traves de dosmicos.co, dosmicos.com, Instagram, TikTok, y potencialmente Amazon.

---

## PRINCIPIO CENTRAL

> "Queremos generar crecimiento predecible y rentable. E-commerce es un negocio donde si quieres ganar plata, depende de comprar inventario con la expectativa de venderlo en un periodo fijo. Esa predictibilidad es lo que pone dinero en tu bolsillo. Si te equivocas en las estimaciones de inventario, no puedes producir dinero en la cuenta bancaria."

El sistema conecta tres areas que normalmente estan en silos: **Finance + Marketing + Operations**. La mayoria de marcas e-commerce las manejan por separado. El Prophit System las une.

---

## 1. JERARQUIA DE METRICAS

Las metricas tienen un orden de importancia estricto. Lo que esta arriba gobierna las decisiones. Lo que esta abajo es contexto de soporte. La mayoria de marcas cometen el error de gobernar su negocio desde la capa mas baja (Facebook ROAS).

### Piramide (de mas a menos importante):

```
    +-----------------+
    |   CASH FLOW      |  <- CEO. 13-week cash flow forecast.
    |   (efectivo)     |     Primer tab del browser del CEO.
    +-----------------+
    |  CONTRIBUTION    |  <- SCOREBOARD DIARIO para todo el equipo.
    |  MARGIN          |     La metrica #1 que todos deben ver.
    +-----------------+
    |  BUSINESS        |  <- Revenue, Spend, MER, AOV.
    |  METRICS         |     Importan pero subordinadas al CM.
    +-----------------+
    |  CUSTOMER        |  <- New vs Returning, Active File.
    |  METRICS         |     LA MAS DESCUIDADA Y PELIGROSA.
    +-----------------+
    |  CHANNEL         |  <- Facebook ROAS, Google ROAS, etc.
    |  METRICS         |     LA MENOS IMPORTANTE. Solo contexto.
    +-----------------+
```

### Regla de transparencia:
> "Si quieres que la gente en tu empresa afecte lo que mas te importa, muestrales esa metrica. No puedes pedirle a la gente que afecte cosas que no estan mirando."

Toda la organizacion deberia ver el Contribution Margin diariamente. Channel ROAS (Facebook ROAS, Triple Whale ROAS, etc.) NO deberia gobernar el comportamiento de la organizacion porque es una metrica proxy que no correlaciona fuertemente con cash flow en la mayoria de los casos.

> "Veo fundadores atrapados en la parte mas baja de la piramide, obsesionados con Facebook ROAS, Google ROAS, sin realmente manejar hacia lo que les importa: el valor de la empresa, su obligacion con los accionistas, su capacidad de distribuir capital."

---

## 2. CONTRIBUTION MARGIN (La Metrica #1)

### Formula:
```
CONTRIBUTION MARGIN = Net Sales - Product Cost - Variable Expenses - Ad Spend
```

### Por que es la #1:
- Es el proxy diario mas cercano al cash flow
- Cash flow tiene decisiones humanas (cuando pagas facturas), asi que no se puede trackear al dia con precision
- Contribution Margin si se puede calcular diariamente
- Si CM es positivo en cada dolar marginal de ad spend -> la senal es GASTAR MAS
- Contribution Margin - OpEx = Profit

### TRAMPA CRITICA: No mezclar costos fijos en el analisis diario

> "Imaginemos que tengo un arriendo de oficina de $30,000/mes. Entonces pongo $1,000/dia en mi estimacion. Si genero $900 de contribution margin antes de ese costo fijo y le resto los $1,000, la senal me dice que tengo rentabilidad negativa. Lo que encuentro es que eso tiende a ser una senal para la gente de que necesitan cortar costos. Pero la realidad es que los costos fijos como porcentaje del revenue BAJAN a medida que el volumen SUBE. Frecuentemente la solucion, asumiendo que estas generando contribution margin incremental positivo en tu media, es AUMENTAR el gasto. Pero el costo fijo crea una contra-senal que da la ilusion de perdida."

**Regla:** Cuando defines tu meta de Contribution Margin, debe tener relacion con tus costos fijos (CM - OpEx = Profit). Pero dia a dia, NO metas costos fijos en la vista porque crea senales falsas de "estamos perdiendo plata" cuando realmente la solucion es gastar mas, no menos.

### TRAMPA CRITICA: Returns de Shopify

> "Shopify reporta revenue por defecto en el dashboard bajo 'Total Sales'. Total Sales son el revenue de hoy MENOS las devoluciones de hoy. En enero, para la mayoria de negocios, diciembre fue grande, enero es pequeno. Muchas devoluciones de diciembre se procesan en enero. Entonces Total Sales en enero se ve terrible. Si miro mi MER diario incluyendo esas devoluciones, de repente pienso 'estamos siendo ineficientes, hay que cortar', pero realmente solo tienes un porcentaje mas alto de returns apareciendo en ese P&L."

**Solucion: Returns Accrual**
- NO usar las devoluciones procesadas hoy (son de pedidos viejos)
- Usar una estimacion: si tu tasa de retorno es 10% y hiciste $1M en diciembre -> accruar $3,333/dia de returns durante diciembre
- Reconciliar al final del mes
- NUNCA dejar que returns lagged creen una senal falsa de ineficiencia

> "Shopify, si estan escuchando, por favor actualicen de Total Sales a Order Revenue y saquen esto de la vista de la gente, porque es uno de los problemas mas grandes que enfrentamos."

---

## 3. FOUR QUARTER ACCOUNTING

### Concepto:
Cualquier P&L se puede dividir en 4 categorias simples. Esto permite al CEO entender de un vistazo donde se va la plata.

### Los 4 cuartos:

**1. Cost of Delivery (COGS + Shipping + Variables)**
- Target ideal: 25% (pero realista en e-commerce: 30-40%)
- Dos componentes principales:
  - **Product Cost:** tipicamente 10-20% del revenue
  - **Shipping Cost:** deberia ser maximo 10% del revenue
    - Si shipping es 20-30% del revenue -> algo esta mal
    - O no estas cobrando suficiente o tu 3PL te esta destruyendo
    - Considerar la relacion valor-peso del producto
    - Trackear "Net Shipping Cost" = Shipping Revenue - Shipping Cost
    - Meta: break-even o positivo en shipping
- Gross margin promedio en e-commerce: ~42% (58% COGS)

**2. CAC / Marketing (puro gasto en medios)**
- SOLO media spend variable (Meta, Google, TikTok, etc.)
- NO incluir salarios de marketing ni agencias (eso va en OpEx)
- Si creative es gasto variable -> incluir aqui. Si es fijo -> OpEx.
- Target depende del modelo de negocio:
  - **Alto LTV (consumibles, repurchase):** 20-25% -- porque returning customers generan revenue futuro sin costo de adquisicion
  - **Bajo LTV (hard goods, compra unica):** 40-50% -- porque cada mes tienes que re-adquirir
  - **Con el tiempo:** si tienes buen LTV y mantienes new customer acquisition constante, marketing como % del revenue BAJA ano a ano porque mas revenue viene de returning customers

> "El resultado mediano en Meta para adquisicion de nuevo cliente en todo mi portafolio es como un 1.7x ROAS. Eso significa que el costo promedio de adquisicion es como 55-60% del revenue."

**3. OpEx (costos fijos)**
- Salarios, software, oficina, todo lo fijo
- Target: 10-15% del revenue
- La tendencia es que esto BAJE cada ano por AI y eficiencia
- **Benchmark actual de e-commerce excelente: 10-12%**

> "E-commerce no es un juego de muchos empleados de tiempo completo, oficinas grandes. Eso es lo que todos pensamos en COVID pero no es asi. Es cuanta palanca puedes sacar de un equipo muy pequeno."

**Regla de staffing:**
> "La base de tu fuerza laboral de tiempo completo deberia estar al 12% de tu MES DE MENOR REVENUE del ano. Todo lo que este por encima de eso deberia ser staffing flexible."

**4. Profit (lo que queda)**
- Target: 15-25%
- Si logras 25%, estas matandola

### Escenario ideal: 25% / 25% / 25% / 25%
### Realidad e-commerce: ~35-40% COGS / 25-30% Marketing / 10-15% OpEx / 15-20% Profit

### Como usar:
> "Pidele a tu contador que te arme un chart de Four Quarter Accounting. Solo muestrame esas 4 categorias cada mes. No necesito ver cada linea individual. Es muy confuso. Muestrame mi costo total de delivery, mi opex total, mi CAC total, y mi profit total. Y mira donde se esta yendo mi profit -- cual de estos puedo atacar para crear palanca."

---

## 4. CUSTOMER METRICS (La Capa Mas Descuidada)

### Revenue Layer Cake:
```
Total Revenue = New Customer Revenue + Existing Customer Revenue
```

Estos son los dos bloques fundamentales del forecast. Cada uno se modela por separado.

### Active Customer File:
- La mayoria de marcas asumen que su archivo de clientes crece infinitamente
- FALSO: la mayoria de tus clientes han lapsed y nunca van a volver
- **80% de los clientes que van a re-comprar lo hacen en los primeros 6-8 meses**
- Despues de eso -> churned/lapsed
- El Active Customer File = clientes que han comprado en los ultimos 6-8 meses

> "Cuando ese archivo se encoge, lo que significa es que tu revenue de returning customers en el futuro va a encogerse tambien. Tienes que estar creciendo el numero de clientes activos todo el tiempo para que el negocio mantenga crecimiento futuro."

### Metrica clave: AMER (Acquisition Marketing Efficiency Ratio)
```
AMER = New Customer Revenue / Ad Spend
```

- Es la eficiencia de tu inversion en adquirir clientes NUEVOS
- La relacion entre spend y AMER sigue una curva: a mas spend, menos eficiencia
- La pregunta es la pendiente de esa curva
- Modelar con regresion lineal + efecto estacional + consideracion de AOV

### Errores comunes:
1. **Exprimir la esponja:** Sacar todo el revenue de la base existente sin adquirir nuevos -> el negocio muere en 12-18 meses
2. **Ignorar NC-ROAS bajo vs ROAS general alto:** Si tu ROAS general se ve bien pero el NC-ROAS esta mal -> estas re-comprando clientes existentes, no adquiriendo nuevos
3. **No tener metas de new customer acquisition:** Siempre tener un target de cuantos clientes nuevos por mes

---

## 5. CHANNEL METRICS (La Menos Importante)

### Posicion en la jerarquia:
> "Channel level metrics -- esto es Facebook ROAS, Triple Whale ROAS, tu numero de MTA. Esto gobierna la mayoria de las organizaciones. Es donde fuerzan a la mayoria de la gente a mirar. Es una metrica proxy. No esta correlacionada fuertemente con cash flow en la mayoria de los casos."

### Sobre herramientas de atribucion (Triple Whale, Northbeam, etc.):
> "No importa que modelo de atribucion uses, la asignacion real de tus dolares ocurre basandose en el sistema de Meta, en esa vista de atribucion. Eso es con lo que realmente te quieres quedar."

### Recomendacion practica:
1. Usa la data reportada por Meta (7-day click) como tu fuente principal
2. Corre incrementality studies (geo holdouts) para encontrar el efecto causal real
3. Si Meta reporta un ROAS de 1.0 y tu incrementality study dice 1.2 -> crea un "factor" multiplicador
4. Mide la plataforma con ese ajuste
5. Asegurate de que el setting de optimizacion de Meta coincide con lo que estas midiendo

### Cuando hacer incrementality tests:
- Cuando expandes a un canal nuevo (YouTube, TikTok, AppLovin)
- Cuando tu media mix se diversifica mas alla de Meta solo
- **Si estas solo en Meta:** exporta tu 7-day click ROAS y tu AMER diariamente, haz CORREL() en un spreadsheet -> debe ser 0.78+ de correlacion

---

## 6. DAILY FORECASTING (Ejecucion)

> "Soy un enorme proponente de tener una expectativa diaria de todo lo que estas haciendo. No por el sake de tener razon, sino para entender donde estas equivocado."

### Por que diario:
- Si sabes en el dia 5 que vas atrasado, tienes muchos mas dias para corregir que si lo descubres en el dia 22
- Fuerza al equipo a evaluar que creen que va a pasar con cada accion que proponen
- "Por que debemos mandar este email un martes? Que crees que va a pasar?"

### Dos ritmos simultaneos:
> "Somebody needs to be planning the moment in June -- the big thing that's coming. And somebody needs to worry about tomorrow. They can't be the same person."

1. **Ritmo diario:** ejecucion, optimizacion, ajustes tacticos -> la tarea de Cowork cada manana
2. **Ritmo de planificacion:** el peak del proximo trimestre, la proxima historia grande, el producto nuevo -> trabajo humano estrategico

---

## 7. MARKETING CALENDAR & EVENT EFFECT MODEL

### Concepto central:
> "El forecast financiero de la organizacion en un negocio de producto de consumo deberia salir del departamento de marketing. Porque imagina que en enero pasado lanzamos un producto nuevo. Si yo soy el departamento de finanzas, sin el calendario de marketing, y voy a construir un plan financiero, digo 'oh, enero fue increible'. Pero luego miro el calendario de marketing y sabes que no esta ahi? Ese lanzamiento de producto. La accion que creo esa realidad ya no existe."

### Unidades de crecimiento:
Cada accion de marketing es una "unidad de crecimiento":
- Lanzar un ad
- Enviar un email / SMS
- Publicar en organico
- Colaboracion con influencer
- Lanzamiento de producto
- Promocion / sale
- PR hit
- Cambio en el website

### Que registrar:
Para cada evento, registrar:
- Fecha
- Tipo de evento
- Descripcion
- Impacto esperado
- Impacto real en revenue (despues)
- Impacto en eficiencia de media
- Impacto en existing customer revenue
- Impacto en organic demand

### Patrones de revenue existente:
> "En la mayoria de negocios, email y SMS son un trigger para mover revenue de clientes existentes. Si miro mi calendario durante la semana, el revenue de existing customers sube en los dias que envio email y SMS."

---

## 8. PROGRESSIVE PEAKING (4 Peaks por Ano)

### Por que los peaks son tan importantes:

> "Piensa en Meta. Cada dia la realidad en Meta es que somos market takers. Hay un precio para el inventario que nosotros no fijamos. Es una dinamica de oferta y demanda. Yo no puedo fijar el precio del mercado. Llego cada dia con mis dolares y le digo 'aqui Meta' y me dan el CPM que este asignado a ese ad en ese momento."

> "Mi capacidad de crear arbitraje es basada en el precio que pago y la tasa de conversion sobre ese precio. CTR x Conversion Rate = valor que capturo."

### La mecanica del peak:
- **Black Friday:** el CPM SUBE porque todos estan gastando mas -> pero tu conversion rate tambien sube -> no ganas nada unico relativo a tu competencia
- **Peak que TU creas en mayo, abril, junio:** el CPM del mercado se mantiene CONSTANTE -> pero TU conversion rate sube -> **arbitraje puro**

> "Cuando yo creo un peak en el medio de mayo, en abril, en junio, cuando nadie mas tiene un peak, el precio del mercado de ad inventory se mantiene constante. Mi conversion rate sube. Asi es como creas momentos donde puedes elegir capturar mas valor marginal para ti o aumentar el volumen sustancialmente porque has creado arbitraje contra el precio del mercado."

### La pregunta que siempre debes hacer:
> "Por que alguien necesita comprar esto HOY? No por que necesita comprarlo. Por que necesita comprarlo HOY? Y entre mas puedas responder esa pregunta, mas palanca vas a crear contra ese mercado."

### Estructura: 4 peaks, 1 por trimestre
Esto balancea el cash flow y mantiene un ritmo consistente.

### Ejemplos del masterclass:

**APL (zapatos):**
- Peaks naturales: Black Friday + Mother's Day
- Peak creado: International Women's Day en marzo
- Contaron historias de clientas increibles, destacaron influencers, celebraron mujeres
- Ahora es un peak anual del calendario de la marca

**Born Primitive (fitness apparel):**
- Problema: leggings pegan en invierno, mueren en verano
- Solucion: footwear para verano + D-Day 75th Anniversary
- Sponsorearon veteranos viajando a Normandia
- Edicion limitada: 500 unidades, alto price point, drop de 3 dias
- Esos 3 dias fueron los mas grandes de todo su calendario
- Siguiente: Veterans Day -> pagaron $10M en deuda medica de veteranos
- Fox & Friends los cubrio multiples veces
- 3 semanas despues: Black Friday mas grande de su historia
- Porque adquirieron un monton de clientes nuevos en noviembre que convirtieron en Black Friday

### Amplificacion progresiva:
> "Los peaks se convierten en una amplificacion progresiva del negocio en total. Si puedes crear un momento grande de adquisicion de nuevos clientes en octubre o noviembre, ese grupo va a sobre-performar para ti en esos momentos de peak de realizacion de valor."

### Para Dosmicos, los peaks podrian ser:
- **Q1:** Hot Days (marzo) -- ya existe
- **Q2:** Dia de la Madre (mayo) -- peak natural para ropa de bebe
- **Q3:** Temporada de frio / Back to School (julio-agosto)
- **Q4:** Black Friday / Navidad (noviembre-diciembre)

---

## 9. PRODUCT-LED GROWTH

### El problema:
> "Si estas en un negocio con una categoria de producto donde toda la competencia ya entro y estas gritandole a tu equipo de Meta 'haz la eficiencia mejor, haz mas creativo, resuelve el problema con el ad creative', probablemente les estas pidiendo que logren algo que el mercado ha eliminado."

### La solucion: Product expansion
> "A veces lo que tienes que reconocer es que este negocio puede ser un negocio de $10M al ano y que el crecimiento no va a venir de llevar eso de 10 a 12 o 12 a 15. Es ir: leggings son 10, que mas puedo agregar que sea 5? Como me meto en zapatos? En swimwear?"

### Product MVP Matrix:
Para cada producto, evaluar en 3 dimensiones:
1. **Margin:** Mejora mi perfil de gross margin?
2. **Volume:** Hay velocidad de ventas y tendencia de categoria creciente?
3. **Popularity:** Que tan eficientemente puedo desplegar media para venderlo?

### 4 categorias de productos:

**Champions** -- Alto volumen + Alta eficiencia
- Son los hero SKUs. Proteger.
- Si se acerca el stock-out -> SUBIR eficiencia target o PAUSAR ads
- "Lo peor que puedes hacer es pagar un alto CAC para mover inventario que esta por quedarse sin stock"

**Growth Drivers** -- Eficiencia creciente + Volumen creciendo
- Oportunidad de escalar. Hacer un bet desproporcionado.
- "Hemos visto una tendencia, pero solo hemos ido 10% cada mes. Este mes vamos a hacer un 50% de crecimiento porque hay senales de que hay mas oportunidad."

**Hidden Gems** -- Buen revenue + Poco ad spend
- "Estoy vendiendo $30,000 al mes de sports bras y solo gaste $1,000. Que pasa si aumento la inversion?"
- Oportunidad subestimada.

**Underperformers** -- Alto gasto + Bajo retorno
- Candidatos a liquidacion o repricing
- Crear funnel de liquidacion: unlisted PDP + ads a baja eficiencia + excluir existing customers

### Que problema resuelve tu producto nuevo:
> "Cuando vas a hacer product development, hay una pregunta real: que problema estoy tratando de resolver? Tengo un problema de IBIDA? Un problema de crecimiento? Un problema de cash flow?"

- **Problema de cash flow:** necesito un producto de verano si mis ventas pegan en invierno (suavizar la curva de revenue)
- **Problema de volumen:** necesito entrar en una categoria que esta creciendo rapido
- **Problema de margen:** necesito un producto con mejor margin para poder ser mas agresivo en marketing

### Dynamic Pricing por SKU:
> "Nike y Comfort venden el mismo zapato a diferente precio dependiendo del color porque la demanda no es la misma. El bright pink cuesta menos que el negro porque la demanda no es igual."

- Si un color/talla se agota mucho antes que los demas -> habia un mismatch de precio y demanda
- Cuando se agota un SKU popular, la conversion rate del ad se desploma -> Meta mata el ad
- "Meta no trackea tu inventario. No entiende que cuando el inventario se repone, deberia volver a gastar en ese ad."
- Usar herramientas como Intelligems para price testing

---

## 10. INVENTORY-INFORMED MEDIA

### Principio:
Cada PO (Purchase Order) es un batch. Tu trabajo es maximizar el valor marginal de cada batch de inventario.

### Regla de inventario bajo:
Si un SKU tiene pocos dias de inventario y toma X dias reordenar:
- Si dias_inventario < dias_para_reordenar -> SUBIR eficiencia target significativamente O PAUSAR ads
- Dejar que se venda organicamente a full margin
- NO pagar CAC alto para agotar inventario que no puedes reponer

### Regla de inventario viejo (Aged Inventory):
Clasificar inventario en 4 grados:
- **A Grade:** < 30 dias outstanding -> Saludable
- **B Grade:** 30-60 dias -> Monitorear
- **C Grade:** 60-90 dias -> Planificar liquidacion
- **D Grade:** > 90 dias -> Liquidar AHORA

> "Nada es peor que pagar una tarifa de almacenamiento por poner en estantes inventario que no tienes plan de vender. No hay ads corriendo. No hay emails planeados. Solo esta ahi y le pagas a alguien por guardarlo. Eso es literalmente tu cash como founder sentado en un estante sin plan de venderse."

### Tacticas de liquidacion:
1. **Funnel de liquidacion:** PDP unlisted (no aparece en el website), correr ads a eficiencia baja (ROAS 0.8-1.0), excluir existing customers
2. **Descuento agresivo:** la cantidad de descuento debe ser proporcional a los dias de inventario outstanding
3. **Liquidadores profesionales:** tener relacion con empresas de liquidacion
4. **Narrativa:** si no afecta la marca, crear una historia alrededor ("sale de fin de temporada")

### Reunion semanal obligatoria:
> "Si eres un negocio de apparel deberias tener una reunion de inventario con tu media buyer cada semana. Deberias estar mirando cuantos dias de inventario hay en los mejores SKUs. Donde estan yendo mis ads? En que estoy gastando?"

---

## 11. CONSTRAINT AS SUPERPOWER

> "No capitular a la eficiencia de adquisicion. Es muy dificil tener a tu equipo de marketing viniendo a decirte 'no creo que podamos hacer esto, este target no funciona'. Y founders y CFOs frecuentemente no saben. Piensan que son razonables. Y dicen 'ok, podemos bajar el estandar'. NO. No bajes el estandar. Resuelve el problema."

### Lo que NO hacer:
- Bajar el ROAS target cuando el equipo dice "no podemos"
- Bajar el CPA target
- Aceptar "la macro economia esta dificil" como excusa
- Aceptar "los CPMs subieron" como excusa

### Lo que SI hacer:
- Forzar al equipo a resolver el problema de otra forma
- El constraint desbloquea creatividad: mejor storytelling, mejores peaks, product innovation, channel expansion
- Si alguien decide internamente que no puede -> quizas necesitas a alguien mas que lo intente

> "60% de los dolares de media gastados nunca fueron rentables. Nunca pagaron de vuelta en ningun periodo de tiempo. Eso es falta de constraint."

---

## 12. STORY, NOT ITERATION

> "Nuestra industria ha colapsado alrededor de la peor idea de estrategia creativa de la historia, que es iteracion. Hacer un ad, mirar los resultados, crear un cambio, iterar, iterar, iterar, iterar. Lo que estas haciendo es optimizar para el maximo local -- un rango muy estrecho de cambio potencial. Cambios pequenos = cambio pequeno en resultado."

### El problema con iteracion:
- La mayoria del workflow creativo es: hacer ads -> analizar datos (mal) -> hacer un cambio -> intentar de nuevo -> repetir
- Esto optimiza un maximo local
- Nunca va a producir un resultado mas grande que cualquier cosa que hayas hecho antes

### La alternativa: Historias que importen
- Inversion en crear stories que rompan el modelo
- Desasociarse del maximo local
- Generar un retorno mayor que cualquier cosa anterior
- No dice que no se puede iterar, pero la mayoria del esfuerzo debe ir a stories, no a hooks

### "Crea para la audiencia de tu audiencia":
> "No estoy creando solo para el espectador final. Quiero darles algo que puedan decir sobre si mismos al mundo. Quiero darles un contenido que quieran mostrar a sus amigos, que los haga cool en el group chat."

- Que contenido haria que mi cliente quiera compartirlo en DMs?
- Que haria que una mama quiera repostearlo en sus stories?
- Como hago que mi cliente sea un heroe en su mundo?

### Formato de ad -- Image vs Video:
> "Odio esa pregunta. Puedes tener un gran ad de imagen y un gran ad de video. Los formatos en si mismos son irrelevantes. Tu trabajo es entregar la comunicacion como sea necesario."

La pregunta correcta: **"Que es todo lo que alguien necesita saber para hacer una compra?"**
- Si necesitan saber muchas cosas (ej: impresora 3D) -> el funnel entero debe cubrir esas preguntas
- Si es un ad de imagen estatica -> tu landing page tiene que ser increible
- Si es un video largo que responde todo -> puedes llevarlos directo a checkout
- Para productos simples -> imagen estatica puede ser altamente efectiva

### Sobre replicar formatos:
> "Tu replicacion de una idea que funciona es la degradacion de su valor. Quieres encontrar lo que nadie mas esta haciendo. La vaca morada. Si te encuentras como un creative shop que trata de replicar la performance de otros, tu yield siempre va a ser subordinado."

### Sobre AI creative:
> "Permitir que la AI trabaje independientemente de las personas fue lo que mas performo en el estudio. Tenemos nociones preconcebidas sobre que va a funcionar. Tenemos sesgos. Tenemos miedos. La AI no tiene esa limitacion si le permites optimizar para un resultado especifico."

---

## 13. CHANNEL STRATEGY 2026

### Para marcas sub $10M:
- Quedate en Meta. No necesitas ir mas alla.
- Sprinkle de Google Search basico.
- Ir muy duro en Meta.

### Para marcas $10M-$100M:
El playbook 2026:

1. **Meta** -- Motor principal de demanda. 85%+ del spend para la mayoria.
2. **Google** -- #2. Branded search es un tax, no creacion de demanda.
3. **Amazon** -- 40-50% de TODO e-commerce ocurre en Amazon. Expandir distribucion.
4. **AppLovin** -- #3-4 en share of wallet. Ads unskippables en mobile gaming. 3-5% del budget.
5. **YouTube** -- Cada dolar en YouTube genera valor igual en Amazon como en .com.
6. **TikTok Shops** -- Red de afiliados. Correr neutral o leve perdida. Flywheel de atencion.
7. **CTV** -- Poderoso cuando tienes distribucion amplia (web + Amazon + retail). Dificil si eres solo .com.

### Regla critica de medicion:
> "No puedes expandir distribucion y continuar midiendo tu media exclusivamente en .com. Si expandiste a Amazon y tu media se mide solo en .com, tu eficiencia va a parecer que cae y vas a cortar el gasto y vas a ahogar todo el motor."

### Sobre Amazon Ads:
> "Amazon ads son un tax. No son creacion de demanda. Son una defensa contra que otros overtaken el SERP. Es la capacidad de Amazon de sacar tu demanda. Es un finger en el hole que mantiene tu funnel tight pero no crea nueva demanda."

---

## 14. CASH FLOW ERA

### Tres eras del e-commerce:
1. **COVID era (2020-2021):** Abundancia. Capital gratis. Aprendimos a CRECER. Desplegar capital rapido.
2. **Austerity era (2022-2023):** Capital desaparecio. iOS 14. Aprendimos FINANZAS. Contribution margin. Forecast.
3. **Cash Flow era (2024-2026):** Fusion de skills. Channel distribution. Product development. Cash conversion cycle.

### Vendor as Lender:
> "Necesitas entender el costo de capital en tu ecosistema. Tu proveedor en China probablemente tiene acceso a capital mas barato que tu gracias a subsidios gubernamentales de manufactura. Si les dices 'te pago 2 puntos mas en mi gross margin pero necesito mejores terms', para ellos ese calculo puede tener sentido."

**Tacticas:**
- Negociar net terms mas largos con proveedores (30->60->90->120 dias)
- Ideal: pagar al proveedor con dinero del cliente (negative cash conversion cycle)
- Consignment: el proveedor te da el inventario y le pagas cuando vendes
- Pre-orders: si no puedes conseguir net terms, pide al cliente que pague por adelantado
- Negociar terms con TODOS: Meta, agencias, 3PLs, software, etc.

### Cash Conversion Cycle ideal:
```
Si toma 90 dias manufacturar tu producto
Y tienes terms de 120 dias
= Recibes el producto, lo vendes, y pagas con el dinero del cliente
= Negative Cash Conversion Cycle = IDEAL
```

---

## 15. BENCHMARKS RAPIDOS

| Metrica | Excelente | Bueno | Atencion | Malo |
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

## REGLAS DE DECISION PARA EL REPORTE DIARIO DE COWORK

### Si Contribution Margin > meta:
-> Hay hidden gems para escalar?
-> El active customer file esta creciendo? (no solo exprimir existentes)
-> Hay peaks proximos para preparar?

### Si Contribution Margin < meta:
-> Cual de los 4 cuartos es el problema?
-> COGS alto -> producto de bajo margen vendiendo mucho? shipping destruyendo margin?
-> CAC alto -> ads ineficientes? competencia subio? Necesita nueva historia, no iteracion
-> OpEx alto -> costos fijos que no se justifican?
-> Si CM incremental por dolar de ad spend es positivo -> GASTAR MAS, no menos

### Si Active Customer File encoge:
-> ALERTA MAXIMA
-> Priorizar new customer acquisition
-> El revenue futuro de returning customers va a caer

### Si un SKU se va a quedar sin stock:
-> SUBIR eficiencia target o PAUSAR ads para ese SKU
-> Maximizar el marginal value del batch restante

### Si un SKU tiene >90 dias de inventario:
-> Liquidar: funnel especial, descuento, o liquidador externo
-> Convertir ese inventario muerto en cash para comprar inventario bueno

### Si AMER se degrada mes a mes:
-> Probablemente es competencia creciendo, no un problema de ads
-> SOLUCION: product innovation, stories, peaks
-> NO SOLUCION: iterar hooks

### Para planning de peaks:
-> Pregunta: "Por que alguien necesita comprar esto HOY?"
-> Si no puedes responder -> no tienes un peak, tienes un dia normal
-> Conectar a momentos culturales relevantes para el ICP de Dosmicos

---
---

# APENDICE A: Ejemplos del Masterclass y Aplicacion a Dosmicos

---

## EJEMPLOS DE PEAKS CULTURALES (del masterclass)

### Ejemplo 1: APL -- International Women's Day
- **Marca:** APL (zapatos premium, LA)
- **Peaks naturales:** Black Friday + Mother's Day
- **Problema:** Necesitaban un peak en Q1
- **Solucion:** Adoptaron International Women's Day en marzo
- **Ejecucion:** Historias de clientas increibles, highlight de influencers, celebracion de mujeres, destacar los mejores SKUs
- **Resultado:** Se convirtio en un peak anual permanente del calendario

### Ejemplo 2: Born Primitive -- D-Day Anniversary
- **Marca:** Born Primitive (fitness apparel, fundador ex Navy Seal)
- **Problema:** Leggings pegan en invierno, verano muere. Necesitaban un peak de verano.
- **Producto:** Lanzaron footwear (categoria con revenue mas plano anualmente)
- **Momento cultural:** 75th anniversary de la invasion de Normandia (junio)
- **Ejecucion:**
  - Sponsorearon el viaje de los ultimos veteranos vivos de vuelta a Normandia
  - Drop limitado: 500 unidades, high price point, edicion D-Day
  - Packaging en caja tipo ammo con baseball cards de cada veterano
  - Los militares que saltaban en paracaidas sobre Normandia llevaban el zapato
  - Contenido increible desde el evento
  - 3 dias de duracion
- **Resultado:** Los 3 dias mas grandes de TODO su calendario anual

### Ejemplo 3: Born Primitive -- Veterans Day
- **Evolucion del peak anterior**
- **Concepto:** Pagar $5M de deuda medica de veteranos
- **Mecanica:** Por 3 dias, cada dolar gastado iba a pagar deuda medica
- **PR:** Fox & Friends multiples veces
- **Contenido:** Grabaron llamadas a veteranos diciendo "tu deuda esta pagada"
- **Revenue directo:** $0 margen (todo fue a caridad)
- **Resultado real:** Masiva adquisicion de nuevos clientes -> 3 semanas despues, el Black Friday mas grande de su historia
- **Leccion:** "Los peaks se convierten en una amplificacion progresiva. Los clientes adquiridos en un peak sobre-performan en el siguiente."

### Ejemplo 4: Kalo Ring -- Category Expansion via Stories
- **Marca:** Kalo Ring (anillos de silicona para boda)
- **Historia:** Empezaron vendiendo a gente fitness
- **Desbloqueo:** Una blogger de "firefighter wives" les contacto
- **Insight:** Bomberos, policias, militares no pueden usar anillos de metal (riesgo de ring avulsion)
- **Resultado:** Cada nueva categoria (firefighters, CrossFit, nurses) era una nueva historia que desbloqueaba un trunch de crecimiento
- **Leccion:** "El verdadero desbloqueo no es iterar el ad. Es construir una historia completamente nueva en un area nueva."

---

## APLICACION A DOSMICOS

### Cultural Calendar para Dosmicos

**Target:** Mamas colombianas (25-44 anos) con ninos 0-8 anos

**Q1 -- Marzo:**
- Hot Days (16-20 de marzo) -- YA EXISTE
- Potencial: Dia del Hombre (19 marzo en Colombia) -> angle para papas que compran para sus hijos

**Q2 -- Mayo:**
- Dia de la Madre (segundo domingo de mayo) -- PEAK NATURAL para ropa de bebe
  - Story angle: "Lo que cada mama quiere es que su bebe duerma tranquilo"
  - Producto: Sleeping bags como regalo para mamas
  - Drop: Edicion especial "Mama" con algun detalle unico
  - UGC: Mamas contando como cambio su vida el sleeping bag

**Q3 -- Julio/Agosto:**
- Temporada de frio en Bogota (junio-agosto es la temporada fria)
  - Peak natural para ruanas y ponchos
  - Story: "Esta temporada de frio, tu bebe merece la mejor proteccion"
  - Posible: Back to School angle (ninos entrando a jardin)

**Q4 -- Noviembre:**
- Black Friday / Cyber Monday -- PEAK NATURAL
  - Preparar con un peak de adquisicion en octubre
  - Bundles especiales solo para Black Friday
  - Early access para lista de email

### "Por que alguien necesita comprar esto HOY?" -- Para Dosmicos:

| Trigger | Respuesta |
|---------|-----------|
| Temporada de frio | "Las noches frias ya llegaron. Tu bebe las esta sintiendo AHORA." |
| Producto nuevo | "Acaba de salir la Ruana Dinosaurio. Edicion limitada." |
| Hot Days | "Solo 5 dias. Los precios mas bajos del ano." |
| Dia de la Madre | "El regalo perfecto para la mama que quiere que su bebe duerma toda la noche." |
| Testimonio urgente | "3,000 mamas ya lo tienen. Las resenas hablan solas. Tu todavia no?" |
| FOMO de stock | "Solo quedan 12 unidades de la talla M." |

### Product MVP Matrix -- Aplicacion a Dosmicos:

**Preguntas para clasificar:**
- Ruana Dinosaurio es Champion, Growth, Gem, o Under?
  -> Revisar: ad spend asignado, revenue generado, ROAS del producto, unidades vendidas

**Posibles expansiones de producto:**
- **Problema de cash flow:** producto de verano (ropa ligera para ninos? accesorios?)
- **Problema de volumen:** entrar a una categoria adyacente con tendencia (pijamas termicas? medias?)
- **Problema de margen:** producto pequeno y liviano con alto AOV (accesorios premium?)

### Inventory-Informed Media -- Para Dosmicos:

**Escenario:** Ruana Dinosaurio tiene 15 dias de inventario y el reorder toma 45 dias.
-> ACCION: Subir el target de eficiencia significativamente o pausar los ads. Dejar que se venda organicamente y por email a full margin. Cada venta con ad spend alto en este momento esta minimizando el valor del batch.

**Escenario:** Kit Navidad tiene 180 dias de inventario en marzo.
-> ACCION: Crear un funnel de liquidacion. PDP unlisted. Ads con ROAS target de 0.8-1.0. Excluir existing customers. O descuento agresivo en email a existing customers. Convertir ese inventario en cash para comprar el siguiente batch de Ruanas.

---

## "CREA PARA LA AUDIENCIA DE TU AUDIENCIA" -- Para Dosmicos

### La pregunta clave:
Que contenido haria que una mama quiera compartirlo con otras mamas?

### Ideas basadas en el framework:
1. **Contenido que la haga "hero" en su grupo de mamas:**
   - "5 formas de que tu bebe duerma toda la noche sin despertarse por frio" -> util, compartible
   - Si lo comparte en su grupo de WhatsApp de mamas -> organico infinito

2. **Contenido que diga algo sobre su identidad:**
   - "Soy la mama que investiga todo lo mejor para su bebe" -> social proof de ser buena mama
   - UGC de mamas reales contando su experiencia -> otras mamas se identifican

3. **Contenido emocional que genere DMs:**
   - Video de bebe durmiendo placidamente en su sleeping bag -> "awww" -> share
   - Antes/despues de noches sin dormir -> mamas taggeando a otras mamas

### La regla:
> "No estoy creando solo para el espectador final. Quiero darles algo que puedan decir sobre si mismos al mundo."

Para Dosmicos: crea contenido que una mama quiera compartir porque la hace ver como una mama informada, carinosa, que investiga lo mejor para su hijo. No vendas un sleeping bag. Vende la identidad de "mama que tiene todo resuelto para que su bebe duerma seguro".

---

## VENDOR AS LENDER -- Para Dosmicos

### Preguntas para Angie/equipo:
1. Cuales son los terms actuales con el proveedor? (net 7? net 30? net 60?)
2. Cuanto toma producir un batch? (lead time)
3. Se podria negociar net terms mas largos ofreciendo unos puntos mas de margin?
4. Se podria hacer consignment con algun proveedor de confianza?
5. Los pre-orders funcionarian para drops limitados?

### Objetivo:
```
Si el lead time de produccion es 60 dias
Y los terms son net 30
= Pagas 30 dias ANTES de recibir el producto
= Cash Conversion Cycle POSITIVO (malo)

Si negocias net 90:
= Recibes el producto, lo vendes por 30 dias, y LUEGO pagas
= Cash Conversion Cycle NEGATIVO (ideal)
```

---

## CONSTRAINT -- Aplicado al Equipo de Dosmicos

### Lo que Julian (Ads) NO puede decir:
- "Necesitamos bajar el ROAS target"
- "Los CPMs subieron, no podemos hacer nada"
- "La competencia esta muy fuerte"

### Lo que Julian SI puede decir:
- "Con el target actual, necesitamos una nueva historia/peak/producto para desbloquearlo"
- "Recomiendo reasignar budget de underperformers a hidden gems"
- "Propongo un test de audiencia en [X] para encontrar nueva eficiencia"

### Lo que Angie (Creative) NO puede decir:
- "Necesitamos hacer 50 variaciones mas del mismo hook"
- "Iteremos el ad que ya tenemos"

### Lo que Angie SI puede decir:
- "Propongo una historia completamente nueva basada en [momento cultural/testimonial/narrativa]"
- "Hay una oportunidad en [nuevo angulo] que no hemos probado"
- "La creadora @X tiene una idea para un contenido tipo [Y] que nunca hemos hecho"

### Lo que Sebastian (Web) NO puede decir:
- "La landing esta bien, el problema son los ads"

### Lo que Sebastian SI puede decir:
- "El CTR de los ads es alto pero la conversion de la landing es baja. Voy a testear [X] cambios"
- "El checkout tiene un abandono de [X%]. Propongo [Y] mejora"
- "Net Shipping Cost es negativo. Propongo cobrar [X] por shipping o cambiar la estructura"

---
---

# APENDICE B: Formulas, Benchmarks y Diagnosticos

---

## FORMULAS COMPLETAS

### Contribution Margin
```
Contribution Margin ($) = Net Sales - Product Cost - Shipping Cost - Variable Expenses - Ad Spend
Contribution Margin (%) = Contribution Margin ($) / Net Sales x 100
```

### Net Sales (correcto)
```
Net Sales = Order Revenue - Returns Accrual
Returns Accrual = Revenue del periodo x Tasa de retorno historica
NO usar: Total Sales de Shopify (incluye returns procesadas de otros periodos)
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
Net Shipping Cost = Shipping Revenue (cobrado al cliente) - Shipping Cost (pagado al courier/3PL)
Meta: >= 0 (break-even o positivo)
```

### Active Customer File
```
Active Customers = Clientes que han comprado en los ultimos 6-8 meses
Churned Customers = Clientes cuya ultima compra fue hace > 8 meses
Active File Growth = (Active Customers este mes - Active Customers mes pasado) / Active Customers mes pasado
```

### Four Quarter Accounting
```
Cost of Delivery % = (Product Cost + Shipping Cost + Variable Expenses) / Net Sales x 100
CAC % = Total Ad Spend / Net Sales x 100
OpEx % = Total Fixed Costs / Net Sales x 100
Profit % = 100% - Cost of Delivery % - CAC % - OpEx %
```

### Revenue Layer Cake
```
Total Revenue = New Customer Revenue + Returning Customer Revenue
New Customer % = New Customer Revenue / Total Revenue x 100
Returning Customer % = Returning Customer Revenue / Total Revenue x 100
```

### Peak Multiplier
```
Peak Multiplier = Revenue de la semana del peak / Revenue promedio de una semana normal
```

### Cash Conversion Cycle
```
CCC = Days Inventory Outstanding + Days Sales Outstanding - Days Payable Outstanding
CCC negativo = pagas al proveedor DESPUES de cobrar al cliente = IDEAL
```

### Product Efficiency (por SKU)
```
SKU ROAS = SKU Revenue / Ad Spend asignado al SKU
SKU Contribution Margin = SKU Revenue - SKU COGS - SKU Shipping - Ad Spend del SKU
```

### Staffing Rule
```
Max Fixed Payroll = Mes de menor revenue del ano x 12%
Todo lo demas = flex staffing (freelancers, contractors, agencias, offshore)
```

---

## BENCHMARKS POR ETAPA DE NEGOCIO

### Marca nueva ($0-$1M)
| Metrica | Target |
|---------|--------|
| Canal | Meta solamente + Google Search basico |
| CM % | >15% (esta bien ser bajo mientras aprenden) |
| OpEx % | <20% (equipo minimo) |
| Focus | Product-market fit, encontrar el hero SKU |

### Marca en crecimiento ($1M-$10M)
| Metrica | Target |
|---------|--------|
| Canal | Meta heavy + Google |
| CM % | >20% |
| OpEx % | <15% |
| Focus | Escalar Meta, encontrar los 4 peaks, product expansion |

### Marca establecida ($10M-$100M)
| Metrica | Target |
|---------|--------|
| Canales | Meta + Google + Amazon + YouTube + TikTok Shops |
| CM % | >25% |
| OpEx % | <12% |
| Focus | Channel expansion, incrementality testing, product portfolio, retail |

---

## BENCHMARK DE SHIPPING

| Producto | Value-to-Weight Ratio | Shipping % Revenue |
|----------|----------------------|-------------------|
| Joyeria, perfume | Excelente | <5% |
| Ropa (pequena, ligera) | Buena | 8-12% |
| Ropa (abrigos, bulky) | Media | 12-18% |
| Hard goods (coolers, muebles) | Mala | 15-25%+ |
| Dosmicos (ruanas, sleeping bags) | Media-Buena | Target: <10% |

---

## ARBOL DE DIAGNOSTICO

### Contribution Margin bajo -- Donde esta el problema?

```
CM bajo
+-- Cost of Delivery alto (>40%)
|   +-- Product Cost alto -> Negociar con proveedor, buscar alternativas
|   +-- Shipping Cost alto -> Cobrando shipping? Value-to-weight malo? 3PL caro?
|   +-- Returns altas -> Producto no cumple expectativas? Sizing mal comunicado?
|
+-- CAC / Marketing alto (>30% sin buen LTV)
|   +-- AMER degradandose mes a mes
|   |   +-- Mas competencia? -> Product innovation, nuevas stories, peaks
|   |   +-- Creative fatigue? -> Nuevas historias, NO solo iterar hooks
|   |   +-- Audiencia saturada? -> Expandir targeting, nuevos canales
|   |
|   +-- Ads gastando en SKUs sin stock -> Pausar ads, maximizar margin del batch
|   |
|   +-- Ads gastando en underperformers -> Reasignar a champions y hidden gems
|
+-- OpEx alto (>15%)
|   +-- Demasiados FTEs para el revenue -> Flex staffing, offshore, AI
|   +-- Software innecesario -> Auditar subscripciones
|   +-- Oficina cara -> Necesaria? Remote work
|
+-- Revenue bajo (no hay suficiente volumen)
    +-- Product-market fit? -> Se vende organicamente?
    +-- Peak calendar vacio? -> Crear 4 peaks por ano
    +-- Customer file encogiendo? -> Priorizar new customer acquisition
    +-- Categoria estancada? -> Product expansion
```

### ROAS de ads bajo -- Es realmente un problema?

```
ROAS bajo en un ad
+-- Contribution Margin del negocio esta bien?
|   +-- SI -> El ROAS bajo del ad puede no ser un problema real
|   |   +-- El revenue esta llegando por otro canal? (Amazon, organic, email)
|   |
|   +-- NO -> Si hay un problema. Diagnosticar:
|       +-- CTR alto + Conv baja -> Problema de landing page, NO del ad
|       +-- CTR bajo + CPM normal -> Problema de creative
|       +-- CPM alto -> Audiencia saturada o demasiada competencia
|       +-- Hook Rate bajo -> Primeros 3 segundos del video no atrapan
|       +-- ATC alto + Compras bajas -> Problema de checkout (shipping, payment)
```

---

## CALENDARIO DE PEAKS -- TEMPLATE PARA DOSMICOS

### Estructura de un peak:

**6-8 semanas antes:**
- Definir el concepto y la historia
- Preparar el producto (hay edicion limitada? bundle? producto nuevo?)
- Asegurar inventario

**4 semanas antes:**
- Briefing de creativos
- Produccion de contenido (UGC, video, carruseles)
- Preparar email/SMS sequences

**2 semanas antes:**
- Early access campaign (lead gen, email capture)
- Teaser en organico
- Configurar ads

**Semana del peak:**
- Launch
- Multiples touchpoints: ads + email + SMS + organic + influencer
- Monitorear diariamente vs expectation
- Optimizar en tiempo real

**Post-peak:**
- Medir: Revenue, CM, New Customers, Peak Multiplier
- Registrar como marketing event
- Que funciono? Que no? -> Input para el proximo peak

---

## INVENTORY-MEDIA DECISION MATRIX

| Dias de inventario | Media strategy |
|-------------------|----------------|
| >120 dias | LIQUIDAR: funnel especial, descuento agresivo, liquidador |
| 90-120 dias | DESCUENTO: bajar precio, ads a ROAS 0.8-1.0 |
| 60-90 dias | MONITOREAR: esta vendiendo? Si no, planificar liquidacion |
| 30-60 dias | NORMAL: correr ads al target normal |
| <30 dias (y reorder toma >30) | PROTEGER: subir ROAS target o pausar ads |
| <15 dias (y reorder toma >30) | PAUSAR ADS: vender organicamente a full margin |

---

## SPEND & AMER CURVE -- COMO INTERPRETAR

```
AMER (eje Y)
  ^
4x| *
  |   *
3x|      *
  |         *
2x|            *  *
  |                  *  *
1x|                        *  *  *
  |
  +-------------------------------- Spend (eje X)
```

- Cada punto es un mes
- A mas spend -> menos eficiencia (curva descendente)
- La pendiente de la curva varia por marca y temporada
- **El punto optimo:** donde el area bajo la curva (total CM) se maximiza
- Si la curva es muy empinada -> el mercado tiene mucha competencia
- Si la curva es relativamente plana -> hay espacio para escalar
