
# Plan: Corregir Errores de Carga en Picking & Packing

## ✅ COMPLETADO - v2

Correcciones implementadas:

### Optimizaciones de rendimiento
1. **Eliminado debounce problemático**: React Query ya maneja caché, no se necesita debounce
2. **effectiveOrder con useMemo**: Valida que el orden coincida con `orderId` actual
3. **No se resetea localOrder a null**: Se mantienen datos anteriores durante transición
4. **Loading state inteligente**: Solo muestra loading si realmente no hay datos
5. **Cache de etiquetas (tags)**: Hook useShopifyTags ahora usa cache de 5 minutos a nivel de módulo
6. **Toast de error de tags suprimido**: No más spam de "Error al cargar etiquetas disponibles"

### Cotización de envío - 1 intento máximo
7. **Cotización automática limitada a 1 intento**: Sin reintentos automáticos (maxRetries: 0)
8. **Botón de reintento visible**: Si falla, muestra Alert con botón "Reintentar" prominente
9. **Timeout de 8 segundos**: Evita esperas largas en cotización

### UI mejorada
10. **Badge "Cargando..." en lugar de "0 unidades"**: Muestra spinner mientras carga los artículos
11. **lineItems no se resetean inmediatamente**: Previene flash de "0 unidades" al cambiar de orden

## Cambios Realizados

- `src/components/picking/PickingOrderDetailsModal.tsx`: Badge con loading state, no resetear lineItems
- `src/features/shipping/components/EnviaShippingButton.tsx`: Cotización 1 intento, retry button
- `src/hooks/useShopifyTags.ts`: Cache 5 min, toast suprimido
- `src/hooks/usePickingOrderDetails.ts`: AbortError no cachea null
