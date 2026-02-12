

## Corregir orden #68902 y prevenir desincronizaciones de fulfillment

### Estado actual de la orden #68902

La orden ya esta corregida en la base de datos:
- `fulfillment_status` = `fulfilled`
- `operational_status` = `shipped`

No se necesita accion adicional para esta orden especifica.

### Problema raiz

El webhook actual (`shopify-webhook`) solo procesa los topics `orders/create` y `orders/update`. Cuando alguien marca un pedido como "fulfilled" directamente en Shopify, Shopify envia un webhook `fulfillments/create` que el sistema ignora (linea 948: "Webhook ignorado"). Aunque Shopify tambien deberia enviar un `orders/update`, este puede perderse o llegar con delay.

### Solucion: 2 capas de proteccion

#### 1. Agregar soporte para `fulfillments/create` en el webhook existente

Modificar `supabase/functions/shopify-webhook/index.ts` para que cuando reciba un evento `fulfillments/create`, extraiga el `order_id` del payload y actualice:
- `shopify_orders.fulfillment_status` a `fulfilled`
- `picking_packing_orders.operational_status` a `shipped`

Esto es un cambio pequeno en la logica de routing del webhook (linea 948).

#### 2. Cron de sincronizacion como respaldo

Ya existe la Edge Function `sync-shopify-fulfillment` que sincroniza el fulfillment_status de todas las ordenes. La solucion es invocarla automaticamente desde el frontend como parte del flujo de Picking & Packing, ejecutandola en segundo plano al cargar la pagina de Picking. Esto actua como red de seguridad para cualquier evento webhook perdido.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/shopify-webhook/index.ts` | Agregar manejo del topic `fulfillments/create` para actualizar fulfillment_status y operational_status |
| `src/hooks/usePickingOrders.ts` | Agregar llamada en segundo plano a `sync-shopify-fulfillment` al cargar la lista de ordenes (cada 15 minutos maximo) |

### Detalle tecnico del cambio en el webhook

```typescript
// En la seccion de routing (linea 948), agregar:
if (topic === 'fulfillments/create' || topic === 'fulfillments/update') {
  const fulfillmentData = JSON.parse(body);
  const orderId = fulfillmentData.order_id;
  
  // Actualizar shopify_orders
  await supabase.from('shopify_orders')
    .update({ fulfillment_status: 'fulfilled' })
    .eq('shopify_order_id', orderId);
  
  // Actualizar picking_packing_orders
  await supabase.from('picking_packing_orders')
    .update({ operational_status: 'shipped' })
    .eq('shopify_order_id', orderId);
  
  return Response con success;
}
```

### Detalle del sync periodico en Picking

En `usePickingOrders.ts`, al cargar las ordenes, verificar si han pasado mas de 15 minutos desde la ultima sincronizacion y, si es asi, invocar `sync-shopify-fulfillment` en segundo plano sin bloquear la carga de la pagina.

### Resultado esperado

- Los pedidos marcados como "fulfilled" en Shopify se reflejan inmediatamente en Sewdle via webhook
- Como respaldo, cada 15 minutos se sincroniza el estado de fulfillment al visitar Picking & Packing
- No se vuelven a presentar discrepancias entre Shopify y Sewdle

