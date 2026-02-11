

## Plan: Sincronizacion completa de productos y variantes de Shopify a Sewdle

### Problema

Actualmente el sistema tiene una herramienta manual (`VariantSyncManager`) donde debes:
1. Hacer clic en "Detectar Variantes"
2. Seleccionar las variantes nuevas
3. Hacer clic en "Sincronizar"

Esto deja variantes sin sincronizar si no se ejecuta regularmente. Ademas, la funcion `shopify-products` solo trae 250 productos (1 pagina REST) sin paginacion completa.

### Solucion

Crear una nueva Edge Function `sync-all-shopify-products` que haga una sincronizacion completa automatica:

1. Obtiene TODOS los productos y variantes de Shopify usando GraphQL con paginacion (como ya hace `detect-new-variants`)
2. Para cada variante, busca o crea el producto base en Sewdle
3. Crea las variantes faltantes automaticamente
4. Actualiza stock y precio de variantes existentes

Luego agregar un boton "Sincronizar Todo" en la pagina de productos que ejecute esta funcion con un solo clic.

### Detalle tecnico

#### 1. Nueva Edge Function: `supabase/functions/sync-all-shopify-products/index.ts`

- Usa GraphQL API de Shopify con paginacion (como `detect-new-variants`) para obtener TODOS los productos
- Para cada producto de Shopify:
  - Busca producto en Sewdle por nombre (ilike)
  - Si no existe, lo crea en `products`
  - Para cada variante:
    - Busca por `sku_variant` en `product_variants`
    - Si no existe, la crea con size/color extraidos de las opciones
    - Si existe, actualiza `stock_quantity` con el valor de Shopify
- Retorna resumen: productos procesados, variantes creadas, variantes actualizadas, errores
- Procesa en lotes para evitar timeouts

#### 2. Nuevo Hook: `src/hooks/useFullShopifySync.ts`

- Llama a la edge function `sync-all-shopify-products`
- Maneja estados de loading/progress/resultados
- Muestra toast con resumen al finalizar

#### 3. Modificar: `src/pages/ProductsPage.tsx`

- Agregar boton "Sincronizar Todo desde Shopify" en la pestana de catalogo o en el header
- Al hacer clic, ejecuta la sincronizacion completa
- Muestra progreso y resultados

#### 4. Modificar: `src/components/VariantSyncManager.tsx`

- Agregar boton de "Sincronizar Todo Automaticamente" ademas del flujo manual existente
- Mostrar resultados de la sincronizacion completa

### Flujo

```text
[Boton "Sincronizar Todo"]
        |
        v
[Edge Function: sync-all-shopify-products]
        |
        v
[GraphQL API Shopify - paginado]
        |
        v
[Para cada producto]
  ├── Buscar en Sewdle por nombre
  ├── Si no existe -> Crear producto
  └── Para cada variante
       ├── Buscar por SKU en product_variants
       ├── Si no existe -> Crear variante
       └── Si existe -> Actualizar stock
        |
        v
[Retornar resumen]
```

### Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `supabase/functions/sync-all-shopify-products/index.ts` | Crear |
| `src/hooks/useFullShopifySync.ts` | Crear |
| `src/components/VariantSyncManager.tsx` | Modificar - agregar boton sync total |
| `src/pages/ProductsPage.tsx` | Modificar - agregar boton en header |

