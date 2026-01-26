

## Plan: Mejorar Detección con Comparación por SKU

### Problema Actual

La lógica actual en `AlegraProductSyncModal.tsx` solo compara productos por nombre:

```typescript
// Línea 67 - Solo compara nombres
const score = calculateSimilarity(productName, item.name);
```

Esto causa que productos con el **mismo SKU pero diferente nombre** se marquen incorrectamente como faltantes y se intenten crear duplicados en Alegra.

---

### Solución Propuesta

Agregar una verificación por SKU **antes** de la comparación por nombre. Si el SKU de Shopify coincide con el `reference` de Alegra, el producto ya existe y NO debe crearse.

---

### Lógica de Comparación Mejorada

```text
┌─────────────────────────────────────────────────────────────┐
│  Para cada producto de Shopify:                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. ¿El producto tiene SKU?                                 │
│     │                                                       │
│     ├─ SÍ → ¿Existe en Alegra con ese SKU (reference)?      │
│     │       │                                               │
│     │       ├─ SÍ → ✓ Ya existe, NO crear                   │
│     │       │                                               │
│     │       └─ NO → Continuar a paso 2                      │
│     │                                                       │
│     └─ NO → Continuar a paso 2                              │
│                                                             │
│  2. Comparar por nombre (fuzzy matching)                    │
│     │                                                       │
│     ├─ Match > 60% → ✓ Ya existe, NO crear                  │
│     │                                                       │
│     └─ Sin match → ✗ Faltante, agregar a lista              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Cambios Técnicos

#### Archivo: `src/components/alegra/AlegraProductSyncModal.tsx`

**1. Nueva función para buscar por SKU:**

```typescript
const findBySkuMatch = (sku: string | null, alegraItems: AlegraItem[]): AlegraItem | null => {
  if (!sku || sku.trim() === '') return null;
  
  const normalizedSku = sku.toLowerCase().trim();
  
  return alegraItems.find(item => {
    if (!item.reference) return false;
    return item.reference.toLowerCase().trim() === normalizedSku;
  }) || null;
};
```

**2. Modificar la lógica de detección (líneas 145-161):**

```typescript
for (const [, product] of uniqueProducts) {
  const fullName = product.variant_title 
    ? `${product.title} ${product.variant_title}` 
    : product.title;
  
  // NUEVO: Primero verificar por SKU
  const skuMatch = findBySkuMatch(product.sku, alegraItems);
  if (skuMatch) {
    // Producto ya existe por SKU, no es faltante
    continue;
  }
  
  // Si no hay match por SKU, buscar por nombre
  const nameMatch = findBestMatch(fullName, alegraItems);
  
  if (!nameMatch) {
    const priceWithTax = parseFloat(String(product.price)) || 0;
    missing.push({
      name: fullName,
      sku: product.sku,
      priceWithTax,
      priceWithoutTax: Math.round(priceWithTax / 1.19),
      selected: true
    });
  }
}
```

---

### Resultado Esperado

| Escenario | Antes | Después |
|-----------|-------|---------|
| Producto con mismo SKU en Alegra | Se marca como faltante | NO se marca (ya existe) |
| Producto con mismo nombre | NO se marca | NO se marca |
| Producto nuevo sin SKU | Se marca | Se marca |
| Producto nuevo con SKU único | Se marca | Se marca |

---

### Beneficios

1. **Evita duplicados**: Productos con mismo SKU no se crean dos veces
2. **Más preciso**: SKU es identificador único, más confiable que nombre
3. **Prioriza SKU**: Verificación por SKU es más rápida que fuzzy matching
4. **Compatible**: Sigue funcionando para productos sin SKU

