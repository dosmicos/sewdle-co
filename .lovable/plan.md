
## Plan: Corrección de Facturación Automática Duplicada

### Problema Confirmado

La imagen muestra facturas duplicadas creadas el mismo día:
- **LINA MARCELA BU...**: DM46030, DM46031 (2 facturas de $99.900)
- **Beatriz Arce Pineda**: DM46027, DM46028, DM46029 (3 facturas de $99.900)

### Causa Raíz: Race Condition

El flujo actual tiene una "ventana de vulnerabilidad":

```text
Tiempo 0ms:    Webhook A → Verifica "¿tiene factura?" → NO
Tiempo 50ms:   Webhook B → Verifica "¿tiene factura?" → NO  ← Aún no se ha guardado
Tiempo 100ms:  Webhook C → Verifica "¿tiene factura?" → NO  ← Aún no se ha guardado
Tiempo 3000ms: Webhook A → Crea factura DM46027
Tiempo 3050ms: Webhook B → Crea factura DM46028  ← Duplicado!
Tiempo 3100ms: Webhook C → Crea factura DM46029  ← Duplicado!
```

### Solución: Sistema de Bloqueo (Mutex)

#### 1. Migración de Base de Datos

Agregar columnas de control de concurrencia a `shopify_orders`:

```sql
ALTER TABLE shopify_orders 
ADD COLUMN IF NOT EXISTS auto_invoice_processing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_invoice_processing_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shopify_orders_auto_invoice_processing 
ON shopify_orders (shopify_order_id) 
WHERE auto_invoice_processing = true;
```

#### 2. Modificar `auto-invoice-alegra/index.ts`

**a) Agregar función de lock atómico (nueva función):**

```typescript
async function acquireInvoiceLock(
  supabase: any, 
  shopifyOrderId: number, 
  organizationId: string
): Promise<{ acquired: boolean; reason?: string }> {
  // Timeout: liberar locks de más de 5 minutos
  const lockTimeout = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  await supabase
    .from('shopify_orders')
    .update({ auto_invoice_processing: false })
    .eq('organization_id', organizationId)
    .eq('auto_invoice_processing', true)
    .lt('auto_invoice_processing_at', lockTimeout);

  // Intentar adquirir lock de forma atómica
  const { data, error } = await supabase
    .from('shopify_orders')
    .update({
      auto_invoice_processing: true,
      auto_invoice_processing_at: new Date().toISOString()
    })
    .eq('shopify_order_id', shopifyOrderId)
    .eq('organization_id', organizationId)
    .eq('auto_invoice_processing', false)
    .is('alegra_invoice_id', null)
    .select('shopify_order_id')
    .maybeSingle();

  if (error || !data) {
    return { acquired: false, reason: 'Already processing or invoiced' };
  }

  return { acquired: true };
}
```

**b) Agregar función de release lock:**

```typescript
async function releaseInvoiceLock(
  supabase: any, 
  shopifyOrderId: number, 
  organizationId: string
): Promise<void> {
  await supabase
    .from('shopify_orders')
    .update({ auto_invoice_processing: false })
    .eq('shopify_order_id', shopifyOrderId)
    .eq('organization_id', organizationId);
}
```

**c) Modificar `processAutoInvoice` (línea ~523):**

Añadir al inicio de la función:

```typescript
// NUEVO: Adquirir lock atómico antes de procesar
const lockResult = await acquireInvoiceLock(supabase, shopifyOrderId, organizationId);
if (!lockResult.acquired) {
  console.log(`⏭️ Lock no adquirido: ${lockResult.reason}`);
  return { success: false, error: lockResult.reason };
}

console.log(`🔒 Lock adquirido para pedido ${shopifyOrderId}`);
```

Envolver el resto de la función en try/finally para liberar siempre:

```typescript
try {
  // ... código existente de processAutoInvoice ...
} finally {
  await releaseInvoiceLock(supabase, shopifyOrderId, organizationId);
  console.log(`🔓 Lock liberado para pedido ${shopifyOrderId}`);
}
```

**d) Corregir formato de identificación (líneas 225-242):**

Cambiar:
```typescript
const contactPayload = {
  // ... otros campos ...
  identificationType: 'CC',
  identificationNumber: String(identification).slice(0, 20),
  identification: String(identification).slice(0, 20),
  // ...
}
```

Por:
```typescript
const contactPayload = {
  // ... otros campos ...
  identification: {
    type: 'CC',
    number: String(identification).slice(0, 20)
  },
  // ...
}
```

### Flujo Corregido

```text
Tiempo 0ms:    Webhook A → Intenta lock → ✅ ADQUIRIDO
Tiempo 50ms:   Webhook B → Intenta lock → ❌ RECHAZADO (ya locked)
Tiempo 100ms:  Webhook C → Intenta lock → ❌ RECHAZADO (ya locked)
Tiempo 3000ms: Webhook A → Crea factura DM46027 → Libera lock
```

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `supabase/functions/auto-invoice-alegra/index.ts` | 1) Agregar funciones `acquireInvoiceLock` y `releaseInvoiceLock`<br>2) Modificar `processAutoInvoice` para usar lock<br>3) Corregir formato de `identification` a objeto estructurado |

### Migración de Base de Datos

```sql
-- Columnas de control de concurrencia
ALTER TABLE shopify_orders 
ADD COLUMN IF NOT EXISTS auto_invoice_processing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_invoice_processing_at TIMESTAMPTZ;

-- Índice parcial para queries de lock
CREATE INDEX IF NOT EXISTS idx_shopify_orders_auto_invoice_processing 
ON shopify_orders (shopify_order_id) 
WHERE auto_invoice_processing = true;
```

### Resultado Esperado

1. **Sin duplicados**: Cada pedido se procesará exactamente una vez
2. **Contactos creados correctamente**: Formato de identificación compatible con Alegra API
3. **Timeout de seguridad**: Locks huérfanos se liberan después de 5 minutos
4. **Logs claros**: Se registra cuando un pedido es rechazado por lock existente
