
## Diagnóstico (qué está pasando y por qué)

Con lo que describes (y viendo el código actual), los síntomas coinciden con 3 causas principales que se refuerzan entre sí:

1) **La UI no se actualiza al instante cuando se marca “Empacado”**
- En `PickingOrderDetailsModal`, el botón flotante “Crear Guía” solo aparece si `effectiveOrder.operational_status === 'ready_to_ship'`.
- Pero `effectiveOrder` **prioriza** `cachedOrder` (React Query) sobre `localOrder`.  
- Cuando marcamos empacado, el modal hace un “optimistic update” en `localOrder`, pero **no actualiza/invalida el caché** de React Query para `cachedOrder`. Resultado: `effectiveOrder` se queda “viejo” y la UI sigue mostrando “Escanear”.

2) **Se abre la impresión varias veces (y se “re-empaca” varias veces)**
- El auto-pack corre en un `useEffect` cuando `allItemsVerified` pasa a true.
- Ese efecto está “protegido” con `!updatingStatus`, pero como `effectiveOrder.operational_status` no cambia (por el punto 1), cuando `updatingStatus` vuelve a `false`, el efecto vuelve a disparar el auto-pack.
- Además, en Preview (Vite + React 18) está `StrictMode` activo, lo cual puede **duplicar** ejecuciones de efectos en desarrollo si no son idempotentes.

3) **La etiqueta EMPACADO se ve en Shopify (y se dispara varias veces), pero en Sewdle no queda “estable”**
- No es que Shopify esté “mejor”: es que la acción se está invocando varias veces por los reintentos/loops anteriores.
- En Sewdle, al volver a entrar, React Query puede seguir sirviendo el detalle del pedido desde caché (staleTime 30s) y como no invalidamos/refetch, se ve como si nunca hubiese quedado empacado, y por eso tampoco aparece “quién empacó”.

---

## Objetivo del arreglo

- Al terminar de escanear:
  1) Se ejecuta el flujo **una sola vez** (sin loops).
  2) Se abre la impresión **una sola vez**.
  3) El pedido queda **empacado en Sewdle inmediatamente** (estado + packed_at + packed_by).
  4) Al salir y volver a entrar, se mantiene empacado y con el registro de quién empacó.
  5) En Shopify no se repiten acciones innecesarias.

---

## Cambios propuestos (implementación)

### A) Hacer el flujo “Empacar + Imprimir” idempotente (anti-duplicados)
En `src/components/picking/PickingOrderDetailsModal.tsx`:

1. Crear refs de control, por ejemplo:
- `packInFlightRef` (boolean)
- `autoPackTriggeredRef` (guard por orderId)
- `autoPrintTriggeredRef` (guard por orderId)

2. En el `useEffect` de auto-pack (`allItemsVerified`):
- Antes de programar el `setTimeout`, verificar:
  - Si ya se disparó para ese `orderId` → no hacer nada.
  - Si ya está `ready_to_ship/awaiting_pickup/shipped` → no hacer nada.
- Marcar `autoPackTriggeredRef.current = orderId` antes de ejecutar, para evitar dobles disparos por re-renders.

3. En `handleMarkAsPackedAndPrint` y `handleMarkAsPackedExpress`:
- Si `packInFlightRef.current` está `true`, salir inmediatamente.
- Si el pedido ya está empacado/enviado, salir inmediatamente.
- Solo permitir **una apertura de impresión** por pedido con `autoPrintTriggeredRef`.

Esto corta:
- Ventanas de impresión múltiples
- Múltiples llamadas a update-status / edge functions
- Múltiples “acciones” registradas en Shopify

### B) Forzar actualización inmediata del estado (sin esperar realtime)
Aplicar el patrón “mutación → refetch/invalidate” (el que ya quedó en el contexto como solución probada).

En `handleStatusChange('ready_to_ship')`:

1. Mantener el optimistic update, pero además:
- Llamar `updateOrderOptimistically(...)` para actualizar el caché `['picking-order-details', orderId]` con:
  - `operational_status = ready_to_ship`
  - `packed_at`, `packed_by`
  - `shopify_order.tags` actualizado

