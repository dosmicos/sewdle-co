

## Plan: Evitar Duplicados Usando Mapeos Existentes

### Problema Identificado

Los productos en Alegra **no tienen SKU asignado** en el campo `reference`, por lo que la verificación por SKU no funciona. Además, muchos productos tienen **nombres diferentes** en Shopify vs Alegra (ej: "Ruana Grinch - Navidad" en Shopify = "Ruana Grinch" en Alegra).

Sin embargo, ya existe una tabla `alegra_product_mapping` con **mapeos manuales** que vinculan productos de Shopify con IDs de Alegra:

```text
Ejemplo de mapeo existente:
┌─────────────────────────────────────────────────────────────────────┐
│ shopify_product_title: "Ruana Grinch - Navidad"                     │
│ shopify_sku:           "46996902150379"                             │
│ alegra_item_id:        "494"                                        │
│ alegra_item_name:      "Ruana Grinch"                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Solución Propuesta

Agregar una **tercera verificación** usando los mapeos existentes:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Para cada producto de Shopify:                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. ¿Tiene SKU que coincide en Alegra (reference)?                  │
│     ├─ SÍ → Ya existe, NO crear                                     │
│     └─ NO → Continuar                                               │
│                                                                     │
│  2. ¿Tiene nombre similar en Alegra (fuzzy matching)?               │
│     ├─ SÍ → Ya existe, NO crear                                     │
│     └─ NO → Continuar                                               │
│                                                                     │
│  3. ¿Tiene mapeo existente en alegra_product_mapping?  ← NUEVO      │
│     ├─ SÍ → Ya está vinculado, NO crear                             │
│     └─ NO → Producto faltante, agregar a lista                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Cambios Técnicos

#### Archivo: `src/components/alegra/AlegraProductSyncModal.tsx`

**1. Cargar mapeos existentes al inicio de la detección:**

```typescript
const detectMissingProducts = async () => {
  // ... código existente ...
  
  // NUEVO: Cargar mapeos existentes
  const { data: existingMappings } = await supabase
    .from('alegra_product_mapping')
    .select('shopify_product_title, shopify_variant_title, shopify_sku')
    .eq('organization_id', currentOrganization.id);
  
  // Crear Set para búsqueda rápida
  const mappedProducts = new Set<string>();
  const mappedSkus = new Set<string>();
  
  for (const m of existingMappings || []) {
    // Agregar combinación título+variante
    const key = `${m.shopify_product_title}|${m.shopify_variant_title || ''}`;
    mappedProducts.add(key.toLowerCase());
    
    // Agregar SKU si existe
    if (m.shopify_sku) {
      mappedSkus.add(m.shopify_sku.toLowerCase());
    }
  }
  
  // ... resto del código ...
};
```

**2. Agregar verificación por mapeo existente:**

```typescript
for (const [, product] of uniqueProducts) {
  const fullName = product.variant_title 
    ? `${product.title} ${product.variant_title}` 
    : product.title;
  
  // 1. Verificar por SKU en Alegra
  const skuMatch = findBySkuMatch(product.sku, alegraItems);
  if (skuMatch) continue;
  
  // 2. Verificar por nombre similar
  const nameMatch = findBestMatch(fullName, alegraItems);
  if (nameMatch) continue;
  
  // 3. NUEVO: Verificar si ya tiene mapeo existente
  const productKey = `${product.title}|${product.variant_title || ''}`.toLowerCase();
  if (mappedProducts.has(productKey)) {
    // Ya tiene mapeo manual, no crear
    continue;
  }
  
  // 4. NUEVO: Verificar si el SKU ya está mapeado
  if (product.sku && mappedSkus.has(product.sku.toLowerCase())) {
    // SKU ya tiene mapeo, no crear
    continue;
  }
  
  // Producto realmente faltante
  missing.push({
    name: fullName,
    sku: product.sku,
    priceWithTax: parseFloat(String(product.price)) || 0,
    priceWithoutTax: Math.round((parseFloat(String(product.price)) || 0) / 1.19),
    selected: true
  });
}
```

---

### Flujo Visual Actualizado

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Producto de Shopify: "Ruana Grinch - Navidad"                            │
│  SKU: 46996902150379                                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ❌ No hay match por SKU en Alegra (reference vacío)                      │
│                                                                          │
│  ❌ No hay match por nombre ("Ruana Grinch - Navidad" ≠ "Ruana Grinch")   │
│                                                                          │
│  ✅ EXISTE mapeo en alegra_product_mapping                                │
│     → shopify_product_title: "Ruana Grinch - Navidad"                    │
│     → alegra_item_id: 494                                                │
│                                                                          │
│  RESULTADO: NO crear (ya está vinculado)                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Resultado Esperado

| Escenario | Antes | Después |
|-----------|-------|---------|
| SKU coincide en Alegra | No se crea | No se crea |
| Nombre similar en Alegra | No se crea | No se crea |
| Tiene mapeo manual existente | SE CREA (duplicado) | NO se crea |
| SKU ya mapeado en tabla | SE CREA (duplicado) | NO se crea |
| Producto realmente nuevo | Se crea | Se crea |

---

### Beneficios

1. **Respeta mapeos manuales**: Si ya vinculaste "Ruana Grinch - Navidad" → "Ruana Grinch", no se duplica
2. **Cubre nombres diferentes**: No depende de que los nombres coincidan
3. **Verificación por SKU mapeado**: Si el SKU ya tiene mapeo, no se crea
4. **Compatible con lógica existente**: Las verificaciones anteriores siguen funcionando

---

### Archivo a Modificar

`src/components/alegra/AlegraProductSyncModal.tsx`

