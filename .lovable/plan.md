
## Plan: Reemplazar botón "Empacado" con botón "Escanear" y modificar atajo Ctrl+.

### Resumen del comportamiento solicitado

1. **Reemplazar el botón flotante** de "Marcar como Empacado" por un botón "Escanear"
2. **Modificar el atajo Ctrl+.** para que enfoque el input de escaneo en lugar de marcar como empacado
3. **Al hacer clic en el botón "Escanear"** o usar Ctrl+., el usuario es llevado directamente al campo de escaneo y puede empezar a escanear inmediatamente

> **Nota importante:** El auto-empacado al completar la verificación (implementado anteriormente) seguirá funcionando - el botón "Escanear" solo facilita el acceso rápido al campo de escaneo.

---

### Archivo a modificar

`src/components/picking/PickingOrderDetailsModal.tsx`

---

### Cambio 1: Agregar ref al input de escaneo

**Ubicación:** Alrededor de línea 91 (después de los otros refs existentes)

```typescript
const skuInputRef = useRef<HTMLInputElement>(null);
```

---

### Cambio 2: Crear función para enfocar el input y hacer scroll

**Ubicación:** Después de línea 95 (con las otras funciones de utilidad)

```typescript
// Focus SKU input and scroll to verification section
const focusScanInput = useCallback(() => {
  if (skuInputRef.current) {
    skuInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Small delay to ensure scroll completes before focusing
    setTimeout(() => {
      skuInputRef.current?.focus();
    }, 300);
  }
}, []);
```

---

### Cambio 3: Modificar el atajo Ctrl+. para enfocar el input

**Ubicación:** Líneas 127-144

**Antes:**
```typescript
// Ctrl + . → Marcar como Empacado
if (e.ctrlKey && e.key === '.') {
  e.preventDefault();
  // ... validaciones ...
  if (localOrder?.operational_status !== 'ready_to_ship' && ...) {
    handleMarkAsPackedAndPrintRef.current();
  }
  return;
}
```

**Después:**
```typescript
// Ctrl + . → Enfocar campo de escaneo
if (e.ctrlKey && e.key === '.') {
  e.preventDefault();
  // Solo enfocar si la orden no está empacada/enviada/cancelada
  if (effectiveOrder?.operational_status !== 'ready_to_ship' && 
      effectiveOrder?.operational_status !== 'awaiting_pickup' && 
      effectiveOrder?.operational_status !== 'shipped' && 
      !effectiveOrder?.shopify_order?.cancelled_at) {
    focusScanInput();
  }
  return;
}
```

---

### Cambio 4: Agregar ref al Input de escaneo

**Ubicación:** Línea 1180

**Antes:**
```typescript
<Input
  value={skuInput}
  onChange={(e) => { ... }}
  placeholder="🔍 Escanea o escribe el SKU..."
  ...
/>
```

**Después:**
```typescript
<Input
  ref={skuInputRef}
  value={skuInput}
  onChange={(e) => { ... }}
  placeholder="🔍 Escanea o escribe el SKU..."
  ...
/>
```

---

### Cambio 5: Reemplazar botón "Empacado" por botón "Escanear"

**Ubicación:** Líneas 1520-1543

**Antes:**
```typescript
{/* Sticky Floating Action Button - "Marcar como Empacado" - solo visible cuando todos los artículos están verificados */}
{!effectiveOrder.shopify_order?.cancelled_at && 
 effectiveOrder.operational_status !== 'ready_to_ship' && 
 effectiveOrder.operational_status !== 'awaiting_pickup' && 
 effectiveOrder.operational_status !== 'shipped' && 
 allItemsVerified && (
  <div className="absolute bottom-3 md:bottom-4 right-3 md:right-4 z-10 pointer-events-none">
    <Button
      onClick={handleMarkAsPackedAndPrint}
      disabled={updatingStatus}
      title="Ctrl + . para marcar rápidamente"
      className="..."
    >
      {updatingStatus ? (
        <Loader2 className="..." />
      ) : (
        <>
          <Package className="..." />
          <span className="hidden sm:inline">Marcar como</span> Empacado
        </>
      )}
    </Button>
  </div>
)}
```

**Después:**
```typescript
{/* Sticky Floating Action Button - "Escanear" - visible cuando la orden no está empacada */}
{!effectiveOrder.shopify_order?.cancelled_at && 
 effectiveOrder.operational_status !== 'ready_to_ship' && 
 effectiveOrder.operational_status !== 'awaiting_pickup' && 
 effectiveOrder.operational_status !== 'shipped' && (
  <div className="absolute bottom-3 md:bottom-4 right-3 md:right-4 z-10 pointer-events-none">
    <Button
      onClick={focusScanInput}
      title="Ctrl + . para escanear"
      className="h-11 md:h-14 px-4 md:px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm md:text-base gap-1.5 md:gap-2 pointer-events-auto"
    >
      <ScanLine className="w-4 h-4 md:w-5 md:h-5" />
      Escanear
    </Button>
  </div>
)}
```

---

### Flujo resultante

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Usuario abre modal de orden (estado: "Por Procesar")    │
│     - Botón flotante "Escanear" visible abajo a la derecha  │
├─────────────────────────────────────────────────────────────┤
│  2. Usuario presiona botón "Escanear" o Ctrl + .            │
│     - Pantalla hace scroll al campo de escaneo              │
│     - Campo de escaneo recibe foco automáticamente          │
├─────────────────────────────────────────────────────────────┤
│  3. Usuario escanea artículos con pistola de códigos        │
│     - Cada escaneo verifica el SKU                          │
│     - Contador se actualiza (1/2, 2/2...)                   │
├─────────────────────────────────────────────────────────────┤
│  4. Al completar todos los artículos (ej: 2/2)              │
│     - Muestra mensaje "¡Verificación completa!"             │
│     - AUTO-EMPACA después de 800ms (implementado antes)     │
├─────────────────────────────────────────────────────────────┤
│  5. Después del empacado automático                         │
│     - Botón "Escanear" desaparece (orden ya empacada)       │
│     - Botón "Crear Guía" aparece automáticamente            │
└─────────────────────────────────────────────────────────────┘
```

---

### Detalles técnicos

| Aspecto | Valor |
|---------|-------|
| Atajo de teclado | `Ctrl + .` |
| Scroll behavior | `smooth`, block: `center` |
| Delay antes de focus | 300ms (para completar scroll) |
| Icono del botón | `ScanLine` (ya importado) |
| Condición de visibilidad | Orden no cancelada, no empacada, no enviada |

---

### Resultado esperado

- El botón flotante ahora dice **"Escanear"** con ícono de escáner
- Al hacer clic o usar **Ctrl+.**, el usuario va directo al campo de escaneo
- El flujo de auto-empacado al completar verificación **sigue funcionando** igual
- Experiencia más rápida para operarios de bodega
