

# Flujo unificado: Cotizar + Crear Guia en un solo clic

## Situacion actual
Hoy el flujo tiene dos pasos manuales separados:
1. El usuario oprime "Cotizar Envio" y espera las tarifas
2. Selecciona transportadora y oprime "Crear Guia"

## Cambio propuesto
Cuando el usuario oprime "Crear Guia" (o el boton equivalente tras escanear los articulos), el sistema automaticamente:
1. Primero ejecuta la cotizacion (llama a `getQuotesWithRetry`)
2. Espera que termine y auto-selecciona la mejor transportadora segun las reglas de negocio existentes
3. Inmediatamente despues crea la guia con la transportadora seleccionada (llama a `handleCreateLabel`)

Todo en un solo clic, sin pasos intermedios.

## Cambios en `EnviaShippingButton.tsx`

### 1. Nueva funcion `handleQuoteAndCreateLabel`
Combina los dos pasos en una sola funcion asincrona:

```text
async handleQuoteAndCreateLabel():
  1. Llamar getQuotesWithRetry (con las mismas opciones de retry/timeout)
  2. Si falla -> mostrar error de cotizacion con boton de reintentar
  3. Si tiene exito -> auto-seleccionar la mejor transportadora (mismo logica que ya existe en el useEffect)
  4. Llamar handleCreateLabel con la transportadora seleccionada
```

### 2. Modificar el boton "Crear Guia" (linea ~1474)
- Cuando no hay quotes cargados aun (quoteState idle), el boton "Crear Guia" llama a `handleQuoteAndCreateLabel` en vez de `handleCreateLabel`
- Cuando ya hay quotes cargados, sigue llamando a `handleCreateLabel` directamente
- El texto del boton cambia durante la cotizacion: "Cotizando..." -> "Creando guia..."

### 3. Estado visual durante el proceso
- Fase 1 (cotizando): Boton muestra "Cotizando envio..." con spinner
- Fase 2 (creando): Boton muestra "Creando guia..." con spinner
- Si la cotizacion falla, se detiene y muestra el error existente

### 4. Seccion de cotizacion idle (lineas ~1442-1471)
- Se mantiene el boton "Cotizar Envio" por si el usuario quiere ver tarifas antes
- El selector de transportadora manual tambien se mantiene como opcion alternativa

### Vista del flujo unificado
```text
[Boton: Crear Guia de Envio]
  click ->
  [Boton: Cotizando envio... (spinner)] (2-10s)
  -> auto-selecciona Coordinadora (o la que corresponda)
  [Boton: Creando guia... (spinner)] (5-10s)
  -> Guia creada, se muestra el PDF
```

## Detalle tecnico

**Nueva funcion en EnviaShippingButton.tsx:**
- `handleQuoteAndCreateLabel` que encadena `getQuotesWithRetry` + seleccion de carrier + `handleCreateLabel`
- Un nuevo state `quoteAndCreatePhase` ('idle' | 'quoting' | 'creating') para manejar el texto del boton
- La seleccion automatica de transportadora se extrae de la logica del useEffect existente (lineas 374-388) a una funcion reutilizable `selectBestCarrier(quotes)`

**Boton "Crear Guia" (linea 1474):**
- Si `quoteState.status !== 'success'` (no hay quotes): onClick llama `handleQuoteAndCreateLabel`
- Si `quoteState.status === 'success'` (ya cotizo): onClick llama `handleCreateLabel` (comportamiento actual)

**apiRef (linea 546):**
- `createLabelWithDefaults` tambien usara `handleQuoteAndCreateLabel` cuando no hay quotes, para que el flujo externo (Express) tambien funcione con un solo paso

## Archivos a modificar
- `src/features/shipping/components/EnviaShippingButton.tsx`

## Lo que NO se cambia
- Edge functions (`envia-quote`, `create-envia-label`)
- Hook `useEnviaShipping`
- Reglas de seleccion de transportadora
- Flujo de guia manual
- Validacion de ciudad (se ejecuta durante la cotizacion como siempre)
