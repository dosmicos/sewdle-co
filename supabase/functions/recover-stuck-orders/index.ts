import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Send a WhatsApp text message
async function sendWhatsAppMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  message: string
): Promise<boolean> {
  try {
    const cleanPhone = to.replace(/[\s+]/g, '');
    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { preview_url: false, body: message }
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("WhatsApp send error:", data);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error sending WhatsApp:", err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const whatsappToken = Deno.env.get('META_WHATSAPP_TOKEN');
    const results = { recovered: 0, expired: 0, errors: 0 };

    // ============= 1. Recover orders stuck in "paid" (webhook created paid but failed to create Shopify order) =============
    // These have been paid for 2+ minutes but no Shopify order was created
    const { data: paidOrders, error: paidErr } = await supabase
      .from('pending_orders')
      .select('*')
      .in('status', ['paid', 'creation_failed'])
      .lt('updated_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(10);

    if (paidErr) {
      console.error('Error fetching paid orders:', paidErr);
    }

    if (paidOrders && paidOrders.length > 0) {
      console.log(`🔄 Found ${paidOrders.length} paid orders to recover`);

      for (const order of paidOrders) {
        try {
          console.log(`🔄 Recovering order ${order.id} for ${order.customer_name} (ref: ${order.bold_reference})`);

          const lineItems = order.line_items as any[];

          const { data: orderResult, error: orderError } = await supabase.functions.invoke('create-shopify-order', {
            body: {
              orderData: {
                customerName: order.customer_name,
                cedula: order.cedula || '',
                email: order.customer_email,
                phone: order.customer_phone,
                address: order.address,
                city: order.city,
                department: order.department,
                neighborhood: order.neighborhood || '',
                lineItems: lineItems,
                notes: (order.notes || '') + ' | Recovered by cron (stuck in paid)',
                shippingCost: order.shipping_cost || 0,
                paymentMethod: 'link_de_pago'
              },
              organizationId: order.organization_id
            }
          });

          if (orderError) {
            console.error(`❌ Failed to create Shopify order for ${order.id}:`, orderError);
            await supabase
              .from('pending_orders')
              .update({
                status: 'creation_failed',
                updated_at: new Date().toISOString()
              })
              .eq('id', order.id);
            results.errors++;
            continue;
          }

          console.log(`✅ Recovered order ${order.id} → Shopify #${orderResult.orderNumber}`);

          // Update pending order
          await supabase
            .from('pending_orders')
            .update({
              status: 'order_created',
              shopify_order_id: String(orderResult.orderId),
              shopify_order_number: String(orderResult.orderNumber),
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);

          // Send WhatsApp confirmation
          if (whatsappToken && order.customer_phone) {
            let phoneNumberId = Deno.env.get('META_PHONE_NUMBER_ID');

            if (order.organization_id) {
              const { data: channels } = await supabase
                .from('messaging_channels')
                .select('meta_phone_number_id')
                .eq('organization_id', order.organization_id)
                .eq('channel_type', 'whatsapp')
                .eq('is_active', true)
                .limit(1);

              if (channels?.[0]?.meta_phone_number_id) {
                phoneNumberId = channels[0].meta_phone_number_id;
              }
            }

            if (phoneNumberId) {
              const productsList = lineItems
                .map((item: any) => `• ${item.productName} (${item.variantName}) x${item.quantity || 1}`)
                .join('\n');

              const confirmationMessage =
                `¡Tu pago ha sido confirmado! 🎉✅\n\n` +
                `📋 Número de pedido: #${orderResult.orderNumber}\n` +
                `💰 Total pagado: $${Number(orderResult.totalPrice).toLocaleString('es-CO')} COP\n\n` +
                `📦 Productos:\n${productsList}\n\n` +
                `Tu pedido ha sido creado exitosamente. Te enviaremos la información de seguimiento cuando sea despachado.\n\n` +
                `¡Gracias por tu compra! 😊`;

              await sendWhatsAppMessage(phoneNumberId, whatsappToken, order.customer_phone, confirmationMessage);

              // Save message to conversation
              if (order.conversation_id) {
                await supabase
                  .from('messaging_messages')
                  .insert({
                    conversation_id: order.conversation_id,
                    content: confirmationMessage,
                    direction: 'outbound',
                    message_type: 'text',
                    sent_at: new Date().toISOString(),
                  });
              }
            }
          }

          results.recovered++;
        } catch (err) {
          console.error(`❌ Exception recovering order ${order.id}:`, err);
          results.errors++;
        }
      }
    }

    // ============= 2. Expire old pending_payment orders (24+ hours old) =============
    const { data: expiredOrders, error: expireErr } = await supabase
      .from('pending_orders')
      .update({
        status: 'expired',
        expired_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('status', 'pending_payment')
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .select('id');

    if (expireErr) {
      console.error('Error expiring old orders:', expireErr);
    } else if (expiredOrders && expiredOrders.length > 0) {
      console.log(`🕐 Expired ${expiredOrders.length} old pending_payment orders`);
      results.expired = expiredOrders.length;
    }

    console.log(`📊 Recovery results: recovered=${results.recovered}, expired=${results.expired}, errors=${results.errors}`);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("recover-stuck-orders error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
