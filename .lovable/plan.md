

## Plan: Facturación Automática para Pedidos Pagados (Solo Nuevos)

### Objetivo

Implementar un sistema de facturación automática que emita facturas electrónicas de Alegra cuando un pedido de Shopify cumpla estas condiciones:

1. **Estado financiero**: `paid` (pagado)
2. **Origen**: `web` (no draft orders ni POS)  
3. **Sin contraentrega**: No tenga tag "contraentrega"
4. **Sin factura existente**: No tenga ya `alegra_invoice_id` o tag `FACTURADO`

Los pedidos antiguos se seguirán facturando manualmente con el botón "Verificar y Emitir" existente.

---

### Arquitectura

```text
┌─────────────────────────────────────────────────────────────────────┐
│                   SHOPIFY WEBHOOK                                    │
│             (orders/create, orders/update)                           │
├─────────────────────────────────────────────────────────────────────┤
│  1. Recibe pedido de Shopify                                        │
│  2. Guarda en shopify_orders                                        │
│  3. Aplica auto-tags (Contraentrega, BORDADO, etc.)                 │
│  4. Verifica: ¿paid + web + sin contraentrega + sin factura?        │
│        │                                                            │
│        ├── SÍ ───────────────────────────────────────┐              │
│        │                                             │              │
│        ▼                                             ▼              │
│  [Llama a auto-invoice-alegra]              [Continúa normal]       │
│        │  (fire-and-forget)                                         │
│        ▼                                                            │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │         AUTO-INVOICE-ALEGRA (Nueva Edge Function)         │       │
│  ├──────────────────────────────────────────────────────────┤       │
│  │  1. Cargar datos completos del pedido                    │       │
│  │  2. Buscar/crear contacto en Alegra                      │       │
│  │  3. Cargar mappings de alegra_product_mapping            │       │
│  │  4. Mapear productos Shopify → Alegra (SKU, título)      │       │
│  │  5. Crear factura (paymentMethod: CASH, IVA 19%)         │       │
│  │  6. Emitir electrónicamente (stamp → CUFE)               │       │
│  │  7. Registrar pago automáticamente                       │       │
│  │  8. Actualizar shopify_orders con invoice_id, CUFE       │       │
│  │  9. Registrar en alegra_invoices                         │       │
│  │  10. Aplicar tag "FACTURADO" en Shopify                  │       │
│  └──────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Archivos a Crear

#### 1. `supabase/functions/auto-invoice-alegra/index.ts`

Nueva Edge Function que encapsula toda la lógica de facturación automática.

**Flujo interno:**

| Paso | Acción | Datos |
|------|--------|-------|
| 1 | Recibir shopify_order_id y organization_id | Payload del webhook |
| 2 | Cargar pedido completo de shopify_orders | Con line_items |
| 3 | Verificar elegibilidad (double-check) | paid, web, no contraentrega, no facturado |
| 4 | Buscar contacto en Alegra | email → cédula → teléfono |
| 5 | Crear contacto si no existe | Con dirección normalizada DIAN |
| 6 | Cargar product mappings | De tabla alegra_product_mapping |
| 7 | Construir items de factura | Con IVA 19%, descuentos |
| 8 | Crear factura en Alegra | POST /invoices |
| 9 | Emitir con DIAN (stamp) | POST /invoices/stamp |
| 10 | Registrar pago | POST /payments |
| 11 | Actualizar shopify_orders | alegra_invoice_id, cufe, stamped |
| 12 | Registrar en alegra_invoices | Para auditoría |
| 13 | Aplicar tag FACTURADO | Via Shopify API |

**Lógica reutilizada de `alegra-api` y `BulkInvoiceCreator`:**
- Normalización de ciudades DIAN (Bogotá, D.C., etc.)
- Búsqueda/creación de contactos con identificationType/kindOfPerson
- Mapeo de productos con precios sin IVA (÷ 1.19)
- Envío como item separado sin impuesto
- Registro de pago automático para pedidos paid

---

### Archivos a Modificar

#### 2. `supabase/functions/shopify-webhook/index.ts`

**Cambios:**

1. **Nueva función `checkAutoInvoiceEligibility()`** (después de línea 730)
   - Verifica los 4 criterios de elegibilidad
   - Retorna `true` solo si cumple todos

2. **Nueva función `triggerAutoInvoice()`** (después de `checkAutoInvoiceEligibility`)
   - Llama a la Edge Function `auto-invoice-alegra`
   - Ejecuta de forma asíncrona (fire-and-forget)
   - No bloquea la respuesta del webhook

3. **Integración en `processSingleOrder()`** (línea ~403, después de auto-tags)
   - Verificar elegibilidad
   - Si cumple, disparar facturación automática

4. **Integración en `updateExistingOrder()`** (línea ~732, después de auto-tags)
   - Mismo flujo para updates (cuando cambia a `paid`)

**Criterios de elegibilidad:**

```text
┌────────────────────────────────────────────────────────┐
│  Criterio                  │ Valor requerido           │
├────────────────────────────┼───────────────────────────┤
│  financial_status          │ 'paid'                    │
│  source_name               │ 'web'                     │
│  tags (no contiene)        │ 'contraentrega'           │
│  tags (no contiene)        │ 'facturado'               │
│  alegra_stamped (en DB)    │ false o null              │
└────────────────────────────┴───────────────────────────┘
```

#### 3. `supabase/config.toml`

Agregar configuración para la nueva función:

```toml
[functions.auto-invoice-alegra]
verify_jwt = false
```

---

### Manejo de Errores

| Escenario | Acción |
|-----------|--------|
| Rate limit de Alegra | Reintentar con backoff (1s, 2s, 4s) |
| Producto sin mapping | Log warning, agregar tag AUTO_INVOICE_FAILED |
| Error creando factura | Tag "AUTO_INVOICE_FAILED" en Shopify |
| Error en stamp | Factura creada sin CUFE (recuperable manual) |
| Error de red | Log en sync_control_logs |

Los errores de facturación **NO bloquean** el webhook principal. El pedido se guarda normalmente y puede facturarse manualmente después.

---

### Tabla de Resultados Esperados

| Tipo de Pedido | Origen | Tags | Resultado |
|----------------|--------|------|-----------|
| Pagado | web | - | Factura automática |
| Pagado | web | Express | Factura automática |
| Pending | web | Contraentrega | No facturar (COD) |
| Pagado | shopify_draft_order | - | No facturar (manual) |
| Pagado | pos | - | No facturar (POS) |
| Pagado | web | FACTURADO | Ya facturado |
| Pagado | web | - (con alegra_stamped) | Ya facturado |

---

### Sección Técnica

**Nueva Edge Function: `auto-invoice-alegra/index.ts`**

Estructura principal:

```typescript
// 1. Imports y CORS
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

