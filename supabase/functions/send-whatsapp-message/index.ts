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
    const { 
      conversation_id, 
      message, 
      phone_number,
      media_base64,
      media_type,
      media_mime_type,
      media_filename
    } = await req.json();
    
    // Either message or media is required
    if (!message && !media_base64) {
      return new Response(
        JSON.stringify({ error: 'Message or media is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const whatsappToken = Deno.env.get('META_WHATSAPP_TOKEN');
    
    if (!whatsappToken) {
      console.error('Missing META_WHATSAPP_TOKEN');
      return new Response(
        JSON.stringify({ error: 'WhatsApp token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get phone number and phone_number_id from conversation/channel
    let recipientPhone = phone_number;
    let conversationId = conversation_id;
    let channelType = 'whatsapp';
    let phoneNumberId: string | null = null;
    
    if (conversation_id) {
      // Get conversation with channel info
      const { data: conversation, error: convError } = await supabase
        .from('messaging_conversations')
        .select(`
          external_user_id, 
          channel_type,
          channel_id,
          messaging_channels!inner (
            meta_phone_number_id
          )
        `)
        .eq('id', conversation_id)
        .single();
      
      if (convError || !conversation) {
        console.error('Conversation not found:', convError);
        return new Response(
          JSON.stringify({ error: 'Conversation not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      recipientPhone = conversation.external_user_id;
      channelType = conversation.channel_type;
      
      // Get phone_number_id from the channel
      const channel = conversation.messaging_channels as any;
      phoneNumberId = channel?.meta_phone_number_id;
      
      console.log('Resolved from conversation:', {
        recipientPhone,
        channelType,
        phoneNumberId,
        channelId: conversation.channel_id
      });
    }

    if (!recipientPhone) {
      return new Response(
        JSON.stringify({ error: 'Recipient phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback to secret if channel doesn't have phone_number_id
    if (!phoneNumberId) {
      phoneNumberId = Deno.env.get('META_PHONE_NUMBER_ID') || null;
      console.log('Using fallback phone_number_id from secret:', phoneNumberId);
    }

    if (!phoneNumberId) {
      console.error('No phone_number_id available');
      return new Response(
        JSON.stringify({ error: 'WhatsApp phone number ID not configured. Please set up the messaging channel correctly.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean phone number (remove + and spaces)
    const cleanPhone = recipientPhone.replace(/[\s+]/g, '');

    let result: any;
    let savedMediaUrl: string | null = null;
    let messageTypeForDb = 'text';

    // Handle media upload if present
    if (media_base64 && media_type) {
      console.log('Processing media upload:', { media_type, media_mime_type, media_filename });
      
      // First upload media to WhatsApp
      const mediaUploadResponse = await uploadMediaToWhatsApp(
        phoneNumberId, 
        whatsappToken, 
        media_base64, 
        media_mime_type
      );

      if (!mediaUploadResponse.success) {
        return new Response(
          JSON.stringify({ error: mediaUploadResponse.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const mediaId = mediaUploadResponse.media_id;
      console.log('Media uploaded to WhatsApp, ID:', mediaId);

      // Send message with media
      const messagePayload = buildMediaMessagePayload(cleanPhone, media_type, mediaId, message);
      messageTypeForDb = media_type;

      console.log('Sending media message:', JSON.stringify(messagePayload));

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messagePayload)
        }
      );

      result = await response.json();
      console.log('WhatsApp API response:', result);

      if (!response.ok) {
        console.error('WhatsApp API error:', result);
        return new Response(
          JSON.stringify({
            error: result?.error?.message || 'Failed to send media message',
            details: result?.error?.error_data?.details,
            code: result?.error?.code,
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Send text-only message
      console.log('Sending WhatsApp text message:', {
        to: cleanPhone,
        phoneNumberId,
        messageLength: message?.length || 0
      });

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
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

      result = await response.json();
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
          sender_type: 'agent',
          content: message || `[${media_type?.toUpperCase()}]`,
          message_type: messageTypeForDb,
          media_url: savedMediaUrl,
          media_mime_type: media_mime_type,
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
          last_message_preview: message || `📎 ${media_type === 'image' ? 'Imagen' : media_type === 'audio' ? 'Audio' : 'Documento'}`,
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

// Helper function to upload media to WhatsApp
async function uploadMediaToWhatsApp(
  phoneNumberId: string, 
  token: string, 
  base64Data: string, 
  mimeType: string
): Promise<{ success: boolean; media_id?: string; error?: string }> {
  try {
    // Convert base64 to binary
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Create form data
    const formData = new FormData();
    const blob = new Blob([binaryData], { type: mimeType });
    formData.append('file', blob, `file.${getExtensionFromMime(mimeType)}`);
    formData.append('type', mimeType);
    formData.append('messaging_product', 'whatsapp');

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/media`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      }
    );

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Media upload error:', result);
      return { success: false, error: result?.error?.message || 'Failed to upload media' };
    }

    return { success: true, media_id: result.id };
  } catch (error) {
    console.error('Error uploading media:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to build media message payload
function buildMediaMessagePayload(
  to: string, 
  mediaType: string, 
  mediaId: string, 
  caption?: string
): Record<string, any> {
  const payload: Record<string, any> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: mediaType,
  };

  const mediaObject: Record<string, any> = {
    id: mediaId,
  };

  // Only image and document support captions
  if (caption && (mediaType === 'image' || mediaType === 'document')) {
    mediaObject.caption = caption;
  }

  payload[mediaType] = mediaObject;

  return payload;
}

// Helper function to get file extension from MIME type
function getExtensionFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'audio/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
  };
  
  return mimeMap[mimeType] || 'bin';
}