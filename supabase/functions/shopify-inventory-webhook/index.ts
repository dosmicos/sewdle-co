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
  
  console.log('🔍 Inventory webhook signature comparison:');
  console.log('- Expected (Base64):', expectedSignature);
  console.log('- Received (Base64):', receivedSignature);
  console.log('- Match:', expectedSignature === receivedSignature);
  
  return expectedSignature === receivedSignature;
}

// Function to process inventory level updates
async function processInventoryUpdate(inventoryLevel: any, supabase: any) {
  console.log(`📦 Procesando actualización de inventario: ${inventoryLevel.inventory_item_id}`);

  try {
    const newStockQuantity = inventoryLevel.available || 0;
    const inventoryItemId = inventoryLevel.inventory_item_id;

    // Get Shopify credentials
    const shopifyApiKey = Deno.env.get('SHOPIFY_API_KEY');
    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    const shopifyShop = Deno.env.get('SHOPIFY_SHOP_DOMAIN');

    if (!shopifyApiKey || !shopifyAccessToken || !shopifyShop) {
      console.error('⚠️ Missing Shopify API credentials');
      return { success: false, error: 'Missing Shopify API credentials' };
    }

    // Call Shopify API to get the variant details using inventory_item_id
    console.log(`🔍 Consultando API de Shopify para inventory_item_id: ${inventoryItemId}`);
    
    const shopifyUrl = `https://${shopifyShop}/admin/api/2024-07/graphql.json`;
    const query = `
      query getInventoryItem($inventoryItemId: ID!) {
        inventoryItem(id: $inventoryItemId) {
          id
          sku
          variant {
            id
            sku
            product {
              id
              handle
            }
          }
        }
      }
    `;

    const shopifyResponse = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyAccessToken,
      },
      body: JSON.stringify({
        query,
        variables: {
          inventoryItemId: `gid://shopify/InventoryItem/${inventoryItemId}`
        }
      })
    });

    if (!shopifyResponse.ok) {
      console.error(`⚠️ Error en API de Shopify: ${shopifyResponse.status}`);
      return { success: false, error: 'Shopify API error' };
    }

    const shopifyData = await shopifyResponse.json();
    
    if (shopifyData.errors) {
      console.error('⚠️ Errores en GraphQL:', shopifyData.errors);
      return { success: false, error: 'GraphQL errors' };
    }

    const inventoryItem = shopifyData.data?.inventoryItem;
    if (!inventoryItem || !inventoryItem.variant) {
      console.log(`ℹ️ No se encontró variante para inventory_item_id: ${inventoryItemId}`);
      return { success: false, error: 'Variant not found in Shopify' };
    }

    const shopifySku = inventoryItem.variant.sku;
    console.log(`📋 SKU encontrado en Shopify: ${shopifySku}`);

    // Find the matching variant in our database by SKU
    const { data: localVariant, error: variantError } = await supabase
      .from('product_variants')
      .select('id, sku_variant, stock_quantity, product_id')
      .eq('sku_variant', shopifySku)
      .single();

    if (variantError || !localVariant) {
      console.log(`ℹ️ SKU ${shopifySku} no encontrado en base de datos local`);
      
      // Log for debugging - store unknown SKU for future mapping
      const { error: logError } = await supabase
        .from('inventory_sync_logs')
        .insert({
          delivery_id: null,
          sync_results: {
            type: 'webhook_inventory_update_unmapped',
            inventory_item_id: inventoryItemId,
            sku: shopifySku,
            available_quantity: newStockQuantity,
            error: 'SKU not found in local database',
            updated_at: inventoryLevel.updated_at,
            processed_at: new Date().toISOString()
          },
          success_count: 0,
          error_count: 1
        });

      return { success: false, error: `SKU ${shopifySku} not found in local database` };
    }

    const previousStock = localVariant.stock_quantity;
    
    // Get organization_id for the variant
    const { data: productData } = await supabase
      .from('product_variants')
      .select('product_id, products!inner(organization_id)')
      .eq('id', localVariant.id)
      .single();

    const organizationId = productData?.products?.organization_id;
    
    // Update the stock quantity in our database
    const { error: updateError } = await supabase
      .from('product_variants')
      .update({ 
        stock_quantity: newStockQuantity
      })
      .eq('id', localVariant.id);

    if (updateError) {
      console.error('⚠️ Error actualizando stock en base de datos:', updateError);
      return { success: false, error: 'Database update failed' };
    }

    console.log(`✅ Stock actualizado exitosamente en product_variants`);

    // Record stock change in history table
    if (organizationId) {
      const { error: historyError } = await supabase
        .from('product_stock_history')
        .insert({
          product_variant_id: localVariant.id,
          organization_id: organizationId,
          stock_quantity: newStockQuantity,
          source: 'shopify_webhook',
          recorded_at: new Date().toISOString()
        });

      if (historyError) {
        console.error('⚠️ Error registrando historial de stock:', historyError);
        // Don't fail the sync if history recording fails
      } else {
        console.log(`📊 Historial de stock registrado para variant ${localVariant.id}`);
      }
    }

    // Log successful update
    const { error: logError } = await supabase
      .from('inventory_sync_logs')
      .insert({
        delivery_id: null,
        sync_results: {
          type: 'webhook_inventory_update_success',
          inventory_item_id: inventoryItemId,
          sku: shopifySku,
          variant_id: localVariant.id,
          previous_stock: previousStock,
          new_stock: newStockQuantity,
          stock_change: newStockQuantity - previousStock,
          updated_at: inventoryLevel.updated_at,
          processed_at: new Date().toISOString(),
          history_recorded: !!organizationId
        },
        success_count: 1,
        error_count: 0
      });

    if (logError) {
      console.error('⚠️ Error registrando log de inventario:', logError);
    }

    console.log(`✅ Stock actualizado exitosamente:`);
    console.log(`   - SKU: ${shopifySku}`);
    console.log(`   - Stock anterior: ${previousStock}`);
    console.log(`   - Stock nuevo: ${newStockQuantity}`);
    console.log(`   - Cambio: ${newStockQuantity - previousStock}`);
    
    return { 
      success: true, 
      inventory_item_id: inventoryItemId,
      sku: shopifySku,
      variant_id: localVariant.id,
      previous_quantity: previousStock,
      new_quantity: newStockQuantity,
      stock_change: newStockQuantity - previousStock
    };

  } catch (error) {
    console.error('❌ Error procesando actualización de inventario:', error);
    
    // Log error
    const { error: logError } = await supabase
      .from('inventory_sync_logs')
      .insert({
        delivery_id: null,
        sync_results: {
          type: 'webhook_inventory_update_error',
          inventory_item_id: inventoryLevel.inventory_item_id,
          error: error.message,
          updated_at: inventoryLevel.updated_at,
          processed_at: new Date().toISOString()
        },
        success_count: 0,
        error_count: 1
      });
    
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Webhook de inventario de Shopify recibido');

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

    console.log(`📋 Inventory webhook topic: ${topic}`);

    // Debug logging for signature verification
    console.log('🔍 Inventory signature verification details:');
    console.log('- Received signature header:', signature);
    console.log('- Secret configured:', shopifyWebhookSecret ? 'YES' : 'NO');
    console.log('- Body length:', body.length);
    
    // Verify webhook signature
    const isValid = await verifyShopifyWebhook(body, signature, shopifyWebhookSecret);
    if (!isValid) {
      console.log('❌ Firma de webhook de inventario inválida');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Webhook de inventario verificado correctamente');

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if body is empty or minimal (test webhook)
    if (!body || body.length <= 10) {
      console.log('ℹ️ Webhook de inventario vacío o de test - ignorando');
      return new Response(
        JSON.stringify({ message: 'Test webhook received - ignoring empty payload' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse inventory data safely
    let inventoryLevel;
    try {
      inventoryLevel = JSON.parse(body);
    } catch (parseError) {
      console.error('❌ Error parseando JSON del webhook:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate payload has required data
    if (!inventoryLevel || typeof inventoryLevel !== 'object') {
      console.log('ℹ️ Webhook recibido sin datos de inventario válidos - ignorando');
      return new Response(
        JSON.stringify({ message: 'Webhook received without valid inventory data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📊 Payload del webhook:', JSON.stringify(inventoryLevel, null, 2));
    
    // Only process inventory level update webhooks
    if (!['inventory_levels/update', 'inventory_levels/connect'].includes(topic)) {
      console.log(`ℹ️ Webhook de inventario ignorado - topic: ${topic}`);
      return new Response(
        JSON.stringify({ message: 'Inventory webhook received but not processed', topic }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate inventory level has required fields
    if (!inventoryLevel.inventory_item_id && !inventoryLevel.variant_id) {
      console.log('ℹ️ Webhook sin inventory_item_id o variant_id - probablemente test');
      return new Response(
        JSON.stringify({ message: 'Webhook without inventory identifiers - likely test webhook' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log webhook event
    const logEntry = await supabase
      .from('sync_control_logs')
      .insert({
        sync_type: 'webhook_inventory',
        sync_mode: 'real_time',
        status: 'running',
        execution_details: {
          webhook_topic: topic,
          inventory_item_id: inventoryLevel.inventory_item_id || null,
          location_id: inventoryLevel.location_id || null,
          available_quantity: inventoryLevel.available || null,
          timestamp: new Date().toISOString(),
          raw_payload: inventoryLevel
        }
      })
      .select('id')
      .single();

    // Process the inventory update
    const result = await processInventoryUpdate(inventoryLevel, supabase);

    // Update log with success
    if (logEntry.data) {
      await supabase
        .from('sync_control_logs')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          variants_updated: result.success ? 1 : 0,
          execution_details: {
            webhook_topic: topic,
            inventory_item_id: inventoryLevel.inventory_item_id,
            location_id: inventoryLevel.location_id,
            available_quantity: inventoryLevel.available,
            processed_at: new Date().toISOString(),
            result
          }
        })
        .eq('id', logEntry.data.id);
    }

    console.log(`🎉 Inventario actualizado exitosamente para item ${inventoryLevel.inventory_item_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Inventario actualizado para item ${inventoryLevel.inventory_item_id}`,
        inventory_item_id: inventoryLevel.inventory_item_id,
        new_quantity: inventoryLevel.available,
        processed_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error procesando webhook de inventario:', error);
    
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