

## Plan: Sincronizar Productos de Shopify a Alegra

### Problema Identificado

Los productos nuevos vendidos en Shopify no existen en el catálogo de Alegra, lo que impide:
1. Mapearlos correctamente para facturación
2. Control de inventario en Alegra
3. Contabilidad precisa

La API de Alegra permite crear productos (`POST /items`), pero actualmente esta funcionalidad no está implementada.

---

### Solución Propuesta

Agregar un botón **"Sincronizar Productos"** en el módulo de Alegra que:
1. Obtiene todos los productos únicos de Shopify (desde `shopify_order_line_items`)
2. Compara con el catálogo actual de Alegra
3. Crea los productos que faltan en Alegra con IVA 19%
4. Muestra un resumen de sincronización

---

### Arquitectura

```text
┌────────────────────────────────────────────────────────────────┐
│  AlegraProductMapper.tsx                                        │
├────────────────────────────────────────────────────────────────┤
│  [🔄 Sincronizar Productos Nuevos]                              │
│        │                                                        │
│        ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. Cargar productos únicos de Shopify                    │  │
│  │     (SELECT DISTINCT title, variant_title, sku, price     │  │
│  │      FROM shopify_order_line_items)                       │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  2. Cargar catálogo completo de Alegra                    │  │
│  │     (GET /items paginado)                                 │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  3. Comparar por nombre (fuzzy matching)                  │  │
│  │     → Identificar productos faltantes                     │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  4. Crear productos en Alegra                             │  │
│  │     (POST /items con IVA 19%)                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

### Interfaz de Usuario

#### Nuevo botón en la sección "Catálogo de Alegra":

```text
┌─────────────────────────────────────────────────────────────────┐
│  📦 Catálogo de Alegra                                          │
├─────────────────────────────────────────────────────────────────┤
│  Busca productos en tu catálogo de Alegra para vincularlos...   │
│                                                                 │
│  [Buscar...]                  [🔍] [🔄 Refrescar]               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 💡 Sincronizar Productos Nuevos                            │  │
│  │                                                            │  │
│  │ Detecta productos vendidos en Shopify que no existen       │  │
│  │ en Alegra y los crea automáticamente.                      │  │
│  │                                                            │  │
│  │ [🔄 Detectar y Sincronizar Productos]                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ID    Nombre                    Precio     Vinculado           │
│  ───────────────────────────────────────────────────────────── │
│  ...                                                            │
└─────────────────────────────────────────────────────────────────┘
```

#### Modal de sincronización:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Sincronizar Productos a Alegra                            [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 Análisis de Productos                                       │
│  ───────────────────────────────────────────────────────────── │
│  Productos en Shopify:         45                               │
│  Ya existen en Alegra:         32                               │
│  Faltantes por crear:          13                               │
│                                                                 │
│  Productos a crear:                                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ☑️ Ruana Castor                     $89,900 + IVA         │  │
│  │ ☑️ Chaleco Osito Bebé               $75,000 + IVA         │  │
│  │ ☑️ Camiseta Clean Tee Niño          $24,900 + IVA         │  │
│  │ ...                                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Cancelar]                       [Crear 13 Productos en Alegra]│
└─────────────────────────────────────────────────────────────────┘
```

---

### Archivos a Modificar

#### 1. `supabase/functions/alegra-api/index.ts`

Agregar nueva acción `create-item`:

```typescript
case "create-item": {
  // Create a new item/product in Alegra
  const item = data?.item || {};
  
  if (!item.name) {
    throw new Error("Nombre del producto requerido");
  }
  
  const itemPayload = {
    name: item.name,
    description: item.description || "",
    reference: item.reference || null,  // SKU
    price: item.price || 0,  // Precio sin IVA
    tax: item.tax || [{ id: 3 }],  // ID 3 = IVA 19% en Alegra Colombia
    category: item.category || null,
    inventory: item.inventory || { unit: "unit" },
    type: "product"
  };
  
  console.log("Creating item:", JSON.stringify(itemPayload, null, 2));
  result = await makeAlegraRequest("/items", "POST", itemPayload);
  console.log("Item created:", JSON.stringify(result, null, 2));
  break;
}

case "create-items-bulk": {
  // Create multiple items
  const items = data?.items || [];
  const results = [];
  
  for (const item of items) {
    try {
      const itemPayload = {
        name: item.name,
        reference: item.reference || null,
        price: item.price || 0,
        tax: [{ id: 3 }],  // IVA 19%
        inventory: { unit: "unit" },
        type: "product"
      };
      
      const created = await makeAlegraRequest("/items", "POST", itemPayload);
      results.push({ success: true, item: created });
      
      // Small delay to avoid rate limiting
      await sleep(200);
    } catch (err) {
      results.push({ 
        success: false, 
        name: item.name, 
        error: (err as any)?.message 
      });
    }
  }
  
  result = results;
  break;
}
```

