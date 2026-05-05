import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shopify_order_id, organization_id, user_id } = await req.json();

    if (!shopify_order_id || !organization_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'shopify_order_id y organization_id son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Confirmando retiro de pedido - Orden Shopify: ${shopify_order_id}`);

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
    
    console.log(`📋 Fulfillment orders encontradas: ${fulfillmentOrders.length}`, 
      fulfillmentOrders.map((fo: { id: number; status: string }) => ({ id: fo.id, status: fo.status }))
    );

    // Find the fulfillment order that's ready for pickup (scheduled status in Shopify)
    const readyForPickupOrder = fulfillmentOrders.find(
      (fo: { status: string }) => 
        fo.status === 'scheduled' || 
        fo.status === 'ready_for_pickup' || 
        fo.status === 'in_progress' ||
        fo.status === 'open'
    );

    if (!readyForPickupOrder) {
      // Check if already fulfilled
      const fulfilledOrder = fulfillmentOrders.find(
        (fo: { status: string }) => fo.status === 'closed'
      );
      
      if (fulfilledOrder) {
        console.log(`ℹ️ El pedido ya fue retirado/completado en Shopify`);
        // Update local status anyway
        const updateData: Record<string, unknown> = {
          operational_status: 'shipped',
          shipped_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        if (user_id) {
          updateData.shipped_by = user_id;
        }

        await supabase
          .from('picking_packing_orders')
          .update(updateData)
          .eq('shopify_order_id', shopify_order_id)
          .eq('organization_id', organization_id);

        await supabase
          .from('shopify_orders')
          .update({ fulfillment_status: 'fulfilled' })
          .eq('shopify_order_id', shopify_order_id)
          .eq('organization_id', organization_id);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'El pedido ya estaba completado',
            already_fulfilled: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.error(`❌ No se encontró fulfillment order lista para retiro`);
      throw new Error('No se encontró una fulfillment order lista para completar');
    }

    const fulfillmentOrderId = readyForPickupOrder.id;
    console.log(`✅ Fulfillment order encontrada: ${fulfillmentOrderId} (status: ${readyForPickupOrder.status})`);

    // Step 2: Use GraphQL to create fulfillment (mark as picked up)
    console.log(`📦 Creando fulfillment via GraphQL (marcar como retirado)...`);
    
    const graphqlQuery = `
      mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
        fulfillmentCreateV2(fulfillment: $fulfillment) {
          fulfillment {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      fulfillment: {
        lineItemsByFulfillmentOrder: [
          {
            fulfillmentOrderId: `gid://shopify/FulfillmentOrder/${fulfillmentOrderId}`
          }
        ],
        notifyCustomer: false // Don't notify again, they already know it's ready
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

    const userErrors = graphqlData.data?.fulfillmentCreateV2?.userErrors || [];
    if (userErrors.length > 0) {
      console.error(`❌ User errors:`, userErrors);
      throw new Error(`Errores de Shopify: ${JSON.stringify(userErrors)}`);
    }

    const createdFulfillment = graphqlData.data?.fulfillmentCreateV2?.fulfillment;
    console.log(`✅ Fulfillment creado:`, createdFulfillment);

    // Step 3: Update local database status to 'shipped'
    console.log(`💾 Actualizando estado local a 'shipped'...`);
    
    const updateData: Record<string, unknown> = {
      operational_status: 'shipped',
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (user_id) {
      updateData.shipped_by = user_id;
    }

    const { error: updateError } = await supabase
      .from('picking_packing_orders')
      .update(updateData)
      .eq('shopify_order_id', shopify_order_id)
      .eq('organization_id', organization_id);

    if (updateError) {
      console.error(`❌ Error actualizando picking_packing_orders:`, updateError);
      throw updateError;
    }

    // Step 4: Update shopify_orders fulfillment status
    await supabase
      .from('shopify_orders')
      .update({ fulfillment_status: 'fulfilled' })
      .eq('shopify_order_id', shopify_order_id)
      .eq('organization_id', organization_id);

    // Step 5: Add ENTREGADO tag to Shopify order
    console.log(`🏷️ Agregando tag ENTREGADO...`);
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
      if (!tagsArray.includes('ENTREGADO')) {
        tagsArray.push('ENTREGADO');
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
      
      console.log(`✅ Tag ENTREGADO agregado`);

      // Update local shopify_orders table with new tags
      await supabase
        .from('shopify_orders')
        .update({ tags: tagsArray.join(', ') })
        .eq('shopify_order_id', shopify_order_id)
        .eq('organization_id', organization_id);

    } catch (tagError) {
      console.warn(`⚠️ Error agregando tag ENTREGADO:`, tagError);
      // Continue - tag is not critical
    }

    console.log(`✅ Retiro confirmado exitosamente`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Retiro confirmado exitosamente',
        fulfillment_id: createdFulfillment?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error en confirm-pickup-delivery:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error confirmando retiro'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
