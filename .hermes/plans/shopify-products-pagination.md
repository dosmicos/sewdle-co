# Fix: importador Shopify no encuentra todo el catálogo

## Root cause confirmado
- `supabase/functions/shopify-products/index.ts` consulta Shopify una sola vez con `limit=250`.
- Shopify REST devuelve máximo 250 productos por página y expone el siguiente lote en el header `Link` con `page_info`.
- `ShopifyProductImport` llama `shopify-products` con `searchTerm: ''` al montar el modal y luego filtra localmente; si el producto está fuera de la primera página, nunca puede aparecer.

## Cambio propuesto
1. Agregar paginación cursor-based (`page_info`) en `shopify-products` hasta agotar `rel="next"`.
2. Mantener el contrato actual de respuesta (`products`, `_metadata`) para no romper frontend.
3. Robustecer el filtro backend para tags string/array y variantes vacías.
4. Agregar helpers testeables para parseo de `Link` y filtro de búsqueda.
5. Ejecutar `deno test` scoped y build/lint del frontend si aplica.

## No tocar
- No importar productos.
- No cambiar stock/inventario.
- No desplegar Supabase a producción sin aprobación explícita.
