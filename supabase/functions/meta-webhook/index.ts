import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  // GET: Webhook verification from Meta
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    const verifyToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN');
    
    console.log('Webhook verification request:', { mode, token, challenge });
    
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully');
      return new Response(challenge, { status: 200 });
    } else {
      console.error('Webhook verification failed');
      return new Response('Forbidden', { status: 403 });
    }
  }

  // POST: Incoming messages from Meta
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('Received webhook payload:', JSON.stringify(body, null, 2));

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Process WhatsApp messages
      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'messages') {
              const value = change.value;
              const phoneNumberId = value.metadata?.phone_number_id;
              
              // Process incoming messages
              for (const message of value.messages || []) {
                const contactPhone = message.from;
                const externalMessageId = message.id;
                const timestamp = new Date(parseInt(message.timestamp) * 1000);
                
                // Get contact name
                const contact = value.contacts?.find((c: any) => c.wa_id === contactPhone);
                const contactName = contact?.profile?.name || contactPhone;
                
                // Get message content
                let content = '';
                let messageType = 'text';
                let mediaUrl = null;
                
                if (message.type === 'text') {
                  content = message.text?.body || '';
                } else if (message.type === 'image') {
                  content = '[Imagen]';
                  messageType = 'image';
                  mediaUrl = message.image?.id;
                } else if (message.type === 'audio') {
                  content = '[Audio]';
                  messageType = 'audio';
                  mediaUrl = message.audio?.id;
                } else if (message.type === 'video') {
                  content = '[Video]';
                  messageType = 'video';
                  mediaUrl = message.video?.id;
                } else if (message.type === 'document') {
                  content = '[Documento]';
                  messageType = 'document';
                  mediaUrl = message.document?.id;
                } else if (message.type === 'sticker') {
                  content = '[Sticker]';
                  messageType = 'sticker';
                } else if (message.type === 'location') {
                  content = '[Ubicación]';
                  messageType = 'location';
                } else {
                  content = `[${message.type}]`;
                  messageType = message.type;
                }

                console.log('Processing message:', { contactPhone, contactName, content, messageType });

                // Find channel by phone number ID
                let { data: channel, error: channelError } = await supabase
                  .from('messaging_channels')
                  .select('*')
                  .eq('meta_phone_number_id', phoneNumberId)
                  .eq('channel_type', 'whatsapp')
                  .single();

                if (channelError || !channel) {
                  console.log('Channel not found for phone_number_id:', phoneNumberId);
                  // Try to find any active WhatsApp channel
                  const { data: anyChannel } = await supabase
                    .from('messaging_channels')
                    .select('*')
                    .eq('channel_type', 'whatsapp')
                    .eq('is_active', true)
                    .limit(1)
                    .single();
                  
                  if (!anyChannel) {
                    console.error('No WhatsApp channel configured');
                    continue;
                  }
                  channel = anyChannel;
                }

                // Find or create conversation
                let { data: conversation, error: convError } = await supabase
                  .from('messaging_conversations')
                  .select('*')
                  .eq('channel_id', channel.id)
                  .eq('external_user_id', contactPhone)
                  .single();

                if (convError || !conversation) {
                  console.log('Creating new conversation');
                  const { data: newConv, error: createConvError } = await supabase
                    .from('messaging_conversations')
                    .insert({
                      channel_id: channel.id,
                      organization_id: channel.organization_id,
                      channel_type: 'whatsapp',
                      external_user_id: contactPhone,
                      user_identifier: contactPhone,
                      user_name: contactName,
                      last_message_preview: content,
                      last_message_at: timestamp.toISOString(),
                      unread_count: 1,
                      // Importante: el status tiene constraint en DB; usar solo valores válidos
                      status: 'active',
                      ai_managed: false
                    })
                    .select()
                    .single();

                  if (createConvError) {
                    console.error('Error creating conversation:', createConvError);
                    continue;
                  }
                  conversation = newConv;
                } else {
                  // Update existing conversation (no sobreescribir status para no romper flujos como "closed")
                  const { error: updateError } = await supabase
                    .from('messaging_conversations')
                    .update({
                      last_message_preview: content,
                      last_message_at: timestamp.toISOString(),
                      unread_count: (conversation.unread_count || 0) + 1,
                      user_name: contactName,
                    })
                    .eq('id', conversation.id);

                  if (updateError) {
                    console.error('Error updating conversation:', updateError);
                  }
                }

                // Insert message
                const { error: msgError } = await supabase
                  .from('messaging_messages')
                  .insert({
                    conversation_id: conversation.id,
                    external_message_id: externalMessageId,
                    channel_type: 'whatsapp',
                    direction: 'inbound',
                    sender_type: 'user',
                    content: content,
                    message_type: messageType,
                    media_url: mediaUrl,
                    metadata: message,
                    sent_at: timestamp.toISOString()
                  });

                if (msgError) {
                  console.error('Error inserting message:', msgError);
                } else {
                  console.log('Message saved successfully');
                }
              }

              // Process message status updates
              for (const status of value.statuses || []) {
                console.log('Message status update:', status);
                const statusType = status.status; // sent, delivered, read
                const messageId = status.id;
                
                if (statusType === 'delivered') {
                  await supabase
                    .from('messaging_messages')
                    .update({ delivered_at: new Date().toISOString() })
                    .eq('external_message_id', messageId);
                } else if (statusType === 'read') {
                  await supabase
                    .from('messaging_messages')
                    .update({ read_at: new Date().toISOString() })
                    .eq('external_message_id', messageId);
                }
              }
            }
          }
        }
      }

      // Process Instagram messages
      if (body.object === 'instagram') {
        console.log('Instagram webhook received - processing not implemented yet');
      }

      // Process Messenger messages
      if (body.object === 'page') {
        console.log('Messenger webhook received - processing not implemented yet');
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });

    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
