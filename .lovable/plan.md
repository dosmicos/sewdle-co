
## Plan: Ocultar el botón y sección de "Crear Guía" para pedidos Express y de Recoger

### Resumen del cambio

Modificar el componente `PickingOrderDetailsModal.tsx` para que:
1. **El botón flotante "Crear Guía"** no aparezca para pedidos Express ni de Recoger
2. **La sección "Guía de Envío"** (EnviaShippingButton) dentro del modal tampoco aparezca para estos pedidos

---

### Archivo a modificar

`src/components/picking/PickingOrderDetailsModal.tsx`

---

### Cambio 1: Ocultar la sección "Guía de Envío" para Express y Recoger

**Ubicación:** Líneas 1492-1512

**Antes:**
```typescript
{/* Shipping Label Section - At the very bottom of scrollable content */}
{effectiveOrder.shopify_order?.shopify_order_id && !effectiveOrder.shopify_order?.cancelled_at && (
  <div className="border-t pt-4 mt-6">
    <div className="flex items-center gap-2 mb-2">
      <Truck className="w-4 h-4 text-muted-foreground" />
      <span className="font-medium text-sm">Guía de Envío</span>
    </div>
    <EnviaShippingButton
      ...
    />
  </div>
)}
```

**Después:**
```typescript
{/* Shipping Label Section - Hidden for Express and Pickup orders */}
{effectiveOrder.shopify_order?.shopify_order_id && 
 !effectiveOrder.shopify_order?.cancelled_at && 
 shippingType?.label !== 'Recoger' && 
 shippingType?.label !== 'Express' && (
  <div className="border-t pt-4 mt-6">
    <div className="flex items-center gap-2 mb-2">
      <Truck className="w-4 h-4 text-muted-foreground" />
      <span className="font-medium text-sm">Guía de Envío</span>
    </div>
    <EnviaShippingButton
      ...
    />
  </div>
)}
```

---

### Cambio 2: Ocultar el botón flotante "Crear Guía" también para Express

**Ubicación:** Líneas 1585-1615

**Antes:**
```typescript
{/* Sticky Floating Action Button - "Crear Guía" (shipping orders after packing) */}
{!effectiveOrder.shopify_order?.cancelled_at && 
 effectiveOrder.operational_status === 'ready_to_ship' && 
 shippingType?.label !== 'Recoger' &&
 (!shippingLabel || shippingLabel.status === 'cancelled' || shippingLabel.status === 'error') && (
```

**Después:**
```typescript
{/* Sticky Floating Action Button - "Crear Guía" (shipping orders after packing) */}
{!effectiveOrder.shopify_order?.cancelled_at && 
 effectiveOrder.operational_status === 'ready_to_ship' && 
 shippingType?.label !== 'Recoger' &&
 shippingType?.label !== 'Express' &&
 (!shippingLabel || shippingLabel.status === 'cancelled' || shippingLabel.status === 'error') && (
```

---

### Lógica de detección existente

El sistema ya tiene la lógica para detectar el tipo de envío (líneas 906-919):

```typescript
const getShippingType = (shippingTitle: string | null) => {
  if (!shippingTitle) return null;
  const title = shippingTitle.toLowerCase();
  
  if (title.includes('express')) {
    return { label: 'Express', ... };  // ← Ya existe
  }
  if (title.includes('recog') || title.includes('pickup') || ...) {
    return { label: 'Recoger', ... };  // ← Ya existe
  }
  return { label: 'Standard', ... };
};
```

---

### Resultado esperado

| Tipo de Pedido | Botón "Crear Guía" | Sección "Guía de Envío" |
|----------------|-------------------|-------------------------|
| **Standard** | ✅ Visible | ✅ Visible |
| **Express** | ❌ Oculto | ❌ Oculta |
| **Recoger** | ❌ Oculto | ❌ Oculta |

---

### Flujo de pedidos Express/Recoger

Para **pedidos Express**: El operario empaca el pedido, pero la guía se gestiona de forma manual/externa (no a través de Envia.com).

Para **pedidos de Recoger**: Ya existe el flujo alternativo:
1. "Listo para Retiro" → Notifica al cliente
2. "Marcar como Entregado" → Completa el fulfillment

---

### Nota sobre pedidos Express

Los pedidos Express se identifican de dos formas:
1. **Por el método de envío** (shipping_lines title contiene "express")
2. **Por el tag de Shopify** (tags contiene "express")

Este plan usa la detección por método de envío que ya está implementada en `getShippingType()`.
