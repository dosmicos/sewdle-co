

## Plan: Arreglar Cola Bloqueada de Facturación Automática

### Problema
El cron job procesa pedidos ordenados por fecha ascendente (más antiguos primero) con límite de 10. Los 5 pedidos del 21 de enero tienen errores permanentes de datos del cliente en Alegra (ciudad/departamento inválido), causando que:

1. Se reprocesen infinitamente cada 2 minutos
2. Los pedidos nuevos (68055-68076) nunca lleguen a procesarse
3. **0 facturas exitosas** desde hace días

### Solución en 2 Partes

---

#### Parte 1: Desbloquear los pedidos atascados (inmediato)

**Opción A - Marcar como fallidos permanentes** (recomendada):
Agregar el tag `AUTO_INVOICE_FAILED` a los 5 pedidos problemáticos para que el filtro los excluya:

```sql
-- Ejecutar en Supabase SQL Editor
UPDATE shopify_orders
SET tags = tags || ', AUTO_INVOICE_FAILED'
WHERE order_number IN ('67786', '67787', '67789', '67791', '67795')
  AND alegra_stamped = false;
```

Esto los excluye del batch porque el filtro ya verifica:
```typescript
!tags.includes('auto_invoice_failed')
```

---

#### Parte 2: Prevenir bloqueos futuros (código)

Modificar `findPendingOrders()` para implementar un sistema de **límite de reintentos**:

**Archivo**: `supabase/functions/auto-invoice-alegra/index.ts`

**Cambios**:

1. **Agregar contador de reintentos** a la tabla `shopify_orders`:
   - Nuevo campo `auto_invoice_retries` (integer, default 0)

2. **Modificar la consulta** para excluir pedidos con demasiados reintentos:
   ```typescript
   .or('auto_invoice_retries.is.null,auto_invoice_retries.lt.5')
   ```

3. **Incrementar contador en cada fallo**:
   ```typescript
   // En processAutoInvoice, cuando falla el stamping:
   await supabase.from('shopify_orders').update({
     auto_invoice_retries: (currentRetries || 0) + 1
   }).eq('shopify_order_id', orderId)
   ```

4. **Después de 5 reintentos**, agregar automáticamente el tag `AUTO_INVOICE_FAILED`

---

### Cambios Detallados

#### A. Migración SQL (nueva columna)

```sql
ALTER TABLE shopify_orders 
ADD COLUMN IF NOT EXISTS auto_invoice_retries INTEGER DEFAULT 0;
```

#### B. Modificar `findPendingOrders()` (línea 615-625)

```typescript
const { data, error } = await supabase
  .from('shopify_orders')
  .select('shopify_order_id, organization_id, order_number, tags, source_name, alegra_invoice_id, alegra_stamped, auto_invoice_retries')
  .eq('financial_status', 'paid')
  .or('alegra_stamped.is.null,alegra_stamped.eq.false')
  .neq('source_name', 'pos')
  // NUEVO: Excluir pedidos con demasiados reintentos
  .or('auto_invoice_retries.is.null,auto_invoice_retries.lt.5')
  .gte('created_at', sevenDaysAgo)
  .order('created_at', { ascending: true })
  .limit(10)
```

#### C. Modificar manejo de errores en `processAutoInvoice()` (después del catch del re-stamp)

```typescript
// Cuando falla el re-stamp:
catch (stampError: any) {
  console.error(`❌ Re-stamp falló: ${stampError.message}`)
  
  // NUEVO: Incrementar contador de reintentos
  const currentRetries = orderData.auto_invoice_retries || 0
  const newRetries = currentRetries + 1
  
  let updateData: any = { auto_invoice_retries: newRetries }
  
  // Si alcanza el límite, marcar como fallido permanente
  if (newRetries >= 5) {
    console.warn(`⚠️ Pedido ${orderData.order_number} alcanzó límite de reintentos, marcando como fallido`)
    const currentTags = orderData.tags || ''
    updateData.tags = currentTags + ', AUTO_INVOICE_FAILED'
  }
  
  await supabase.from('shopify_orders').update(updateData)
    .eq('shopify_order_id', shopifyOrderId)
    .eq('organization_id', organizationId)
  
  return { success: false, invoiceId: orderData.alegra_invoice_id, error: stampError.message }
}
```

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Agregar columna `auto_invoice_retries` |
| `supabase/functions/auto-invoice-alegra/index.ts` | 1. Agregar `auto_invoice_retries` al select<br>2. Filtrar por reintentos < 5<br>3. Incrementar contador en cada fallo<br>4. Auto-aplicar tag `AUTO_INVOICE_FAILED` después de 5 intentos |

---

### Resultado Esperado

```text
ANTES:                              DESPUÉS:
┌─────────────────────────┐        ┌─────────────────────────┐
│ 67786 → falla → retry   │        │ 67786 → 5 retries → OUT │
│ 67787 → falla → retry   │        │ 67787 → 5 retries → OUT │
│ 67789 → falla → retry   │   →    │ 68055 → procesar ✅     │
│ 67791 → falla → retry   │        │ 68059 → procesar ✅     │
│ 67795 → falla → retry   │        │ 68064 → procesar ✅     │
│ (68055+ nunca llegan)   │        │ (pedidos nuevos pasan)  │
└─────────────────────────┘        └─────────────────────────┘
```

### Acción Inmediata Recomendada

Antes de implementar el código, desbloquear manualmente los 5 pedidos atascados ejecutando este SQL:

```sql
UPDATE shopify_orders
SET tags = CONCAT(COALESCE(tags, ''), ', AUTO_INVOICE_FAILED')
WHERE order_number IN ('67786', '67787', '67789', '67791', '67795');
```

Esto permitirá que los pedidos nuevos empiecen a procesarse mientras se implementa la solución permanente.

