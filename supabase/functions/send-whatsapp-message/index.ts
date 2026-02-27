import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplate } from "../_shared/whatsapp-template.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Product image helpers (WhatsApp) ---
function extractProductIdsFromText(text: string): number[] {
  const regex = /\[PRODUCT_IMAGE_ID:(\d+)\]/g;
  const ids: number[] = [];
  let match;
  while ((match = regex.exec(text || '')) !== null) {
    const id = parseInt(match[1], 10);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, 10);
}

function extractImageNameHints(text: string): string[] {
  const hints: string[] = [];
  const regex = /\[(?:IMAGE|PRODUCT_IMAGE)\s*:\s*([^\]]+)\]/gi;
  let match;
  while ((match = regex.exec(text || '')) !== null) {
    const name = (match[1] || '').trim();
    if (name && !hints.includes(name)) hints.push(name);
  }
  return hints.slice(0, 10);
}

function cleanOutgoingText(text: string): string {
  return (text || '')
    .replace(/\[PRODUCT_IMAGE_ID:\d+\]/g, '')
    .replace(/\[(?:IMAGE|PRODUCT_IMAGE)\s*:[^\]]+\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inferProductIdsFromMentionedTitles(
  text: string,
  productImageMap: Record<number, { url: string; title: string }>
): number[] {
  const lower = (text || '').toLowerCase();
  const matches: Array<{ id: number; index: number; length: number }> = [];

  for (const [idStr, meta] of Object.entries(productImageMap)) {
    const id = Number(idStr);
    const title = (meta?.title || '').trim();
    if (!title) continue;

    const idx = lower.indexOf(title.toLowerCase());
    if (idx >= 0) matches.push({ id, index: idx, length: title.length });
  }

  matches.sort((a, b) => (a.index - b.index) || (b.length - a.length));

  const ordered: number[] = [];
  for (const m of matches) {
    if (!ordered.includes(m.id)) ordered.push(m.id);
    if (ordered.length >= 10) break;
  }

  return ordered;
}

async function fetchShopifyProductImage(
  productId: number,
  shopifyCredentials: any
): Promise<{ url: string; title: string } | null> {
  const storeDomain = shopifyCredentials?.store_domain || shopifyCredentials?.shopDomain;
  const accessToken = shopifyCredentials?.access_token || shopifyCredentials?.accessToken;

  if (!storeDomain || !accessToken) return null;

  try {
    const url = `https://${String(storeDomain).replace('.myshopify.com', '')}.myshopify.com/admin/api/2024-01/products/${productId}.json`;
    const resp = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    const title = data?.product?.title || `Producto ${productId}`;
    const imageUrl = data?.product?.image?.src || data?.product?.images?.[0]?.src;
    if (!imageUrl) return null;

    return { url: imageUrl, title };
  } catch (e) {
    console.error('Error fetching Shopify product image:', e);
    return null;
  }
}

async function cacheImageToStorage(
  supabase: any,
  imageUrl: string,
  organizationId: string,
  productId: number
): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return imageUrl;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Keep conservative here; bucket supports 20MB but don't upload huge files.
    if (bytes.length > 12 * 1024 * 1024) return imageUrl;

    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `products/${organizationId}/${productId}.${ext}`;

    const { error } = await supabase.storage
      .from('messaging-media')
      .upload(path, bytes, { contentType, upsert: true });

    if (error) {
      console.error('Storage upload error:', error);
      return imageUrl;
    }

    const { data } = supabase.storage.from('messaging-media').getPublicUrl(path);
    return data?.publicUrl || imageUrl;
  } catch (e) {
    console.error('Error caching image:', e);
    return imageUrl;
  }
}

