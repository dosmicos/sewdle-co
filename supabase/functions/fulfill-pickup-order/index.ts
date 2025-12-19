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

    console.log(`🏪 Marcando pedido como listo para retiro - Orden Shopify: ${shopify_order_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Shopify credentials
    const rawShopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!rawShopifyDomain || !shopifyToken) {
      throw new Error('Credenciales de Shopify no configuradas');
    }

    const shopifyDomain = rawShopifyDomain.includes('.myshopify.com')
      ? rawShopifyDomain
      : `${rawShopifyDomain}.myshopify.com`;

    // Step 1: Get fulfillment orders for this order
    console.log(`📦 Obteniendo fulfillment orders...`);
    const fulfillmentOrdersRes = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/orders/${shopify_order_id}/fulfillment_orders.json`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
        }
      }
    );

    if (!fulfillmentOrdersRes.ok) {
      const errorText = await fulfillmentOrdersRes.text();
      console.error(`❌ Error obteniendo fulfillment orders:`, errorText);
      throw new Error(`Error obteniendo fulfillment orders: ${fulfillmentOrdersRes.status}`);
    }

    const fulfillmentOrdersData = await fulfillmentOrdersRes.json();
    const fulfillmentOrders = fulfillmentOrdersData.fulfillment_orders || [];
    
    console.log(`📋 Fulfillment orders encontradas: ${fulfillmentOrders.length}`);

    // Find the open fulfillment order
    const openFulfillmentOrder = fulfillmentOrders.find(
      (fo: { status: string }) => fo.status === 'open' || fo.status === 'in_progress'
    );

    if (!openFulfillmentOrder) {
      // Check if already prepared for pickup or fulfilled
      const preparedOrder = fulfillmentOrders.find(
        (fo: { status: string }) => fo.status === 'scheduled' || fo.status === 'ready_for_pickup'
      );
      
      if (preparedOrder) {
        console.log(`ℹ️ El pedido ya está listo para retiro en Shopify`);
        // Update local status anyway
        await supabase
          .from('picking_packing_orders')
          .update({
            operational_status: 'awaiting_pickup',
            updated_at: new Date().toISOString()
          })
          .eq('shopify_order_id', shopify_order_id)
          .eq('organization_id', organization_id);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'El pedido ya estaba listo para retiro',
            already_prepared: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.error(`❌ No se encontró fulfillment order abierta. Estados:`, 
        fulfillmentOrders.map((fo: { id: number; status: string }) => ({ id: fo.id, status: fo.status }))
      );
      throw new Error('No se encontró una fulfillment order abierta para este pedido');
    }

    const fulfillmentOrderId = openFulfillmentOrder.id;
    console.log(`✅ Fulfillment order encontrada: ${fulfillmentOrderId}`);

    // Step 2: Use GraphQL to mark as prepared for pickup
    console.log(`🏪 Marcando como listo para retiro via GraphQL...`);
    
    const graphqlQuery = `
      mutation fulfillmentOrderLineItemsPreparedForPickup($input: FulfillmentOrderLineItemsPreparedForPickupInput!) {
        fulfillmentOrderLineItemsPreparedForPickup(input: $input) {
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        lineItemsByFulfillmentOrder: [
          {
            fulfillmentOrderId: `gid://shopify/FulfillmentOrder/${fulfillmentOrderId}`
          }
        ]
      }
    };

    const graphqlRes = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: graphqlQuery, variables })
      }
    );

    if (!graphqlRes.ok) {
      const errorText = await graphqlRes.text();
      console.error(`❌ Error en GraphQL:`, errorText);
      throw new Error(`Error en GraphQL: ${graphqlRes.status}`);
    }

    const graphqlData = await graphqlRes.json();
    console.log(`📊 Respuesta GraphQL:`, JSON.stringify(graphqlData));

    if (graphqlData.errors) {
      console.error(`❌ Errores GraphQL:`, graphqlData.errors);
      throw new Error(`Errores GraphQL: ${JSON.stringify(graphqlData.errors)}`);
    }

    const userErrors = graphqlData.data?.fulfillmentOrderLineItemsPreparedForPickup?.userErrors || [];
    if (userErrors.length > 0) {
      console.error(`❌ User errors:`, userErrors);
      throw new Error(`Errores de Shopify: ${JSON.stringify(userErrors)}`);
    }

    console.log(`✅ Pedido marcado como listo para retiro en Shopify`);

    // Step 3: Add LISTO_PARA_RETIRO tag to Shopify order
    console.log(`🏷️ Agregando tag LISTO_PARA_RETIRO...`);
    try {
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

      const tagsArray = currentTags.split(',').map((t: string) => t.trim()).filter(Boolean);
      if (!tagsArray.includes('LISTO_PARA_RETIRO')) {
        tagsArray.push('LISTO_PARA_RETIRO');
      }

      await fetch(
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
      
      console.log(`✅ Tag LISTO_PARA_RETIRO agregado`);

      // Update local shopify_orders table with new tags
      await supabase
        .from('shopify_orders')
        .update({ tags: tagsArray.join(', ') })
        .eq('shopify_order_id', shopify_order_id)
        .eq('organization_id', organization_id);

    } catch (tagError) {
      console.warn(`⚠️ Error agregando tag:`, tagError);
      // Continue - tag is not critical
    }

    // Step 4: Update local database status
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

    console.log(`✅ Proceso completado exitosamente`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pedido marcado como listo para retiro',
        fulfillment_order_id: fulfillmentOrderId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error en fulfill-pickup-order:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error procesando pedido de retiro'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
