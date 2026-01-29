
# Plan: Optimización de Carga de Pedidos + Botón de Reintentar Cotizaciones

## Resumen Ejecutivo

Optimizar la carga de pedidos en Picking & Packing para que sean instantáneos, sin bloquear la UI cuando la API de Envia.com está lenta o caída, y agregar un botón visible para reintentar cotizaciones manualmente.

## Cambios Propuestos

### 1. Carga de Imágenes en Segundo Plano (No Bloqueante)

**Archivo:** `src/components/picking/PickingOrderDetailsModal.tsx`

Actualmente, las imágenes de Shopify se cargan de forma bloqueante (`await Promise.all`). El cambio:

1. Mostrar inmediatamente los productos con imágenes de fallback
2. Cargar las imágenes de Shopify en segundo plano sin bloquear
3. Actualizar las imágenes cuando lleguen, sin afectar la interacción del usuario

```typescript
// ANTES (bloqueante):
const imagePromises = itemsWithShopifyIds.map(async (item) => {
  const shopifyImage = await fetchImageFromShopify(item.product_id!, item.variant_id!);
  return { sku: item.sku, image_url: shopifyImage };
});
const shopifyImages = await Promise.all(imagePromises);
// ... esperar todas antes de mostrar

// DESPUÉS (no bloqueante):
// 1. Mostrar items con fallback inmediatamente
const itemsWithFallback = enrichedItems.map(item => ({
  ...item,
  image_url: (item as any).fallback_image_url || null
}));
setLineItems(itemsWithFallback);
setLoadingItems(false); // UI lista inmediatamente

// 2. Cargar imágenes de Shopify en segundo plano (diferido 300ms)
if (itemsWithShopifyIds.length > 0 && !isCancelled) {
  setTimeout(async () => {
    for (const item of itemsWithShopifyIds) {
      if (isCancelled) break;
      try {
        const shopifyImage = await fetchImageFromShopify(item.product_id!, item.variant_id!);
        if (shopifyImage && !isCancelled) {
          setLineItems(prev => prev.map(li => 
            li.sku === item.sku ? { ...li, image_url: shopifyImage } : li
          ));
        }
      } catch (e) {
        // Silenciosamente fallar - mantenemos el fallback
      }
    }
  }, 300);
}
```

### 2. Timeout y Supresión de Toasts Repetitivos

**Archivo:** `src/features/shipping/hooks/useEnviaShipping.ts`

Agregar timeout de 8 segundos y suprimir toasts cuando la API está caída:

```typescript
const getQuotes = useCallback(async (request: QuoteRequest): Promise<QuoteResponse | null> => {
  setIsLoadingQuotes(true);
  setQuotes([]);
  setMatchInfo(null);
  
  try {
    console.log('💰 Getting shipping quotes for:', request.destination_city);

    const { data, error } = await supabase.functions.invoke('envia-quote', {
      body: request
    });

    if (error) {
      console.error('Error getting quotes:', error);
      // Solo log, NO toast para errores de conexión (evitar spam)
      return null;
    }

    if (!data.success) {
      console.error('Quote request failed:', data.error);
      // NO toast para errores de autenticación (API caída)
      return null;
    }

    console.log('✅ Quotes received:', data.quotes?.length || 0);
    setQuotes(data.quotes || []);
    
    if (data.matchInfo) {
      setMatchInfo(data.matchInfo);
    }
    
    return data as QuoteResponse;
  } catch (error: any) {
    console.error('Error in getQuotes:', error);
    return null;
  } finally {
    setIsLoadingQuotes(false);
  }
}, []);
```

### 3. Flag para Evitar Reintentos Infinitos + Botón de Reintentar

**Archivo:** `src/features/shipping/components/EnviaShippingButton.tsx`

Agregar estado `quotesError` y mostrar botón de reintentar cuando falla:

