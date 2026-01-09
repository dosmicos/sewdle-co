import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversation_id, message, phone_number } = await req.json();
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const whatsappToken = Deno.env.get('META_WHATSAPP_TOKEN');
    const phoneNumberId = Deno.env.get('META_PHONE_NUMBER_ID');
    
    if (!whatsappToken || !phoneNumberId) {
      console.error('Missing WhatsApp configuration');
      return new Response(
        JSON.stringify({ error: 'WhatsApp configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get phone number from conversation if not provided
    let recipientPhone = phone_number;
    let conversationId = conversation_id;
    let channelType = 'whatsapp';
    
    if (conversation_id && !phone_number) {
      const { data: conversation, error: convError } = await supabase
        .from('messaging_conversations')
        .select('external_user_id, channel_type')
        .eq('id', conversation_id)
        .single();
      
      if (convError || !conversation) {
        return new Response(
          JSON.stringify({ error: 'Conversation not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      recipientPhone = conversation.external_user_id;
      channelType = conversation.channel_type;
    }

    if (!recipientPhone) {
      return new Response(
        JSON.stringify({ error: 'Recipient phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean phone number (remove + and spaces)
    const cleanPhone = recipientPhone.replace(/[\s+]/g, '');

    console.log('Sending WhatsApp message to:', cleanPhone);

    // Send message via WhatsApp Cloud API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: true,
            body: message
          }
        })
      }
    );

    const result = await response.json();
    console.log('WhatsApp API response:', result);

    if (!response.ok) {
      console.error('WhatsApp API error:', result);

      const apiError = result?.error;
      const details = apiError?.error_data?.details || apiError?.message;

      return new Response(
        JSON.stringify({
          error: apiError?.message || 'Failed to send message',
          details,
          code: apiError?.code,
          fbtrace_id: apiError?.fbtrace_id,
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save message to database
    if (conversationId) {
      const { error: msgError } = await supabase
        .from('messaging_messages')
        .insert({
          conversation_id: conversationId,
          external_message_id: result.messages?.[0]?.id,
          channel_type: channelType,
          direction: 'outbound',
          sender_type: 'agent', // Valid values: 'user' | 'ai' | 'agent'
          content: message,
          message_type: 'text',
          metadata: result,
          sent_at: new Date().toISOString()
        });

      if (msgError) {
        console.error('Error saving message:', msgError);
      }

      // Update conversation
      const { error: updateError } = await supabase
        .from('messaging_conversations')
        .update({
          last_message_preview: message,
          last_message_at: new Date().toISOString(),
          ai_managed: true
        })
        .eq('id', conversationId);

      if (updateError) {
        console.error('Error updating conversation:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: result.messages?.[0]?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
