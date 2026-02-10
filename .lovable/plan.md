

# Sincronizar estado de entrega con campanas UGC automaticamente

## Resumen
Cuando el sistema de tracking (`envia-track`) detecte que un envio fue entregado (`delivered`), automaticamente actualizar la campana UGC vinculada a ese pedido al estado `producto_recibido`.

## Donde se hace el cambio
En la edge function `supabase/functions/envia-track/index.ts`, que es donde se consulta el estado del envio y ya se actualiza la tabla `shipping_labels`. Justo despues de esa actualizacion (linea ~161), se agrega logica para:

1. Buscar el `order_number` de la guia en `shipping_labels`
2. Si el status es `delivered`, actualizar `ugc_campaigns` donde el `order_number` coincida y el estado actual sea `producto_enviado`

## Cambio en `envia-track/index.ts`

Despues de actualizar `shipping_labels` (linea 161), agregar:

```text
Si status === 'delivered':
  1. Consultar shipping_labels para obtener order_number y organization_id
     usando el tracking_number
  2. Si encuentra order_number:
     UPDATE ugc_campaigns
     SET status = 'producto_recibido', updated_at = NOW()
     WHERE REPLACE(order_number, '#', '') = REPLACE(label.order_number, '#', '')
       AND organization_id = label.organization_id
       AND status = 'producto_enviado'
```

Esto se ejecuta cada vez que un usuario abre un pedido en Picking y Packing (ya que el tracking se consulta automaticamente al montar el componente), asi que el estado de la campana se actualiza sin necesidad de oprimir nada.

## Flujo completo

```text
Usuario abre pedido en Picking & Packing
  -> EnviaShippingButton monta y auto-consulta tracking
  -> envia-track consulta estado en Envia.com
  -> Si es "delivered":
     -> Actualiza shipping_labels.status = 'delivered'
     -> Busca order_number en shipping_labels
     -> Actualiza ugc_campaigns.status = 'producto_recibido'
  -> UI muestra badge "Entregado" en picking
  -> Kanban de UGC muestra la campana en "Producto Recibido"
```

## Archivos a modificar
- `supabase/functions/envia-track/index.ts` - agregar logica de sync con ugc_campaigns tras detectar estado delivered

## Lo que NO se cambia
- EnviaShippingButton (ya hace auto-tracking al montar)
- Trigger existente `sync_ugc_campaign_from_picking` (sigue manejando el paso a `producto_enviado`)
- Hook useUgcCampaigns
- UI del Kanban UGC