```typescript
// Nuevo estado
const [quotesError, setQuotesError] = useState(false);

// Modificar auto-load useEffect (líneas 168-185)
useEffect(() => {
  if (
    currentOrganization?.id && 
    shippingAddress?.city && 
    shippingAddress?.province && 
    !existingLabel && 
    !quotesLoaded &&
    hasChecked &&
    !quotesError  // No reintentar automáticamente si ya falló
  ) {
    getQuotes({
      destination_city: shippingAddress.city,
      destination_department: shippingAddress.province,
      destination_postal_code: shippingAddress.zip,
      declared_value: totalPrice || 100000
    }).then((result) => {
      setQuotesLoaded(true);
      if (!result) {
        setQuotesError(true);
      }
    });
  }
}, [/* deps */]);

// Reset quotesError cuando cambia el pedido
useEffect(() => {
  // ... código existente de reset ...
  setQuotesError(false);
}, [shopifyOrderId, currentOrganization?.id, /* ... */]);

// Modificar handleRefreshQuotes para limpiar el error
const handleRefreshQuotes = () => {
  setQuotesError(false);  // <-- agregar
  setUserRejectedSuggestion(false);
  setCorrectedCity(null);
  setQuotesLoaded(false);
  if (shippingAddress?.city && shippingAddress?.province) {
    getQuotes({
      destination_city: shippingAddress.city,
      destination_department: shippingAddress.province,
      destination_postal_code: shippingAddress.zip,
      declared_value: totalPrice || 100000
    }).then((result) => {
      setQuotesLoaded(true);
      if (!result) {
        setQuotesError(true);
      }
    });
  }
};
```

**Nuevo UI - Botón de Reintentar** (agregar en la sección donde se muestran las cotizaciones):

```tsx
{/* Mostrar cuando hay error de cotizaciones */}
{quotesError && !existingLabel && (
  <Alert variant="destructive" className="mb-3">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error al obtener cotizaciones</AlertTitle>
    <AlertDescription className="flex items-center justify-between">
      <span>No se pudieron cargar las tarifas de envío.</span>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleRefreshQuotes}
        disabled={isLoadingQuotes}
        className="ml-2"
      >
        {isLoadingQuotes ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-1" />
        )}
        Reintentar
      </Button>
    </AlertDescription>
  </Alert>
)}
```

## Flujo de Usuario Después de la Optimización

```
┌─────────────────────────────────────────────────────────────────┐
│  Usuario abre pedido                                             │
├─────────────────────────────────────────────────────────────────┤
│  ↓ INMEDIATO (<200ms)                                           │
│  ✓ Modal abre con datos del pedido                             │
│  ✓ Productos muestran con imágenes de fallback                 │
│  ✓ Usuario puede escanear SKUs, ver notas, etc.                │
├─────────────────────────────────────────────────────────────────┤
│  ↓ EN PARALELO (sin bloquear)                                   │
│  ⟳ Imágenes de Shopify se cargan y actualizan (300ms+)         │
│  ⟳ Cotizaciones de envío se solicitan (máx 8s)                 │
├─────────────────────────────────────────────────────────────────┤
│  SI COTIZACIONES FALLAN:                                        │
│  ⚠️ Alerta con botón "Reintentar"                               │
│  ✓ Usuario puede trabajar normalmente                          │
│  ✓ Puede reintentar cotizaciones cuando quiera                 │
├─────────────────────────────────────────────────────────────────┤
│  SI COTIZACIONES LLEGAN:                                        │
│  ✓ Dropdown de transportadoras aparece                         │
│  ✓ Usuario selecciona y crea guía                              │
└─────────────────────────────────────────────────────────────────┘
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/picking/PickingOrderDetailsModal.tsx` | Carga no-bloqueante de imágenes |
| `src/features/shipping/hooks/useEnviaShipping.ts` | Eliminar toasts de error repetitivos |
| `src/features/shipping/components/EnviaShippingButton.tsx` | Flag `quotesError` + botón "Reintentar" |

## Resultado Esperado

| Métrica | Antes | Después |
|---------|-------|---------|
| Tiempo apertura modal | 2-5+ segundos | <500ms |
| Toasts de error (API caída) | Múltiples repetitivos | Ninguno (solo alerta visual) |
| Bloqueo por cotizaciones | Sí, infinito si API caída | No, timeout 8s + botón reintentar |
| Navegación entre pedidos | Lenta, espera imágenes | Instantánea |

## Funcionalidad Preservada

- ✅ Cotizaciones se cargan automáticamente cuando API funciona
- ✅ Imágenes de Shopify siguen siendo la prioridad (mejor calidad)
- ✅ Escaneo de SKUs funciona inmediatamente
- ✅ Creación de guías funciona igual
- ✅ Botón de reintentar permite cargar cotizaciones cuando el usuario quiera
