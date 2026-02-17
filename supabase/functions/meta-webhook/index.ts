import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============== CONFIGURACIÓN PRINCIPAL ==============
// Organización por defecto para canales nuevos: Dosmicos
const DEFAULT_ORG_ID = 'cb497af2-3f29-4bb4-be53-91b7f19e5ffb';

// Maximum file size for media downloads (16MB - WhatsApp limit)
const MAX_MEDIA_SIZE = 16 * 1024 * 1024;

// Generate AI response using Lovable AI Gateway (Gemini)
async function generateAIResponse(
  userMessage: string, 
  conversationHistory: any[],
  aiConfig: any,
  mediaContext?: { type: string; url?: string }
): Promise<string> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    console.log('LOVABLE_API_KEY not configured, skipping AI response');
    return '';
  }

  try {
    // Build system prompt from aiConfig or use default
    let systemPrompt = aiConfig?.systemPrompt || `Eres un asistente virtual amigable y profesional para una empresa. 
Tu objetivo es ayudar a los clientes con sus consultas de manera clara y concisa.
Responde siempre en español.
Sé amable, útil y mantén las respuestas breves pero informativas.
Si no puedes ayudar con algo, indica que un humano se pondrá en contacto pronto.`;

    // Add tone instructions if configured
    const toneMap: Record<string, string> = {
      'friendly': 'Usa un tono amigable y cercano. Puedes usar emojis ocasionalmente.',
      'formal': 'Usa un tono formal y respetuoso.',
      'casual': 'Usa un tono casual y relajado. Usa emojis libremente.',
      'professional': 'Usa un tono profesional y directo.'
    };
    if (aiConfig?.tone && toneMap[aiConfig.tone]) {
      systemPrompt += `\n\nTono: ${toneMap[aiConfig.tone]}`;
    }

    // Add response rules if configured
    if (aiConfig?.rules && Array.isArray(aiConfig.rules) && aiConfig.rules.length > 0) {
      systemPrompt += '\n\nReglas especiales:';
      aiConfig.rules.forEach((rule: any) => {
        if (rule.condition && rule.response) {
          systemPrompt += `\n- Cuando el usuario mencione "${rule.condition}": ${rule.response}`;
        }
      });
    }

    // Add knowledge base context if available
    if (aiConfig?.knowledgeBase && Array.isArray(aiConfig.knowledgeBase)) {
      systemPrompt += '\n\nConocimiento de la empresa:';
      aiConfig.knowledgeBase.forEach((item: any) => {
        if (item.question && item.answer) {
          systemPrompt += `\n- P: ${item.question}\n  R: ${item.answer}`;
        }
      });
    }

    // Build user message with media context
    let finalUserMessage = userMessage;
    if (mediaContext?.type === 'image' && mediaContext.url) {
      finalUserMessage = userMessage || `[El cliente envió una imagen]`;
      console.log(`🖼️ Enviando imagen a IA: ${mediaContext.url}`);
    } else if (mediaContext?.type === 'audio') {
      finalUserMessage = userMessage || `[El cliente envió un audio/nota de voz]`;
    } else if (mediaContext?.type === 'sticker') {
      // Don't analyze stickers, just acknowledge
      return '¡Lindo sticker! 😊 ¿En qué puedo ayudarte?';
    }

    // Build messages array with conversation history
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content
      })),
    ];

    // Add the current message - with image if available
    if (mediaContext?.type === 'image' && mediaContext.url) {
      // Use vision capabilities with the permanent Supabase URL
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: finalUserMessage },
          { 
            type: 'image_url', 
            image_url: { 
              url: mediaContext.url,
              detail: 'auto'
            } 
          }
        ]
      });
    } else {
      messages.push({ role: 'user', content: finalUserMessage });
    }

    console.log('Calling Lovable AI Gateway with system prompt length:', systemPrompt.length, 'and', messages.length, 'messages');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      return '';
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';
    console.log('AI response generated:', aiResponse.substring(0, 100) + '...');
    return aiResponse;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return '';
  }
}

