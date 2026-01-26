
## Plan: Cambiar a Facturación Automática por Cron (Polling)

### Cambio de Arquitectura

| Antes (Webhook) | Después (Cron) |
|-----------------|----------------|
| Cada webhook dispara `auto-invoice-alegra` | Un cron cada 2 minutos busca pedidos pendientes |
| Race conditions con múltiples webhooks | Proceso secuencial, sin concurrencia |
| Necesita locks complejos | No necesita locks (1 solo proceso) |
| Fire-and-forget desde webhook | Controlado y predecible |

```text
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO ACTUAL (Webhook)                   │
├─────────────────────────────────────────────────────────────┤
│  Shopify ──webhook──> shopify-webhook ──fire──> auto-invoice│
│                       ↓                         ↓           │
│                    (paralelo)              (paralelo)       │
│                    webhook A               invoice A        │
│                    webhook B               invoice B  ← DUP │
│                    webhook C               invoice C  ← DUP │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    FLUJO NUEVO (Cron)                       │
├─────────────────────────────────────────────────────────────┤
│  Shopify ──webhook──> shopify-webhook (guarda pedido)       │
│                                                             │
│  pg_cron (cada 2 min) ──> auto-invoice-alegra               │
│                           ↓                                 │
│                      (secuencial)                           │
│                      pedido 1 → factura 1                   │
│                      pedido 2 → factura 2                   │
│                      pedido 3 → factura 3                   │
└─────────────────────────────────────────────────────────────┘
```

---

### Cambios Requeridos

#### 1. Modificar `shopify-webhook/index.ts`
**Eliminar** la llamada `triggerAutoInvoice()`. El webhook solo guarda el pedido, no dispara facturación.

```typescript
// ANTES (línea ~1050)
if (isEligible) {
  triggerAutoInvoice(order.id, organization.id);
}

// DESPUÉS
if (isEligible) {
  console.log(`🧾 Pedido ${order.order_number} elegible para auto-invoice (se procesará por cron)`);
}
```

#### 2. Modificar `auto-invoice-alegra/index.ts`
Cambiar de recibir un solo `shopifyOrderId` a **buscar todos los pedidos pendientes**:

```typescript
// NUEVO: Función para buscar pedidos pendientes de facturación
async function findPendingOrders(supabase: any): Promise<Array<{shopify_order_id: number, organization_id: string}>> {
  // Buscar pedidos:
  // - financial_status = 'paid'
  // - alegra_invoice_id IS NULL
  // - NO tiene tag 'FACTURADO' ni 'AUTO_INVOICE_FAILED'
  // - source_name != 'pos'
  // - NO es contraentrega
  // - created_at en últimos 7 días (evitar procesar histórico)
  
  const { data } = await supabase
    .from('shopify_orders')
    .select('shopify_order_id, organization_id, tags, source_name')
    .eq('financial_status', 'paid')
    .is('alegra_invoice_id', null)
    .is('alegra_stamped', null)  // No procesado
    .neq('source_name', 'pos')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })  // Más antiguo primero
    .limit(10)  // Máximo 10 por ejecución
  
  return (data || []).filter(order => {
    const tags = (order.tags || '').toLowerCase();
    return !tags.includes('contraentrega') 
        && !tags.includes('facturado')
        && !tags.includes('auto_invoice_failed');
  });
}
```

#### 3. Agregar Normalización de Ciudad desde `shipping_coverage`

```typescript
async function normalizeAlegraCityFromDB(
  supabase: any,
  organizationId: string,
  cityName: string,
  provinceName: string
): Promise<{ city: string; department: string }> {
  const normalizedCity = cityName.toLowerCase().trim();
  
  // 1. Buscar en shipping_coverage (tiene 1,100+ municipios)
  const { data: match } = await supabase
    .from('shipping_coverage')
    .select('municipality, department')
    .eq('organization_id', organizationId)
    .ilike('municipality', normalizedCity)
    .limit(1)
    .maybeSingle();

  if (match) {
    console.log(`📍 Ciudad normalizada desde DB: ${cityName} → ${match.municipality}, ${match.department}`);
    return { city: match.municipality, department: match.department };
  }

  // 2. Usar provincia de Shopify como departamento (si disponible)
  if (provinceName && !provinceName.toLowerCase().includes('bogot')) {
    console.log(`📍 Usando provincia de Shopify: ${cityName}, ${provinceName}`);
    return { city: cityName, department: provinceName };
  }

  // 3. Fallback a diccionario estático o Bogotá por defecto
  const staticMatch = ALEGRA_CITY_NORMALIZATIONS[normalizedCity];
  if (staticMatch) return staticMatch;

  console.log(`⚠️ Ciudad no encontrada, usando Bogotá por defecto: ${cityName}`);
  return { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' };
}
```

