
# Abrir modal de pedido de Picking & Packing desde UGC Creators

## Resumen
Al hacer clic en el numero de pedido de una campana UGC, se abrira el modal completo de `PickingOrderDetailsModal` directamente en la pagina de UGC Creators, sin navegar a otra pagina. Todas las modificaciones (notas, tags, estado, guias) se sincronizaran con Shopify igual que en Picking & Packing.

## Flujo del usuario

```text
UGC Creators > Modal Detalle Creador > Tab Campanas
  -> Click en "Pedido: 68933"
  -> Se busca el ID del pedido en picking_packing_orders via order_number
  -> Se abre PickingOrderDetailsModal encima del modal actual
  -> Usuario puede ver/editar todo como si estuviera en Picking & Packing
  -> Al cerrar, vuelve al modal del creador UGC
```

## Cambios necesarios

### 1. `UgcCreatorDetailModal.tsx` - Agregar estado y modal de picking

**Nuevos estados:**
- `pickingOrderId`: string | null - el ID del pedido en picking_packing_orders
- `pickingModalOpen`: boolean - controla si el modal de picking esta abierto
- `loadingPickingOrder`: boolean - mientras busca el ID

**Nueva funcion `handleOpenPickingOrder(orderNumber)`:**
1. Normaliza el order_number (quita el #)
2. Consulta `picking_packing_orders` JOIN `shopify_orders` para encontrar el ID del pedido cuyo `order_number` coincida
3. Si lo encuentra, guarda el ID en `pickingOrderId` y abre el modal
4. Si no lo encuentra, muestra toast de error

**Cambio en el click del numero de pedido (linea 270-275):**
- En vez de `onOpenChange(false)` + `navigate(...)`, llama a `handleOpenPickingOrder(campaign.order_number)`
- El usuario se queda en la pagina de UGC Creators

**Render del PickingOrderDetailsModal:**
- Se agrega al final del componente, condicionado a `pickingOrderId && pickingModalOpen`
- Props: `orderId={pickingOrderId}`, `onClose` cierra el modal, `allOrderIds={[pickingOrderId]}` (sin navegacion entre ordenes), `onNavigate` vacio

### 2. Importaciones nuevas en `UgcCreatorDetailModal.tsx`
- `PickingOrderDetailsModal` de `@/components/picking/PickingOrderDetailsModal`
- `supabase` de `@/integrations/supabase/client`
- `toast` de `sonner`
- `useState` de `react`
- `Loader2` de `lucide-react`

## Detalle tecnico

**Busqueda del pedido por order_number:**
```text
SELECT ppo.id
FROM picking_packing_orders ppo
JOIN shopify_orders so ON so.shopify_order_id = ppo.shopify_order_id
WHERE REPLACE(so.order_number, '#', '') = '68933'
LIMIT 1
```

**Manejo de z-index:**
- El PickingOrderDetailsModal usa Dialog de Radix que se renderiza en un portal con z-50
- El modal del creador UGC tambien usa z-50
- Como ambos son portales independientes, el segundo se renderizara encima del primero naturalmente

**Props del PickingOrderDetailsModal:**
- `orderId`: el ID encontrado en la consulta
- `allOrderIds`: array con solo ese ID (no necesita navegacion J/K entre ordenes)
- `onNavigate`: funcion vacia (no aplica en este contexto)
- `onClose`: cierra el modal de picking y mantiene abierto el del creador

## Archivos a modificar
- `src/components/ugc/UgcCreatorDetailModal.tsx`

## Lo que NO se cambia
- `PickingOrderDetailsModal` (se reutiliza tal cual)
- Hooks de picking (`usePickingOrders`, `usePickingOrderDetails`, `usePickingLineItems`)
- Edge functions de Shopify/Envia
- Logica de sincronizacion existente