// Determine file extension based on MIME type and message type
function getFileExtension(mimeType: string, messageType: string): string {
  // Handle common MIME types
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
    'audio/amr': 'amr',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  };

  if (mimeType && mimeToExt[mimeType.toLowerCase()]) {
    return mimeToExt[mimeType.toLowerCase()];
  }

  // Fallback based on message type
  const typeDefaults: Record<string, string> = {
    'image': 'jpg',
    'audio': 'ogg',
    'video': 'mp4',
    'sticker': 'webp',
    'document': 'bin',
  };

  return typeDefaults[messageType] || 'bin';
}

// Get subfolder based on message type
function getMediaSubfolder(messageType: string): string {
  const folders: Record<string, string> = {
    'image': 'images',
    'audio': 'audios',
    'video': 'videos',
    'sticker': 'stickers',
    'document': 'documents',
  };
  return folders[messageType] || 'misc';
}

// Fetch media URL from WhatsApp API using media ID with robust error handling
async function fetchMediaUrl(
  mediaId: string, 
  messageType: string,
  conversationId: string,
  supabase: any
): Promise<{ url: string | null; mimeType: string | null; error?: string }> {
  const accessToken = Deno.env.get('META_WHATSAPP_TOKEN');
  
  if (!accessToken) {
    console.error('❌ META_WHATSAPP_TOKEN not configured');
    return { url: null, mimeType: null, error: 'Token not configured' };
  }
  
  if (!mediaId) {
    console.error('❌ No media ID provided');
    return { url: null, mimeType: null, error: 'No media ID' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseClient = supabase || createClient(supabaseUrl, supabaseKey);

  try {
    console.log(`📥 Fetching WhatsApp media: ${mediaId} (type: ${messageType})`);
    
    // Step 1: Get media info from Meta API (with 10s timeout)
    const infoController = new AbortController();
    const infoTimeoutId = setTimeout(() => infoController.abort(), 10000);
    
    let infoResponse: Response;
    try {
      infoResponse = await fetch(
        `https://graph.facebook.com/v21.0/${mediaId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          signal: infoController.signal,
        }
      );
    } finally {
      clearTimeout(infoTimeoutId);
    }

    if (!infoResponse.ok) {
      const errorText = await infoResponse.text();
      console.error(`❌ Failed to get media info (${infoResponse.status}):`, errorText);
      return { url: null, mimeType: null, error: `Meta API error: ${infoResponse.status}` };
    }

    const mediaInfo = await infoResponse.json();
    console.log(`📋 Media info received:`, { 
      url: mediaInfo.url?.substring(0, 50) + '...', 
      mime_type: mediaInfo.mime_type,
      file_size: mediaInfo.file_size 
    });
    
    if (!mediaInfo.url) {
      console.error('❌ No URL in media info response');
      return { url: null, mimeType: null, error: 'No URL in response' };
    }

    // Check file size before downloading
    if (mediaInfo.file_size && mediaInfo.file_size > MAX_MEDIA_SIZE) {
      console.error(`❌ File too large: ${mediaInfo.file_size} bytes (max: ${MAX_MEDIA_SIZE})`);
      return { url: null, mimeType: mediaInfo.mime_type, error: 'File too large' };
    }

    // Step 2: Download the media binary (with 30s timeout)
    const downloadController = new AbortController();
    const downloadTimeoutId = setTimeout(() => downloadController.abort(), 30000);
    
    let mediaResponse: Response;
    try {
      mediaResponse = await fetch(mediaInfo.url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        signal: downloadController.signal,
      });
    } finally {
      clearTimeout(downloadTimeoutId);
    }

    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      console.error(`❌ Failed to download media (${mediaResponse.status}):`, errorText.substring(0, 200));
      return { url: null, mimeType: mediaInfo.mime_type, error: `Download failed: ${mediaResponse.status}` };
    }

    // Step 3: Read and validate the binary data
    const arrayBuffer = await mediaResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    if (uint8Array.length === 0) {
      console.error('❌ Downloaded file is empty');
      return { url: null, mimeType: mediaInfo.mime_type, error: 'Empty file' };
    }

    console.log(`📦 Downloaded ${uint8Array.length} bytes`);

    // Step 4: Determine file path
    const mimeType = mediaInfo.mime_type || 'application/octet-stream';
    const ext = getFileExtension(mimeType, messageType);
    const subfolder = getMediaSubfolder(messageType);
    const timestamp = Date.now();
    const fileName = `whatsapp-media/${subfolder}/${conversationId}/${timestamp}_${mediaId}.${ext}`;
    
    console.log(`📤 Uploading to Supabase Storage: ${fileName}`);

    // Step 5: Upload to Supabase Storage (with retry)
    let uploadSuccess = false;
    let uploadAttempts = 0;
    const maxUploadAttempts = 2;
    
    while (!uploadSuccess && uploadAttempts < maxUploadAttempts) {
      uploadAttempts++;
      const { error: uploadError } = await supabaseClient
        .storage
        .from('messaging-media')
        .upload(fileName, uint8Array, {
          contentType: mimeType,
          cacheControl: '31536000',
          upsert: true,
        });

      if (uploadError) {
        console.error(`❌ Upload attempt ${uploadAttempts} failed:`, uploadError);
        if (uploadAttempts < maxUploadAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        uploadSuccess = true;
      }
    }

    if (!uploadSuccess) {
      console.error('❌ All upload attempts failed');
      return { url: null, mimeType, error: 'Upload failed after retries' };
    }

    // Step 6: Get public URL
    const { data: publicUrlData } = supabaseClient
      .storage
      .from('messaging-media')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData?.publicUrl;
    
    if (!publicUrl) {
      console.error('❌ Failed to get public URL');
      return { url: null, mimeType, error: 'No public URL' };
    }

    console.log(`✅ Media cached successfully: ${publicUrl.substring(0, 80)}...`);
    return { url: publicUrl, mimeType };
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('❌ Media fetch timed out');
      return { url: null, mimeType: null, error: 'Timeout' };
    }
    console.error('❌ Error fetching WhatsApp media:', error);
    return { url: null, mimeType: null, error: error.message || 'Unknown error' };
  }
}

// Send WhatsApp message via Meta API
async function sendWhatsAppMessage(phoneNumberId: string, recipientPhone: string, message: string): Promise<any> {
  const accessToken = Deno.env.get('META_WHATSAPP_TOKEN');
  
  if (!accessToken) {
    console.error('META_WHATSAPP_TOKEN not configured');
    return null;
  }

  try {
    console.log('Sending WhatsApp message to:', recipientPhone, 'via phone_number_id:', phoneNumberId);
    
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'text',
          text: { body: message }
        }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      return null;
    }

    console.log('WhatsApp message sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return null;
  }
}

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
      console.log('========== WEBHOOK RECEIVED ==========');
      console.log('Received webhook payload:', JSON.stringify(body, null, 2));

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Helper to normalize Meta's payload (can be array or object with numeric keys)
      const toArray = (obj: any): any[] => {
        if (!obj) return [];
        if (Array.isArray(obj)) return obj;
        // Meta sometimes sends objects like { "0": {...}, "1": {...} }
        return Object.values(obj);
      };

      // Process WhatsApp messages
      if (body.object === 'whatsapp_business_account') {
        for (const entry of toArray(body.entry)) {
          for (const change of toArray(entry.changes)) {
            if (change.field === 'messages') {
              const value = change.value;
              const phoneNumberId = value.metadata?.phone_number_id;
              
              console.log('========== PROCESSING MESSAGE ==========');
              console.log('phone_number_id from Meta:', phoneNumberId);
              console.log('display_phone_number:', value.metadata?.display_phone_number);
              
              // Process incoming messages
              for (const message of toArray(value.messages)) {
                const contactPhone = message.from;
                const externalMessageId = message.id;
                const timestamp = new Date(parseInt(message.timestamp) * 1000);
                
                // Get contact name
                const contact = toArray(value.contacts)?.find((c: any) => c.wa_id === contactPhone);
                const contactName = contact?.profile?.name || contactPhone;
                
                console.log('Message from:', contactPhone, 'name:', contactName);
                
                // Get message content
                let content = '';
                let messageType = 'text';
                let mediaId: string | null = null;
                let mediaMimeType: string | null = null;
                let replyToMessageId = null;
                
                // Handle context (replies to previous messages)
                if (message.context?.id) {
                  replyToMessageId = message.context.id;
                }
                
                if (message.type === 'text') {
                  content = message.text?.body || '';
                } else if (message.type === 'reaction') {
                  const emoji = message.reaction?.emoji || '👍';
                  content = `Reaccionó con ${emoji}`;
                  messageType = 'reaction';
                } else if (message.type === 'image') {
                  content = message.image?.caption || '[Imagen]';
                  messageType = 'image';
                  mediaId = message.image?.id;
                  mediaMimeType = message.image?.mime_type;
                } else if (message.type === 'audio') {
                  content = '[audio]';
                  messageType = 'audio';
                  mediaId = message.audio?.id;
                  mediaMimeType = message.audio?.mime_type;
                } else if (message.type === 'video') {
                  content = message.video?.caption || '[video]';
                  messageType = 'video';
                  mediaId = message.video?.id;
                  mediaMimeType = message.video?.mime_type;
                } else if (message.type === 'document') {
                  content = message.document?.filename || '[documento]';
                  messageType = 'document';
                  mediaId = message.document?.id;
                  mediaMimeType = message.document?.mime_type;
                } else if (message.type === 'sticker') {
                  content = '[sticker]';
                  messageType = 'sticker';
                  mediaId = message.sticker?.id;
                  mediaMimeType = message.sticker?.mime_type;
                } else if (message.type === 'location') {
                  const loc = message.location;
                  content = loc?.name || loc?.address || `[Ubicación: ${loc?.latitude}, ${loc?.longitude}]`;
                  messageType = 'location';
                } else if (message.type === 'contacts') {
                  const contactCount = message.contacts?.length || 1;
                  content = `[${contactCount} contacto${contactCount > 1 ? 's' : ''}]`;
                  messageType = 'contacts';
                } else if (message.type === 'button') {
                  content = message.button?.text || '[Botón]';
                  messageType = 'button';
                } else if (message.type === 'interactive') {
                  const interactive = message.interactive;
                  if (interactive?.type === 'button_reply') {
                    content = interactive.button_reply?.title || '[Respuesta de botón]';
                  } else if (interactive?.type === 'list_reply') {
                    content = interactive.list_reply?.title || '[Selección de lista]';
                  } else {
                    content = '[Interactivo]';
                  }
                  messageType = 'interactive';
                } else if (message.type === 'order') {
                  const orderItems = message.order?.product_items?.length || 0;
                  content = `[Pedido: ${orderItems} producto${orderItems !== 1 ? 's' : ''}]`;
                  messageType = 'order';
                } else {
                  content = `[${message.type}]`;
                  messageType = message.type;
                }

                console.log('Message content:', content, 'type:', messageType, 'mediaId:', mediaId);

                // Find channel by phone number ID - ESTRATEGIA MEJORADA
                let channel = null;
                
                // 1. Buscar por phone_number_id exacto
                const { data: exactChannel, error: exactError } = await supabase
                  .from('messaging_channels')
                  .select('*')
                  .eq('meta_phone_number_id', phoneNumberId)
                  .eq('channel_type', 'whatsapp')
                  .single();

                if (exactChannel) {
                  console.log('Found exact channel match:', exactChannel.id, exactChannel.channel_name);
                  channel = exactChannel;
                } else {
                  console.log('No exact channel match for phone_number_id:', phoneNumberId);
                  
                  // 2. Buscar cualquier canal WhatsApp activo de Dosmicos
                  const { data: dosmicoChannel } = await supabase
                    .from('messaging_channels')
                    .select('*')
                    .eq('organization_id', DEFAULT_ORG_ID)
                    .eq('channel_type', 'whatsapp')
                    .eq('is_active', true)
                    .limit(1)
                    .single();
                  
                  if (dosmicoChannel) {
                    console.log('Using Dosmicos fallback channel:', dosmicoChannel.id);
                    // Actualizar el phone_number_id del canal existente
                    await supabase
                      .from('messaging_channels')
                      .update({ meta_phone_number_id: phoneNumberId })
                      .eq('id', dosmicoChannel.id);
                    channel = dosmicoChannel;
                  } else {
                    // 3. Crear nuevo canal para Dosmicos
                    console.log('Creating new WhatsApp channel for Dosmicos with phone_number_id:', phoneNumberId);
                    const { data: newChannel, error: createError } = await supabase
                      .from('messaging_channels')
                      .insert({
                        organization_id: DEFAULT_ORG_ID,
                        channel_type: 'whatsapp',
                        channel_name: 'WhatsApp Business',
                        meta_phone_number_id: phoneNumberId,
                        is_active: true,
                        ai_enabled: true, // Auto-responder activado por defecto
                        webhook_verified: true,
                        ai_config: {
                          systemPrompt: `Eres un asistente de ventas amigable para una tienda de artesanías colombianas. 
Tu rol es:
- Responder preguntas sobre productos disponibles
- Proporcionar información de precios y disponibilidad
- Ayudar a los clientes con sus pedidos
- Ser amable y usar emojis ocasionalmente

Reglas importantes:
- Siempre saluda al cliente
- Si no sabes algo, ofrece conectar con un humano
- Mantén respuestas concisas pero informativas`,
                          tone: 'friendly',
                          greetingMessage: '¡Hola! 👋 Soy el asistente virtual de la tienda. ¿En qué puedo ayudarte?',
                          autoReply: true,
                          rules: []
                        }
                      })
                      .select()
                      .single();
                    
                    if (createError) {
                      console.error('Error creating channel:', createError);
                      continue;
                    }
                    
                    console.log('Created new channel:', newChannel.id);
                    channel = newChannel;
                  }
                }

                // Find or create conversation
                let { data: conversation, error: convError } = await supabase
                  .from('messaging_conversations')
                  .select('*')
                  .eq('channel_id', channel.id)
                  .eq('external_user_id', contactPhone)
                  .single();

                if (convError || !conversation) {
                  console.log('Creating new conversation for:', contactPhone);
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
                      status: 'active',
                      ai_managed: channel.ai_enabled !== false,
                    })
                    .select()
                    .single();

                  if (createConvError) {
                    console.error('Error creating conversation:', createConvError);
                    continue;
                  }
                  conversation = newConv;
                  console.log('Created conversation:', conversation.id);
                } else {
                  // Update existing conversation with preview that includes media info
                  console.log('Updating existing conversation:', conversation.id);
                  const previewText = mediaId 
                    ? (messageType === 'image' ? '📷 Imagen' : 
                       messageType === 'audio' ? '🎵 Audio' : 
                       messageType === 'video' ? '🎬 Video' : 
                       messageType === 'document' ? '📄 Documento' : 
                       messageType === 'sticker' ? '🎭 Sticker' : content || `[${messageType}]`)
                    : content;
                  
                  await supabase
                    .from('messaging_conversations')
                    .update({
                      last_message_preview: previewText,
                      last_message_at: timestamp.toISOString(),
                      unread_count: (conversation.unread_count || 0) + 1,
                      user_name: contactName,
                    })
                    .eq('id', conversation.id);
                }

                // Fetch real media URL if there's a media ID (with improved error handling)
                let mediaUrl: string | null = null;
                let mediaError: string | undefined;
                if (mediaId) {
                  console.log(`📥 Processing media: ${mediaId} (type: ${messageType})`);
                  const mediaResult = await fetchMediaUrl(mediaId, messageType, conversation.id, supabase);
                  mediaUrl = mediaResult.url;
                  mediaMimeType = mediaResult.mimeType || mediaMimeType;
                  mediaError = mediaResult.error;
                  
                  if (mediaUrl) {
                    console.log(`✅ Media URL resolved: ${mediaUrl.substring(0, 80)}...`);
                  } else {
                    console.log(`⚠️ Media download failed: ${mediaError}`);
                  }
                }

                // Insert message (skip for reaction type)
                if (messageType !== 'reaction') {
                  // Resolve reply_to_message_id from WAMID to internal UUID
                  let resolvedReplyToId: string | null = null;
                  if (replyToMessageId) {
                    const { data: replyMsg } = await supabase
                      .from('messaging_messages')
                      .select('id')
                      .eq('external_message_id', replyToMessageId)
                      .limit(1)
                      .single();
                    
                    if (replyMsg) {
                      resolvedReplyToId = replyMsg.id;
                      console.log(`✅ Resolved reply WAMID ${replyToMessageId} to internal ID ${resolvedReplyToId}`);
                    } else {
                      console.log(`⚠️ Could not resolve reply WAMID ${replyToMessageId}, setting to null`);
                    }
                  }

                  const { error: msgError } = await supabase
                    .from('messaging_messages')
                    .insert({
                      conversation_id: conversation.id,
                      external_message_id: externalMessageId,
                      channel_type: 'whatsapp',
                      direction: 'inbound',
                      sender_type: 'user',
                      content: content || null,
                      message_type: messageType,
                      media_url: mediaUrl,
                      media_mime_type: mediaMimeType,
                      reply_to_message_id: resolvedReplyToId,
                      metadata: {
                        ...message,
                        original_media_id: mediaId,
                        media_download_error: mediaError,
                        referral: message.referral || null,
                        context: message.context || null
                      },
                      sent_at: timestamp.toISOString()
                    });

                  if (msgError) {
                    console.error('Error inserting message:', msgError);
                  } else {
                    console.log('Message saved successfully');
                    
                    // Generate AI response if AI is enabled (AUTO-RESPONDER)
                    const aiConfig = channel.ai_config as any;
                    const autoReplyEnabled = aiConfig?.autoReply !== false;

                    // Releer el estado de la conversación para respetar el switch
                    const { data: freshConv } = await supabase
                      .from('messaging_conversations')
                      .select('ai_managed')
                      .eq('id', conversation.id)
                      .single();

                    const aiEnabledOnChannel = channel.ai_enabled !== false;
                    const aiEnabledOnConversation = (freshConv?.ai_managed ?? conversation.ai_managed) !== false;
                    const shouldAutoReply = aiEnabledOnChannel && aiEnabledOnConversation && autoReplyEnabled;

                    console.log('AI config:', {
                      channelAiEnabled: channel.ai_enabled,
                      conversationAiManaged: freshConv?.ai_managed ?? conversation.ai_managed,
                      autoReplyEnabled,
                      shouldAutoReply,
                    });
                    
                    if (shouldAutoReply) {
                      // Check business hours if configured
                      let withinBusinessHours = true;
                      if (aiConfig?.businessHours === true) {
                        const now = new Date();
                        const colombiaOffset = -5 * 60;
                        const colombiaTime = new Date(now.getTime() + (colombiaOffset - now.getTimezoneOffset()) * 60000);
                        const hour = colombiaTime.getHours();
                        const dayOfWeek = colombiaTime.getDay();
                        
                        withinBusinessHours = dayOfWeek >= 1 && dayOfWeek <= 6 && hour >= 9 && hour < 18;
                        console.log('Business hours check:', { hour, dayOfWeek, withinBusinessHours });
                        
                        if (!withinBusinessHours) {
                          console.log('Outside business hours, skipping AI response');
                        }
                      }
                      
                      if (withinBusinessHours) {
                        // Apply response delay if configured
                        const responseDelay = parseInt(aiConfig?.responseDelay) || 0;
                        if (responseDelay > 0) {
                          console.log(`Applying response delay of ${responseDelay} seconds`);
                          await new Promise(resolve => setTimeout(resolve, responseDelay * 1000));
                        }
                        
                        console.log('Generating AI response...');
                        
                        // Get recent conversation history
                        const { data: historyMessages } = await supabase
                          .from('messaging_messages')
                          .select('content, direction')
                          .eq('conversation_id', conversation.id)
                          .order('sent_at', { ascending: false })
                          .limit(10);
                        
                        // Prepare media context for AI - ALWAYS use Supabase URL (permanent)
                        const mediaContext = mediaId ? {
                          type: messageType,
                          url: mediaUrl || undefined, // Only pass if we have a permanent URL
                        } : undefined;
                        
                        // Validate that image URL is from Supabase Storage before sending to AI
                        if (mediaContext?.type === 'image' && mediaContext.url) {
                          const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
                          if (!mediaContext.url.includes(supabaseUrl) && !mediaContext.url.includes('supabase')) {
                            console.warn('⚠️ Image URL is not from Supabase Storage, skipping image analysis');
                            mediaContext.url = undefined;
                          }
                        }
                        
                        const aiResponse = await generateAIResponse(
                          content, 
                          (historyMessages || []).reverse(),
                          aiConfig,
                          mediaContext
                        );
                        
                        if (aiResponse) {
                          console.log('AI response:', aiResponse.substring(0, 100) + '...');
                          
                          // Send via WhatsApp
                          const sendResult = await sendWhatsAppMessage(phoneNumberId, contactPhone, aiResponse);
                          
                          if (sendResult) {
                            // Save AI response to database
                            const { error: aiMsgError } = await supabase
                              .from('messaging_messages')
                              .insert({
                                conversation_id: conversation.id,
                                external_message_id: sendResult.messages?.[0]?.id,
                                channel_type: 'whatsapp',
                                direction: 'outbound',
                                sender_type: 'ai',
                                content: aiResponse,
                                message_type: 'text',
                                sent_at: new Date().toISOString()
                              });
                            
                            if (aiMsgError) {
                              console.error('Error saving AI response:', aiMsgError);
                            } else {
                              console.log('AI response saved successfully');
                              
                              // Update conversation preview/time
                              await supabase
                                .from('messaging_conversations')
                                .update({
                                  last_message_preview: aiResponse.substring(0, 100),
                                  last_message_at: new Date().toISOString(),
                                })
                                .eq('id', conversation.id);
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }

              // Process status updates (sent, delivered, read)
              for (const status of toArray(value.statuses)) {
                const messageId = status.id;
                const statusType = status.status;
                const timestamp = new Date(parseInt(status.timestamp) * 1000);
                
                console.log('Status update:', { messageId, statusType, timestamp });
                
                const updateData: any = {};
                if (statusType === 'sent') {
                  updateData.sent_at = timestamp.toISOString();
                } else if (statusType === 'delivered') {
                  updateData.delivered_at = timestamp.toISOString();
                } else if (statusType === 'read') {
                  updateData.read_at = timestamp.toISOString();
                }
                
                if (Object.keys(updateData).length > 0) {
                  await supabase
                    .from('messaging_messages')
                    .update(updateData)
                    .eq('external_message_id', messageId);
                }
              }
            }
          }
        }
      }

      // Process Instagram messages
      if (body.object === 'instagram') {
        console.log('Instagram webhook received - processing...');
        // Similar logic for Instagram
      }

      // Process Messenger messages  
      if (body.object === 'page') {
        console.log('Messenger webhook received - processing...');
        // Similar logic for Messenger
      }

      console.log('========== WEBHOOK PROCESSED ==========');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
