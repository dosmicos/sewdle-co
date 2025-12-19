import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shopify_order_id, organization_id } = await req.json();

    if (!shopify_order_id || !organization_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'shopify_order_id y organization_id son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🏪 Procesando Listo para Retiro - Orden Shopify: ${shopify_order_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Shopify credentials
    const rawShopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!rawShopifyDomain || !shopifyToken) {
      throw new Error('SHOPIFY_STORE_DOMAIN y SHOPIFY_ACCESS_TOKEN son requeridos');
    }

    const shopifyDomain = rawShopifyDomain.includes('.myshopify.com')
      ? rawShopifyDomain
      : `${rawShopifyDomain}.myshopify.com`;

    // Step 1: Get fulfillment orders from Shopify
    console.log(`📦 Obteniendo fulfillment_orders de Shopify...`);
    
    const fulfillmentOrdersRes = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/orders/${shopify_order_id}/fulfillment_orders.json`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!fulfillmentOrdersRes.ok) {
      const errorText = await fulfillmentOrdersRes.text();
      console.error(`❌ Error obteniendo fulfillment_orders: ${fulfillmentOrdersRes.status}`, errorText);
      throw new Error(`Error obteniendo fulfillment_orders: ${fulfillmentOrdersRes.status}`);
    }

    const fulfillmentOrdersData = await fulfillmentOrdersRes.json();
    const fulfillmentOrders = fulfillmentOrdersData.fulfillment_orders || [];
    
    console.log(`📋 Fulfillment orders encontrados: ${fulfillmentOrders.length}`);

    if (fulfillmentOrders.length === 0) {
      throw new Error('No se encontraron fulfillment_orders para esta orden');
    }

    // Find open fulfillment order
    const openFulfillmentOrder = fulfillmentOrders.find(
      (fo: any) => fo.status === 'open' || fo.status === 'in_progress'
    );

    if (!openFulfillmentOrder) {
      console.log(`⚠️ No hay fulfillment_orders abiertos. Estados: ${fulfillmentOrders.map((fo: any) => fo.status).join(', ')}`);
      
      // Check if already fulfilled
      const alreadyFulfilled = fulfillmentOrders.some((fo: any) => fo.status === 'closed');
      if (alreadyFulfilled) {
        console.log(`✅ La orden ya está fulfilled en Shopify`);
        // Still update local status
        const { error: updateError } = await supabase
          .from('picking_packing_orders')
          .update({
            operational_status: 'awaiting_pickup',
            updated_at: new Date().toISOString()
          })
          .eq('shopify_order_id', shopify_order_id)
          .eq('organization_id', organization_id);

        if (updateError) {
          console.error(`❌ Error actualizando estado local:`, updateError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Orden ya estaba fulfilled en Shopify. Estado local actualizado.',
            alreadyFulfilled: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('No hay fulfillment_orders abiertos para procesar');
    }

    // Step 2: Create fulfillment WITHOUT tracking info (for pickup)
    console.log(`📬 Creando fulfillment para retiro (sin guía)...`);
    
    const fulfillmentPayload = {
      fulfillment: {
        line_items_by_fulfillment_order: [
          {
            fulfillment_order_id: openFulfillmentOrder.id
          }
        ],
        notify_customer: true, // Notify customer that order is ready for pickup
        message: "Tu pedido está listo para recoger. ¡Te esperamos!"
      }
    };

    const fulfillmentRes = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/fulfillments.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fulfillmentPayload)
      }
    );

    if (!fulfillmentRes.ok) {
      const errorText = await fulfillmentRes.text();
      console.error(`❌ Error creando fulfillment: ${fulfillmentRes.status}`, errorText);
      throw new Error(`Error creando fulfillment: ${fulfillmentRes.status} - ${errorText}`);
    }

    const fulfillmentData = await fulfillmentRes.json();
    console.log(`✅ Fulfillment creado exitosamente:`, fulfillmentData.fulfillment?.id);

    // Step 3: Add LISTO_PARA_RETIRO tag to Shopify order
    console.log(`🏷️ Agregando tag LISTO_PARA_RETIRO...`);
    
    // First get current tags
    const orderRes = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/orders/${shopify_order_id}.json?fields=tags`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
        }
      }
    );

    let currentTags = '';
    if (orderRes.ok) {
      const orderData = await orderRes.json();
      currentTags = orderData.order?.tags || '';
    }

    // Add new tag
    const tagsArray = currentTags.split(',').map((t: string) => t.trim()).filter(Boolean);
    if (!tagsArray.includes('LISTO_PARA_RETIRO')) {
      tagsArray.push('LISTO_PARA_RETIRO');
    }

    const updateTagsRes = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/orders/${shopify_order_id}.json`,
      {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: {
            id: shopify_order_id,
            tags: tagsArray.join(', ')
          }
        })
      }
    );

    if (!updateTagsRes.ok) {
      console.warn(`⚠️ Error actualizando tags: ${updateTagsRes.status}`);
    } else {
      console.log(`✅ Tag LISTO_PARA_RETIRO agregado`);
    }

    // Step 4: Update local database
    console.log(`💾 Actualizando estado local a 'awaiting_pickup'...`);
    
    const { error: updateError } = await supabase
      .from('picking_packing_orders')
      .update({
        operational_status: 'awaiting_pickup',
        updated_at: new Date().toISOString()
      })
      .eq('shopify_order_id', shopify_order_id)
      .eq('organization_id', organization_id);

    if (updateError) {
      console.error(`❌ Error actualizando picking_packing_orders:`, updateError);
      throw updateError;
    }

    // Update shopify_orders table
    const { error: shopifyUpdateError } = await supabase
      .from('shopify_orders')
      .update({
        fulfillment_status: 'fulfilled',
        tags: tagsArray.join(', ')
      })
      .eq('shopify_order_id', shopify_order_id)
      .eq('organization_id', organization_id);

    if (shopifyUpdateError) {
      console.warn(`⚠️ Error actualizando shopify_orders:`, shopifyUpdateError);
    }

    console.log(`✅ Listo para Retiro completado exitosamente`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pedido marcado como Listo para Retiro. El cliente fue notificado.',
        fulfillment_id: fulfillmentData.fulfillment?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error en fulfill-pickup-order:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error procesando la orden'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
