

# Sincronizacion automatica Picking y Packing a Campanas UGC (con normalizacion de order_number)

## Resumen
Cuando un pedido se empaca o envia en Picking y Packing, las campanas UGC vinculadas se actualizan automaticamente. El sistema normaliza los numeros de pedido para que coincidan independientemente de si tienen `#` o no.

## Datos actuales
- **Picking y Packing**: numeros sin `#` (ej: `68875`, `57205`)
- **Campanas UGC**: mezcla con y sin `#` (ej: `#68588`, `68879`)

## Cambios

### 1. Migracion SQL: Trigger con normalizacion

Se crea un trigger `sync_ugc_campaign_from_picking` en `picking_packing_orders` que:

1. Detecta cuando `operational_status` cambia a `ready_to_ship` o `shipped`
2. Busca campanas en `ugc_campaigns` comparando el numero **sin el `#`** en ambos lados:
   ```
   REPLACE(ugc_campaigns.order_number, '#', '') = REPLACE(picking.order_number, '#', '')
   ```
3. Solo actualiza campanas con status `contactado`, `negociando` o `aceptado`
4. Cambia el status a `producto_enviado` y actualiza `updated_at`

### 2. UgcCreatorDetailModal.tsx: Enlace clickeable en campanas

Donde dice "Pedido: 68879", convertirlo en un link que navega a `/picking-packing?search=68879` (limpiando el `#`). Se cierra el modal antes de navegar.

### 3. UgcKanbanCard.tsx: Enlace clickeable en tarjeta

El numero de pedido en la tarjeta Kanban sera clickeable con la misma logica. Se usa `e.stopPropagation()` para no abrir el modal de detalle al hacer click.

### 4. UgcTableView.tsx: Enlace clickeable en tabla

La columna de pedido en la vista de tabla tambien sera clickeable con la misma navegacion.

## Detalle tecnico del trigger

```text
FUNCION sync_ugc_campaign_from_picking():
  SI NEW.operational_status EN ('ready_to_ship', 'shipped')
     Y (OLD.operational_status ES NULL O OLD.operational_status != NEW.operational_status)
     Y NEW.order_number NO ES NULO:

    ACTUALIZAR ugc_campaigns
    SET status = 'producto_enviado',
        updated_at = NOW()
    DONDE REPLACE(order_number, '#', '') = REPLACE(NEW.order_number, '#', '')
      Y organization_id = NEW.organization_id
      Y status EN ('contactado', 'negociando', 'aceptado')

TRIGGER: AFTER UPDATE en picking_packing_orders
```

## Normalizacion en frontend

Para la navegacion, se limpia el `#` antes de pasarlo como parametro de busqueda:
```text
orderNumber.replace('#', '')  -->  /picking-packing?search=68588
```

## Lo que NO se cambia
- No se modifica la tabla `ugc_campaigns` ni `picking_packing_orders`
- No se agrega FK entre tablas
- No se modifica el modulo de Picking y Packing
- Estados avanzados de la campana (producto_recibido, video_en_revision, etc.) no se sobrescriben

