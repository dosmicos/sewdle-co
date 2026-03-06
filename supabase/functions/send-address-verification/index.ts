import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplate } from "../_shared/whatsapp-template.ts";
import { normalizeColombianPhone } from "../_shared/phone-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface VerificationRequest {
  organizationId: string;
  shopifyOrderId: number;
  mismatch: {
    city: string;
    province: string;
    expectedDepartment: string;
  };
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
    const body: VerificationRequest = await req.json();

    console.log('📍 Address verification request:', body.organizationId, body.shopifyOrderId);

    if (!body.organizationId || !body.shopifyOrderId || !body.mismatch) {
      return new Response(
        JSON.stringify({ success: false, error: 'organizationId, shopifyOrderId y mismatch son requeridos' }),
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
      const fallbackPhoneId = Deno.env.get('META_PHONE_NUMBER_ID');
      if (!fallbackPhoneId) {
        return new Response(
          JSON.stringify({ success: false, error: 'No se encontro canal de WhatsApp configurado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    const phoneNumberId = channel?.meta_phone_number_id || Deno.env.get('META_PHONE_NUMBER_ID')!;
    const channelId = channel?.id;

    // 1. Get order data
    const { data: order, error: orderError } = await supabase
      .from('shopify_orders')
      .select('shopify_order_id, order_number, customer_first_name, customer_last_name, customer_phone, shipping_address, billing_address, tags')
      .eq('shopify_order_id', body.shopifyOrderId)
      .eq('organization_id', body.organizationId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido no encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // 2. Extract phone number
    const rawPhone = order.shipping_address?.phone || order.customer_phone || order.billing_address?.phone;
    if (!rawPhone) {
      console.error('No phone number for order:', order.order_number);
      return new Response(
        JSON.stringify({ success: false, error: `Sin telefono para pedido #${order.order_number}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const phone = normalizeColombianPhone(rawPhone);
    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: `Telefono invalido: ${rawPhone}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 3. Build customer name
    const customerName = [order.customer_first_name, order.customer_last_name]
      .filter(Boolean)
      .join(' ') || 'Cliente';

    // 4. Build address verification template parameters
    const orderNum = String(order.order_number).replace('#', '');
    const { city, province, expectedDepartment } = body.mismatch;

    // Text fallback for saving in DB (readable version of the template)
    const message = `Hola ${customerName}! 🛍️ Para tu pedido #${orderNum} de Dosmicos.co, necesitamos verificar tu direccion. ${city} pertenece a ${expectedDepartment}, pero en tu pedido aparece ${province}. ¿Esta correcta tu direccion?`;

    // 5. Find or create conversation
    let conversationId: string | null = null;

    let convQuery = supabase
      .from('messaging_conversations')
      .select('id, metadata')
      .eq('organization_id', body.organizationId)
      .eq('external_user_id', phone)
      .eq('channel_type', 'whatsapp');
    if (channelId) {
      convQuery = convQuery.eq('channel_id', channelId);
    }
    const { data: existingConv } = await convQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
      const existingMetadata = existingConv.metadata || {};
      await supabase
        .from('messaging_conversations')
        .update({
          ai_managed: false,
          metadata: {
            ...existingMetadata,
            ai_disabled_by_automation: true,
            pending_address_verification: {
              shopify_order_id: body.shopifyOrderId,
              order_number: order.order_number,
              mismatch: body.mismatch,
              status: 'pending',
              set_at: new Date().toISOString()
            }
          }
        })
        .eq('id', conversationId);
      console.log(`📝 Updated conversation ${conversationId} with pending address verification`);
    } else {
      const insertData: any = {
        organization_id: body.organizationId,
        external_user_id: phone,
        channel_type: 'whatsapp',
        user_name: customerName,
        ai_managed: false,
        status: 'active',
        metadata: {
          ai_disabled_by_automation: true,
          pending_address_verification: {
            shopify_order_id: body.shopifyOrderId,
            order_number: order.order_number,
            mismatch: body.mismatch,
            status: 'pending',
            set_at: new Date().toISOString()
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
        const { data: retryConv } = await supabase
          .from('messaging_conversations')
          .select('id')
          .eq('organization_id', body.organizationId)
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

    // 6. Send WhatsApp template message
    const sendResult = await sendWhatsAppTemplate(
      phoneNumberId, META_WHATSAPP_TOKEN, phone,
      'address_verification', 'es',
      [
        { type: 'text', text: customerName },
        { type: 'text', text: orderNum },
        { type: 'text', text: city.replace(/[\n\t\r]/g, ' ') },
        { type: 'text', text: expectedDepartment.replace(/[\n\t\r]/g, ' ') },
        { type: 'text', text: province.replace(/[\n\t\r]/g, ' ') },
      ],
      [
        { type: 'payload', payload: 'ADDRESS_CORRECT' },
        { type: 'payload', payload: 'ADDRESS_WRONG' },
      ]
    );

    if (!sendResult.ok) {
      console.error('WhatsApp send failed:', sendResult.error);
      return new Response(
        JSON.stringify({ success: false, error: `Error al enviar WhatsApp: ${JSON.stringify(sendResult.error)}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`✅ WhatsApp address verification sent, ID: ${sendResult.messageId}`);

    // 7. Save message to messaging_messages
    if (conversationId) {
      await supabase
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
        });

      // Update conversation preview
      await supabase
        .from('messaging_conversations')
        .update({
          last_message_preview: message.substring(0, 100),
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);
    }

    // 8. Assign "Verificar direccion" tag to conversation
    if (conversationId) {
      // Find or create the tag
      let tagId: string | null = null;
      const { data: existingTag } = await supabase
        .from('messaging_conversation_tags')
        .select('id')
        .eq('organization_id', body.organizationId)
        .eq('name', 'Verificar direccion')
        .maybeSingle();

      if (existingTag) {
        tagId = existingTag.id;
      } else {
        // Create the tag
        const { data: newTag } = await supabase
          .from('messaging_conversation_tags')
          .insert({
            organization_id: body.organizationId,
            name: 'Verificar direccion',
            color: '#f59e0b' // amber
          })
          .select('id')
          .single();
        tagId = newTag?.id || null;
      }

      if (tagId) {
        await supabase
          .from('messaging_conversation_tag_assignments')
          .upsert({
            conversation_id: conversationId,
            tag_id: tagId
          }, { onConflict: 'conversation_id,tag_id' });
        console.log(`🏷️ Tag "Verificar direccion" assigned to conversation`);
      }
    }

    console.log(`📍 Address verification sent for order #${order.order_number} to ${phone}`);
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-address-verification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
