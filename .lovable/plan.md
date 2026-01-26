
## Plan: Usar Precios de Productos Más Recientes

### Problema Actual

El código actual:
1. Ordena los productos por `title` (alfabéticamente)
2. Durante la deduplicación, usa el **primer** precio encontrado
3. Esto significa que si "Camiseta Dosmicos Classic" aparece varias veces con diferentes precios, se usa el precio de la primera ocurrencia (no necesariamente la más reciente)

### Solución

Modificar la consulta para ordenar por fecha descendente (`created_at DESC`) para que los productos más recientes aparezcan primero durante la deduplicación.

### Cambios Técnicos

#### Archivo: `src/components/alegra/AlegraProductSyncModal.tsx`

**1. Incluir `created_at` en la consulta y ordenar por fecha descendente:**

```typescript
// Línea 176: Agregar created_at al select
.select('title, variant_title, sku, price, created_at')

// Línea 179: Cambiar orden de 'title' a 'created_at' descendente
.order('created_at', { ascending: false })
```

**2. Actualizar tipo del array:**

```typescript
// Línea 168
const allShopifyProducts: Array<{
  title: string; 
  variant_title: string | null; 
  sku: string | null; 
  price: number;
  created_at: string;
}> = [];
```

### Flujo Corregido

```text
ANTES:
┌─────────────────────────────────────────────────────────────────┐
│  Orden: Alfabético por título                                    │
│  "Camiseta Dosmicos Classic" - $15.000 (Enero 2025)             │
│  "Camiseta Dosmicos Classic" - $20.924 (Enero 2026) ← Ignorado  │
│  Resultado: Precio usado = $15.000 (antiguo)                    │
└─────────────────────────────────────────────────────────────────┘

DESPUÉS:
┌─────────────────────────────────────────────────────────────────┐
│  Orden: Fecha descendente (más reciente primero)                │
│  "Camiseta Dosmicos Classic" - $20.924 (Enero 2026) ← Primero   │
│  "Camiseta Dosmicos Classic" - $15.000 (Enero 2025) ← Ignorado  │
│  Resultado: Precio usado = $20.924 (reciente)                   │
└─────────────────────────────────────────────────────────────────┘
```

### Resultado Esperado

| Producto | Precio Antes | Precio Después |
|----------|--------------|----------------|
| Camiseta Dosmicos Classic | $16.723 (histórico) | Precio más reciente |
| Camiseta Dosmicos Clean Tee | $20.924 (histórico) | Precio más reciente |
| Chaleco Corazones Dosmicos | $58.739 (histórico) | Precio más reciente |

### Archivos a Modificar

- `src/components/alegra/AlegraProductSyncModal.tsx`
