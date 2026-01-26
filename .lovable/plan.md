
## Plan: Reprocesar Pedidos con `alegra_stamped = false`

### Problema Actual
La función `findPendingOrders` excluye pedidos donde `alegra_stamped = false`, dejando en "limbo" aquellos donde la factura se creó pero el stamping DIAN falló.

### Solución

```text
┌─────────────────────────────────────────────────────────────┐
│              FLUJO ACTUAL vs NUEVO                          │
├─────────────────────────────────────────────────────────────┤
│  ANTES:                                                     │
│  findPendingOrders → .is('alegra_stamped', null)            │
│  Resultado: Solo pedidos NUNCA procesados                   │
│                                                             │
│  DESPUÉS:                                                   │
│  findPendingOrders → NULL o FALSE                           │
│  + verificación en Alegra antes de crear factura            │
│  Resultado: También reintenta los que fallaron en DIAN      │
└─────────────────────────────────────────────────────────────┘
```

---

### Cambios en `auto-invoice-alegra/index.ts`

#### 1. Modificar `findPendingOrders()` (líneas 571-604)

Cambiar la consulta para incluir pedidos con `alegra_stamped = false`:

```typescript
async function findPendingOrders(supabase: any): Promise<Array<{
  shopify_order_id: number, 
  organization_id: string, 
  order_number: string,
  alegra_invoice_id: number | null,  // NUEVO: para saber si ya tiene factura
  alegra_stamped: boolean | null     // NUEVO: para saber el estado
}>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  
  const { data, error } = await supabase
    .from('shopify_orders')
    .select('shopify_order_id, organization_id, order_number, tags, source_name, alegra_invoice_id, alegra_stamped')
    .eq('financial_status', 'paid')
    // CAMBIO: Incluir NULL y FALSE (antes solo NULL)
    .or('alegra_stamped.is.null,alegra_stamped.eq.false')
    .neq('source_name', 'pos')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: true })
    .limit(10)
  
  // ... resto del filtrado igual
}
```

#### 2. Agregar función `verifyNoExistingInvoice()` (nueva función)

Antes de crear una factura, verificar en Alegra que no exista una por número de pedido:

