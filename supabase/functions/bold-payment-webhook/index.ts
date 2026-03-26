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
        text: {
          preview_url: false,
          body: message
        }
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("WhatsApp send error:", data);
      return false;
    }
    console.log("WhatsApp message sent:", data?.messages?.[0]?.id);
    return true;
  } catch (err) {
    console.error("Error sending WhatsApp message:", err);
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

    const body = await req.json();
    console.log("Bold webhook received:", JSON.stringify(body));

    // Bold webhook follows CloudEvents spec
    // type: event type (e.g. "SALE_APPROVED", "SALE_REJECTED")
    // subject: transaction ID
    // data: transaction details including reference, amount, etc.
    const eventType = body.type;
    const transactionId = body.subject;
    const paymentData = body.data;

    if (!eventType || !paymentData) {
      console.log("Invalid webhook payload, ignoring");
      return new Response("OK", { status: 200 });
    }

    console.log(`Bold event: ${eventType}, transaction: ${transactionId}`);

    // Only process approved sales
    if (eventType !== 'SALE_APPROVED') {
      console.log(`Ignoring event type: ${eventType}`);

      // For rejected sales, update pending order status
      if (eventType === 'SALE_REJECTED') {
        const reference = paymentData.reference;
        if (reference) {
          await supabase
            .from('pending_orders')
            .update({ status: 'payment_rejected', updated_at: new Date().toISOString() })
            .eq('bold_reference', reference)
            .eq('status', 'pending_payment');
          console.log(`Marked pending order ${reference} as payment_rejected`);
        }
      }

      return new Response("OK", { status: 200 });
    }

    // Extract reference from payment data
    const reference = paymentData.reference;
    if (!reference) {
      console.error("No reference in Bold webhook data");
      return new Response("OK", { status: 200 });
    }

    console.log(`Processing approved payment for reference: ${reference}`);

    // Look up pending order by Bold reference
    const { data: pendingOrder, error: lookupError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('bold_reference', reference)
      .eq('status', 'pending_payment')
      .single();

    if (lookupError || !pendingOrder) {
      console.error("Pending order not found for reference:", reference, lookupError);
      // Return 404 so Bold retries the webhook (instead of silent 200 OK)
      return new Response(
        JSON.stringify({ error: "Pending order not found", reference }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found pending order: ${pendingOrder.id} for ${pendingOrder.customer_name}`);

    // Update pending order status to "paid"
    await supabase
      .from('pending_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', pendingOrder.id);

    // Create the Shopify order now that payment is confirmed
    const lineItems = pendingOrder.line_items as any[];

    const { data: orderResult, error: orderError } = await supabase.functions.invoke('create-shopify-order', {
      body: {
        orderData: {
          customerName: pendingOrder.customer_name,
          cedula: pendingOrder.cedula || '',
          email: pendingOrder.customer_email,
          phone: pendingOrder.customer_phone,
          address: pendingOrder.address,
          city: pendingOrder.city,
          department: pendingOrder.department,
          neighborhood: pendingOrder.neighborhood || '',
          lineItems: lineItems,
          notes: (pendingOrder.notes || '') + ` | Pago confirmado via Bold (ref: ${reference})`,
          shippingCost: pendingOrder.shipping_cost || 0,
          paymentMethod: 'link_de_pago'
        },
        organizationId: pendingOrder.organization_id
      }
    });

    if (orderError) {
      console.error("Error creating Shopify order after payment:", orderError);
      // Mark as creation_failed so the recovery cron can retry
      await supabase
        .from('pending_orders')
        .update({
          status: 'creation_failed',
          notes: (pendingOrder.notes || '') + ` | Webhook order creation failed: ${orderError.message || 'unknown error'}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', pendingOrder.id);

      return new Response(
        JSON.stringify({ error: "Error creating Shopify order", details: orderError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Shopify order created after Bold payment:", orderResult);

    // Update pending order with Shopify order info
    await supabase
      .from('pending_orders')
      .update({
        status: 'order_created',
        shopify_order_id: String(orderResult.orderId),
        shopify_order_number: String(orderResult.orderNumber),
        updated_at: new Date().toISOString()
      })
      .eq('id', pendingOrder.id);

    // Send WhatsApp confirmation to the customer
    const whatsappToken = Deno.env.get('META_WHATSAPP_TOKEN');
    let phoneNumberId = Deno.env.get('META_PHONE_NUMBER_ID');

    // Try to get phone number ID from the organization's messaging channel
    if (pendingOrder.organization_id) {
      const { data: channels } = await supabase
        .from('messaging_channels')
        .select('meta_phone_number_id')
        .eq('organization_id', pendingOrder.organization_id)
        .eq('channel_type', 'whatsapp')
        .eq('is_active', true)
        .limit(1);

      if (channels?.[0]?.meta_phone_number_id) {
        phoneNumberId = channels[0].meta_phone_number_id;
      }
    }

    if (whatsappToken && phoneNumberId && pendingOrder.customer_phone) {
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

      const sent = await sendWhatsAppMessage(
        phoneNumberId,
        whatsappToken,
        pendingOrder.customer_phone,
        confirmationMessage
      );

      if (sent) {
        console.log("WhatsApp confirmation sent to:", pendingOrder.customer_phone);

        // Save the confirmation message to the conversation
        if (pendingOrder.conversation_id) {
          await supabase
            .from('messaging_messages')
            .insert({
              conversation_id: pendingOrder.conversation_id,
              content: confirmationMessage,
              direction: 'outbound',
              message_type: 'text',
              sent_at: new Date().toISOString(),
            });
        }
      }
    } else {
      console.warn("Missing WhatsApp credentials, could not send confirmation");
    }

    return new Response(
      JSON.stringify({ success: true, orderId: orderResult.orderId, orderNumber: orderResult.orderNumber }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Bold webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
