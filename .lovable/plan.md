
## Plan: Corregir Facturación Automática Duplicada + Cobertura Completa

### Diagnóstico del Problema

He confirmado los dos problemas principales:

#### Problema 1: Facturas Duplicadas (4 facturas para pedido #68028)
Los logs muestran que **el lock atómico no está funcionando correctamente**:

```text
20:05:35Z → Crea factura DM46058
20:05:46Z → Crea factura DM46059  
20:06:31Z → Crea factura DM46060
20:06:42Z → Crea factura DM46061
```

**Causa**: El lock verifica `alegra_invoice_id = null`, pero el código guarda `alegra_invoice_id` **DESPUÉS** de crear la factura (línea 742). Esto crea una ventana de 5-10 segundos donde múltiples webhooks pueden adquirir el lock porque `alegra_invoice_id` sigue siendo `null`.

Flujo actual problemático:
```text
0ms:  Webhook A adquiere lock (.eq('alegra_invoice_id', null) → TRUE) ✅
1ms:  Webhook B adquiere lock (.eq('alegra_invoice_id', null) → TRUE) ✅ ← El lock de A no cambió alegra_invoice_id
...
5000ms: Webhook A crea factura y guarda alegra_invoice_id
5000ms: Webhook B crea factura (ya pasó la verificación)
```

#### Problema 2: Error DIAN "la ciudad no es válida"
El pedido #68028 tiene:
- Ciudad: "El Rosal"
- Provincia: "Cundinamarca"

Pero en `ALEGRA_CITY_NORMALIZATIONS` solo hay ~10 ciudades principales. "El Rosal" no está, y el código asigna por defecto "Bogotá D.C." como departamento, lo cual es incorrecto.

#### Problema 3: Pedidos no facturados
Los pedidos con `source_name='shopify_draft_order'` no se facturan porque el código actual solo procesa `source_name='web'`. Según tu selección, todos los pedidos pagados deben facturarse.

---

### Solución Propuesta

#### 1. Corregir el Lock Atómico (Prevenir Duplicados)

**Cambio clave**: Separar el "lock para crear factura" del "lock para procesar". Usar una columna dedicada `auto_invoice_lock_id` para evitar race conditions.

```typescript
// ANTES (problemático)
.eq('auto_invoice_processing', false)
.is('alegra_invoice_id', null)  // ← Sigue null durante 5+ segundos

// DESPUÉS (correcto)
.eq('auto_invoice_processing', false)
.is('auto_invoice_lock_id', null)  // ← Se marca inmediatamente

// Al adquirir lock, también setear un UUID único
auto_invoice_lock_id: crypto.randomUUID()
```

Flujo corregido:
```text
0ms:   Webhook A → lock_id = "abc123" (UPDATE exitoso)
1ms:   Webhook B → .is('auto_invoice_lock_id', null) → FALSE → Rechazado ✅
5000ms: Webhook A → Crea factura → Guarda alegra_invoice_id
```

#### 2. Corregir Normalización de Ciudad/Departamento

Usar la tabla `shipping_coverage` (1,102 municipios) para normalizar la ciudad correctamente:

```typescript
async function normalizeAlegraCityFromDB(
  supabase: any,
  organizationId: string,
  cityName: string,
  provinceName: string
): Promise<{ city: string; department: string }> {
  // 1. Buscar municipio exacto
  const { data: match } = await supabase
    .from('shipping_coverage')
    .select('municipality, department')
    .eq('organization_id', organizationId)
    .ilike('municipality', cityName)
    .limit(1)
    .maybeSingle()

  if (match) {
    return { city: match.municipality, department: match.department }
  }

  // 2. Usar provincia de Shopify como departamento
  if (provinceName && provinceName.toLowerCase() !== 'bogotá') {
    return { city: cityName, department: provinceName }
  }

  // 3. Fallback a diccionario estático
  return ALEGRA_CITY_NORMALIZATIONS[cityName.toLowerCase()] || 
         { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' }
}
```