```typescript
async function verifyNoExistingInvoice(orderNumber: string): Promise<{ exists: boolean; invoiceId?: number; cufe?: string }> {
  try {
    // Buscar facturas que contengan el número de pedido en observaciones
    const invoices = await makeAlegraRequest(
      `/invoices?search=${encodeURIComponent(orderNumber)}&start=0&limit=5`
    )
    
    if (Array.isArray(invoices) && invoices.length > 0) {
      // Buscar coincidencia exacta en observaciones
      const match = invoices.find((inv: any) => 
        inv.observations?.includes(`#${orderNumber}`) || 
        inv.observations?.includes(orderNumber)
      )
      
      if (match) {
        console.log(`⚠️ Factura existente encontrada en Alegra: ${match.id}`)
        return { 
          exists: true, 
          invoiceId: match.id,
          cufe: match.stamp?.cufe 
        }
      }
    }
    
    return { exists: false }
  } catch (e: any) {
    console.warn(`⚠️ No se pudo verificar facturas existentes: ${e.message}`)
    // En caso de error, asumir que no existe para no bloquear
    return { exists: false }
  }
}
```

#### 3. Modificar `processAutoInvoice()` (línea 607+)

Agregar lógica para:
- Si `alegra_stamped = false` y tiene `alegra_invoice_id`, solo intentar re-stamping
- Si no tiene factura, verificar en Alegra antes de crear

```typescript
async function processAutoInvoice(...) {
  // ... código existente hasta línea 666 ...

  // NUEVO: Verificar si ya existe factura en Alegra (prevenir duplicados)
  if (!orderData.alegra_invoice_id) {
    console.log('🔍 Verificando si existe factura en Alegra...')
    const existingInvoice = await verifyNoExistingInvoice(orderData.order_number)
    
    if (existingInvoice.exists && existingInvoice.invoiceId) {
      console.log(`⚠️ Factura ya existe en Alegra: ${existingInvoice.invoiceId}`)
      
      // Sincronizar la factura encontrada
      await supabase.from('shopify_orders').update({
        alegra_invoice_id: existingInvoice.invoiceId,
        alegra_stamped: !!existingInvoice.cufe,
        alegra_cufe: existingInvoice.cufe || null,
      }).eq('shopify_order_id', shopifyOrderId)
        .eq('organization_id', organizationId)
      
      if (existingInvoice.cufe) {
        // Ya está emitida, marcar como completada
        await addFacturadoTag(shopifyOrderId, shopDomain)
        return { success: true, invoiceId: existingInvoice.invoiceId, cufe: existingInvoice.cufe }
      }
      
      // Existe pero sin CUFE - intentar stamping
      // (continuar al paso de stamping con este ID)
      orderData.alegra_invoice_id = existingInvoice.invoiceId
    }
  }

  // NUEVO: Si ya tiene factura pero no está emitida, solo re-stamp
  if (orderData.alegra_invoice_id && !orderData.alegra_stamped) {
    console.log(`🔄 Re-intentando stamping de factura existente: ${orderData.alegra_invoice_id}`)
    
    try {
      const stampedInvoice = await stampInvoice(orderData.alegra_invoice_id)
      const cufe = stampedInvoice.stamp?.cufe
      
      // Actualizar BD con éxito
      await supabase.from('shopify_orders').update({
        alegra_stamped: true,
        alegra_cufe: cufe || null,
      }).eq('shopify_order_id', shopifyOrderId)
        .eq('organization_id', organizationId)
      
      await addFacturadoTag(shopifyOrderId, shopDomain)
      
      return { success: true, invoiceId: orderData.alegra_invoice_id, cufe }
    } catch (stampError: any) {
      console.error(`❌ Re-stamp falló: ${stampError.message}`)
      return { success: false, invoiceId: orderData.alegra_invoice_id, error: stampError.message }
    }
  }

  // ... resto del código existente (crear factura nueva) ...
}
```

---

### Flujo de Decisiones

```text
┌─────────────────────────────────────────────────────────────┐
│               LÓGICA DE PROCESAMIENTO                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ¿Tiene alegra_invoice_id en BD?                            │
│       │                                                     │
│       ├── SÍ → ¿alegra_stamped = true?                      │
│       │         ├── SÍ → SKIP (ya procesado)                │
│       │         └── NO → RE-STAMP (solo emitir con DIAN)    │
│       │                                                     │
│       └── NO → ¿Existe factura en Alegra?                   │
│                 (buscar por #order_number)                  │
│                 ├── SÍ → Sincronizar + RE-STAMP si falta    │
│                 └── NO → CREAR NUEVA FACTURA                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/auto-invoice-alegra/index.ts` | 1. Modificar `findPendingOrders` (línea 580): cambiar `.is('alegra_stamped', null)` por `.or('alegra_stamped.is.null,alegra_stamped.eq.false')`<br>2. Agregar campos `alegra_invoice_id` y `alegra_stamped` al select<br>3. Agregar función `verifyNoExistingInvoice()`<br>4. Modificar `processAutoInvoice()` para manejar re-stamping y verificación previa |

---

### Beneficios

1. **Recuperación automática**: Pedidos con stamping fallido se reintentan cada 2 minutos
2. **Sin duplicados**: Verifica en Alegra antes de crear facturas nuevas
3. **Eficiente**: Si ya existe factura, solo hace re-stamp (más rápido)
4. **Seguro**: Si el re-stamp falla, mantiene el registro y reintentará después

### Consideraciones

- El tag `AUTO_INVOICE_FAILED` sigue excluyendo pedidos del batch (para casos donde el error es permanente, como productos sin mapeo)
- El cron seguirá ejecutándose cada 2 minutos, pero ahora incluirá pedidos con `alegra_stamped = false`
