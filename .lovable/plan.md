

## Plan: Corregir Carga de Productos Shopify con Paginación

### Problema Identificado

El modal muestra solo **188 productos únicos** cuando en realidad hay **691** productos de Shopify diferentes. Esto ocurre porque:

1. **Límite de Supabase**: La consulta actual devuelve máximo 1,000 filas
2. **14,983 líneas de pedido** existen en los últimos 6 meses
3. Solo se procesan las primeras 1,000 líneas → solo 188 productos únicos detectados
4. Los 66 mapeos existentes no se aplican correctamente porque muchos productos nunca se cargan

### Solución

Modificar la función `detectMissingProducts` para usar paginación o agregación directa en la base de datos.

**Opción elegida**: Consulta agregada que obtiene productos únicos directamente desde la base de datos (más eficiente).

### Cambios Técnicos

#### Archivo: `src/components/alegra/AlegraProductSyncModal.tsx`

**Cambiar la consulta de productos de Shopify:**

```typescript
// ANTES (problemático - límite de 1000 filas)
const { data: shopifyProducts, error: shopifyError } = await supabase
  .from('shopify_order_line_items')
  .select('title, variant_title, sku, price')
  .eq('organization_id', currentOrganization.id)
  .gte('created_at', sixMonthsAgo.toISOString())
  .order('title');

// DESPUÉS (paginación para obtener TODOS los productos)
const allShopifyProducts: Array<{title: string; variant_title: string | null; sku: string | null; price: number}> = [];
const pageSize = 1000;
let from = 0;
let hasMore = true;

while (hasMore) {
  const { data: batch, error } = await supabase
    .from('shopify_order_line_items')
    .select('title, variant_title, sku, price')
    .eq('organization_id', currentOrganization.id)
    .gte('created_at', sixMonthsAgo.toISOString())
    .order('title')
    .range(from, from + pageSize - 1);
  
  if (error) throw error;
  
  if (batch && batch.length > 0) {
    allShopifyProducts.push(...batch);
    from += pageSize;
    hasMore = batch.length === pageSize;
  } else {
    hasMore = false;
  }
  
  // Safety limit
  if (from > 50000) break;
}
```

### Flujo Corregido

```text
ANTES (Incorrecto):
┌─────────────────────────────────────────────────────────────────┐
│  1. Cargar líneas de pedido (MÁXIMO 1000)                        │
│  2. Deduplicar → 188 productos únicos                           │
│  3. Comparar con 66 mapeos → Solo 4 coinciden                   │
│  4. Resultado: 184 "faltantes" (incorrecto)                     │
└─────────────────────────────────────────────────────────────────┘

DESPUÉS (Correcto):
┌─────────────────────────────────────────────────────────────────┐
│  1. Cargar TODAS las líneas de pedido (14,983)                  │
│  2. Deduplicar → 691 productos únicos                           │
│  3. Comparar con:                                               │
│     - SKU en Alegra                                             │
│     - Nombre similar en Alegra (28 items)                       │
│     - 66 mapeos existentes                                      │
│  4. Resultado: X "faltantes" (correcto)                         │
└─────────────────────────────────────────────────────────────────┘
```

### Resultado Esperado

| Métrica | Antes | Después |
|---------|-------|---------|
| Líneas de pedido procesadas | 1,000 | 14,983 |
| Productos únicos detectados | 188 | 691 |
| Mapeos aplicados | ~4 | ~66 |
| Faltantes estimados | 184 | ~620 |

### Archivos a Modificar

- `src/components/alegra/AlegraProductSyncModal.tsx`

