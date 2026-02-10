

# Mostrar quien registro la guia manual

## Situacion actual
- El fulfillment de Shopify SI se sigue haciendo cuando se crea una guia directa via Envia.com (en la edge function `create-envia-label`). Eso no se toca.
- El campo `created_by` ya se guarda al crear una guia manual, pero NO se muestra en la UI.
- Cuando un pedido se empaca y se genera la guia al mismo tiempo (Express), el sistema ya registra `packed_by` y `shipped_by` como la misma persona -- no necesita registro adicional de guia.

## Cambios

### 1. Mostrar quien registro la guia manual en la vista activa
En `EnviaShippingButton.tsx`, cuando la guia activa es manual (`isManual`), buscar el nombre del usuario que la creo usando `existingLabel.created_by` y mostrarlo debajo del tracking, similar a como se muestra "Por: {packedByName}" en el modal de picking.

Texto: "Registrada por: {nombre}" con icono de usuario.

### 2. Mostrar quien registro la guia en el historial
En la seccion `LabelHistorySection`, para cada label que tenga `created_by`, mostrar el nombre del usuario.

### Detalle tecnico

**En `EnviaShippingButton.tsx`:**
- Agregar un state `labelCreatorName` y un `useEffect` que busque en `profiles` el nombre cuando `existingLabel?.created_by` cambie
- En la vista de label activa manual (linea ~920-924), agregar una linea con el nombre del creador
- En el historial, hacer lo mismo (batch fetch de nombres para los labels con `created_by`)

```text
Vista actual:
  [Manual] 240045946725
  Guia registrada manualmente

Vista nueva:
  [Manual] 240045946725 (clickeable)
  Guia registrada manualmente
  Registrada por: Juan Perez
```

### Archivos a modificar
- `src/features/shipping/components/EnviaShippingButton.tsx`

### Lo que NO se cambia
- El fulfillment automatico en `create-envia-label` (ya funciona)
- El flujo de empacado Express (ya registra `packed_by` y `shipped_by`)
- La logica de `handleSaveManualLabel` (ya guarda `created_by`)

