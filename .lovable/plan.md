
## Plan: Auto-empacar al completar verificación de artículos

### Resumen del comportamiento solicitado

1. **Ocultar el botón "Marcar como Empacado"** hasta que se verifiquen todos los artículos
2. **Auto-presionar el botón de empacado** cuando se escaneen todos los artículos
3. **Mostrar el botón "Crear Guía"** inmediatamente después de que el pedido se marque como empacado

---

### Archivo a modificar

`src/components/picking/PickingOrderDetailsModal.tsx`

---

### Cambio 1: Crear variable para verificar si todos los artículos están escaneados

**Ubicación:** Después de línea 414 (donde se calculan `totalVerifiedUnits` y `totalRequiredUnits`)

```typescript
// Determina si todos los artículos han sido verificados
const allItemsVerified = totalRequiredUnits > 0 && totalVerifiedUnits === totalRequiredUnits;
```

---

### Cambio 2: Auto-empacar cuando se completa la verificación

**Ubicación:** Agregar un nuevo `useEffect` después de línea 415

```typescript
// Auto-pack when all items are verified
useEffect(() => {
  if (allItemsVerified && 
      effectiveOrder?.operational_status !== 'ready_to_ship' && 
      effectiveOrder?.operational_status !== 'awaiting_pickup' && 
      effectiveOrder?.operational_status !== 'shipped' &&
      !effectiveOrder?.shopify_order?.cancelled_at &&
      !updatingStatus) {
    // Small delay to show the green verification before auto-packing
    const timer = setTimeout(() => {
      handleMarkAsPackedAndPrint();
    }, 800);
    
    return () => clearTimeout(timer);
  }
}, [allItemsVerified, effectiveOrder?.operational_status, updatingStatus]);
```

---

### Cambio 3: Ocultar botón "Marcar como Empacado" hasta verificación completa

**Ubicación:** Líneas 1490-1512 (botón flotante de Empacado)

**Antes:**
```typescript
{!effectiveOrder.shopify_order?.cancelled_at && 
 effectiveOrder.operational_status !== 'ready_to_ship' && 
 effectiveOrder.operational_status !== 'awaiting_pickup' && 
 effectiveOrder.operational_status !== 'shipped' && (
```

**Después:**
```typescript
{!effectiveOrder.shopify_order?.cancelled_at && 
 effectiveOrder.operational_status !== 'ready_to_ship' && 
 effectiveOrder.operational_status !== 'awaiting_pickup' && 
 effectiveOrder.operational_status !== 'shipped' && 
 allItemsVerified && (
```

---

### Cambio 4: Mensaje visual cuando se auto-empaca

Para mejorar la experiencia, agregar feedback visual cuando todos los artículos están verificados.

**Ubicación:** Dentro de la sección de verificación (después de línea 1230), agregar:

```typescript
{/* Success message when all items verified */}
{allItemsVerified && effectiveOrder.operational_status !== 'ready_to_ship' && (
  <div className="p-3 bg-green-100 border-2 border-green-400 rounded-lg animate-pulse">
    <div className="flex items-center justify-center gap-2 text-green-700 font-bold">
      <CheckCircle className="w-5 h-5" />
      ¡Verificación completa! Marcando como empacado...
    </div>
  </div>
)}
```

---

### Flujo resultante

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Usuario escanea artículos (0/2, 1/2...)                 │
│     - Botón "Empacado" está OCULTO                          │
├─────────────────────────────────────────────────────────────┤
│  2. Usuario escanea último artículo (2/2)                   │
│     - Muestra mensaje "¡Verificación completa!"             │
│     - Se auto-ejecuta handleMarkAsPackedAndPrint() en 800ms │
├─────────────────────────────────────────────────────────────┤
│  3. Pedido marcado como Empacado                            │
│     - Se abre diálogo de impresión automáticamente          │
│     - Estado cambia a ready_to_ship                         │
├─────────────────────────────────────────────────────────────┤
│  4. Botón "Crear Guía" aparece automáticamente              │
│     - El pedido ahora puede generar la guía de envío        │
└─────────────────────────────────────────────────────────────┘
```

---

### Detalles técnicos

| Aspecto | Implementación |
|---------|----------------|
| Auto-pack delay | 800ms (da tiempo a ver el mensaje verde) |
| Prevención de duplicados | `updatingStatus` evita doble ejecución |
| Órdenes canceladas | No se auto-empaca si está cancelada |
| Ya empacadas | No se dispara si ya está en `ready_to_ship` |

---

### Resultado esperado

- El botón "Marcar como Empacado" permanece **oculto** hasta verificar todos los artículos
- Al verificar el último artículo, se muestra mensaje y se **auto-empaca en 800ms**
- Después del empacado, el botón "Crear Guía" aparece **inmediatamente** (esto ya funciona así)