2. Tras `updateOrderStatus(...)` en success:
- Ejecutar **refetch inmediato** del pedido (tu `refetchOrder(orderId)` ya existe y además escribe en cache):
  - Esto asegura que al salir/volver a entrar quede consistente
  - Y que `packed_by`/`packed_at` se lean desde DB, no “solo en memoria”

3. Adicional (opcional pero recomendable):
- Invalidar queries relacionadas:
  - `queryClient.invalidateQueries({ queryKey: ['picking-order-details', orderId] })`
  - (si existe) invalidar la lista o forzar `fetchOrders()` ya lo hace en el hook, pero el detalle es el crítico.

Con esto, `effectiveOrder.operational_status` pasa a `ready_to_ship` “ya”, por lo que:
- El botón cambia de “Escanear” a “Crear Guía”
- El auto-pack effect deja de re-dispararse

### C) Ajustar la prioridad de `effectiveOrder` para reflejar cambios del modal
Actualmente:
- cachedOrder → localOrder → listOrder

Propuesta:
- **localOrder (si coincide el id)** → cachedOrder → listOrder

Razón: el modal es donde hacemos optimistic updates; si `cachedOrder` manda, la UI se queda atrás.  
Se mantiene la condición `localOrder.id === orderId` para evitar mostrar datos de otro pedido durante navegación rápida.

### D) Evitar doble `window.print()` en la vista de impresión (StrictMode-safe)
En `src/pages/PrintableOrderView.tsx`:

- Agregar un `useRef` tipo `hasAutoPrintedRef`.
- En el `useEffect`, antes de `setTimeout(() => window.print(), 500)`, verificar:
  - si ya imprimió → no volver a imprimir

Esto evita:
- Doble diálogo de impresión en Preview/dev
- Comportamientos raros si el componente re-monta

### E) Mejor feedback y detección de fallos (para que no sea “silencioso”)
- En el flujo de empacado, mostrar un estado visible tipo:
  - “Marcando como empacado…”
  - “Empacado listo”
- Si falla `updateOrderStatus`, mostrar el error real (cuando sea seguro) y **no reintentar automáticamente** (para no duplicar).

---

## Archivos a tocar

1) `src/components/picking/PickingOrderDetailsModal.tsx`
- Guards anti-duplicados
- Actualización de cache + refetch inmediato tras mutación
- Ajuste de prioridad `effectiveOrder`
- Control estricto de impresión 1 vez por pedido

2) `src/pages/PrintableOrderView.tsx`
- Guard `hasAutoPrintedRef` para evitar doble print

(En principio no hace falta tocar edge functions para este bug; el problema es el “loop” y el caché/UI.)

---

## Validación (pasos de prueba)

1) En un pedido NO empacado:
- Escanear todos los artículos.
- Confirmar:
  - Se abre **una sola** pestaña/ventana de impresión.
  - El modal cambia a estado **Empacado**.
  - El botón flotante cambia a **Crear Guía** (si no es Express/Recoger).
  - No se vuelven a abrir impresiones “solas”.

2) Salir del pedido y volver a entrar:
- Debe seguir:
  - `Estado: Empacado`
  - `Fecha/hora empacado`
  - `Por: (nombre del usuario)`

3) Revisar Shopify:
- Ver que la etiqueta `EMPACADO` está (sin duplicados en string) y que no se repite la acción varias veces.

4) Probar en Preview (StrictMode) y en Published:
- En Preview, asegurar que no hay dobles efectos (print/auto-pack).
- En Published, confirmar comportamiento estable.

---

## Riesgos / consideraciones
- Abrir impresión desde un “auto-evento” (sin click) puede depender del navegador (pop-up blocker). Hoy ya está funcionando; nuestros cambios lo harán más estable.
- Si prefieres que **NO se imprima automáticamente** al terminar escaneo (solo con botón “Imprimir”), también lo puedo ajustar, pero no es necesario para resolver el bug principal.