#### 2. `src/components/alegra/AlegraProductMapper.tsx`

Agregar componente de sincronización:

**Nuevos estados:**
- `isSyncing`: Indica si está ejecutando la sincronización
- `syncModalOpen`: Controla la visibilidad del modal
- `shopifyProducts`: Lista de productos únicos de Shopify
- `missingProducts`: Productos que no existen en Alegra
- `syncProgress`: Progreso de la sincronización

**Nuevas funciones:**
- `detectMissingProducts()`: Compara Shopify vs Alegra
- `syncProductsToAlegra()`: Crea los productos faltantes
- Reutilizar `findBestAlegraMatch()` del BulkInvoiceCreator

**Nueva UI:**
- Card de sincronización con explicación
- Botón "Detectar y Sincronizar"
- Modal con lista de productos a crear
- Checkboxes para seleccionar qué productos crear
- Barra de progreso durante creación

---

### Lógica de Detección de Productos Faltantes

```typescript
async function detectMissingProducts() {
  // 1. Obtener productos únicos de Shopify (últimos 6 meses)
  const { data: shopifyProducts } = await supabase
    .from('shopify_order_line_items')
    .select('title, variant_title, sku, price')
    .eq('organization_id', currentOrganization.id)
    .gte('created_at', sixMonthsAgo)
    .order('title');
  
  // 2. Deduplicar por título+variante
  const uniqueProducts = new Map();
  for (const p of shopifyProducts) {
    const key = `${p.title}|${p.variant_title || ''}`;
    if (!uniqueProducts.has(key)) {
      uniqueProducts.set(key, p);
    }
  }
  
  // 3. Cargar catálogo completo de Alegra
  const alegraItems = await loadAllAlegraItems();
  
  // 4. Comparar y encontrar faltantes
  const missing = [];
  for (const [key, product] of uniqueProducts) {
    const fullName = product.variant_title 
      ? `${product.title} ${product.variant_title}` 
      : product.title;
    
    const match = findBestMatch(fullName, alegraItems);
    if (!match || match.score < 0.6) {
      missing.push({
        name: fullName,
        sku: product.sku,
        priceWithTax: product.price,
        priceWithoutTax: Math.round(product.price / 1.19)
      });
    }
  }
  
  return missing;
}
```

---

### Formato de Creación de Productos en Alegra

Según la documentación de Alegra (POST /items):

```json
{
  "name": "Ruana Castor",
  "description": "Producto sincronizado desde Shopify",
  "reference": "SKU-123456",  // SKU de Shopify
  "price": [
    {
      "idPriceList": 1,
      "price": 75546.22  // Precio SIN IVA (÷ 1.19)
    }
  ],
  "tax": [
    { "id": 3 }  // IVA 19%
  ],
  "inventory": {
    "unit": "unit"
  },
  "type": "product"
}
```

---

### Manejo de Errores

| Escenario | Acción |
|-----------|--------|
| Producto ya existe en Alegra | Omitir con log informativo |
| Error de rate limit | Reintentar con backoff |
| Error de validación | Mostrar en resumen |
| Producto sin precio | Crear con precio $0 (editable en Alegra) |

---

### Resultado Esperado

| Antes | Después |
|-------|---------|
| Productos nuevos no aparecen | Botón detecta y crea automáticamente |
| Mapeo manual obligatorio | Productos ya existen para mapear |
| Sin sincronización | Sincronización en un click |

---

### Sección Técnica

**Archivos a modificar:**
1. `supabase/functions/alegra-api/index.ts` - Agregar acciones `create-item` y `create-items-bulk`
2. `src/components/alegra/AlegraProductMapper.tsx` - UI de sincronización

**Dependencias reutilizadas:**
- `makeAlegraRequest()` con retry/backoff
- Tabla `shopify_order_line_items` para productos de Shopify
- Lógica de matching de `BulkInvoiceCreator`

**Consideraciones:**
- IVA 19% aplicado automáticamente (ID de tax = 3 en Alegra Colombia)
- Precio enviado sin IVA (el sistema de Alegra lo calcula)
- SKU de Shopify usado como "reference" en Alegra
- Delay de 200ms entre creaciones para evitar rate limiting