#### 3. Ampliar Pedidos Elegibles

Cambiar la validación para incluir todos los pedidos pagados:

```typescript
// ANTES
if (orderData.source_name !== 'web') {
  return { success: false, error: 'No es pedido web' }
}

// DESPUÉS
// Solo excluir POS
if (orderData.source_name === 'pos') {
  return { success: false, error: 'Pedido POS' }
}
```

#### 4. Evitar Múltiples Facturas en Alegra por Error DIAN

Si el stamp falla, no crear una factura nueva. Dejar la factura existente como "pendiente":

```typescript
try {
  const stampedInvoice = await stampInvoice(invoice.id)
  // ... éxito
} catch (stampError: any) {
  // NO re-lanzar el error (evita que el webhook reintente)
  // Marcar pedido como "pendiente de revisión"
  await supabase.from('shopify_orders').update({
    alegra_invoice_id: invoice.id,
    alegra_invoice_number: invoiceNumber,
    alegra_stamped: false,  // No emitido
    alegra_stamp_error: stampError.message,  // Guardar error
  }).eq('shopify_order_id', shopifyOrderId)
  
  return { 
    success: false, 
    invoiceId: invoice.id, 
    error: `DIAN rechazó: ${stampError.message}` 
  }
}
```

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `supabase/functions/auto-invoice-alegra/index.ts` | 1) Usar `auto_invoice_lock_id` para lock atómico<br>2) Agregar `normalizeAlegraCityFromDB()` con consulta a `shipping_coverage`<br>3) Cambiar validación de `source_name` para incluir draft orders<br>4) Capturar error de stamp sin re-lanzar<br>5) Pasar `provinceName` de shipping_address para mejor normalización |

### Migración de Base de Datos

```sql
-- Columna para lock más robusto
ALTER TABLE shopify_orders 
ADD COLUMN IF NOT EXISTS auto_invoice_lock_id UUID;

-- Columna para guardar errores de stamp
ALTER TABLE shopify_orders 
ADD COLUMN IF NOT EXISTS alegra_stamp_error TEXT;

-- Índice para lock atómico
CREATE INDEX IF NOT EXISTS idx_shopify_orders_auto_invoice_lock
ON shopify_orders (organization_id, shopify_order_id) 
WHERE auto_invoice_lock_id IS NULL AND alegra_invoice_id IS NULL;
```

---

### Resumen de Cambios Técnicos

1. **Lock Atómico Mejorado**:
   - Agregar columna `auto_invoice_lock_id` (UUID)
   - Marcar inmediatamente al intentar lock (no depende de `alegra_invoice_id`)
   - Limpiar lock solo en `finally`

2. **Normalización de Ciudad**:
   - Consultar tabla `shipping_coverage` primero
   - Usar `shipping_address.province` como fallback para departamento
   - Mantener diccionario estático solo para casos comunes

3. **Cobertura de Pedidos**:
   - Eliminar filtro `source_name === 'web'`
   - Solo excluir POS y contraentrega

4. **Manejo de Errores DIAN**:
   - Guardar factura creada aunque stamp falle
   - No crear nuevas facturas (la existente queda "pendiente")
   - Agregar columna `alegra_stamp_error` para debugging

---

### Resultado Esperado

1. **Sin duplicados**: El lock atómico funciona correctamente
2. **Ciudades correctas**: "El Rosal" → Cundinamarca (no Bogotá D.C.)
3. **Todos los pagados**: Draft orders también se facturan
4. **Errores manejables**: Una sola factura por pedido, se puede corregir y reintentar

---

### Pedidos Afectados Actuales

Después de implementar, necesitarás:
1. **Anular facturas duplicadas** en Alegra (DM46058, DM46059, DM46060, DM46061 del pedido #68028)
2. **Limpiar tags** `AUTO_INVOICE_FAILED` de pedidos que se reprocesarán
3. **Reprocesar** pedidos fallidos manualmente o con un trigger
