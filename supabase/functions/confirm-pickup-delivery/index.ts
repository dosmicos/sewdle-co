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

    console.log(`✅ Confirmando entrega de retiro - Orden Shopify: ${shopify_order_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Shopify credentials for tag update
    const rawShopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    // Step 1: Update local database status to 'shipped'
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

    // Step 2: Add ENTREGADO tag to Shopify order (optional - best effort)
    if (rawShopifyDomain && shopifyToken) {
      const shopifyDomain = rawShopifyDomain.includes('.myshopify.com')
        ? rawShopifyDomain
        : `${rawShopifyDomain}.myshopify.com`;

      console.log(`🏷️ Agregando tag ENTREGADO a Shopify...`);

      try {
        // Get current tags
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

        // Add ENTREGADO tag
        const tagsArray = currentTags.split(',').map((t: string) => t.trim()).filter(Boolean);
        if (!tagsArray.includes('ENTREGADO')) {
          tagsArray.push('ENTREGADO');
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
          console.log(`✅ Tag ENTREGADO agregado`);
          
          // Update local shopify_orders table
          await supabase
            .from('shopify_orders')
            .update({ tags: tagsArray.join(', ') })
            .eq('shopify_order_id', shopify_order_id)
            .eq('organization_id', organization_id);
        }
      } catch (tagError) {
        console.warn(`⚠️ Error agregando tag ENTREGADO:`, tagError);
        // Continue - tag update is best effort
      }
    }

    console.log(`✅ Entrega de retiro confirmada exitosamente`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Entrega confirmada exitosamente'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error en confirm-pickup-delivery:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error confirmando entrega'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
