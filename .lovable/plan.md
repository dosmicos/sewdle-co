
# Plan: Corregir Etiquetado FACTURADO en Facturación Automática

## Problema Identificado

Las facturas se están creando correctamente en Alegra, pero el tag **FACTURADO** no se está agregando a los pedidos en Shopify. La razón:

1. La función `addFacturadoTag` en `auto-invoice-alegra` usa `Deno.env.get('SHOPIFY_ACCESS_TOKEN')` para obtener el token de Shopify
2. Este secret **no está configurado** como variable de entorno del proyecto
3. Las credenciales de Shopify están almacenadas en la tabla `organizations.shopify_credentials`
4. Sin el token, la función retorna silenciosamente sin hacer nada

**Evidencia**: Hay múltiples pedidos con `alegra_stamped = true` y CUFE pero sin el tag FACTURADO:
- Pedido 68137 (DM46251) - Facturado pero sin tag
- Pedido 68125 (DM46245) - Facturado pero sin tag  
- Pedido 68116 (DM46238) - Facturado pero sin tag

## Solución

Modificar las funciones `addFacturadoTag` y `addErrorTag` en `auto-invoice-alegra` para que obtengan las credenciales de Shopify desde la base de datos cuando no estén en variables de entorno (mismo patrón usado en `update-shopify-order-note`).

## Cambios Técnicos

### Archivo: `supabase/functions/auto-invoice-alegra/index.ts`

Modificar las funciones `addFacturadoTag` y `addErrorTag` para:

1. Recibir `supabase` y `organizationId` como parámetros adicionales
2. Obtener las credenciales desde `organizations.shopify_credentials` si no están en env
3. Usar el dominio correcto desde `organizations.shopify_store_url`

**Cambios en la firma de las funciones:**

```typescript
// ANTES:
async function addFacturadoTag(shopifyOrderId: number, shopDomain: string): Promise<void>

// DESPUÉS:
async function addFacturadoTag(
  shopifyOrderId: number, 
  supabase: any, 
  organizationId: string
): Promise<void>
```

**Nueva lógica para obtener credenciales:**

```typescript
async function getShopifyCredentials(supabase: any, organizationId: string): Promise<{
  domain: string;
  accessToken: string;
} | null> {
  // 1. Intentar variables de entorno
  let shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  let shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
  
  // 2. Si no hay, obtener de la organización
  if (!shopifyDomain || !shopifyToken) {
    const { data: org } = await supabase
      .from('organizations')
      .select('shopify_store_url, shopify_credentials')
      .eq('id', organizationId)
      .single();
    
    if (org?.shopify_store_url && org?.shopify_credentials?.access_token) {
      const url = new URL(org.shopify_store_url);
      shopifyDomain = url.hostname;
      shopifyToken = org.shopify_credentials.access_token;
    }
  }
  
  if (!shopifyDomain || !shopifyToken) return null;
  
  // Normalizar dominio
  const normalizedDomain = shopifyDomain.includes('.myshopify.com')
    ? shopifyDomain
    : `${shopifyDomain}.myshopify.com`;
  
  return { domain: normalizedDomain, accessToken: shopifyToken };
}
```

**Actualizar llamadas a las funciones:**

```typescript
// En línea ~730 (después de sincronizar factura existente con CUFE)
await addFacturadoTag(shopifyOrderId, supabase, organizationId);

// En línea ~766 (después de re-stamp exitoso)
await addFacturadoTag(shopifyOrderId, supabase, organizationId);

// En línea ~788 (cuando se alcanza límite de reintentos)
await addErrorTag(shopifyOrderId, supabase, organizationId, `Re-stamp DIAN falló...`);

// En línea ~908 (cuando stamp inicial falla y alcanza límite)
await addErrorTag(shopifyOrderId, supabase, organizationId, `Stamping DIAN falló...`);

// En línea ~959 (éxito completo)
await addFacturadoTag(shopifyOrderId, supabase, organizationId);
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `supabase/functions/auto-invoice-alegra/index.ts` | Nueva función `getShopifyCredentials`, modificar `addFacturadoTag` y `addErrorTag` |

## Resultado Esperado

1. Cuando se facture automáticamente un pedido, el tag FACTURADO se agregará correctamente a Shopify
2. Cuando un pedido alcance el límite de reintentos, el tag AUTO_INVOICE_FAILED se sincronizará a Shopify
3. Los pedidos que ya tienen factura pero no tienen tag podrán ser recuperados con una ejecución manual o mediante `syncPendingInvoices`

## Solución de Datos Existentes

Después de aplicar el fix, los pedidos existentes que tienen `alegra_stamped = true` pero no tienen el tag FACTURADO pueden ser corregidos ejecutando una consulta que los identifique y llame a la función de sincronización de tags. Esto se puede hacer desde el frontend con el botón "Sincronizar Facturas Pendientes" en la página de Alegra.
