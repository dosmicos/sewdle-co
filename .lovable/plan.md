
# Plan: Agregar Botón "Sincronizar Tags" en Página de Alegra

## Problema Identificado

El botón **"Sincronizar CUFE"** actual solo procesa facturas en la tabla `alegra_invoices` que tienen `stamped = false`. Sin embargo, hay **muchos pedidos** (encontré 20+) que:
- ✅ Ya tienen `alegra_stamped = true` en `shopify_orders`
- ✅ Ya tienen `alegra_cufe` (CUFE válido)
- ❌ **No tienen el tag FACTURADO** en Shopify

Estos pedidos fueron procesados por la facturación automática antes del fix que implementamos, por eso les falta el tag.

## Solución

Agregar un nuevo botón **"Sincronizar Tags"** junto al botón "Sincronizar CUFE" que:
1. Busque todos los pedidos con `alegra_stamped = true` y CUFE pero sin tag FACTURADO
2. Agregue el tag FACTURADO a cada uno en Shopify
3. Actualice los tags localmente en `shopify_orders`

## Cambios en la UI

```text
┌─────────────────────────────────────────────────────────────────┐
│  0 seleccionados  |  Desde 1 dic 2025  |                       │
│                                                                 │
│  [🔄 Actualizar]  [🔄 Sincronizar CUFE]  [🏷️ Sincronizar Tags]  │
│                                                                 │
│                            [Validar y Emitir X Facturas]        │
└─────────────────────────────────────────────────────────────────┘
```

## Cambios Técnicos

### Archivo: `src/components/alegra/BulkInvoiceCreator.tsx`

**1. Nueva función `syncMissingTags`:**

```typescript
const syncMissingTags = async () => {
  console.log('🏷️ Sincronizando tags FACTURADO faltantes...');
  
  try {
    // Buscar pedidos con CUFE pero sin tag FACTURADO
    const { data: ordersWithoutTag } = await supabase
      .from('shopify_orders')
      .select('shopify_order_id, order_number, tags')
      .eq('alegra_stamped', true)
      .not('alegra_cufe', 'is', null)
      .or('tags.is.null,tags.not.ilike.%FACTURADO%');
    
    if (!ordersWithoutTag?.length) {
      toast.info('Todos los pedidos facturados ya tienen el tag FACTURADO');
      return 0;
    }
    
    console.log(`📋 Encontrados ${ordersWithoutTag.length} pedidos sin tag FACTURADO`);
    let syncedCount = 0;
    
    for (const order of ordersWithoutTag) {
      try {
        await addFacturadoTag(order.shopify_order_id);
        syncedCount++;
        
        // Pequeña pausa para no saturar Shopify API
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(`Error agregando tag a pedido ${order.order_number}:`, err);
      }
    }
    
    if (syncedCount > 0) {
      toast.success(`${syncedCount} pedido(s) etiquetado(s) como FACTURADO`);
      await fetchShopifyOrders(); // Recargar lista
    }
    
    return syncedCount;
  } catch (err) {
    console.error('Error en syncMissingTags:', err);
    toast.error('Error sincronizando tags');
    return 0;
  }
};
```

**2. Nuevo estado para loading:**

```typescript
const [isSyncingTags, setIsSyncingTags] = useState(false);
```

**3. Nuevo botón en la UI (junto a "Sincronizar CUFE"):**

```typescript
<Button
  variant="outline"
  size="sm"
  onClick={async () => {
    setIsSyncingTags(true);
    await syncMissingTags();
    setIsSyncingTags(false);
  }}
  disabled={isSyncingTags || loading}
>
  {isSyncingTags ? (
    <Loader2 className="h-4 w-4 animate-spin mr-2" />
  ) : (
    <Tag className="h-4 w-4 mr-2" />
  )}
  Sincronizar Tags
</Button>
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/alegra/BulkInvoiceCreator.tsx` | Agregar función `syncMissingTags`, nuevo estado, nuevo botón en toolbar |

## Resultado Esperado

1. Usuario hace clic en **"Sincronizar Tags"**
2. Sistema busca todos los pedidos con CUFE pero sin tag FACTURADO
3. Agrega el tag FACTURADO a cada pedido en Shopify
4. Actualiza los tags localmente
5. Muestra mensaje de éxito con cantidad de pedidos actualizados
6. Los 20+ pedidos que están pendientes recibirán su tag FACTURADO
