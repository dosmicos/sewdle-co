import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

// Helper function to verify Shopify webhook signature
async function verifyShopifyWebhook(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const hash = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  
  // Convert hash to Base64 for comparison (Shopify sends Base64, not hex)
  const hashArray = new Uint8Array(hash);
  const expectedSignature = btoa(String.fromCharCode(...hashArray));
  
  // Shopify sends signature directly in Base64 format, no prefix
  const receivedSignature = signature.replace('sha256=', '');
  
  console.log('🔍 Signature comparison:');
  console.log('- Expected (Base64):', expectedSignature);
  console.log('- Received (Base64):', receivedSignature);
  console.log('- Match:', expectedSignature === receivedSignature);
  
  return expectedSignature === receivedSignature;
}

// Function to determine automatic tags based on payment gateway and line items
// IMPORTANTE: Usa el ÚLTIMO método de pago del array como el efectivo (orden cronológico de Shopify)
function determineAutoTags(order: any): string[] {
  const tags: string[] = [];
  
  // Payment gateway names comes as array in chronological order
  const paymentGateways = order.payment_gateway_names || [];
  
  // El ÚLTIMO método de pago es el efectivo (el cliente pudo intentar varios)
  const effectivePaymentMethod = paymentGateways.length > 0
    ? paymentGateways[paymentGateways.length - 1]
    : null;
  
  console.log('💳 Payment gateways detectados:', paymentGateways);
  console.log('💳 Método de pago EFECTIVO (último):', effectivePaymentMethod);
  
  // Payment gateway rules based on EFFECTIVE (last) payment method only
  if (effectivePaymentMethod === 'Addi Payment') {
    tags.push('Confirmado');
    console.log('  → Addi Payment (efectivo) → Tag "Confirmado"');
  } else if (effectivePaymentMethod?.toLowerCase().includes('bold')) {
    tags.push('Confirmado');
    console.log('  → Bold (efectivo) → Tag "Confirmado"');
  } else if (effectivePaymentMethod?.toLowerCase().includes('mercado pago')) {
    tags.push('Confirmado');
    console.log('  → Mercado Pago (efectivo) → Tag "Confirmado"');
  } else if (effectivePaymentMethod === 'Cash on Delivery (COD)') {
    // Payment gateway rule for "Contraentrega" tag
    // ONLY apply if order is NOT already paid
    const financialStatus = order.financial_status || '';
    if (financialStatus !== 'paid') {
      tags.push('Contraentrega');
      console.log('  → Cash on Delivery (efectivo, no pagado) → Tag "Contraentrega"');
    } else {
      console.log('  → Cash on Delivery (efectivo) pero pedido ya pagado → NO aplicar "Contraentrega"');
    }
  }
  
  // Line items rule for "BORDADO" tag
  const lineItems = order.line_items || [];
  const hasBordado = lineItems.some((item: any) => 
    item.title?.toLowerCase().includes('bordado') || 
    item.name?.toLowerCase().includes('bordado')
  );
  
  if (hasBordado) {
    tags.push('BORDADO');
    console.log('  → Producto con "Bordado" detectado → Tag "BORDADO"');
  }
  
  // Remove duplicates
  return [...new Set(tags)];
}

