import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplate } from "../_shared/whatsapp-template.ts";
import { normalizeColombianPhone } from "../_shared/phone-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ConfirmationRequest {
  action: 'send_single' | 'send_bulk';
  organizationId: string;
  shopifyOrderId?: number; // required for send_single
}

interface OrderData {
  shopify_order_id: number;
  order_number: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_phone: string | null;
  shipping_address: any;
  total_price: number;
  tags: string | null;
  line_items: Array<{ title: string; variant_title: string | null; quantity: number }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const META_WHATSAPP_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');

    if (!META_WHATSAPP_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: 'META_WHATSAPP_TOKEN no configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: ConfirmationRequest = await req.json();

    console.log('📋 Order confirmation request:', body.action, body.organizationId);

    if (!body.organizationId) {
      return new Response(
        JSON.stringify({ success: false, error: 'organizationId requerido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get WhatsApp channel for this organization
    const { data: channel, error: channelError } = await supabase
      .from('messaging_channels')
      .select('id, meta_phone_number_id')
      .eq('organization_id', body.organizationId)
      .eq('channel_type', 'whatsapp')
      .eq('is_active', true)
      .single();

    if (channelError || !channel?.meta_phone_number_id) {
      console.error('No WhatsApp channel found:', channelError);
      // Fallback to env
      const fallbackPhoneId = Deno.env.get('META_PHONE_NUMBER_ID');
      if (!fallbackPhoneId) {
        return new Response(
          JSON.stringify({ success: false, error: 'No se encontro canal de WhatsApp configurado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      // Use fallback below
    }

    const phoneNumberId = channel?.meta_phone_number_id || Deno.env.get('META_PHONE_NUMBER_ID')!;
    const channelId = channel?.id;

    if (body.action === 'send_single') {
      if (!body.shopifyOrderId) {
        return new Response(
          JSON.stringify({ success: false, error: 'shopifyOrderId requerido para send_single' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const result = await sendConfirmation(
        supabase, body.organizationId, body.shopifyOrderId,
        phoneNumberId, META_WHATSAPP_TOKEN, channelId
      );

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: result.success ? 200 : 400 }
      );

    } else if (body.action === 'send_bulk') {
      // Find all COD orders without confirmation
      const { data: codOrders, error: ordersError } = await supabase
        .from('shopify_orders')
        .select('shopify_order_id, order_number, customer_first_name, customer_last_name, customer_phone, shipping_address, total_price, tags')
        .eq('organization_id', body.organizationId)
        .ilike('tags', '%Contraentrega%')
        .not('tags', 'ilike', '%Confirmado%')
        .is('cancelled_at', null)
        .order('created_at_shopify', { ascending: false });

      if (ordersError) {
        console.error('Error fetching COD orders:', ordersError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al buscar pedidos COD' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      if (!codOrders || codOrders.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No hay pedidos COD pendientes', sent: 0, failed: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Filter out orders that already have a confirmation record (not expired)
      const orderIds = codOrders.map(o => o.shopify_order_id);
      const { data: existingConfirmations } = await supabase
        .from('order_confirmations')
        .select('shopify_order_id')
        .in('shopify_order_id', orderIds)
        .neq('status', 'expired');

      const alreadySent = new Set((existingConfirmations || []).map(c => c.shopify_order_id));
      const ordersToSend = codOrders.filter(o => !alreadySent.has(o.shopify_order_id));

      console.log(`📦 Bulk send: ${codOrders.length} COD orders, ${ordersToSend.length} need confirmation`);

      let sent = 0;
      let failed = 0;
      const errors: Array<{ order: string; error: string }> = [];

      for (const order of ordersToSend) {
        try {
          const result = await sendConfirmation(
            supabase, body.organizationId, order.shopify_order_id,
            phoneNumberId, META_WHATSAPP_TOKEN, channelId
          );
          if (result.success) {
            sent++;
          } else {
            failed++;
            errors.push({ order: order.order_number, error: result.error || 'Unknown error' });
          }
          // Small delay between sends to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err: any) {
          failed++;
          errors.push({ order: order.order_number, error: err.message });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Enviadas ${sent} confirmaciones, ${failed} fallidas`,
          total: ordersToSend.length,
          sent,
          failed,
          skipped: alreadySent.size,
          errors: errors.length > 0 ? errors : undefined
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'action debe ser send_single o send_bulk' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

  } catch (error: any) {
    console.error('Error in send-order-confirmation:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});


async function sendConfirmation(
  supabase: any,
  organizationId: string,
  shopifyOrderId: number,
  phoneNumberId: string,
  whatsappToken: string,
  channelId?: string
): Promise<{ success: boolean; error?: string }> {

  console.log(`📱 Sending confirmation for order ${shopifyOrderId}...`);

  // 1. Get order data
  const { data: order, error: orderError } = await supabase
    .from('shopify_orders')
    .select('shopify_order_id, order_number, customer_first_name, customer_last_name, customer_phone, shipping_address, total_price, tags')
    .eq('shopify_order_id', shopifyOrderId)
    .eq('organization_id', organizationId)
    .single();

  if (orderError || !order) {
    console.error('Order not found:', orderError);
    return { success: false, error: 'Pedido no encontrado' };
  }

  // 2. Get line items
  const { data: lineItems } = await supabase
    .from('shopify_order_line_items')
    .select('title, variant_title, quantity')
    .eq('shopify_order_id', shopifyOrderId);

  // 3. Extract phone number
  const rawPhone = order.shipping_address?.phone || order.customer_phone;
  if (!rawPhone) {
    console.error('No phone number for order:', order.order_number);
    return { success: false, error: `Sin telefono para pedido ${order.order_number}` };
  }

  const phone = normalizeColombianPhone(rawPhone);
  if (!phone) {
    return { success: false, error: `Telefono invalido: ${rawPhone}` };
  }

  // 4. Build customer name
  const customerName = [order.customer_first_name, order.customer_last_name]
    .filter(Boolean)
    .join(' ') || 'Cliente';

  // 5. Build product list
  const products = (lineItems || [])
    .map((item: any) => {
      const variant = item.variant_title ? ` (${item.variant_title})` : '';
      return `- ${item.title}${variant} x${item.quantity}`;
    })
    .join('\n');

  // 6. Build address
  const addr = order.shipping_address || {};
  const address = [addr.address1, addr.address2, addr.city, addr.province]
    .filter(Boolean)
    .join(', ');

  // 7. Format total
  const total = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
    .format(order.total_price);

  // 8. Build confirmation message
  const orderNum = String(order.order_number).replace('#', '');
  const message = `Hola ${customerName}! Te escribimos de *Dosmicos.co* para confirmar tu pedido contra entrega.

*Pedido #${orderNum}*
${products}

*Total:* ${total}
*Direccion de envio:* ${address}

Por favor confirma respondiendo *SI* para procesar tu pedido, o escribenos si necesitas hacer algun cambio.

Gracias por tu compra!`;

  // 9. Find or create conversation
  let conversationId: string | null = null;

  // Look for existing conversation with this phone
  const { data: existingConv } = await supabase
    .from('messaging_conversations')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('external_user_id', phone)
    .eq('channel_type', 'whatsapp')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
    // Update conversation: disable AI, set metadata
    await supabase
      .from('messaging_conversations')
      .update({
        ai_managed: false,
        metadata: {
          pending_order_confirmation: {
            shopify_order_id: shopifyOrderId,
            order_number: order.order_number,
            status: 'pending'
          }
        }
      })
      .eq('id', conversationId);
    console.log(`📝 Updated existing conversation ${conversationId}`);
  } else {
    // Create new conversation
    const insertData: any = {
      organization_id: organizationId,
      external_user_id: phone,
      channel_type: 'whatsapp',
      user_name: customerName,
      ai_managed: false,
      status: 'active',
      metadata: {
        pending_order_confirmation: {
          shopify_order_id: shopifyOrderId,
          order_number: order.order_number,
          status: 'pending'
        }
      }
    };
    if (channelId) insertData.channel_id = channelId;

    const { data: newConv, error: convError } = await supabase
      .from('messaging_conversations')
      .insert(insertData)
      .select('id')
      .single();

    if (convError) {
      console.error('Error creating conversation:', convError);
      // Try to find it again (race condition)
      const { data: retryConv } = await supabase
        .from('messaging_conversations')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('external_user_id', phone)
        .eq('channel_type', 'whatsapp')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (retryConv) {
        conversationId = retryConv.id;
      }
    } else {
      conversationId = newConv.id;
      console.log(`📝 Created new conversation ${conversationId}`);
    }
  }

  // 10. Send WhatsApp message (template or fallback to text)
  const templateName = Deno.env.get('WHATSAPP_COD_TEMPLATE_NAME') || '';
  let sendResult: { ok: boolean; messageId?: string; error?: any };

  if (templateName) {
    // Send as WhatsApp Template Message (works outside 24h window)
    sendResult = await sendWhatsAppTemplate(
      phoneNumberId, whatsappToken, phone,
      templateName, 'es_MX',
      [
        { type: 'text', text: customerName },
        { type: 'text', text: orderNum },
        { type: 'text', text: products },
        { type: 'text', text: total },
        { type: 'text', text: address },
        { type: 'text', text: addr.city || 'N/A' },
      ]
    );
  } else {
    // Fallback to text (only works within 24h window)
    console.log('⚠️ No WHATSAPP_COD_TEMPLATE_NAME set, using text fallback');
    sendResult = await sendWhatsAppText(phoneNumberId, whatsappToken, phone, message);
  }

  if (!sendResult.ok) {
    console.error('WhatsApp send failed:', sendResult.error);
    return { success: false, error: `Error al enviar WhatsApp: ${JSON.stringify(sendResult.error)}` };
  }

  console.log(`WhatsApp message sent, ID: ${sendResult.messageId}`);

  // 11. Save message to messaging_messages
  let messageId: string | null = null;
  if (conversationId) {
    const { data: msgData } = await supabase
      .from('messaging_messages')
      .insert({
        conversation_id: conversationId,
        external_message_id: sendResult.messageId,
        channel_type: 'whatsapp',
        direction: 'outbound',
        sender_type: 'agent',
        content: message,
        message_type: 'text',
        sent_at: new Date().toISOString()
      })
      .select('id')
      .single();

    messageId = msgData?.id || null;

    // Update conversation preview
    await supabase
      .from('messaging_conversations')
      .update({
        last_message_preview: message.substring(0, 100),
        last_message_at: new Date().toISOString()
      })
      .eq('id', conversationId);
  }

  // 12. Create order_confirmations record (idempotent)
  const { error: confirmError } = await supabase
    .from('order_confirmations')
    .upsert({
      organization_id: organizationId,
      shopify_order_id: shopifyOrderId,
      order_number: order.order_number,
      conversation_id: conversationId,
      customer_phone: phone,
      customer_name: customerName,
      status: 'pending',
      confirmation_message_id: messageId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'shopify_order_id' });

  if (confirmError) {
    console.error('Error saving order confirmation:', confirmError);
    // Not fatal — the message was already sent
  }

  // 13. Assign "Confirmacion pendiente" tag to conversation
  if (conversationId) {
    const { data: tag } = await supabase
      .from('messaging_conversation_tags')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', 'Confirmacion pendiente')
      .maybeSingle();

    if (tag) {
      await supabase
        .from('messaging_conversation_tag_assignments')
        .upsert({
          conversation_id: conversationId,
          tag_id: tag.id
        }, { onConflict: 'conversation_id,tag_id' })
        .then(() => console.log(`🏷️ Tag "Confirmacion pendiente" assigned`));
    }
  }

  console.log(`Confirmation sent for order ${order.order_number} to ${phone}`);
  return { success: true };
}


// Fallback text sender (used when no template name is configured)
async function sendWhatsAppText(
  phoneNumberId: string,
  token: string,
  to: string,
  message: string
): Promise<{ ok: boolean; messageId?: string; error?: any }> {
  try {
    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: data };
    }
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
