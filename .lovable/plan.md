
# Plan: Optimización de Rendimiento y Resiliencia del Módulo Picking & Packing

## Resumen Ejecutivo

Este plan resuelve dos problemas críticos identificados en el sistema de Picking & Packing:
1. **Rendimiento lento** al cambiar entre pedidos
2. **Loop infinito** cuando la API de Envia.com falla

---

## Problema 1: Rendimiento Lento al Cargar Pedidos

### Análisis del Estado Actual

El componente `PickingOrderDetailsModal` actualmente:
- Carga datos del pedido directamente con `supabase.from()` en cada apertura
- Ya tiene `AbortController` implementado (líneas 239-309) para cancelar requests pendientes
- Carga las cotizaciones de envío de forma **sincrónica/bloqueante** en `EnviaShippingButton`
- Las imágenes de variantes se cargan en paralelo correctamente

**Problemas identificados:**
1. No hay caché entre cambios de pedido - cada vez se hace fetch completo
2. Las cotizaciones de envío bloquean la UI mientras cargan
3. No hay debounce al cambiar rápidamente entre pedidos

### Solución Técnica

#### 1.1 Implementar React Query para Caché de Pedidos

Crear un nuevo hook `usePickingOrderDetails` que use React Query para cachear pedidos individuales:

```typescript
// src/hooks/usePickingOrderDetails.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const usePickingOrderDetails = (orderId: string | null) => {
  const queryClient = useQueryClient();
  
  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['picking-order-details', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      
      const { data, error } = await supabase
        .from('picking_packing_orders')
        .select(`*, shopify_order:shopify_orders(...)`)
        .eq('id', orderId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
    staleTime: 30_000, // 30 segundos de caché válido
    gcTime: 5 * 60_000, // 5 minutos en memoria
  });
  
  return { order, isLoading, error, refetch };
};
```

#### 1.2 Implementar Debounce de 300ms al Cambiar Pedidos

Agregar debounce en `PickingOrderDetailsModal` para evitar cargas innecesarias al navegar rápido:

```typescript
// En PickingOrderDetailsModal.tsx
const [debouncedOrderId, setDebouncedOrderId] = useState<string | null>(null);

useEffect(() => {
  const timeoutId = setTimeout(() => {
    setDebouncedOrderId(orderId);
  }, 300);
  
  return () => clearTimeout(timeoutId);
}, [orderId]);

// Usar debouncedOrderId para las queries
const { order, isLoading } = usePickingOrderDetails(debouncedOrderId);
```

#### 1.3 Lazy Loading de Cotizaciones de Envío

Modificar `EnviaShippingButton` para que las cotizaciones se carguen **solo cuando sea necesario** y de forma no bloqueante:

```typescript
// EnviaShippingButton.tsx - Nuevo estado
const [shouldLoadQuotes, setShouldLoadQuotes] = useState(false);

// Cargar cotizaciones solo cuando el componente esté visible y listo
useEffect(() => {
  if (hasChecked && !existingLabel && !quotesLoaded && !shouldLoadQuotes) {
    // Esperar 500ms antes de cargar cotizaciones (priorizar orden)
    const timer = setTimeout(() => setShouldLoadQuotes(true), 500);
    return () => clearTimeout(timer);
  }
}, [hasChecked, existingLabel, quotesLoaded]);

// Trigger de carga diferida
useEffect(() => {
  if (shouldLoadQuotes && shippingAddress?.city) {
    getQuotes({ ... });
  }
}, [shouldLoadQuotes, shippingAddress]);
```

---

## Problema 2: Loop Infinito con API de Envia.com

### Análisis del Estado Actual

En `useEnviaShipping.ts`:
- La función `getQuotes()` hace un solo intento a la API (líneas 161-200)
- No hay reintentos automáticos implementados
- Los errores se muestran con `toast.error()` pero pueden causar re-renders
- En `EnviaShippingButton.tsx`, el useEffect de líneas 169-185 **se re-ejecuta** cada vez que `hasChecked` cambia, potencialmente causando loops

**Causa raíz del loop:**
El useEffect que carga cotizaciones depende de `hasChecked`, y si hay errores de red, el estado puede oscilar causando re-ejecuciones infinitas.

### Solución Técnica

#### 2.1 Separar Completamente Carga de Pedido y Cotizaciones

Restructurar la lógica para que:
1. El pedido cargue primero e independiente
2. Las cotizaciones se carguen después, sin bloquear la UI
3. Los errores de cotización NO afecten la visualización del pedido

```typescript
// EnviaShippingButton.tsx - Nueva estructura de estados
const [quoteState, setQuoteState] = useState<{
  status: 'idle' | 'loading' | 'success' | 'error';
  errorMessage?: string;
  retryCount: number;
}>({ status: 'idle', retryCount: 0 });

const MAX_RETRIES = 3;
const BACKOFF_DELAYS = [2000, 4000, 8000]; // Exponential backoff
```

#### 2.2 Implementar Reintentos con Exponential Backoff

Crear una función robusta para cargar cotizaciones con reintentos controlados:

```typescript
// En useEnviaShipping.ts - Nueva función getQuotesWithRetry
const getQuotesWithRetry = useCallback(async (
  request: QuoteRequest,
  options?: { 
    maxRetries?: number;
    onRetry?: (attempt: number) => void;
    signal?: AbortSignal;
  }
): Promise<QuoteResponse | null> => {
  const maxRetries = options?.maxRetries ?? 3;
  const delays = [2000, 4000, 8000];
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if aborted
    if (options?.signal?.aborted) {
      console.log('🚫 Quote request aborted');
      return null;
    }
    
    try {
      setIsLoadingQuotes(true);
      
      // Add 8-second timeout per attempt
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const { data, error } = await supabase.functions.invoke('envia-quote', {
        body: request
      });
      
      clearTimeout(timeoutId);
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Error desconocido');
      
      setQuotes(data.quotes || []);
      setMatchInfo(data.matchInfo || null);
      return data as QuoteResponse;
      
    } catch (error: any) {
      console.log(`⚠️ Quote attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
      
      if (attempt < maxRetries) {
        options?.onRetry?.(attempt + 1);
        await new Promise(r => setTimeout(r, delays[attempt]));
      } else {
        // All retries exhausted - don't show toast, return error state
        return null;
      }
    }
  }
  
  return null;
}, []);
```

#### 2.3 UI de Tres Estados para Sección de Envío

Actualizar `EnviaShippingButton.tsx` con estados visuales claros:

```typescript
// Estado LOADING
if (quoteState.status === 'loading') {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Obteniendo tarifas{quoteState.retryCount > 0 ? ` (intento ${quoteState.retryCount + 1}/4)` : '...'}...</span>
    </div>
  );
}

// Estado ERROR
if (quoteState.status === 'error') {
  return (
    <Alert variant="destructive" className="py-3">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Servicio no disponible</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>No se pudo obtener cotización. El servicio de envíos no está disponible.</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleManualRetry}
          className="mt-2"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar cotización
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// Estado SUCCESS - mostrar lista de transportadoras (código existente)
```

#### 2.4 Prevenir Re-renders Infinitos

Agregar guards y refs para evitar loops:

```typescript
// En EnviaShippingButton.tsx
const hasTriedQuotesRef = useRef(false);
const abortControllerRef = useRef<AbortController | null>(null);

useEffect(() => {
  // Guard: solo intentar una vez por orden
  if (hasTriedQuotesRef.current) return;
  if (!hasChecked || existingLabel || !shippingAddress?.city) return;
  
  hasTriedQuotesRef.current = true;
  
  // Cancelar request anterior si existe
  abortControllerRef.current?.abort();
  abortControllerRef.current = new AbortController();
  
  const loadQuotes = async () => {
    setQuoteState({ status: 'loading', retryCount: 0 });
    
    const result = await getQuotesWithRetry(
      { destination_city: shippingAddress.city, ... },
      { 
        signal: abortControllerRef.current?.signal,
        onRetry: (attempt) => setQuoteState(prev => ({ ...prev, retryCount: attempt }))
      }
    );
    
    if (result) {
      setQuoteState({ status: 'success', retryCount: 0 });
    } else {
      setQuoteState({ status: 'error', errorMessage: 'Servicio no disponible', retryCount: 3 });
    }
  };
  
  // Lazy load: esperar 500ms para priorizar carga de pedido
  const timer = setTimeout(loadQuotes, 500);
  
  return () => {
    clearTimeout(timer);
    abortControllerRef.current?.abort();
  };
}, [hasChecked, existingLabel, shippingAddress?.city, shopifyOrderId]);

// Reset cuando cambia el pedido
useEffect(() => {
  hasTriedQuotesRef.current = false;
  setQuoteState({ status: 'idle', retryCount: 0 });
}, [shopifyOrderId]);
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/hooks/usePickingOrderDetails.ts` | **NUEVO** - Hook con React Query para caché de pedidos |
| `src/features/shipping/hooks/useEnviaShipping.ts` | Agregar `getQuotesWithRetry` con exponential backoff y timeout |
| `src/features/shipping/components/EnviaShippingButton.tsx` | Refactor completo de carga de cotizaciones con estados loading/error/success |
| `src/components/picking/PickingOrderDetailsModal.tsx` | Integrar debounce de 300ms y usar nuevo hook de caché |

---

## Resultado Esperado

Después de implementar estos cambios:

1. **Rendimiento mejorado:**
   - Pedidos previamente vistos cargan instantáneamente desde caché (< 50ms)
   - Navegación rápida entre pedidos no dispara requests innecesarios (debounce 300ms)
   - Cotizaciones cargan en background sin bloquear la UI principal

2. **Sin loops infinitos:**
   - Máximo 3 reintentos con delays de 2s, 4s, 8s
   - Después del tercer fallo, la UI muestra estado de error estable
   - El usuario puede reintentar manualmente cuando quiera
   - El pedido SIEMPRE es visible aunque Envia.com esté caído

3. **UX mejorada:**
   - Spinner con mensaje "Obteniendo tarifas..." durante la carga
   - Alerta roja clara cuando el servicio no está disponible
   - Botón "Reintentar cotización" para control manual

---

## Diagrama de Flujo de Carga

```text
Usuario abre pedido
       │
       ▼
┌──────────────────┐     ┌──────────────────────┐
│  Cargar pedido   │────▶│  Mostrar datos       │
│  (React Query)   │     │  inmediatamente      │
│  con caché       │     │                      │
└──────────────────┘     └──────────────────────┘
       │
       │ 500ms delay (lazy)
       ▼
┌──────────────────┐     ┌──────────────────────┐
│ Cargar cotizaciones │   │ Estado: "Obteniendo │
│ (background)        │──▶│ tarifas..."         │
│ timeout: 8s         │   │                     │
└──────────────────┘     └──────────────────────┘
       │
       ▼
   ┌───────┐
   │¿Error?│
   └───┬───┘
       │
   ┌───┴───┐
   │       │
  No      Sí
   │       │
   ▼       ▼
┌─────┐  ┌───────────────┐
│Lista│  │ Retry 1 (2s)  │──▶ Retry 2 (4s) ──▶ Retry 3 (8s)
│ OK  │  └───────────────┘                           │
└─────┘                                              ▼
                                         ┌────────────────────┐
                                         │ Alerta: "Servicio  │
                                         │ no disponible"     │
                                         │ + [Reintentar]     │
                                         └────────────────────┘
```

