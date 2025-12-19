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
    fulfillmentOrders.forEach((fo: any, index: number) => {
      console.log(`📋 FO[${index}]:`, { 
        id: fo.id, 
        status: fo.status,
        delivery_method_type: typeof fo.delivery_method,
        delivery_method_value: JSON.stringify(fo.delivery_method)
      });
    });

    // Helper to detect if it's a pickup order - handles both string and object formats
    const isPickupDelivery = (deliveryMethod: any): boolean => {
      if (!deliveryMethod) return false;
      
      // String format: "pick-up", "PICK_UP", "local", etc.
      if (typeof deliveryMethod === 'string') {
        const methodLower = deliveryMethod.toLowerCase();
        return methodLower === 'pick-up' || methodLower === 'pick_up' || 
               methodLower === 'pickup' || methodLower === 'local';
      }
      
      // Object format: { method_type: 'PICK_UP' }
      if (typeof deliveryMethod === 'object' && deliveryMethod.method_type) {
        const methodType = deliveryMethod.method_type.toUpperCase();
        return methodType === 'PICK_UP' || methodType === 'LOCAL';
      }
      
      return false;
    };

    // Find the pickup fulfillment order
    const pickupFulfillmentOrder = fulfillmentOrders.find(
      (fo: any) => isPickupDelivery(fo.delivery_method) && 
                   (fo.status === 'open' || fo.status === 'in_progress')
    );

    // If no pickup order found, look for any open order
    const openFulfillmentOrder = pickupFulfillmentOrder || fulfillmentOrders.find(
      (fo: any) => fo.status === 'open' || fo.status === 'in_progress'
    );

    if (!openFulfillmentOrder) {
      // Check if already prepared for pickup
      const preparedOrder = fulfillmentOrders.find(
        (fo: any) => fo.status === 'scheduled' || fo.status === 'ready_for_pickup'
      );
      
      if (preparedOrder) {
        console.log(`ℹ️ El pedido ya está listo para retiro en Shopify (status: ${preparedOrder.status})`);
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

      // Check if already fulfilled
      const fulfilledOrder = fulfillmentOrders.find(
        (fo: any) => fo.status === 'closed'
      );
      
      if (fulfilledOrder) {
        console.log(`ℹ️ El pedido ya fue completado en Shopify`);
        await supabase
          .from('picking_packing_orders')
          .update({
            operational_status: 'shipped',
            updated_at: new Date().toISOString()
          })
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

      console.error(`❌ No se encontró fulfillment order válida`);
      throw new Error('No se encontró una fulfillment order válida para este pedido');
    }

    const fulfillmentOrderId = openFulfillmentOrder.id;
    const isPickupOrder = isPickupDelivery(openFulfillmentOrder.delivery_method);
    console.log(`✅ Fulfillment order: ${fulfillmentOrderId}`);
    console.log(`🏪 Es pickup order: ${isPickupOrder}`);
    console.log(`📦 delivery_method: ${JSON.stringify(openFulfillmentOrder.delivery_method)}`);

    // IMPORTANT: Only proceed if this is a pickup order
    if (!isPickupOrder) {
      console.error(`❌ Este pedido no es de retiro en tienda`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Este pedido no es de retiro en tienda. Use la opción de envío regular.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Use GraphQL mutation for pickup orders
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

    const userErrors = graphqlData.data?.fulfillmentOrderLineItemsPreparedForPickup?.userErrors || [];
    
    if (userErrors.length > 0 || graphqlData.errors) {
      const errorMessages = userErrors.map((e: any) => e.message).join(', ') || 
                           graphqlData.errors?.map((e: any) => e.message).join(', ');
      console.error(`❌ Errores de Shopify:`, JSON.stringify(userErrors.length > 0 ? userErrors : graphqlData.errors));
      throw new Error(`Errores de Shopify: ${errorMessages}`);
    }

    console.log(`✅ Pedido marcado como listo para retiro via GraphQL`);

    // Step 4: Add LISTO_PARA_RETIRO tag
    console.log(`🏷️ Agregando tag LISTO_PARA_RETIRO...`);
    try {
      const orderRes = await fetch(
        `https://${shopifyDomain}/admin/api/2024-01/orders/${shopify_order_id}.json?fields=tags`,
        {
          headers: { 'X-Shopify-Access-Token': shopifyToken }
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
            order: { id: shopify_order_id, tags: tagsArray.join(', ') }
          })
        }
      );
      
      console.log(`✅ Tag agregado`);

      await supabase
        .from('shopify_orders')
        .update({ tags: tagsArray.join(', ') })
        .eq('shopify_order_id', shopify_order_id)
        .eq('organization_id', organization_id);

    } catch (tagError) {
      console.warn(`⚠️ Error agregando tag:`, tagError);
    }

    // Step 4: Update local database to awaiting_pickup
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
      console.error(`❌ Error actualizando estado:`, updateError);
      throw updateError;
    }

    console.log(`✅ Proceso completado`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pedido marcado como listo para retiro',
        fulfillment_order_id: fulfillmentOrderId,
        new_status: 'awaiting_pickup'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error en fulfill-pickup-order:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error procesando pedido'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
