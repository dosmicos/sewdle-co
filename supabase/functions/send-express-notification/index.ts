import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplate } from "../_shared/whatsapp-template.ts";
import { normalizeColombianPhone, extractDeliveryCode } from "../_shared/phone-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ExpressNotificationRequest {
  action: 'send_single' | 'send_bulk';
  organizationId: string;
  shopifyOrderId?: number;
  deliveryCode?: string; // If not provided, extracted from order notes
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const META_WHATSAPP_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
    const TEMPLATE_NAME = Deno.env.get('WHATSAPP_EXPRESS_TEMPLATE_NAME') || '';

    if (!META_WHATSAPP_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: 'META_WHATSAPP_TOKEN no configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!TEMPLATE_NAME) {
      return new Response(
        JSON.stringify({ success: false, error: 'WHATSAPP_EXPRESS_TEMPLATE_NAME no configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: ExpressNotificationRequest = await req.json();

    console.log('📦 Express notification request:', body.action, body.organizationId);

    if (!body.organizationId) {
      return new Response(
        JSON.stringify({ success: false, error: 'organizationId requerido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get WhatsApp channel
    const { data: channel } = await supabase
      .from('messaging_channels')
      .select('id, meta_phone_number_id')
      .eq('organization_id', body.organizationId)
      .eq('channel_type', 'whatsapp')
      .eq('is_active', true)
      .single();

    const phoneNumberId = channel?.meta_phone_number_id || Deno.env.get('META_PHONE_NUMBER_ID');
    const channelId = channel?.id;

    if (!phoneNumberId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se encontro canal WhatsApp configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (body.action === 'send_single') {
      if (!body.shopifyOrderId) {
        return new Response(
          JSON.stringify({ success: false, error: 'shopifyOrderId requerido para send_single' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const result = await sendExpressNotification(
        supabase, body.organizationId, body.shopifyOrderId,
        phoneNumberId, META_WHATSAPP_TOKEN, TEMPLATE_NAME,
        channelId, body.deliveryCode
      );

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: result.success ? 200 : 400 }
      );

    } else if (body.action === 'send_bulk') {
      // Find express orders that have been shipped but not notified
      const { data: expressOrders, error: ordersError } = await supabase
        .from('shopify_orders')
        .select('shopify_order_id, order_number, customer_first_name, customer_last_name, customer_phone, shipping_address, note, raw_data')
        .eq('organization_id', body.organizationId)
        .ilike('tags', '%ENVIADO%')
        .is('cancelled_at', null)
        .order('created_at_shopify', { ascending: false })
        .limit(200);

      if (ordersError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Error al buscar pedidos express' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Filter: only express orders (by shipping_lines)
      const expressOnly = (expressOrders || []).filter(o => {
        const shippingTitle = o.raw_data?.shipping_lines?.[0]?.title || '';
        return shippingTitle.toLowerCase().includes('express');
      });

      if (expressOnly.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No hay pedidos express pendientes', sent: 0, failed: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Filter out already notified
      const orderIds = expressOnly.map(o => o.shopify_order_id);
      const { data: existingNotifications } = await supabase
        .from('express_notifications')
        .select('shopify_order_id')
        .in('shopify_order_id', orderIds)
        .eq('status', 'sent');

      const alreadySent = new Set((existingNotifications || []).map(n => n.shopify_order_id));
      const ordersToSend = expressOnly.filter(o => !alreadySent.has(o.shopify_order_id));

      console.log(`📦 Bulk: ${expressOnly.length} express orders, ${ordersToSend.length} need notification`);

      let sent = 0;
      let failed = 0;
      let noCode = 0;
      const errors: Array<{ order: string; error: string }> = [];

      for (const order of ordersToSend) {
        const code = extractDeliveryCode(order.note);
        if (!code) {
          noCode++;
          continue;
        }

        try {
          const result = await sendExpressNotification(
            supabase, body.organizationId, order.shopify_order_id,
            phoneNumberId, META_WHATSAPP_TOKEN, TEMPLATE_NAME,
            channelId, code
          );
          if (result.success) sent++;
          else {
            failed++;
            errors.push({ order: order.order_number, error: result.error || 'Unknown' });
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err: any) {
          failed++;
          errors.push({ order: order.order_number, error: err.message });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Enviadas ${sent}, fallidas ${failed}, sin codigo ${noCode}`,
          total: ordersToSend.length, sent, failed, noCode,
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
    console.error('Error in send-express-notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});


async function sendExpressNotification(
  supabase: any,
  organizationId: string,
  shopifyOrderId: number,
  phoneNumberId: string,
  whatsappToken: string,
  templateName: string,
  channelId?: string,
  providedDeliveryCode?: string
): Promise<{ success: boolean; error?: string }> {

  console.log(`📱 Sending express notification for order ${shopifyOrderId}...`);

  // 1. Get order data
  const { data: order, error: orderError } = await supabase
    .from('shopify_orders')
    .select('shopify_order_id, order_number, customer_first_name, customer_last_name, customer_phone, shipping_address, note, raw_data')
    .eq('shopify_order_id', shopifyOrderId)
    .eq('organization_id', organizationId)
    .single();

  if (orderError || !order) {
    return { success: false, error: 'Pedido no encontrado' };
  }

  // 2. Verify it's an express order
  const shippingTitle = order.raw_data?.shipping_lines?.[0]?.title || '';
  if (!shippingTitle.toLowerCase().includes('express')) {
    return { success: false, error: 'No es un pedido express' };
  }

  // 3. Get delivery code
  const deliveryCode = providedDeliveryCode || extractDeliveryCode(order.note);
  if (!deliveryCode) {
    return { success: false, error: 'No se encontro codigo de entrega (revise las notas del pedido)' };
  }

  // 4. Extract and normalize phone
  const rawPhone = order.shipping_address?.phone || order.customer_phone;
  if (!rawPhone) {
    return { success: false, error: `Sin telefono para pedido ${order.order_number}` };
  }

  const phone = normalizeColombianPhone(rawPhone);
  if (!phone) {
    return { success: false, error: `Telefono invalido: ${rawPhone}` };
  }

  // 5. Customer name
  const customerName = [order.customer_first_name, order.customer_last_name]
    .filter(Boolean).join(' ') || 'Cliente';

  // 6. Find or create conversation
  let conversationId: string | null = null;

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
  } else {
    const insertData: any = {
      organization_id: organizationId,
      external_user_id: phone,
      channel_type: 'whatsapp',
      contact_name: customerName,
      ai_managed: true,
      status: 'active',
    };
    if (channelId) insertData.channel_id = channelId;

    const { data: newConv } = await supabase
      .from('messaging_conversations')
      .insert(insertData)
      .select('id')
      .single();

    if (newConv) {
      conversationId = newConv.id;
    }
  }

  // 7. Send WhatsApp template
  const sendResult = await sendWhatsAppTemplate(
    phoneNumberId, whatsappToken, phone,
    templateName, 'es',
    [{ type: 'text', text: deliveryCode }]
  );

  if (!sendResult.ok) {
    console.error('WhatsApp template send failed:', sendResult.error);

    // Save failed notification record
    await supabase.from('express_notifications').upsert({
      organization_id: organizationId,
      shopify_order_id: shopifyOrderId,
      order_number: order.order_number,
      conversation_id: conversationId,
      customer_phone: phone,
      customer_name: customerName,
      delivery_code: deliveryCode,
      status: 'failed',
      created_at: new Date().toISOString()
    }, { onConflict: 'shopify_order_id' });

    return { success: false, error: `Error al enviar template: ${JSON.stringify(sendResult.error)}` };
  }

  // 8. Build human-readable message for DB storage
  const readableMessage = `Hola, buen dia! Te escribimos desde dosmicos.co para informarte que tu pedido ya se encuentra en camino. Por favor, comparte el siguiente codigo con el/la repartidor/a al momento de la entrega: ${deliveryCode}. Gracias por confiar en nosotros!`;

  // 9. Save message to messaging_messages
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
        content: readableMessage,
        message_type: 'template',
        sent_at: new Date().toISOString()
      })
      .select('id')
      .single();

    messageId = msgData?.id || null;

    await supabase.from('messaging_conversations').update({
      last_message_preview: readableMessage.substring(0, 100),
      last_message_at: new Date().toISOString()
    }).eq('id', conversationId);
  }

  // 10. Create express_notifications record
  await supabase.from('express_notifications').upsert({
    organization_id: organizationId,
    shopify_order_id: shopifyOrderId,
    order_number: order.order_number,
    conversation_id: conversationId,
    customer_phone: phone,
    customer_name: customerName,
    delivery_code: deliveryCode,
    status: 'sent',
    notification_message_id: messageId,
    sent_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  }, { onConflict: 'shopify_order_id' });

  console.log(`✅ Express notification sent for order ${order.order_number} (code: ${deliveryCode}) to ${phone}`);
  return { success: true };
}
