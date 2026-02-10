

# Automatizacion de estados UGC y Centro de Notificaciones

## Resumen
Implementar transiciones automaticas de estado en campanas UGC basadas en eventos de envio, crear un centro de notificaciones visible en la pagina de UGC Creators, y generar notificaciones automaticas cuando un producto es entregado o cuando ha pasado 1 dia en "producto_enviado" sin entrega.

## Flujo automatico de estados

```text
Campaña creada con pedido -> "aceptado"
    |
    v (se crea guia o fulfillment en el pedido vinculado)
"producto_enviado"
    |
    v (la guia del pedido vinculado tiene status "delivered")
"producto_recibido"
```

## Componentes del plan

### 1. Tabla de notificaciones en Supabase

Crear tabla `ugc_notifications` con:
- `id` (uuid, PK)
- `organization_id` (uuid, FK)
- `campaign_id` (uuid, FK a ugc_campaigns)
- `creator_id` (uuid, FK a ugc_creators)
- `type` (text): `producto_entregado` | `contactar_creador`
- `title` (text)
- `message` (text)
- `read` (boolean, default false)
- `created_at` (timestamptz)

Habilitar RLS con politica para organizacion.

### 2. Hook `useUgcNotifications`

Nuevo archivo `src/hooks/useUgcNotifications.ts`:
- Query para obtener notificaciones no leidas de la organizacion actual
- Mutation para marcar como leida
- Ordenadas por fecha descendente

### 3. Hook `useUgcCampaignSync`

Nuevo archivo `src/hooks/useUgcCampaignSync.ts`:
- Se ejecuta con un intervalo (polling cada 60s) o al cargar la pagina UGC
- Para cada campana en estado `aceptado` con `order_number`:
  - Busca en `shipping_labels` si existe una guia para ese order_number
  - Si existe o el pedido tiene `fulfillment_status = 'fulfilled'`, actualiza la campana a `producto_enviado`
- Para cada campana en estado `producto_enviado` con `order_number`:
  - Busca en `shipping_labels` si la guia tiene `status = 'delivered'`
  - Si es asi, actualiza la campana a `producto_recibido` y crea notificacion tipo `producto_entregado`
- Para cada campana en estado `producto_enviado`:
  - Calcula si lleva mas de 1 dia en esa etapa (usando `updated_at`)
  - Si no existe ya una notificacion `contactar_creador` para esa campana, crea una

### 4. Componente `UgcNotificationCenter`

Nuevo archivo `src/components/ugc/UgcNotificationCenter.tsx`:
- Icono de campana con badge de contador de no leidas
- Dropdown/popover con lista de notificaciones
- Cada notificacion muestra: icono segun tipo, titulo, mensaje, tiempo relativo
- Al hacer click en una notificacion:
  - La marca como leida
  - Abre el modal del creador correspondiente (`UgcCreatorDetailModal`)

### 5. Integracion en `UgcCreatorsPage.tsx`

- Agregar `UgcNotificationCenter` al header de la pagina (junto al boton "Nuevo Creador")
- Ejecutar `useUgcCampaignSync` al montar la pagina
- Pasar handler para abrir creador desde notificacion

### 6. Mejora del `envia-track` Edge Function (ya existente)

Ya se implemento la logica en `envia-track` que cuando un envio se entrega, actualiza campanas UGC a `producto_recibido`. Esto complementa la sincronizacion del lado del cliente.

## Detalle tecnico

### Tabla SQL
```text
CREATE TABLE ugc_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES ugc_campaigns(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES ugc_creators(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('producto_entregado', 'contactar_creador')),
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ugc_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage notifications in their org"
  ON ugc_notifications FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  ));
```

### Logica de sincronizacion (useUgcCampaignSync)

**Aceptado -> Producto Enviado:**
```text
1. Obtener campanas en "aceptado" con order_number
2. Para cada una, buscar shipping_labels WHERE order_number matches
3. Si existe label -> UPDATE ugc_campaigns SET status = 'producto_enviado'
4. Alternativa: buscar shopify_orders.fulfillment_status = 'fulfilled'
```

**Producto Enviado -> Producto Recibido:**
```text
1. Obtener campanas en "producto_enviado" con order_number
2. Para cada una, buscar shipping_labels WHERE order_number matches AND status = 'delivered'
3. Si entregado -> UPDATE status = 'producto_recibido', crear notificacion
```

**Notificacion de contacto (1 dia):**
```text
1. Obtener campanas en "producto_enviado" donde updated_at < NOW() - 1 dia
2. Verificar que no existe notificacion previa tipo 'contactar_creador' para esa campana
3. Si no existe -> INSERT notificacion
```

### Componente NotificationCenter
- Usa `Popover` de Radix UI
- Icono `Bell` de lucide-react con badge numerico
- Lista scrolleable de notificaciones
- Click abre creador: llama `onCreatorClick(creatorId)` que busca el creador y abre `UgcCreatorDetailModal`

## Archivos a crear
- `src/hooks/useUgcNotifications.ts` - CRUD de notificaciones
- `src/hooks/useUgcCampaignSync.ts` - logica de sincronizacion automatica
- `src/components/ugc/UgcNotificationCenter.tsx` - UI del centro de notificaciones
- Migracion SQL para tabla `ugc_notifications`

## Archivos a modificar
- `src/pages/UgcCreatorsPage.tsx` - integrar notification center y sync hook
- `src/integrations/supabase/types.ts` - agregar tipos de la nueva tabla

## Lo que NO se cambia
- `PickingOrderDetailsModal` - se reutiliza tal cual
- Edge functions existentes
- `UgcKanbanBoard`, `UgcKanbanCard` - sin cambios

