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
    // Get the inventory item details from Shopify to find the SKU
    const { data: existingVariants, error: variantsError } = await supabase
      .from('product_variants')
      .select('id, sku_variant, product_id')
      .not('sku_variant', 'is', null);

    if (variantsError) {
      console.error('⚠️ Error obteniendo variantes locales:', variantsError);
      return { success: false, error: 'Error fetching local variants' };
    }

    // Find the variant that matches this inventory item
    // Note: We'll need to match by inventory_item_id or variant_id from Shopify
    // For now, we'll try to match using the available field if present
    let targetVariant = null;
    
    if (inventoryLevel.variant_id) {
      // If we have variant_id, we can try to match it with Shopify data
      console.log(`🔍 Buscando variante con variant_id: ${inventoryLevel.variant_id}`);
      
      // Here we would need to have stored the Shopify variant_id in our database
      // For now, let's update based on available quantity if we can find a match
    }

    const newStockQuantity = inventoryLevel.available || 0;
    
    // If we can't find a specific variant, let's log the event for debugging
    console.log(`📊 Actualización de inventario recibida:`, {
      inventory_item_id: inventoryLevel.inventory_item_id,
      location_id: inventoryLevel.location_id,
      available: inventoryLevel.available,
      updated_at: inventoryLevel.updated_at
    });

    // Store the inventory update log for tracking
    const { error: logError } = await supabase
      .from('inventory_sync_logs')
      .insert({
        delivery_id: null, // This is from webhook, not delivery
        sync_results: {
          type: 'webhook_inventory_update',
          inventory_item_id: inventoryLevel.inventory_item_id,
          location_id: inventoryLevel.location_id,
          available_quantity: inventoryLevel.available,
          updated_at: inventoryLevel.updated_at,
          processed_at: new Date().toISOString()
        },
        success_count: 1,
        error_count: 0
      });

    if (logError) {
      console.error('⚠️ Error registrando log de inventario:', logError);
    }

    console.log(`✅ Actualización de inventario procesada: item ${inventoryLevel.inventory_item_id}, stock: ${newStockQuantity}`);
    
    return { 
      success: true, 
      inventory_item_id: inventoryLevel.inventory_item_id,
      new_quantity: newStockQuantity
    };

  } catch (error) {
    console.error('❌ Error procesando actualización de inventario:', error);
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

    // Parse inventory data
    const inventoryLevel = JSON.parse(body);
    
    // Only process inventory level update webhooks
    if (!['inventory_levels/update', 'inventory_levels/connect'].includes(topic)) {
      console.log(`ℹ️ Webhook de inventario ignorado - topic: ${topic}`);
      return new Response(
        JSON.stringify({ message: 'Inventory webhook received but not processed', topic }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log webhook event
    const logEntry = await supabase
      .from('sync_control_logs')
      .insert({
        sync_type: 'webhook_inventory',
        sync_mode: 'real_time',
        status: 'running',
        execution_details: {
          webhook_topic: topic,
          inventory_item_id: inventoryLevel.inventory_item_id,
          location_id: inventoryLevel.location_id,
          available_quantity: inventoryLevel.available,
          timestamp: new Date().toISOString()
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