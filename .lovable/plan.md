
# Plan: Auto-fulfillment para Pedidos Express

## Problema Actual
Los pedidos Express no reciben la etiqueta EMPACADO porque:
1. El botón "Crear Guía" está oculto para Express (correcto, no necesitan guía física)
2. Pero al empacar solo se marca como `ready_to_ship`, no se crea fulfillment en Shopify
3. El pedido queda en estado intermedio sin notificar al cliente

## Solución Propuesta
Crear un flujo automático donde los pedidos Express, al ser empacados (todos los productos escaneados), automáticamente:
1. Se cree fulfillment en Shopify (notifica al cliente)
2. Se marque como `shipped` (no `ready_to_ship`)
3. Se agreguen las etiquetas EMPACADO y ENVIADO

## Cambios Requeridos

### 1. Nueva Edge Function: `fulfill-express-order`
Crear una función que maneje específicamente pedidos Express:

| Campo | Valor |
|-------|-------|
| Ubicación | `supabase/functions/fulfill-express-order/index.ts` |
| Entrada | `shopify_order_id`, `organization_id`, `user_id` |
| Acciones | Crear fulfillment en Shopify sin tracking, actualizar estados locales |

Lógica:
- Obtener fulfillment orders de Shopify
- Crear fulfillment con `notify_customer: true` (sin tracking info)
- Actualizar `picking_packing_orders.operational_status` a `shipped`
- Actualizar `picking_packing_orders.shipped_at` y `shipped_by`
- Actualizar `shopify_orders.fulfillment_status` a `fulfilled`
- Agregar etiquetas EMPACADO y ENVIADO en Shopify

### 2. Modificar PickingOrderDetailsModal.tsx
Cambiar el flujo de auto-pack para detectar Express:

```text
Flujo Actual:
Escaneo completo → handleMarkAsPackedAndPrint() → handleStatusChange('ready_to_ship')

Flujo Propuesto:
Escaneo completo → 
  Si Express → handleMarkAsPackedExpress() → Edge Function → shipped
  Si Normal  → handleMarkAsPackedAndPrint() → ready_to_ship (sin cambios)
```

Cambios específicos:
- Agregar nueva función `handleMarkAsPackedExpress()`
- Modificar el `useEffect` de auto-pack para detectar si `shippingType?.label === 'Express'`
- Si es Express: imprimir + llamar a edge function para fulfillment automático
- Si es Normal: mantener comportamiento actual

### 3. Actualizar config.toml
Agregar la nueva función:
```toml
[functions.fulfill-express-order]
verify_jwt = false
```

## Flujo Visual

```text
Usuario escanea SKUs
         │
         ▼
┌──────────────────┐
│ Todos verificados│
│ (auto-pack 800ms)│
└────────┬─────────┘
         │
         ▼
    ¿Es Express?
    /          \
   Sí          No
   │            │
   ▼            ▼
┌─────────┐  ┌─────────────────┐
│Imprimir │  │ Imprimir        │
└────┬────┘  │ + ready_to_ship │
     │       │ + tag EMPACADO  │
     ▼       └─────────────────┘
┌────────────────────┐
│fulfill-express-order│
│• Fulfillment Shopify│
│• shipped_at/by     │
│• tags EMPACADO+    │
│  ENVIADO           │
└────────────────────┘
```

## Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `supabase/functions/fulfill-express-order/index.ts` | Crear |
| `supabase/config.toml` | Modificar (agregar función) |
| `src/components/picking/PickingOrderDetailsModal.tsx` | Modificar |

## Resultado Esperado
Cuando un operario escanee todos los productos de un pedido Express:
1. Se abre la ventana de impresión (feedback instantáneo)
2. Se crea fulfillment en Shopify automáticamente
3. El cliente recibe notificación de que su pedido fue enviado
4. El pedido aparece como "Enviado" en la lista de Picking & Packing
5. Las etiquetas EMPACADO y ENVIADO aparecen en Shopify
