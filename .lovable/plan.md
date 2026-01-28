
# Plan: Auto-fulfillment para Pedidos Express

## ✅ IMPLEMENTADO

### Cambios Realizados

1. **Nueva Edge Function `fulfill-express-order`** (`supabase/functions/fulfill-express-order/index.ts`)
   - Crea fulfillment en Shopify con `notify_customer: true`
   - Agrega etiquetas EMPACADO y ENVIADO usando merge
   - Actualiza `picking_packing_orders.operational_status` a `shipped`
   - Actualiza `shopify_orders.fulfillment_status` a `fulfilled`

2. **Modificado `PickingOrderDetailsModal.tsx`**
   - Nuevo estado `isProcessingExpressFulfillment`
   - Nueva función `handleMarkAsPackedExpress()` que llama a la edge function
   - Auto-pack useEffect detecta Express y llama a la función correcta

3. **Actualizado `supabase/config.toml`**
   - Agregado `[functions.fulfill-express-order]` con `verify_jwt = false`

### Flujo Implementado

```text
Usuario escanea todos los SKUs
         │
         ▼
┌──────────────────┐
│ Todos verificados│
│ (auto-pack 800ms)│
└────────┬─────────┘
         │
    ¿Es Express?
    /          \
   Sí          No
   │            │
   ▼            ▼
handleMarkAs   handleMarkAs
PackedExpress  PackedAndPrint
   │            │
   ▼            ▼
Imprimir +     Imprimir +
Edge Function  ready_to_ship
fulfill-express
   │
   ▼
• Fulfillment Shopify ✓
• shipped status ✓
• Tags EMPACADO+ENVIADO ✓
• Cliente notificado ✓
```

