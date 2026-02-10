

# Mejoras en Guia Manual: Link tracking, quitar transportadora, registrar usuario, y fulfillment en Shopify

## Resumen
Cuatro cambios en el flujo de guia manual en `EnviaShippingButton.tsx` y una nueva edge function para el fulfillment:

## 1. Quitar selector de transportadora
- Eliminar el `<select>` de transportadora del formulario manual (lineas 941-953)
- Hardcodear `carrier: 'manual'` en `handleSaveManualLabel`
- Eliminar el state `manualCarrier` si existe

## 2. Registrar quien creo la guia
- Obtener el usuario actual con `supabase.auth.getUser()` antes del insert
- Guardar `created_by: user?.id || null` en el registro de `shipping_labels`

## 3. Tracking clickeable con link de envia.com
- En la vista de label activa (linea 858-859): convertir el tracking en un `<a>` que abre `https://envia.com/tracking?label={tracking_number}` en nueva pestana
- En el historial (linea 671-672): mismo cambio para los tracking del historial
- Estilo: texto azul con underline al hover

## 4. Fulfillment automatico en Shopify al guardar guia manual
- Despues de guardar la guia manual exitosamente, invocar la edge function `fulfill-express-order` con el `shopify_order_id` y `organization_id`
- Esta funcion ya verifica si el pedido esta fulfilled (busca fulfillment orders con status `open` o `in_progress`; si no hay, no hace nada)
- Esto marca el pedido como "Fulfilled" en Shopify automaticamente
- Si el pedido ya esta fulfilled (`isFulfilled` prop es true), se salta la llamada

### Flujo en handleSaveManualLabel:
```text
1. Validar tracking
2. Obtener usuario actual (auth.getUser)
3. Insertar en shipping_labels con carrier='manual' y created_by=user.id
4. Si el pedido NO esta fulfilled (isFulfilled === false):
   - Invocar fulfill-express-order (ya maneja el caso de pedidos ya fulfilled en Shopify)
   - No bloquear el flujo si falla - solo mostrar warning
5. Toast de exito
6. Limpiar formulario
```

## Archivos a modificar
- `src/features/shipping/components/EnviaShippingButton.tsx` - todos los cambios frontend

## Lo que NO se cambia
- No se crean edge functions nuevas (se reutiliza `fulfill-express-order`)
- El flujo de cotizacion y creacion de guia via Envia.com
- La cancelacion de guias
- La tabla `shipping_labels`