// 2. Constantes de Alegra API
const ALEGRA_API_URL = 'https://api.alegra.com/api/v1'

// 3. Funciones auxiliares (reutilizadas de alegra-api)
// - getAlegraAuthHeader()
// - makeAlegraRequest() con retry
// - normalizeAlegraCOAddress()
// - normalizeIdentificationType()
// - findContactInAlegra()

// 4. Función principal
async function processAutoInvoice(shopifyOrderId, organizationId, supabase) {
  // 4.1 Cargar datos del pedido
  // 4.2 Verificar elegibilidad (double-check)
  // 4.3 Buscar/crear contacto
  // 4.4 Cargar mappings
  // 4.5 Construir items con IVA
  // 4.6 Crear factura
  // 4.7 Emitir con DIAN
  // 4.8 Registrar pago
  // 4.9 Actualizar DB
  // 4.10 Agregar tag FACTURADO
}

// 5. Handler HTTP
Deno.serve(async (req) => { ... })
```

**Modificación en `shopify-webhook/index.ts`:**

```typescript
// Nueva función después de línea 730
async function checkAutoInvoiceEligibility(order: any, supabase: any, organizationId: string): Promise<boolean> {
  // 1. Solo pedidos PAGADOS
  if (order.financial_status !== 'paid') return false;
  
  // 2. Solo pedidos del sitio web
  if (order.source_name !== 'web') return false;
  
  // 3. No contraentrega
  const tags = (order.tags || '').toLowerCase();
  if (tags.includes('contraentrega')) return false;
  
  // 4. No ya facturado (por tag)
  if (tags.includes('facturado')) return false;
  
  // 5. No ya facturado (por DB)
  const { data } = await supabase
    .from('shopify_orders')
    .select('alegra_stamped, alegra_invoice_id')
    .eq('shopify_order_id', order.id)
    .eq('organization_id', organizationId)
    .single();
  
  if (data?.alegra_stamped || data?.alegra_invoice_id) return false;
  
  return true;
}

async function triggerAutoInvoice(shopifyOrderId: number, organizationId: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  
  // Fire-and-forget - no esperamos respuesta
  fetch(`${supabaseUrl}/functions/v1/auto-invoice-alegra`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    },
    body: JSON.stringify({ shopifyOrderId, organizationId })
  }).catch(err => {
    console.error('⚠️ Error llamando auto-invoice-alegra:', err);
  });
}
```

**Integración en processSingleOrder (línea ~403):**

```typescript
// Después de aplicar auto-tags (línea 400-403)
// AUTO-INVOICING
if (await checkAutoInvoiceEligibility(order, supabase, organizationId)) {
  console.log('🧾 Pedido elegible para facturación automática');
  triggerAutoInvoice(order.id, organizationId);
}
```

**Dependencias reutilizadas:**
- Secretos existentes: `ALEGRA_USER_EMAIL`, `ALEGRA_API_TOKEN`, `SHOPIFY_ACCESS_TOKEN`
- Tabla `alegra_product_mapping` para mapeo de productos
- Tabla `alegra_invoices` para registro de facturas emitidas
- Lógica de normalización DIAN de `alegra-api`

**Consideraciones de rendimiento:**
- El webhook de Shopify tiene timeout de 5 segundos
- La facturación se ejecuta **asíncrona** (fire-and-forget)
- El webhook responde inmediatamente después de guardar el pedido
- La factura se procesa en segundo plano sin bloquear

