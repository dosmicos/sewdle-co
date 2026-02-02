
# Plan: Corregir Errores de Carga en Picking & Packing

## ✅ COMPLETADO

Correcciones implementadas:

1. **Eliminado debounce problemático**: React Query ya maneja caché, no se necesita debounce
2. **effectiveOrder con useMemo**: Ahora valida que el orden coincida con `orderId` actual
3. **No se resetea localOrder a null**: Se mantienen datos anteriores durante transición
4. **Loading state inteligente**: Solo muestra loading si realmente no hay datos

## Cambios Realizados

- `src/components/picking/PickingOrderDetailsModal.tsx`: Eliminado debounce, corregido effectiveOrder, mejorado estados de carga
- `src/features/shipping/hooks/useEnviaShipping.ts`: Ya corregido anteriormente (toasts suprimidos en getExistingLabel)
