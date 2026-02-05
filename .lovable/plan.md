
# Plan: Sincronización Bidireccional de Notas Shopify ↔ Sewdle

## Resumen del Problema

Se identificaron **dos problemas** relacionados con las notas de los pedidos:

1. **Notas de Shopify no aparecen en Sewdle**: Cuando abres un pedido en el modal de Picking, la nota que existe en Shopify (y en la base de datos) no se muestra debido a una condición de carrera entre efectos de React.

2. **Guardar notas desde Sewdle es lento**: Cuando guardas una nota en Sewdle, la actualización a Shopify no falla pero el feedback de la UI es confuso y la sincronización parece demorada.

## Diagnóstico Técnico

### Problema 1: Condición de carrera en useEffect
```text
Orden actual de ejecución:

1. orderId cambia → useEffect(line 354) resetea shopifyNote = ''
2. cachedOrder llega → useEffect(line 342) pone shopifyNote = nota
3. PERO a veces el efecto de reset (1) se ejecuta DESPUÉS que (2)
   porque ambos dependen del mismo ciclo de rendering
```

La base de datos **sí tiene** la nota ("ya bordado" para orden #68606), pero el reset en línea 357 la borra.

### Problema 2: Falta feedback inmediato
- El edge function `update-shopify-order-note` funciona correctamente (actualiza Shopify → DB local)
- Pero no hay actualización inmediata del caché de React Query
- El usuario ve un delay mientras espera el refetch

---

## Solución Propuesta

### Parte A: Corregir condición de carrera en notas

**Archivo**: `src/components/picking/PickingOrderDetailsModal.tsx`

Cambios:
1. **Eliminar el reset de notas del efecto de `orderId`** (líneas 356-357)
2. **Manejar el reset de notas dentro del efecto de `effectiveOrder`** con lógica condicional

```text
Antes:
useEffect(() => {
  setNotes('');           ← PROBLEMA: borra nota
  setShopifyNote('');     ← PROBLEMA: borra nota de Shopify
  ...
}, [orderId]);

useEffect(() => {
  if (effectiveOrder?.shopify_order?.note) {
    setShopifyNote(effectiveOrder.shopify_order.note);
  } else {
    setShopifyNote('');
  }
}, [effectiveOrder]);

Después:
useEffect(() => {
  // NO resetear notas aquí - se maneja en el otro effect
  setSkuInput('');
  setVerificationResult(null);
  ...
}, [orderId]);

useEffect(() => {
  // Solo actualizar notas cuando cambia effectiveOrder Y pertenece al orderId actual
  if (effectiveOrder?.id === orderId) {
    setNotes(effectiveOrder.internal_notes || '');
    setShopifyNote(effectiveOrder.shopify_order?.note || '');
  }
}, [effectiveOrder, orderId]);
```

### Parte B: Actualizar caché de React Query inmediatamente al guardar nota

**Archivo**: `src/components/picking/PickingOrderDetailsModal.tsx`

En `handleSaveShopifyNote`:
1. Actualizar `localOrder` inmediatamente (ya se hace)
2. **Actualizar también el caché de React Query** con `updateOrderOptimistically`
3. Hacer refetch solo después de confirmación de Shopify

```text
Flujo mejorado:
1. Usuario presiona "Guardar Nota"
2. Actualización optimista inmediata (UI refleja cambio)
3. Edge function actualiza Shopify + DB
4. Refetch confirma datos finales
```

### Parte C: Mejorar feedback visual durante guardado

Mostrar estado de "Guardando..." más claro en el botón y deshabilitar el textarea durante el proceso.

---

## Archivos a Modificar

1. **`src/components/picking/PickingOrderDetailsModal.tsx`**
   - Corregir condición de carrera en useEffect para notas
   - Agregar actualización optimista de caché en `handleSaveShopifyNote`
   - Mejorar feedback visual del botón de guardar

---

## Cambios Detallados

### 1. Eliminar reset de notas del efecto de orderId

Líneas 354-371: Quitar `setNotes('')` y `setShopifyNote('')` de este efecto.

### 2. Mejorar efecto de sincronización de notas

Líneas 342-351: Añadir validación de que `effectiveOrder.id === orderId` para evitar mostrar notas de pedido anterior durante transición.

### 3. Actualizar handleSaveShopifyNote

Línea 565-588: Agregar `updateOrderOptimistically` para actualizar el caché de React Query inmediatamente después del guardado local.

---

## Validación

1. Abrir un pedido que tenga nota en Shopify → Debe mostrarse inmediatamente en el campo "Notas de Shopify"
2. Escribir una nota nueva y guardar → UI debe reflejar el cambio de inmediato
3. Salir y volver a entrar al pedido → La nota debe persistir
4. Verificar en Shopify que la nota se sincronizó correctamente