#### 4. Nuevo Endpoint para Cron (Batch Processing)

```typescript
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const body = await req.json().catch(() => ({}));
  
  // Modo 1: Pedido específico (para reintento manual)
  if (body.shopifyOrderId && body.organizationId) {
    const result = await processAutoInvoice(body.shopifyOrderId, body.organizationId, supabase);
    return new Response(JSON.stringify(result), { headers: corsHeaders });
  }

  // Modo 2: Batch automático (cron)
  console.log('🔄 Iniciando procesamiento batch de facturas...');
  const pendingOrders = await findPendingOrders(supabase);
  
  if (pendingOrders.length === 0) {
    console.log('✅ No hay pedidos pendientes de facturación');
    return new Response(JSON.stringify({ processed: 0, message: 'No pending orders' }), { headers: corsHeaders });
  }

  console.log(`📋 Encontrados ${pendingOrders.length} pedidos pendientes`);
  
  const results = [];
  for (const order of pendingOrders) {
    try {
      console.log(`\n🧾 Procesando pedido ${order.shopify_order_id}...`);
      const result = await processAutoInvoice(order.shopify_order_id, order.organization_id, supabase);
      results.push({ orderId: order.shopify_order_id, ...result });
      
      // Esperar 2 segundos entre pedidos para no saturar Alegra
      await sleep(2000);
    } catch (err: any) {
      results.push({ orderId: order.shopify_order_id, success: false, error: err.message });
    }
  }

  return new Response(JSON.stringify({ 
    processed: results.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results 
  }), { headers: corsHeaders });
});
```

#### 5. Configurar Cron Job (SQL)

```sql
-- Ejecutar auto-invoice cada 2 minutos
SELECT cron.schedule(
  'auto-invoice-batch',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/auto-invoice-alegra',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzQyODksImV4cCI6MjA2NTM1MDI4OX0.LA-Z6t1uSQrVvZsPimxy65uPSEAf3sOHzOQD_zdt-mI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `supabase/functions/shopify-webhook/index.ts` | Eliminar llamada a `triggerAutoInvoice()` (líneas 889-916) |
| `supabase/functions/auto-invoice-alegra/index.ts` | 1) Agregar `findPendingOrders()`<br>2) Agregar `normalizeAlegraCityFromDB()` con consulta a shipping_coverage<br>3) Modificar handler para soportar batch y single<br>4) Cambiar elegibilidad: todos pagados excepto POS/contraentrega<br>5) Manejar errores DIAN sin crear duplicados |

---

### Beneficios del Cambio

1. **Sin duplicados**: Proceso secuencial, 1 pedido a la vez
2. **Sin race conditions**: No hay concurrencia
3. **Más control**: Fácil de pausar, reiniciar, debuggear
4. **Menos carga**: No dispara en cada webhook
5. **Mejor para lotes**: Puede procesar pedidos históricos
6. **Tolerante a fallos**: Si falla, reintenta en 2 min

### Posibles Desventajas

- **Latencia de 0-2 minutos**: La factura no se crea instantáneamente (pero para propósitos contables esto es aceptable)

---

### Configuración Adicional

Para el cron job se requiere habilitar las extensiones `pg_cron` y `pg_net` en Supabase (si no están habilitadas).

---

### Resumen de Implementación

1. **Migración SQL**: Crear cron job cada 2 minutos
2. **Modificar webhook**: Eliminar trigger de auto-invoice
3. **Modificar auto-invoice**: 
   - Modo batch (sin parámetros) → busca pendientes
   - Modo single (con orderId) → procesa uno específico
   - Normalización de ciudad desde `shipping_coverage`
   - Todos los pagados elegibles (no solo web)
   - No duplicar facturas si DIAN rechaza
4. **Desplegar ambas funciones**
