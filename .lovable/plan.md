
## Plan: Guardar Mapeo Automático al Crear Productos

### Problema
Cuando se sincronizan productos de Shopify a Alegra, se crean en Alegra pero **no se guarda el mapeo** en `alegra_product_mapping`. Esto causa que en la siguiente sincronización se detecten como "faltantes" nuevamente y se creen duplicados.

### Solución
Modificar `AlegraProductSyncModal.tsx` para que al crear cada producto exitosamente en Alegra, también se guarde el mapeo correspondiente en la tabla `alegra_product_mapping`.

### Flujo Actual vs Nuevo

```text
FLUJO ACTUAL (Problemático):
┌─────────────────────────────────────────────────────────────┐
│  1. Detectar productos faltantes                             │
│  2. Crear en Alegra                                          │
│  3. FIN (sin guardar mapeo)                                  │
│                                                             │
│  → Próxima sincronización: Se detectan de nuevo como        │
│    faltantes porque no hay mapeo                            │
└─────────────────────────────────────────────────────────────┘

FLUJO NUEVO (Correcto):
┌─────────────────────────────────────────────────────────────┐
│  1. Detectar productos faltantes                             │
│  2. Crear en Alegra                                          │
│  3. GUARDAR MAPEO en alegra_product_mapping                  │
│     → shopify_product_title                                  │
│     → shopify_variant_title                                  │
│     → shopify_sku                                            │
│     → alegra_item_id (del producto recién creado)            │
│     → alegra_item_name                                       │
│                                                             │
│  → Próxima sincronización: Se detecta el mapeo y            │
│    NO se marca como faltante                                 │
└─────────────────────────────────────────────────────────────┘
```

### Cambios Técnicos

#### Archivo: `src/components/alegra/AlegraProductSyncModal.tsx`

**1. Agregar información original de Shopify a los productos:**

Actualmente `MissingProduct` solo guarda el nombre combinado. Necesitamos guardar también el título y variante originales para crear el mapeo correcto.

```typescript
interface MissingProduct {
  name: string;                    // Nombre combinado (title + variant)
  shopifyTitle: string;            // NUEVO: Título original de Shopify
  shopifyVariantTitle: string | null; // NUEVO: Variante original
  sku: string | null;
  priceWithTax: number;
  priceWithoutTax: number;
  selected: boolean;
}
```

**2. Modificar detección para guardar datos originales:**

```typescript
missing.push({
  name: fullName,
  shopifyTitle: product.title,        // NUEVO
  shopifyVariantTitle: product.variant_title || null, // NUEVO
  sku: product.sku,
  priceWithTax,
  priceWithoutTax: Math.round(priceWithTax / 1.19),
  selected: true
});
```

**3. Crear mapeo después de cada creación exitosa:**

```typescript
const { data, error } = await supabase.functions.invoke('alegra-api', {
  body: { 
    action: 'create-items-bulk',
    data: { items: batch }
  }
});

// Después de crear, guardar los mapeos
if (data?.success && Array.isArray(data.data)) {
  for (let j = 0; j < data.data.length; j++) {
    const result = data.data[j];
    const originalProduct = batch[j]; // El producto original con datos de Shopify
    
    if (result.success && result.item?.id) {
      // Guardar mapeo en la base de datos
      await supabase.from('alegra_product_mapping').insert({
        organization_id: currentOrganization.id,
        shopify_product_title: originalProduct.shopifyTitle,
        shopify_variant_title: originalProduct.shopifyVariantTitle,
        shopify_sku: originalProduct.sku,
        alegra_item_id: result.item.id,
        alegra_item_name: result.item.name
      });
    }
  }
}
```

### Resultado Esperado

| Escenario | Antes | Después |
|-----------|-------|---------|
| Crear 173 productos | 173 en Alegra, 0 mapeos | 173 en Alegra, 173 mapeos |
| Siguiente sincronización | Detecta 173 "faltantes" | Detecta 0 "faltantes" |
| Duplicados | Sí, posibles | No |

### Consideración Adicional

Para los 173 productos que ya se crearon, se recomienda:
1. Verificar si realmente se crearon en Alegra
2. Si se crearon, crear los mapeos manualmente o ejecutar una sincronización inversa
3. Si hay duplicados, eliminarlos desde Alegra directamente

### Archivos a Modificar

- `src/components/alegra/AlegraProductSyncModal.tsx`
