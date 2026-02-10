

# Mostrar estado de seguimiento automaticamente al abrir el pedido

## Resumen
Cuando el pedido tenga una guia activa con tracking number, automaticamente consultar el estado de entrega y mostrarlo en la UI sin que el usuario tenga que oprimir nada.

## Cambios en `EnviaShippingButton.tsx`

### 1. Nuevos estados
- `trackingStatus`: string con el estado actual (in_transit, delivered, returned, etc.)
- `trackingEvents`: array de eventos/checkpoints
- `isLoadingTracking`: boolean para mostrar skeleton/spinner mientras carga

### 2. Auto-fetch del tracking
Un `useEffect` que se dispare cuando `existingLabel` cambie y tenga `tracking_number`:
- Llama a `trackShipment` del hook `useEnviaShipping` (ya existe)
- Guarda el status y eventos en estado local
- No bloquea la UI, muestra un spinner pequeno mientras carga

### 3. UI del estado de entrega
Debajo del tracking number, mostrar automaticamente:
- Un badge con color segun estado:
  - `in_transit` -> amarillo, "En transito"
  - `delivered` -> verde, "Entregado"  
  - `returned` -> rojo, "Devuelto"
  - `exception` -> rojo, "Problema"
  - `pending` -> gris, "Pendiente"
- Los eventos de tracking en un Collapsible (cerrado por defecto)
- Un boton pequeno de refresh para actualizar manualmente si lo desea

### Vista propuesta
```text
[Coordinadora (Manual)] 240045946725 (link)
Guia registrada manualmente
Registrada por: Juan Perez

[Badge: En transito]  (icono refresh pequeno)
  > Ver detalle de seguimiento
    - 9 feb 10:30 - En reparto - Bogota
    - 8 feb 18:00 - En centro de distribucion - Bogota
```

### 4. Importaciones adicionales
- Agregar `Package` o `MapPin` de lucide-react para los iconos de eventos
- Ya se importa `Collapsible` del UI

## Detalle tecnico

**useEffect para auto-tracking:**
- Se dispara cuando `existingLabel?.tracking_number` cambie
- Usa `trackShipment` del hook existente (que ya llama a `envia-track`)
- Guarda resultado en estados locales `trackingStatus` y `trackingEvents`

**En la seccion isActiveLabel (linea ~928):**
- Despues del bloque de PDF/manual (linea ~994), insertar seccion de tracking status
- Badge de estado + Collapsible con eventos
- Boton refresh iconico (sin texto) para re-consultar

## Archivos a modificar
- `src/features/shipping/components/EnviaShippingButton.tsx`

## Lo que NO se cambia
- Edge function `envia-track` (ya funciona)
- Hook `useEnviaShipping` (ya tiene `trackShipment`)
- Flujo de creacion/cancelacion de guias

