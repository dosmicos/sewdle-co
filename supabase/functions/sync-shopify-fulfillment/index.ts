import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

interface ShopifyOrder {
  id: number;
  order_number: string;
  fulfillment_status: string | null;
  tags: string;
  cancelled_at: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando sincronización de fulfillment status desde Shopify...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use environment variables for Shopify credentials (same as other working functions)
    const rawShopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    
    if (!rawShopifyDomain || !shopifyToken) {
      throw new Error('SHOPIFY_STORE_DOMAIN y SHOPIFY_ACCESS_TOKEN son requeridos en las variables de entorno');
    }
    
    // Normalize domain
    const shopifyDomain = rawShopifyDomain.includes('.myshopify.com') 
      ? rawShopifyDomain 
      : `${rawShopifyDomain}.myshopify.com`;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const organizationId = body.organization_id;
    const daysBack = body.days_back || 365;

    if (!organizationId) {
      throw new Error('organization_id es requerido');
    }

    console.log(`📋 Organización: ${organizationId}, Días atrás: ${daysBack}`);

    console.log(`🏪 Tienda Shopify: ${shopifyDomain}`);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch orders from Shopify with pagination
    const allOrders: ShopifyOrder[] = [];
    let hasNextPage = true;
    let pageInfo = '';
    let pageCount = 0;
    const maxPages = 50;

    while (hasNextPage && pageCount < maxPages) {
      pageCount++;
      
      let ordersUrl = `https://${shopifyDomain}/admin/api/2024-01/orders.json?status=any&created_at_min=${startDate.toISOString()}&created_at_max=${endDate.toISOString()}&limit=250&fields=id,order_number,fulfillment_status,tags,cancelled_at`;
      
      if (pageInfo) {
        ordersUrl += `&since_id=${pageInfo}`;
      }

      console.log(`📄 Página ${pageCount}: Fetching orders...`);

      const response = await fetch(ordersUrl, {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Error en página ${pageCount}: ${response.status} - ${errorText}`);
        
        if (response.status === 429) {
          console.log('⏳ Rate limit, esperando 5s...');
          await new Promise(r => setTimeout(r, 5000));
          pageCount--;
          continue;
        }
        
        throw new Error(`Shopify API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const orders = data.orders || [];
      
      console.log(`📦 Página ${pageCount}: ${orders.length} órdenes obtenidas`);
      
      if (orders.length === 0) {
        hasNextPage = false;
        break;
      }
      
      allOrders.push(...orders);
      
      if (orders.length < 250) {
        hasNextPage = false;
      } else {
        pageInfo = orders[orders.length - 1].id.toString();
      }
      
      // Rate limiting delay
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`✅ Total órdenes obtenidas de Shopify: ${allOrders.length}`);

    // Update fulfillment_status in database
    let updatedCount = 0;
    let errorCount = 0;
    const updates: { shopify_order_id: number; fulfillment_status: string | null; tags: string | null; cancelled_at: string | null }[] = [];

    for (const order of allOrders) {
      updates.push({
        shopify_order_id: order.id,
        fulfillment_status: order.fulfillment_status,
        tags: order.tags || null,
        cancelled_at: order.cancelled_at || null
      });
    }

    // Get orders that are currently packed/shipped in picking_packing_orders
    // to protect their tags from being overwritten by stale Shopify data
    const { data: packedOrders } = await supabase
      .from('picking_packing_orders')
      .select('shopify_order_id')
      .eq('organization_id', organizationId)
      .in('operational_status', ['ready_to_ship', 'awaiting_pickup']);

    const packedOrderIds = new Set(packedOrders?.map(o => o.shopify_order_id) || []);
    let skippedTagsCount = 0;

    // Batch update in chunks of 100
    const batchSize = 100;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      for (const update of batch) {
        // For packed/awaiting orders: only update fulfillment_status and cancelled_at
        // Do NOT overwrite tags — they may contain EMPACADO that Shopify doesn't have yet
        const isProtected = packedOrderIds.has(update.shopify_order_id);
        const updateData: any = {
          fulfillment_status: update.fulfillment_status,
          cancelled_at: update.cancelled_at
        };

        if (!isProtected) {
          updateData.tags = update.tags;
        } else {
          skippedTagsCount++;
        }

        const { error: updateError } = await supabase
          .from('shopify_orders')
          .update(updateData)
          .eq('shopify_order_id', update.shopify_order_id)
          .eq('organization_id', organizationId);

        if (updateError) {
          console.error(`❌ Error actualizando orden ${update.shopify_order_id}:`, updateError);
          errorCount++;
        } else {
          updatedCount++;
        }
      }

      console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(updates.length/batchSize)} procesado`);
    }

    if (skippedTagsCount > 0) {
      console.log(`🛡️ Tags protegidos en ${skippedTagsCount} órdenes empacadas/en espera (no se sobrescribieron)`);
    }

    // Log summary statistics
    const fulfilledCount = allOrders.filter(o => o.fulfillment_status === 'fulfilled').length;
    const unfulfilledCount = allOrders.filter(o => !o.fulfillment_status || o.fulfillment_status === 'unfulfilled').length;
    const cancelledCount = allOrders.filter(o => o.cancelled_at).length;

    console.log(`📊 Resumen de Shopify:`);
    console.log(`  - Total órdenes: ${allOrders.length}`);
    console.log(`  - Fulfilled: ${fulfilledCount}`);
    console.log(`  - Unfulfilled/null: ${unfulfilledCount}`);
    console.log(`  - Canceladas: ${cancelledCount}`);
    console.log(`  - Actualizadas en DB: ${updatedCount}`);
    console.log(`  - Errores: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronización de fulfillment completada',
        stats: {
          totalFromShopify: allOrders.length,
          fulfilled: fulfilledCount,
          unfulfilled: unfulfilledCount,
          cancelled: cancelledCount,
          updatedInDb: updatedCount,
          errors: errorCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error en sincronización:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
