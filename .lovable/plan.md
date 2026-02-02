
# Plan: Corregir Errores de Carga en Picking & Packing

## Problemas Identificados

Hay **3 problemas críticos** que se introdujeron con la implementación anterior:

### 1. El modal se queda en "Cargando orden..." indefinidamente
**Causa**: Cuando cambia el `orderId`, el `localOrder` se resetea a `null` inmediatamente (línea 317), pero el `debouncedOrderId` tarda 300ms en actualizarse. Durante ese tiempo, `effectiveOrder` es `null` y la UI queda en loading.

### 2. Los artículos muestran "0 unidades"
**Causa**: El fetch de line items depende de `effectiveOrder?.shopify_order?.shopify_order_id`. Si `effectiveOrder` es null, la función retorna sin hacer el fetch.

### 3. No aparece el selector de transportadora ni el botón de reintento
**Causa**: El toast "Error al cargar etiquetas disponibles" se dispara repetidamente por errores de red en `getExistingLabel`. Sin `shippingAddress` válido (porque `effectiveOrder` es null), el componente de envío no renderiza las cotizaciones.

## Solución

La solución requiere **corregir la sincronización de estados** entre el debounce y la carga de datos:

### Cambio 1: No resetear localOrder a null inmediatamente

El reset de `localOrder` a `null` causa que `effectiveOrder` sea null. En vez de resetear, debemos:
1. Mantener el `localOrder` anterior mientras carga el nuevo
2. Solo resetear cuando el nuevo orden esté disponible

```typescript
// ANTES (problemático)
useEffect(() => {
  setLocalOrder(null);  // ❌ Causa effectiveOrder = null
  // ...
}, [orderId]);

// DESPUÉS (corregido)
useEffect(() => {
  // NO resetear localOrder aquí - mantener datos anteriores
  // Solo resetear estados de verificación
  setNotes('');
  setShopifyNote('');
  setLineItems([]);
  setLoadingItems(true);
  setSkuInput('');
  setVerificationResult(null);
  setVerifiedCounts(new Map());
  setShowScrollHint(false);
}, [orderId]);
```

### Cambio 2: Eliminar el debounce problemático

El debounce de 300ms no es necesario porque React Query ya maneja la caché. El debounce causa más problemas de los que resuelve:

```typescript
// ANTES (problemático)
const [debouncedOrderId, setDebouncedOrderId] = useState<string>(orderId);

useEffect(() => {
  const timeoutId = setTimeout(() => {
    setDebouncedOrderId(orderId);
  }, 300);
  return () => clearTimeout(timeoutId);
}, [orderId]);

// DESPUÉS (simplificado)
// Usar orderId directamente, React Query maneja la caché
const { order: cachedOrder, isLoading } = usePickingOrderDetails(orderId);
```

### Cambio 3: Mejorar la lógica de effectiveOrder

```typescript
// ANTES
const effectiveOrder = localOrder || cachedOrder || order;

// DESPUÉS - Priorizar cachedOrder cuando coincide con el orderId actual
const effectiveOrder = useMemo(() => {
  if (cachedOrder && cachedOrder.id === orderId) return cachedOrder;
  if (localOrder && localOrder.id === orderId) return localOrder;
  return order;
}, [cachedOrder, localOrder, order, orderId]);
```

### Cambio 4: Suprimir toasts repetitivos de error de red

El error "Error al cargar etiquetas disponibles" se repite múltiples veces. Agregar guard para no mostrar toast repetidamente:

```typescript
// En useEnviaShipping.ts - getExistingLabel
if (error) {
  // Solo log, no toast - es una verificación de background
  console.error('Error fetching labels:', error);
  return null;
}
```

### Cambio 5: Mantener line items del pedido anterior mientras carga el nuevo

```typescript
// En el useEffect de fetchLineItems - no limpiar inmediatamente
const fetchLineItems = async () => {
  const currentShopifyOrderId = effectiveOrder?.shopify_order?.shopify_order_id;
  if (!currentShopifyOrderId) return;
  
  // Solo mostrar loading si no hay items previos
  if (lineItems.length === 0) {
    setLoadingItems(true);
  }
  // ...resto del código
};
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/picking/PickingOrderDetailsModal.tsx` | Eliminar debounce, corregir reset de localOrder, mejorar effectiveOrder |
| `src/features/shipping/hooks/useEnviaShipping.ts` | Suprimir toast de error en getExistingLabel |

## Resultado Esperado

1. El modal carga el pedido inmediatamente sin quedarse en "Cargando orden..."
2. Los artículos se muestran correctamente con las cantidades
3. El selector de transportadora aparece o muestra el botón de reintento
4. Los datos del pedido anterior se mantienen visibles mientras carga el nuevo (mejor UX)
5. No más toasts repetitivos de error de red
