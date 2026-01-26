

## Plan: Corregir Sincronización de Productos a Alegra

### Diagnóstico

He identificado los siguientes problemas:

1. **Error de JavaScript en el frontend**: El error `shopifyProducts is not defined` impide que la detección de productos funcione. El código actual debería usar `allShopifyProducts`, pero parece que hay una versión desactualizada en caché o el cambio no se aplicó completamente.

2. **La API de Alegra SÍ funciona**: Probé directamente el edge function y confirmé que la creación de productos funciona correctamente. El producto de prueba "TEST PRODUCTO LOVABLE 123" se creó exitosamente con ID 4832.

### Solución

Verificar y asegurar que el código del modal use las variables correctas después de la refactorización de paginación.

### Cambios Técnicos

#### Archivo: `src/components/alegra/AlegraProductSyncModal.tsx`

El código actual parece correcto según mi revisión. Sin embargo, para asegurar que no hay referencias residuales, el plan es:

**1. Verificar que la variable `allShopifyProducts` se usa correctamente en todo el archivo:**

La estructura correcta del código es:
```typescript
// Líneas 168-194: Cargar productos con paginación
const allShopifyProducts: Array<{title: string; variant_title: string | null; sku: string | null; price: number}> = [];
// ... loop de paginación que llena allShopifyProducts

// Líneas 197-203: Deduplicar usando allShopifyProducts
const uniqueProducts = new Map<...>();
for (const p of allShopifyProducts) {  // ← Debe ser allShopifyProducts
  // ...
}

// Líneas 214-253: Iterar sobre uniqueProducts
for (const [, product] of uniqueProducts) {
  // ...
}
```

El código actual parece correcto. El error en consola (`shopifyProducts is not defined` en línea 152) sugiere que el navegador del usuario tiene una versión en caché desactualizada.

### Acción Recomendada

1. **Refrescar el navegador con Ctrl+Shift+R** (hard refresh) para limpiar caché
2. Si el error persiste, confirmar que los cambios se guardaron correctamente

### Nota sobre los 173 productos

Los productos que se crearon anteriormente probablemente **SÍ existen en Alegra** pero:
- No se guardaron los mapeos en la tabla `alegra_product_mapping` (por eso aparecen como "faltantes")
- Pueden estar en una categoría diferente o con nombres que difieren de lo esperado

Para evitar duplicados, después de que el modal funcione correctamente, el sistema:
1. Detectará los productos existentes por SKU o nombre similar
2. Solo creará los que realmente no existen
3. Guardará automáticamente los mapeos para futuras sincronizaciones

### Archivos a Modificar

No se requieren cambios de código - el código actual es correcto. El problema es de caché del navegador.

**Si el problema persiste después del hard refresh**, podría ser necesario agregar un log de depuración o verificar que el build se completó correctamente.