// Function to apply automatic tags to Shopify order via API
// IMPORTANTE: Guarda PRIMERO en la base de datos local, DESPUÉS envía a Shopify
async function applyAutoTagsToShopify(
  orderId: number, 
  tagsToAdd: string[], 
  existingTags: string | null,
  shopDomain: string,
  supabase: any
): Promise<void> {
  if (tagsToAdd.length === 0) {
    console.log('🏷️ No hay tags automáticos que aplicar');
    return;
  }
  
  // Combine existing tags with new tags
  const currentTags = existingTags ? existingTags.split(',').map(t => t.trim()).filter(Boolean) : [];
  
  // Check if tags already exist to avoid unnecessary operations
  const newTagsToAdd = tagsToAdd.filter(tag => 
    !currentTags.some(existing => existing.toLowerCase() === tag.toLowerCase())
  );
  
  if (newTagsToAdd.length === 0) {
    console.log('🏷️ Todos los tags automáticos ya existen, no es necesario actualizar');
    return;
  }
  
  const allTags = [...new Set([...currentTags, ...newTagsToAdd])];
  const tagsString = allTags.join(', ');
  
  console.log('🏷️ Aplicando tags automáticos:');
  console.log('  - Tags actuales:', existingTags || 'ninguno');
  console.log('  - Tags a agregar:', newTagsToAdd);
  console.log('  - Tags finales:', tagsString);
  
  // ✅ PRIMERO: Guardar en base de datos local (independiente de Shopify)
  console.log('💾 Guardando tags en base de datos local PRIMERO...');
  const { error: dbError } = await supabase
    .from('shopify_orders')
    .update({ tags: tagsString })
    .eq('shopify_order_id', orderId);

  if (dbError) {
    console.error('❌ Error guardando tags en DB local:', dbError);
    // Continuamos para intentar Shopify de todas formas
  } else {
    console.log('✅ Tags guardados en base de datos local exitosamente');
  }
  
  // ✅ DESPUÉS: Enviar a Shopify (opcional, si falla los tags ya están en DB local)
  const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
  if (!shopifyAccessToken) {
    console.warn('⚠️ SHOPIFY_ACCESS_TOKEN no configurado - tags guardados solo en DB local');
    return;
  }
  
  console.log('📡 Enviando tags a Shopify...');
  try {
    const response = await fetch(
      `https://${shopDomain}/admin/api/2024-01/orders/${orderId}.json`,
      {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': shopifyAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: { tags: tagsString }
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error aplicando tags en Shopify:', response.status, errorText);
      console.log('ℹ️ Los tags ya están guardados en la DB local');
    } else {
      console.log('✅ Tags también aplicados exitosamente en Shopify');
    }
  } catch (error) {
    console.error('❌ Error llamando Shopify API para tags:', error);
    console.log('ℹ️ Los tags ya están guardados en la DB local');
  }
}

// Function to process and store a single Shopify order
async function processSingleOrder(order: any, supabase: any, shopDomain: string) {
  console.log(`📦 Procesando orden en tiempo real: ${order.id} - ${order.order_number}`);
  console.log(`🏪 Shop domain recibido: ${shopDomain}`);

  // Get organization_id using exact matching with shop domain from header
  let organizationId = null;
  if (shopDomain) {
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, shopify_store_url')
      .eq('shopify_store_url', `https://${shopDomain}`)
      .single();
    
    if (orgError) {
      console.error(`❌ Error buscando organización para ${shopDomain}:`, orgError);
      // Log available organizations for debugging
      const { data: allOrgs } = await supabase
        .from('organizations')
        .select('id, name, shopify_store_url')
        .not('shopify_store_url', 'is', null);
      console.log('📋 Organizaciones disponibles:', allOrgs);
      throw new Error(`No se pudo encontrar organización para la tienda: ${shopDomain}`);
    }
    
    organizationId = orgData?.id;
    console.log(`✅ Organización encontrada: ${orgData?.name} (${orgData?.id})`);
  } else {
    throw new Error('No se pudo determinar el dominio de la tienda Shopify');
  }

  // Store complete order in shopify_orders table
  const orderToInsert = {
    shopify_order_id: order.id,
    order_number: order.order_number || `#${order.id}`,
    email: order.email,
    created_at_shopify: order.created_at,
    updated_at_shopify: order.updated_at,
    cancelled_at: order.cancelled_at || null,
    closed_at: order.closed_at || null,
    processed_at: order.processed_at || null,
    
    // Estados
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status,
    order_status_url: order.order_status_url || null,
    
    // Información del cliente
    customer_id: order.customer?.id || null,
    customer_email: order.customer?.email || order.email,
    customer_first_name: order.customer?.first_name || null,
    customer_last_name: order.customer?.last_name || null,
    customer_phone: order.customer?.phone || null,
    customer_accepts_marketing: order.customer?.accepts_marketing || false,
    customer_orders_count: order.customer?.orders_count || 0,
    customer_total_spent: parseFloat(order.customer?.total_spent || '0'),
    
    // Direcciones como JSON
    billing_address: order.billing_address || null,
    shipping_address: order.shipping_address || null,
    
    // Información financiera
    currency: order.currency || 'USD',
    total_price: parseFloat(order.total_price || '0'),
    subtotal_price: parseFloat(order.subtotal_price || '0'),
    total_tax: parseFloat(order.total_tax || '0'),
    total_discounts: parseFloat(order.total_discounts || '0'),
    total_shipping: parseFloat(order.total_shipping || '0'),
    total_line_items_price: parseFloat(order.total_line_items_price || '0'),
    
    // Información adicional
    tags: order.tags || null,
    note: order.note || null,
    source_name: order.source_name || null,
    referring_site: order.referring_site || null,
    landing_site: order.landing_site || null,
    browser_ip: order.browser_ip || null,
    order_source_url: order.order_source_url || null,
    
    // Metadatos
    raw_data: order,
    organization_id: organizationId
  };

  // Insert order using upsert
  const { error: orderError } = await supabase
    .from('shopify_orders')
    .upsert(orderToInsert, { 
      onConflict: 'shopify_order_id',
      ignoreDuplicates: false 
    });

  if (orderError) {
    console.error('❌ Error insertando orden:', orderError);
    throw new Error(`Error al insertar orden: ${orderError.message}`);
  }

  console.log(`✅ Orden ${order.order_number} almacenada correctamente`);

  // Determinar operational_status basado en estados de Shopify
  let operationalStatus: 'pending' | 'picking' | 'packing' | 'ready_to_ship' | 'shipped' = 'pending';
  const orderTags = (order.tags || '').toLowerCase();

  if (order.cancelled_at) {
    operationalStatus = 'pending';
  } else if (order.fulfillment_status === 'fulfilled') {
    operationalStatus = 'shipped'; // Ya viene preparado desde Shopify
  } else if (orderTags.includes('empacado')) {
    operationalStatus = 'ready_to_ship';
  }

  console.log(`📦 Inicializando orden ${order.order_number} (${order.id}) en picking & packing para org ${organizationId}...`);
  console.log(`📦 Estado operacional inicial: ${operationalStatus} (fulfillment: ${order.fulfillment_status}, tags: ${order.tags})`);
  
  const { error: pickingError } = await supabase
    .from('picking_packing_orders')
    .upsert({
      shopify_order_id: order.id,
      organization_id: organizationId,
      operational_status: operationalStatus
    }, { 
      onConflict: 'organization_id,shopify_order_id',
      ignoreDuplicates: true 
    });

  if (pickingError) {
    console.error('⚠️ Error inicializando picking order:', pickingError);
    // No lanzamos error - es suplementario
  } else {
    console.log(`✅ Orden ${order.order_number} inicializada exitosamente en picking & packing`);
  }

  // Build SKU to image_url map from product_variants
  console.log('🖼️ Building SKU to image map for line items...');
  const skusInOrder = order.line_items.map((item: any) => item.sku).filter(Boolean);
  const skuToImageMap = new Map();
  
  if (skusInOrder.length > 0) {
    // Query through products table to get organization_id filter
    const { data: variantData, error: variantError } = await supabase
      .from('product_variants')
      .select('sku_variant, products!inner(image_url, organization_id)')
      .in('sku_variant', skusInOrder)
      .eq('products.organization_id', organizationId);
    
    if (variantError) {
      console.error('⚠️ Error fetching variant images:', variantError);
    } else if (variantData) {
      variantData.forEach((v: any) => {
        if (v.sku_variant && v.products?.image_url) {
          skuToImageMap.set(v.sku_variant, v.products.image_url);
        }
      });
      console.log(`✅ Mapped ${skuToImageMap.size} SKUs to images`);
    }
  }

  // Insert line items
  const lineItemsToInsert = [];
  
  for (const item of order.line_items) {
    // Try to get image from: 1) webhook data, 2) SKU map, 3) null
    const imageUrl = item.image?.src || item.featured_image || (item.sku ? skuToImageMap.get(item.sku) : null) || null;
    
    if (!imageUrl && item.sku) {
      console.log(`⚠️ No image found for SKU: ${item.sku} (${item.title})`);
    }
    
    lineItemsToInsert.push({
      shopify_order_id: order.id,
      shopify_line_item_id: item.id,
      
      // Información del producto
      product_id: item.product_id,
      variant_id: item.variant_id,
      title: item.title,
      variant_title: item.variant_title || null,
      vendor: item.vendor || null,
      product_type: item.product_type || null,
      sku: item.sku,
      image_url: imageUrl,
      
      // Cantidades y precios
      quantity: item.quantity,
      price: parseFloat(item.price),
      total_discount: parseFloat(item.total_discount || '0'),
      
      // Propiedades
      properties: item.properties || null,
      gift_card: item.gift_card || false,
      taxable: item.taxable !== false,
      
      // Información de fulfillment
      fulfillment_status: item.fulfillment_status || null,
      fulfillment_service: item.fulfillment_service || null,
      requires_shipping: item.requires_shipping !== false,
      organization_id: organizationId
    });
  }

  // UPSERT line items (atómico - previene duplicados por webhooks simultáneos)
  if (lineItemsToInsert.length > 0) {
    console.log(`📦 Upserting ${lineItemsToInsert.length} line items para orden ${order.order_number}...`);
    const { error: lineItemsError } = await supabase
      .from('shopify_order_line_items')
      .upsert(lineItemsToInsert, {
        onConflict: 'shopify_order_id,shopify_line_item_id',
        ignoreDuplicates: false
      });

    if (lineItemsError) {
      console.error('❌ Error upserting line items:', lineItemsError);
      throw new Error(`Error al upsert line items: ${lineItemsError.message}`);
    }
    
    console.log(`✅ ${lineItemsToInsert.length} line items almacenados correctamente`);
  }

  // Process sales metrics if order is paid
  if (['paid', 'partially_paid'].includes(order.financial_status)) {
    await processSalesMetrics(order, supabase);
  }

  // Auto-apply tags based on payment gateway and line items (replicates Shopify Flow logic)
  console.log('🤖 Analizando pedido para auto-aplicación de tags...');
  const autoTags = determineAutoTags(order);
  
  if (autoTags.length > 0) {
    console.log('🏷️ Tags automáticos detectados:', autoTags);
    await applyAutoTagsToShopify(order.id, autoTags, order.tags, shopDomain, supabase);
  } else {
    console.log('ℹ️ No se detectaron tags automáticos para este pedido');
  }

  // AUTO-INVOICING: Solo log - el cron batch procesará pedidos elegibles cada 2 minutos
  if (await checkAutoInvoiceEligibility(order, supabase, organizationId)) {
    console.log('🧾 Pedido elegible para facturación automática (se procesará por cron batch)');
  }

  return { success: true, order_number: order.order_number };
}

// Function to update an existing Shopify order (for orders/update webhook)
async function updateExistingOrder(order: any, supabase: any, shopDomain: string) {
  console.log(`🔄 Actualizando orden existente: ${order.id} - ${order.order_number}`);
  console.log(`🏪 Shop domain recibido: ${shopDomain}`);
  console.log('📝 Nota recibida de Shopify (webhook):', JSON.stringify((order as any)?.note ?? null));

  // Get organization_id using exact matching with shop domain from header
  let organizationId = null;
  if (shopDomain) {
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, shopify_store_url')
      .eq('shopify_store_url', `https://${shopDomain}`)
      .single();
    
    if (orgError) {
      console.error(`❌ Error buscando organización para ${shopDomain}:`, orgError);
      throw new Error(`No se pudo encontrar organización para la tienda: ${shopDomain}`);
    }
    
    organizationId = orgData?.id;
    console.log(`✅ Organización encontrada: ${orgData?.name} (${orgData?.id})`);
  } else {
    throw new Error('No se pudo determinar el dominio de la tienda Shopify');
  }

  // Update shopify_orders with latest data
  const orderToUpdate = {
    order_number: order.order_number || `#${order.id}`,
    email: order.email,
    updated_at_shopify: order.updated_at,
    cancelled_at: order.cancelled_at || null,
    closed_at: order.closed_at || null,
    processed_at: order.processed_at || null,
    
    // Estados actualizados
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status,
    order_status_url: order.order_status_url || null,
    
    // Información del cliente actualizada
    customer_id: order.customer?.id || null,
    customer_email: order.customer?.email || order.email,
    customer_first_name: order.customer?.first_name || null,
    customer_last_name: order.customer?.last_name || null,
    customer_phone: order.customer?.phone || null,
    customer_accepts_marketing: order.customer?.accepts_marketing || false,
    customer_orders_count: order.customer?.orders_count || 0,
    customer_total_spent: parseFloat(order.customer?.total_spent || '0'),
    
    // Direcciones actualizadas
    billing_address: order.billing_address || null,
    shipping_address: order.shipping_address || null,
    
    // Información financiera actualizada
    currency: order.currency || 'USD',
    total_price: parseFloat(order.total_price || '0'),
    subtotal_price: parseFloat(order.subtotal_price || '0'),
    total_tax: parseFloat(order.total_tax || '0'),
    total_discounts: parseFloat(order.total_discounts || '0'),
    total_shipping: parseFloat(order.total_shipping || '0'),
    total_line_items_price: parseFloat(order.total_line_items_price || '0'),
    
    // Información adicional - PROTEGER contra sobrescritura de tags/notes
    // Solo actualizar tags si el webhook trae tags válidos (no sobrescribir con null)
    ...(order.tags ? { tags: order.tags } : {}),

    // Solo actualizar note si viene en el payload (evita sobrescribir con null cuando Shopify omite el campo)
    ...(Object.prototype.hasOwnProperty.call(order, 'note') ? { note: order.note || null } : {}),

    // Metadatos actualizados
    raw_data: order
  };

  const { error: updateError } = await supabase
    .from('shopify_orders')
    .update(orderToUpdate)
    .eq('shopify_order_id', order.id)
    .eq('organization_id', organizationId);

  if (updateError) {
    console.error('❌ Error actualizando orden:', updateError);
    throw new Error(`Error al actualizar orden: ${updateError.message}`);
  }

  console.log(`✅ Orden ${order.order_number} actualizada correctamente`);

  // Sincronizar picking_packing_orders
  console.log('📦 Sincronizando estado de picking & packing...');
  console.log('📊 Información del pedido:');
  console.log('  - fulfillment_status:', order.fulfillment_status);
  console.log('  - financial_status:', order.financial_status);
  console.log('  - cancelled_at:', order.cancelled_at);
  console.log('  - tags:', order.tags);
  
  // Determinar operational_status basado en estados y tags de Shopify
  let operationalStatus: 'pending' | 'picking' | 'packing' | 'ready_to_ship' | 'shipped' = 'pending';

  const orderTags = (order.tags || '').toLowerCase();

  if (order.cancelled_at) {
    operationalStatus = 'pending'; // Mantener en pending para que no aparezca en flujo activo
  } else if (order.fulfillment_status === 'fulfilled') {
    operationalStatus = 'shipped'; // Pedido completamente enviado
  } else if (orderTags.includes('empacado')) {
    operationalStatus = 'ready_to_ship'; // Tag EMPACADO = listo para enviar
  } else if (order.fulfillment_status === null || order.fulfillment_status === 'unfulfilled' || order.fulfillment_status === '') {
    operationalStatus = 'pending'; // Sin fulfillment = por procesar
  } else {
    operationalStatus = 'pending'; // Fallback
  }

  console.log(`📦 Actualizando estado operacional a: ${operationalStatus}`);

  // Actualizar o crear picking_packing_order
  const { data: existingPickingOrder, error: findPickingError } = await supabase
    .from('picking_packing_orders')
    .select('id')
    .eq('shopify_order_id', order.id)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (findPickingError) {
    console.error('⚠️ Error buscando picking order:', findPickingError);
  } else if (existingPickingOrder) {
    // Actualizar orden existente
    const { error: pickingUpdateError } = await supabase
      .from('picking_packing_orders')
      .update({
        operational_status: operationalStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingPickingOrder.id);

    if (pickingUpdateError) {
      console.error('⚠️ Error actualizando picking order:', pickingUpdateError);
    } else {
      console.log(`✅ Picking order actualizada a estado: ${operationalStatus}`);
    }
  } else {
    // Crear nueva picking order si no existe
    console.log('📝 Creando nueva picking order...');
    const { error: createPickingError } = await supabase
      .from('picking_packing_orders')
      .insert({
        shopify_order_id: order.id,
        organization_id: organizationId,
        operational_status: operationalStatus
      });

    if (createPickingError) {
      console.error('⚠️ Error creando picking order:', createPickingError);
    } else {
      console.log('✅ Nueva picking order creada');
    }
  }

  // Build SKU to image_url map from product_variants
  console.log('🖼️ Building SKU to image map for updated line items...');
  const skusInOrder = order.line_items.map((item: any) => item.sku).filter(Boolean);
  const skuToImageMap = new Map();
  
  if (skusInOrder.length > 0) {
    // Query through products table to get organization_id filter
    const { data: variantData, error: variantError } = await supabase
      .from('product_variants')
      .select('sku_variant, products!inner(image_url, organization_id)')
      .in('sku_variant', skusInOrder)
      .eq('products.organization_id', organizationId);
    
    if (variantError) {
      console.error('⚠️ Error fetching variant images:', variantError);
    } else if (variantData) {
      variantData.forEach((v: any) => {
        if (v.sku_variant && v.products?.image_url) {
          skuToImageMap.set(v.sku_variant, v.products.image_url);
        }
      });
      console.log(`✅ Mapped ${skuToImageMap.size} SKUs to images`);
    }
  }

  // Build line items to upsert (skip removed items with quantity 0)
  const lineItemsToUpsert = [];
  const removedLineItemIds: number[] = [];
  
  for (const item of order.line_items) {
    // current_quantity reflects actual quantity after refunds/cancellations
    const effectiveQuantity = item.current_quantity ?? item.quantity;
    
    if (effectiveQuantity === 0) {
      console.log(`⏭️ Skipping removed line item: ${item.title} (ID: ${item.id})`);
      removedLineItemIds.push(item.id);
      continue;
    }
    
    const imageUrl = item.image?.src || item.featured_image || (item.sku ? skuToImageMap.get(item.sku) : null) || null;
    
    lineItemsToUpsert.push({
      shopify_order_id: order.id,
      shopify_line_item_id: item.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      title: item.title,
      variant_title: item.variant_title || null,
      vendor: item.vendor || null,
      product_type: item.product_type || null,
      sku: item.sku,
      image_url: imageUrl,
      quantity: effectiveQuantity,
      price: parseFloat(item.price),
      total_discount: parseFloat(item.total_discount || '0'),
      properties: item.properties || null,
      gift_card: item.gift_card || false,
      taxable: item.taxable !== false,
      fulfillment_status: item.fulfillment_status || null,
      fulfillment_service: item.fulfillment_service || null,
      requires_shipping: item.requires_shipping !== false,
      organization_id: organizationId
    });
  }

  // Delete removed line items (quantity 0)
  if (removedLineItemIds.length > 0) {
    console.log(`🗑️ Eliminando ${removedLineItemIds.length} line items removidos...`);
    const { error: deleteError } = await supabase
      .from('shopify_order_line_items')
      .delete()
      .eq('shopify_order_id', order.id)
      .in('shopify_line_item_id', removedLineItemIds);

    if (deleteError) {
      console.error('⚠️ Error eliminando line items removidos:', deleteError);
    }
  }

  // UPSERT line items (atómico - previene duplicados por webhooks simultáneos)
  if (lineItemsToUpsert.length > 0) {
    console.log(`📦 Upserting ${lineItemsToUpsert.length} line items para orden ${order.order_number}...`);
    const { error: lineItemsError } = await supabase
      .from('shopify_order_line_items')
      .upsert(lineItemsToUpsert, {
        onConflict: 'shopify_order_id,shopify_line_item_id',
        ignoreDuplicates: false
      });

    if (lineItemsError) {
      console.error('❌ Error upserting line items:', lineItemsError);
      throw new Error(`Error al upsert line items: ${lineItemsError.message}`);
    }
    
    console.log(`✅ ${lineItemsToUpsert.length} line items actualizados correctamente`);
  }

  // Sincronizar picking_packing_order_items
  console.log('🔄 Sincronizando picking items...');

  // Obtener el picking_packing_order_id
  const { data: pickingOrder, error: pickingOrderError } = await supabase
    .from('picking_packing_orders')
    .select('id')
    .eq('shopify_order_id', order.id)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (pickingOrderError) {
    console.error('⚠️ Error obteniendo picking order para items:', pickingOrderError);
  } else if (!pickingOrder) {
    console.log('ℹ️ No existe picking order, se creará en el próximo fetch del frontend');
  } else {
    // Eliminar items antiguos
    const { error: deletePickingItemsError } = await supabase
      .from('picking_packing_order_items')
      .delete()
      .eq('picking_packing_order_id', pickingOrder.id);

    if (deletePickingItemsError) {
      console.error('⚠️ Error eliminando picking items antiguos:', deletePickingItemsError);
    } else {
      console.log('✅ Picking items antiguos eliminados');
    }

    // Insertar items actualizados
    const pickingItemsToInsert = order.line_items.map((item: any) => {
      // Usar la misma lógica de imagen que para shopify_order_line_items
      const imageUrl = item.image?.src || 
                       item.featured_image || 
                       (item.sku ? skuToImageMap.get(item.sku) : null) || 
                       null;
      
      return {
        picking_packing_order_id: pickingOrder.id,
        shopify_line_item_id: item.id,
        sku: item.sku || null,
        product_name: item.title,
        variant_name: item.variant_title || null,
        image_url: imageUrl,
        quantity_ordered: item.quantity,
        quantity_picked: 0, // Reset al actualizar
        quantity_packed: 0, // Reset al actualizar
        location: null,
        organization_id: organizationId
      };
    });

    if (pickingItemsToInsert.length > 0) {
      const { error: pickingItemsError } = await supabase
        .from('picking_packing_order_items')
        .insert(pickingItemsToInsert);

      if (pickingItemsError) {
        console.error('⚠️ Error insertando picking items actualizados:', pickingItemsError);
      } else {
        console.log(`✅ ${pickingItemsToInsert.length} picking items sincronizados correctamente`);
      }
    }
  }

  // Auto-apply tags based on payment gateway and line items (also on updates)
  console.log('🤖 Analizando pedido actualizado para auto-aplicación de tags...');
  const autoTags = determineAutoTags(order);
  
  if (autoTags.length > 0) {
    console.log('🏷️ Tags automáticos detectados en update:', autoTags);
    await applyAutoTagsToShopify(order.id, autoTags, order.tags, shopDomain, supabase);
  } else {
    console.log('ℹ️ No se detectaron tags automáticos para este pedido actualizado');
  }

  // AUTO-INVOICING: Check if order now qualifies (e.g., payment confirmed)
  if (await checkAutoInvoiceEligibility(order, supabase, organizationId)) {
    console.log('🧾 Pedido actualizado elegible para facturación automática');
    triggerAutoInvoice(order.id, organizationId);
  }

  return { success: true, order_number: order.order_number, action: 'UPDATE' };
}

// Function to process sales metrics for real-time order
async function processSalesMetrics(order: any, supabase: any) {
  console.log(`📊 Procesando métricas de ventas para orden: ${order.order_number}`);

  // Get mapping from Shopify SKUs to local variants
  const { data: localVariants, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, sku_variant')
    .not('sku_variant', 'is', null);

  if (variantsError) {
    console.error('⚠️ Error obteniendo variantes locales:', variantsError);
    return;
  }

  // Create SKU -> variant_id local map
  const skuToVariantMap = new Map();
  localVariants.forEach(variant => {
    skuToVariantMap.set(variant.sku_variant, variant.id);
  });

  const orderDate = new Date(order.created_at).toISOString().split('T')[0];
  const salesMetricsToUpdate = new Map();

  // Process each line item
  for (const item of order.line_items) {
    if (!item.sku) continue;
    
    const localVariantId = skuToVariantMap.get(item.sku);
    if (!localVariantId) continue;
    
    const quantity = parseInt(item.quantity.toString(), 10);
    if (isNaN(quantity) || quantity <= 0) continue;

    const key = `${localVariantId}_${orderDate}`;
    
    if (!salesMetricsToUpdate.has(key)) {
      salesMetricsToUpdate.set(key, {
        product_variant_id: localVariantId,
        metric_date: orderDate,
        sales_quantity: 0,
        orders_count: 0,
        avg_order_size: 0
      });
    }
    
    const salesData = salesMetricsToUpdate.get(key);
    salesData.sales_quantity += quantity;
    salesData.orders_count = 1; // Esta orden específica
    salesData.avg_order_size = parseFloat(item.price) * quantity;
  }

  // Update or insert sales metrics
  for (const [key, salesData] of salesMetricsToUpdate) {
    // Check if metric already exists for this variant and date
    const { data: existingMetric } = await supabase
      .from('sales_metrics')
      .select('*')
      .eq('product_variant_id', salesData.product_variant_id)
      .eq('metric_date', salesData.metric_date)
      .single();

    if (existingMetric) {
      // Update existing metric
      const { error: updateError } = await supabase
        .from('sales_metrics')
        .update({
          sales_quantity: existingMetric.sales_quantity + salesData.sales_quantity,
          orders_count: existingMetric.orders_count + 1,
          avg_order_size: ((existingMetric.avg_order_size * existingMetric.orders_count) + salesData.avg_order_size) / (existingMetric.orders_count + 1)
        })
        .eq('product_variant_id', salesData.product_variant_id)
        .eq('metric_date', salesData.metric_date);

      if (updateError) {
        console.error('⚠️ Error actualizando métrica:', updateError);
      } else {
        console.log(`✅ Métrica actualizada para variante ${salesData.product_variant_id}`);
      }
    } else {
      // Insert new metric
      const { error: insertError } = await supabase
        .from('sales_metrics')
        .insert(salesData);

      if (insertError) {
        console.error('⚠️ Error insertando métrica:', insertError);
      } else {
        console.log(`✅ Nueva métrica creada para variante ${salesData.product_variant_id}`);
      }
    }
  }
}

// ============= AUTO-INVOICE ELIGIBILITY & TRIGGER =============

// Check if order qualifies for automatic Alegra invoice
async function checkAutoInvoiceEligibility(order: any, supabase: any, organizationId: string): Promise<boolean> {
  // 1. Only PAID orders
  if (order.financial_status !== 'paid') {
    console.log('🧾 Elegibilidad: NO - no está pagado');
    return false;
  }
  
  // 2. Only web orders (not draft orders, POS, etc.)
  if (order.source_name !== 'web') {
    console.log(`🧾 Elegibilidad: NO - origen no es web (${order.source_name})`);
    return false;
  }
  
  // 3. No contraentrega orders
  const tags = (order.tags || '').toLowerCase();
  if (tags.includes('contraentrega')) {
    console.log('🧾 Elegibilidad: NO - es contraentrega');
    return false;
  }
  
  // 4. Not already invoiced (by tag)
  if (tags.includes('facturado')) {
    console.log('🧾 Elegibilidad: NO - ya tiene tag FACTURADO');
    return false;
  }
  
  // 5. Not already invoiced (by DB)
  const { data } = await supabase
    .from('shopify_orders')
    .select('alegra_stamped, alegra_invoice_id')
    .eq('shopify_order_id', order.id)
    .eq('organization_id', organizationId)
    .single();
  
  if (data?.alegra_stamped || data?.alegra_invoice_id) {
    console.log('🧾 Elegibilidad: NO - ya tiene factura en DB');
    return false;
  }
  
  console.log('🧾 Elegibilidad: SÍ - cumple todos los criterios');
  return true;
}

// DEPRECATED: triggerAutoInvoice removed - now using cron batch processing
// El cron cada 2 minutos busca pedidos pendientes y los procesa secuencialmente

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Webhook de Shopify recibido');

    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const shopifyWebhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');

    if (!supabaseUrl || !supabaseServiceKey || !shopifyWebhookSecret) {
      throw new Error('Variables de entorno faltantes');
    }

    // Get request body and signature
    const body = await req.text();
    const signature = req.headers.get('X-Shopify-Hmac-Sha256') || '';
    const topic = req.headers.get('X-Shopify-Topic') || '';
    const shopDomain = req.headers.get('X-Shopify-Shop-Domain') || '';

    console.log(`📋 Webhook topic: ${topic}`);
    console.log(`🏪 Shop domain from header: ${shopDomain}`);

    // Debug logging for signature verification
    console.log('🔍 Signature verification details:');
    console.log('- Received signature header:', signature);
    console.log('- Secret configured:', shopifyWebhookSecret ? 'YES' : 'NO');
    console.log('- Secret length:', shopifyWebhookSecret?.length || 0);
    console.log('- Body length:', body.length);
    
    // Verify webhook signature
    const isValid = await verifyShopifyWebhook(body, signature, shopifyWebhookSecret);
    if (!isValid) {
      console.log('❌ Firma de webhook inválida');
      console.log('- This could mean:');
      console.log('  1. Wrong secret configured');
      console.log('  2. Shopify sending different signature format');
      console.log('  3. Body modification during transit');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Webhook verificado correctamente');

    // Parse order data
    const order = JSON.parse(body);
    
    // Process both order creation and update webhooks
    if (topic !== 'orders/create' && topic !== 'orders/update' && topic !== 'orders/updated') {
      console.log(`ℹ️ Webhook ignorado - topic: ${topic}`);
      return new Response(
        JSON.stringify({ message: 'Webhook received but not processed', topic }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log webhook event with action type
    const action = topic === 'orders/create' ? 'CREATE' : 'UPDATE';
    await supabase
      .from('sync_control_logs')
      .insert({
        sync_type: `webhook_${topic.replace('/', '_')}`,
        sync_mode: 'real_time',
        status: 'running',
        execution_details: {
          webhook_topic: topic,
          action: action,
          order_id: order.id,
          order_number: order.order_number,
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          total_price: order.total_price,
          timestamp: new Date().toISOString()
        }
      });

    // Process the order based on webhook type
    let result;
    if (topic === 'orders/create') {
      result = await processSingleOrder(order, supabase, shopDomain);
    } else if (topic === 'orders/update' || topic === 'orders/updated') {
      result = await updateExistingOrder(order, supabase, shopDomain);
    }

    // Update log with success
    await supabase
      .from('sync_control_logs')
      .update({
        status: 'completed',
        end_time: new Date().toISOString(),
        metrics_created: order.line_items.length,
        execution_details: {
          webhook_topic: topic,
          action: result?.action || action,
          order_id: order.id,
          order_number: order.order_number,
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          total_price: order.total_price,
          processed_at: new Date().toISOString(),
          result
        }
      })
      .eq('sync_type', `webhook_${topic.replace('/', '_')}`)
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1);

    const actionText = action === 'CREATE' ? 'creada' : 'actualizada';
    console.log(`🎉 Orden ${order.order_number} ${actionText} exitosamente en tiempo real`);

    return new Response(
      JSON.stringify({
        success: true,
        action: action,
        message: `Orden ${order.order_number} ${actionText} exitosamente`,
        order_id: order.id,
        order_number: order.order_number,
        processed_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});