async function sendWhatsAppImageByLink(
  phoneNumberId: string,
  token: string,
  to: string,
  imageUrl: string,
  caption?: string
): Promise<{ ok: boolean; messageId?: string; error?: any }> {
  try {
    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'image',
        image: {
          link: imageUrl,
          caption: caption || '',
        },
      }),
    });

    const data = await resp.json();
    if (!resp.ok) return { ok: false, error: data };
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e };
  }
}

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
      media_filename,
      reply_to_message_id,  // UUID interno del mensaje al que se responde
      template_name,        // Nombre de plantilla de WhatsApp (opcional)
      template_language     // Código de idioma de la plantilla (opcional, default: es_CO)
    } = await req.json();
    
    // Either message, media, or template is required
    if (!message && !media_base64 && !template_name) {
      return new Response(
        JSON.stringify({ error: 'Message, media, or template_name is required' }),
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
    let metaPageId: string | null = null;
    
    if (conversation_id) {
      // Get conversation with channel info
      const { data: conversation, error: convError } = await supabase
        .from('messaging_conversations')
        .select(`
          external_user_id,
          channel_type,
          channel_id,
          messaging_channels!inner (
            meta_phone_number_id,
            meta_page_id
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
      
      // Get phone_number_id and meta_page_id from the channel
      const channel = conversation.messaging_channels as any;
      phoneNumberId = channel?.meta_phone_number_id;
      metaPageId = channel?.meta_page_id;

      console.log('Resolved from conversation:', {
        recipientPhone,
        channelType,
        phoneNumberId,
        metaPageId,
        channelId: conversation.channel_id
      });
    }

    if (!recipientPhone) {
      return new Response(
        JSON.stringify({ error: 'Recipient identifier is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== INSTAGRAM / MESSENGER SEND (text only from UI) ==========
    if (channelType === 'instagram' || channelType === 'messenger') {
      if (!metaPageId) {
        return new Response(
          JSON.stringify({ error: `meta_page_id not configured for ${channelType} channel` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!message) {
        return new Response(
          JSON.stringify({ error: 'Message text is required for Instagram/Messenger' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use Instagram token for Instagram, WhatsApp token for Messenger
      const sendToken = channelType === 'instagram'
        ? (Deno.env.get('META_INSTAGRAM_TOKEN') || whatsappToken)
        : whatsappToken;

      console.log(`📤 Sending ${channelType} message to ${recipientPhone} via page ${metaPageId}`);

      let apiUrl: string;
      let apiBody: Record<string, any>;

      if (channelType === 'instagram') {
        // Resolve Facebook Page ID: prefer env variable, then fallback to GET /me, then metaPageId
        let fbPageId = Deno.env.get('META_FACEBOOK_PAGE_ID');
        if (!fbPageId) {
          try {
            const meResp = await fetch(`https://graph.facebook.com/v21.0/me?fields=id&access_token=${sendToken}`);
            const meData = await meResp.json();
            if (meData?.id && !meData?.error) {
              fbPageId = meData.id;
              console.log(`📸 Resolved FB Page ID: ${fbPageId} (from token)`);
            }
          } catch (e) {
            console.log('⚠️ Could not resolve FB Page ID from token');
          }
        }
        if (!fbPageId) {
          fbPageId = metaPageId;
          console.log('⚠️ Using metaPageId as fallback:', metaPageId);
        }

        apiUrl = `https://graph.facebook.com/v21.0/${fbPageId}/messages`;
        apiBody = {
          recipient: { id: recipientPhone },
          message: { text: message },
        };
      } else {
        // messenger
        apiUrl = `https://graph.facebook.com/v21.0/me/messages`;
        apiBody = {
          recipient: { id: recipientPhone },
          message: { text: message },
        };
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiBody),
      });

      const result = await response.json();
      console.log(`${channelType} API response:`, result);

      if (!response.ok) {
        console.error(`${channelType} API error:`, result);
        return new Response(
          JSON.stringify({
            error: result?.error?.message || `Failed to send ${channelType} message`,
            details: result?.error?.error_data?.details,
            code: result?.error?.code,
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Save message to database
      if (conversationId) {
        await supabase.from('messaging_messages').insert({
          conversation_id: conversationId,
          external_message_id: result.message_id || result.messages?.[0]?.id || null,
          channel_type: channelType,
          direction: 'outbound',
          sender_type: 'agent',
          content: message,
          message_type: 'text',
          sent_at: new Date().toISOString(),
        });

        await supabase.from('messaging_conversations').update({
          last_message_preview: message.substring(0, 100),
          last_message_at: new Date().toISOString(),
        }).eq('id', conversationId);
      }

      return new Response(
        JSON.stringify({ success: true, message_id: result.message_id || result.messages?.[0]?.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== WHATSAPP SEND (original logic) ==========

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

    // Si hay reply_to_message_id, buscar el external_message_id (WAMID) del mensaje original
    let replyToExternalId: string | null = null;
    if (reply_to_message_id) {
      const { data: originalMessage, error: replyError } = await supabase
        .from('messaging_messages')
        .select('external_message_id')
        .eq('id', reply_to_message_id)
        .single();
      
      if (originalMessage?.external_message_id) {
        replyToExternalId = originalMessage.external_message_id;
        console.log('Reply context found:', { 
          internal_id: reply_to_message_id, 
          external_wamid: replyToExternalId 
        });
      } else {
        console.warn('Could not find external_message_id for reply:', reply_to_message_id, replyError);
      }
    }

    // Clean phone number (remove + and spaces)
    const cleanPhone = recipientPhone.replace(/[\s+]/g, '');

    let result: any;
    let savedMediaUrl: string | null = null;
    let messageTypeForDb = 'text';

    // ========== WHATSAPP TEMPLATE SEND ==========
    if (template_name) {
      const lang = template_language || 'es_CO';
      console.log(`📤 Sending template "${template_name}" (${lang}) to ${cleanPhone}`);

      const templateResult = await sendWhatsAppTemplate(
        phoneNumberId, whatsappToken, cleanPhone,
        template_name, lang,
        [] // sin parámetros de body
      );

      if (!templateResult.ok) {
        console.error('Template send error:', templateResult.error);
        const errDetail = templateResult.error?.error?.message || 'Failed to send template';
        return new Response(
          JSON.stringify({ error: errDetail, details: templateResult.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      result = { messages: [{ id: templateResult.messageId }] };
      const templateText = message || 'Hola! Nos comunicamos de parte de Dosmicos.';

      // Guardar en DB
      if (conversationId) {
        const { error: templateMsgError } = await supabase.from('messaging_messages').insert({
          conversation_id: conversationId,
          external_message_id: templateResult.messageId,
          channel_type: channelType,
          direction: 'outbound',
          sender_type: 'agent',
          content: templateText,
          message_type: 'template',
          metadata: { template_name, template_language: lang },
          sent_at: new Date().toISOString()
        });

        if (templateMsgError) {
          console.error('Error saving template message to DB:', templateMsgError);
        }

        await supabase.from('messaging_conversations').update({
          last_message_preview: templateText.substring(0, 100),
          last_message_at: new Date().toISOString(),
        }).eq('id', conversationId);
      }

      return new Response(
        JSON.stringify({ success: true, message_id: templateResult.messageId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle media upload if present
    if (media_base64 && media_type) {
      console.log('Processing media upload:', { media_type, media_mime_type, media_filename });
      
      // First save to Supabase Storage for persistent URL (so UI can display it)
      try {
        const binaryData = Uint8Array.from(atob(media_base64), c => c.charCodeAt(0));
        const ext = getExtensionFromMime(media_mime_type || 'image/jpeg');
        const storagePath = `outbound/${conversationId || 'unknown'}/${Date.now()}.${ext}`;
        
        console.log('Saving media to Supabase Storage:', storagePath);
        
        const { error: uploadError } = await supabase.storage
          .from('messaging-media')
          .upload(storagePath, binaryData, { 
            contentType: media_mime_type || 'image/jpeg', 
            upsert: true 
          });
        
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('messaging-media').getPublicUrl(storagePath);
          savedMediaUrl = urlData?.publicUrl || null;
          console.log('Media saved to storage successfully:', savedMediaUrl);
        } else {
          console.error('Error saving media to storage:', uploadError);
        }
      } catch (storageError) {
        console.error('Exception saving media to storage:', storageError);
        // Continue anyway - WhatsApp send is more important than storage
      }
      
      // Then upload media to WhatsApp
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

      // Send message with media (incluyendo context si es respuesta)
      const messagePayload = buildMediaMessagePayload(cleanPhone, media_type, mediaId, message, replyToExternalId);
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
        messageLength: message?.length || 0,
        replyTo: replyToExternalId || 'none'
      });

      // Construir el payload del mensaje
      const messagePayload: Record<string, any> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: true,
          body: message
        }
      };

      // Agregar context si es una respuesta a otro mensaje (según documentación de Meta)
      if (replyToExternalId) {
        messagePayload.context = {
          message_id: replyToExternalId
        };
        console.log('Adding reply context to message:', messagePayload.context);
      }

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
          reply_to_message_id: reply_to_message_id || null,  // Guardar referencia al mensaje original
          metadata: result,
          sent_at: new Date().toISOString()
        });

      if (msgError) {
        console.error('Error saving message:', msgError);
      }

      // Update conversation (IMPORTANT: do NOT change ai_managed here; only the user toggles it)
      const { error: updateError } = await supabase
        .from('messaging_conversations')
        .update({
          last_message_preview: message || `📎 ${media_type === 'image' ? 'Imagen' : media_type === 'audio' ? 'Audio' : 'Documento'}`,
          last_message_at: new Date().toISOString(),
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
  caption?: string,
  replyToExternalId?: string | null  // WAMID del mensaje al que se responde
): Record<string, any> {
  const payload: Record<string, any> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: mediaType,
  };

  // Agregar context si es una respuesta a otro mensaje
  if (replyToExternalId) {
    payload.context = {
      message_id: replyToExternalId
    };
  }

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
