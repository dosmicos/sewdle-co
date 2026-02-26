import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

interface FulfillExpressRequest {
  shopify_order_id: number;
  organization_id: string;
  user_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shopify_order_id, organization_id, user_id } = await req.json() as FulfillExpressRequest;
    
    console.log(`🚀 fulfill-express-order: Procesando orden Express ${shopify_order_id}`);

    if (!shopify_order_id || !organization_id) {
      throw new Error('shopify_order_id y organization_id son requeridos');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!shopifyDomain || !shopifyToken) {
      throw new Error('Credenciales de Shopify no configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const normalizedDomain = shopifyDomain.includes('.myshopify.com') 
      ? shopifyDomain 
      : `${shopifyDomain}.myshopify.com`;

    // Step 1: Get fulfillment orders from Shopify
    console.log('📋 Obteniendo fulfillment orders de Shopify...');
    const fulfillmentOrdersUrl = `https://${normalizedDomain}/admin/api/2024-01/orders/${shopify_order_id}/fulfillment_orders.json`;
    
    const fulfillmentOrdersResponse = await fetch(fulfillmentOrdersUrl, {
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      },
    });

    if (!fulfillmentOrdersResponse.ok) {
      const errorText = await fulfillmentOrdersResponse.text();
      console.error('❌ Error obteniendo fulfillment orders:', errorText);
      throw new Error(`Error de Shopify: ${errorText}`);
    }

    const fulfillmentOrdersData = await fulfillmentOrdersResponse.json();
    const fulfillmentOrders = fulfillmentOrdersData.fulfillment_orders || [];
    
    // Find open fulfillment order
    const openFulfillmentOrder = fulfillmentOrders.find((fo: any) => 
      fo.status === 'open' || fo.status === 'in_progress'
    );

    if (!openFulfillmentOrder) {
      console.log('⚠️ No hay fulfillment orders abiertos - puede que ya esté fulfilled');
      // Continue anyway to update local status
    }

    // Step 2: Create fulfillment in Shopify (if there's an open order)
    let fulfillmentCreated = false;
    if (openFulfillmentOrder) {
      console.log(`📦 Creando fulfillment para fulfillment_order ${openFulfillmentOrder.id}...`);
      
      const fulfillmentPayload = {
        fulfillment: {
          line_items_by_fulfillment_order: [
            {
              fulfillment_order_id: openFulfillmentOrder.id
            }
          ],
          notify_customer: true,
          // No tracking info for Express orders (pickup/immediate delivery)
        }
      };

      const createFulfillmentUrl = `https://${normalizedDomain}/admin/api/2024-01/fulfillments.json`;
      const createFulfillmentResponse = await fetch(createFulfillmentUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fulfillmentPayload),
      });

      if (!createFulfillmentResponse.ok) {
        const errorText = await createFulfillmentResponse.text();
        console.error('❌ Error creando fulfillment:', errorText);
        // Don't throw - continue to update local status
      } else {
        fulfillmentCreated = true;
        console.log('✅ Fulfillment creado exitosamente');
      }
    }

    // Step 3: Add EMPACADO and ENVIADO tags using merge logic
    console.log('🏷️ Agregando etiquetas EMPACADO y ENVIADO...');
    
    // Get current tags from Shopify
    const orderUrl = `https://${normalizedDomain}/admin/api/2024-01/orders/${shopify_order_id}.json`;
    const orderResponse = await fetch(orderUrl, {
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      },
    });

    if (!orderResponse.ok) {
      console.error('❌ Error obteniendo orden para tags');
    } else {
      const orderData = await orderResponse.json();
      const currentTags = orderData.order?.tags || '';
      const currentTagsArray = currentTags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
      
      // Merge EMPACADO and ENVIADO tags
      const tagsToAdd = ['EMPACADO', 'ENVIADO'];
      const existingLower = currentTagsArray.map((t: string) => t.toLowerCase());
      const mergedTags = [...currentTagsArray];
      
      for (const tag of tagsToAdd) {
        if (!existingLower.includes(tag.toLowerCase())) {
          mergedTags.push(tag);
        }
      }

      // Update tags in Shopify
      const updateTagsResponse = await fetch(orderUrl, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: {
            tags: mergedTags.join(', ')
          }
        }),
      });

      if (updateTagsResponse.ok) {
        console.log('✅ Etiquetas actualizadas:', mergedTags.join(', '));
        
        // Update local shopify_orders table with new tags
        await supabase
          .from('shopify_orders')
          .update({
            tags: mergedTags.join(', '),
            fulfillment_status: 'fulfilled'
          })
          .eq('shopify_order_id', shopify_order_id)
          .eq('organization_id', organization_id);
      } else {
        console.error('❌ Error actualizando etiquetas en Shopify');
      }
    }

    // Step 4: Update local database - picking_packing_orders
    console.log('💾 Actualizando estado local...');
    const now = new Date().toISOString();
    
    const { error: updateError } = await supabase
      .from('picking_packing_orders')
      .update({
        operational_status: 'shipped',
        shipped_at: now,
        shipped_by: user_id || null,
        // Also set packed_at/packed_by if not already set
        packed_at: now,
        packed_by: user_id || null,
      })
      .eq('shopify_order_id', shopify_order_id)
      .eq('organization_id', organization_id);

    if (updateError) {
      console.error('❌ Error actualizando picking_packing_orders:', updateError);
    } else {
      console.log('✅ Estado local actualizado a shipped');
    }

    // Step 5: Auto-send express delivery notification via WhatsApp
    // The delivery code is extracted from order notes (empacador writes it there)
    let notificationSent = false;
    try {
      const { data: orderNoteData } = await supabase
        .from('shopify_orders')
        .select('note')
        .eq('shopify_order_id', shopify_order_id)
        .single();

      const note = orderNoteData?.note || '';
      const codeMatch = note.match(/c[oó]digo[:\s]*\s*([a-zA-Z0-9]+)/i);
      const deliveryCode = codeMatch?.[1];

      if (deliveryCode) {
        console.log(`📱 Codigo de entrega encontrado: ${deliveryCode}, enviando notificacion...`);
        fetch(`${supabaseUrl}/functions/v1/send-express-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'send_single',
            organizationId: organization_id,
            shopifyOrderId: shopify_order_id,
            deliveryCode
          })
        }).then(r => r.json()).then(res => {
          console.log('📱 Express notification result:', res);
        }).catch(err => {
          console.error('⚠️ Express notification error:', err);
        });
        notificationSent = true;
      } else {
        console.log('⚠️ No se encontro codigo de entrega en las notas del pedido');
      }
    } catch (notifErr) {
      console.error('⚠️ Error checking for delivery code:', notifErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pedido Express procesado exitosamente',
        fulfillment_created: fulfillmentCreated,
        notification_triggered: notificationSent,
        status: 'shipped'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error en fulfill-express-order:', error);
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
