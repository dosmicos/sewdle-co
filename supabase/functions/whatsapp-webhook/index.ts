import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// WHATSAPP WEBHOOK - GPT-4o DETAILED VISION + TEXT EMBEDDINGS
// Con persistencia de imágenes en Supabase Storage
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    if (mode === 'subscribe' && token === Deno.env.get('META_WEBHOOK_VERIFY_TOKEN')) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages' && change.value?.messages) {
            const phoneNumberId = change.value.metadata?.phone_number_id;
            for (const message of change.value.messages) {
              await processMessage(message, change.value, phoneNumberId, supabase);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ============================================================================
// DOWNLOAD WHATSAPP MEDIA → Base64
// ============================================================================
async function downloadWhatsAppMedia(mediaId: string): Promise<string | null> {
  const accessToken = Deno.env.get('META_WHATSAPP_TOKEN');
  if (!accessToken) return null;

  try {
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${mediaId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!mediaResponse.ok) return null;

    const mediaData = await mediaResponse.json();
    if (!mediaData.url) return null;

    const imageResponse = await fetch(mediaData.url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!imageResponse.ok) return null;

    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64 = encodeBase64(new Uint8Array(arrayBuffer));
    
    console.log('✅ Image downloaded:', arrayBuffer.byteLength, 'bytes');
    return base64;
  } catch (error) {
    console.error('❌ Media error:', error);
    return null;
  }
}

// ============================================================================
// UPLOAD MEDIA TO SUPABASE STORAGE (NEW)
// ============================================================================
async function uploadMediaToStorage(
  base64Data: string,
  mediaId: string,
  supabase: any,
  mimeType: string = 'image/jpeg'
): Promise<string | null> {
  try {
    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const binaryData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      binaryData[i] = binaryString.charCodeAt(i);
    }

    const ext = mimeType.split('/')[1]?.split(';')[0] || 'jpg';
    const fileName = `whatsapp-media/${Date.now()}_${mediaId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('messaging-media')
      .upload(fileName, binaryData, {
        contentType: mimeType,
        cacheControl: '31536000',
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('messaging-media')
      .getPublicUrl(fileName);

    console.log('✅ Image uploaded to storage:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('❌ Upload error:', error);
    return null;
  }
}

// ============================================================================
// GPT-4o DESCRIBE IMAGE (DETALLADO para matching)
// ============================================================================
async function describeImageWithGPT(imageBase64: string): Promise<string | null> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) return null;

  try {
    console.log('🔍 GPT-4o describing image (detailed)...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Eres un experto en identificar productos textiles (ruanas, cobijas, prendas tejidas).

Describe esta imagen de forma EXHAUSTIVA para buscar el producto en un catálogo.

INCLUYE:
1. COLORES EXACTOS: Lista todos (ej: "rojo cereza, azul marino, beige")
2. PATRÓN: Rayas, cuadros, degradado, liso, estampado
3. PERSONAJES/FIGURAS: Si hay animales o figuras, describe:
   - Tipo (vaca, gato, dinosaurio, unicornio, Frankenstein, etc.)
   - Estilo (kawaii, cartoon, realista)
   - Características (ojos grandes, expresión)
4. TEXTO VISIBLE: Escríbelo exactamente
5. ESTILO: Infantil, elegante, rústico, moderno
6. FORMA: Con capucha, flecos, bolsillos, rectangular

NO inventes nombres. Solo describe lo que VES.
Responde en español. Máximo 150 palabras pero sé ESPECÍFICO.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
              },
              {
                type: 'text',
                text: 'Describe esta imagen detalladamente para buscar productos similares.'
              }
            ]
          }
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error('GPT error:', response.status);
      return null;
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content;
    console.log('📝 Description:', description?.substring(0, 100) + '...');
    return description || null;

  } catch (err) {
    console.error('GPT error:', err);
    return null;
  }
}

// ============================================================================
// CREATE TEXT EMBEDDING
// ============================================================================
async function createTextEmbedding(text: string): Promise<number[] | null> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.data?.[0]?.embedding || null;

  } catch (err) {
    console.error('Embedding error:', err);
    return null;
  }
}

// ============================================================================
// FIND MATCHING PRODUCTS
// ============================================================================
async function findMatches(embedding: number[], orgId: string, supabase: any) {
  const { data, error } = await supabase.rpc('match_products', {
    query_embedding: embedding,
    org_id: orgId,
    match_threshold: 0.3,
    match_count: 5
  });

  if (error) {
    console.error('Match error:', error);
    return [];
  }

  console.log(`✅ Found ${data?.length || 0} matches`);
  for (const m of data || []) {
    console.log(`  - ${m.product_title}: ${(m.similarity * 100).toFixed(1)}%`);
  }

  return data || [];
}

// ============================================================================
// GENERATE RESPONSE BASED ON MATCHES
// ============================================================================
function generateImageResponse(matches: any[], userMessage: string): string {
  if (matches.length > 0 && matches[0].similarity > 0.65) {
    const best = matches[0];
    const sim = Math.round(best.similarity * 100);
    
    const tallaMatch = userMessage.match(/talla\s*(\d+)/i);
    const tallaReq = tallaMatch ? tallaMatch[1] : null;
    
    let response = `¡Sí tenemos! Es "${best.product_title}" (${sim}% coincidencia).`;
    
    if (tallaReq) {
      const variant = best.variants?.find((v: any) => v.title?.includes(tallaReq));
      if (variant) {
        if (variant.stock > 0) {
          response += ` Talla ${tallaReq}: disponible por $${variant.price}.`;
        } else {
          response += ` Talla ${tallaReq} agotada.`;
          const available = best.variants?.filter((v: any) => v.stock > 0);
          if (available?.length) {
            response += ` Disponible en: ${available.map((v: any) => v.title).join(', ')}.`;
          }
        }
      }
    } else {
      const available = best.variants?.filter((v: any) => v.stock > 0);
      if (available?.length) {
        response += ` Disponible en: ${available.map((v: any) => `${v.title} ($${v.price})`).join(', ')}.`;
      }
    }
    
    return response;
  }
  
  if (matches.length > 0 && matches[0].similarity > 0.5) {
    const best = matches[0];
    const sim = Math.round(best.similarity * 100);
    return `Creo que podría ser "${best.product_title}" (${sim}% similitud). ¿Es este el producto que buscas?`;
  }
  
  if (matches.length > 0 && matches[0].similarity > 0.35) {
    const opts = matches.slice(0, 3).map(m => 
      `• ${m.product_title} (${Math.round(m.similarity * 100)}%)`
    ).join('\n');
    return `Encontré estos productos similares:\n${opts}\n\n¿Es alguno de estos?`;
  }
  
  return 'No encontré este producto exacto en nuestro catálogo. ¿Podrías decirme más detalles o el nombre del producto?';
}

// ============================================================================
// TEXT RESPONSE (GPT-4o-mini)
// ============================================================================
async function generateTextResponse(
  userMessage: string,
  history: any[],
  aiConfig: any,
  products: any[],
  publicDomain: string
): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) return '';

  let systemPrompt = aiConfig?.systemPrompt || 'Eres un asistente amigable de una tienda de ruanas y cobijas. Responde en español.';
  
  if (aiConfig?.tone) {
    const tones: Record<string, string> = {
      'friendly': '\nTONO: Amigable y cercano.',
      'formal': '\nTONO: Formal y respetuoso.',
      'casual': '\nTONO: Casual y relajado.'
    };
    systemPrompt += tones[aiConfig.tone] || '';
  }

  if (aiConfig?.rules?.length) {
    systemPrompt += '\n\n📋 REGLAS:';
    for (const rule of aiConfig.rules) {
      if (rule.condition && rule.response) {
        systemPrompt += `\n- "${rule.condition}": ${rule.response}`;
      }
    }
  }

  if (aiConfig?.knowledgeBase?.length) {
    systemPrompt += '\n\n📚 CONOCIMIENTO:';
    for (const item of aiConfig.knowledgeBase) {
      if (item.title && item.content) {
        systemPrompt += `\n### ${item.title}\n${item.content}`;
      }
    }
  }
  
  if (products.length > 0) {
    systemPrompt += '\n\n🛒 CATÁLOGO:\n';
    for (const p of products) {
      systemPrompt += `\n📦 ${p.product_title}`;
      if (publicDomain && p.product_handle) {
        systemPrompt += ` - https://${publicDomain}/products/${p.product_handle}`;
      }
      systemPrompt += '\n';
      for (const v of p.variants || []) {
        systemPrompt += `   ${v.stock > 0 ? '✅' : '❌'} ${v.title || 'Única'} - $${v.price}${v.stock > 0 ? ` (${v.stock})` : ' AGOTADO'}\n`;
      }
    }
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8).map(m => ({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.content
    })),
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
    }),
  });

  if (!response.ok) return '';
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================================
// PROCESS MESSAGE
// ============================================================================
async function processMessage(message: any, webhookValue: any, phoneNumberId: string, supabase: any) {
  const senderPhone = message.from;
  const messageId = message.id;
  const timestamp = new Date(parseInt(message.timestamp) * 1000);

  // Dedup
  const { data: existing } = await supabase
    .from('messaging_messages')
    .select('id')
    .eq('external_message_id', messageId)
    .single();
  if (existing) return;

  let content = '';
  let messageType = 'text';
  let imageBase64: string | null = null;
  let mediaUrl: string | null = null; // NEW: For storage persistence
  let mediaMimeType: string | null = null; // NEW: Track mime type

  if (message.type === 'text') {
    content = message.text?.body || '';
  } else if (message.type === 'image') {
    content = message.image?.caption || '';
    messageType = 'image';
    mediaMimeType = 'image/jpeg';
    if (message.image?.id) {
      console.log('🖼️ Downloading image...');
      imageBase64 = await downloadWhatsAppMedia(message.image.id);
      
      // NEW: Upload to Supabase Storage for persistence
      if (imageBase64) {
        mediaUrl = await uploadMediaToStorage(
          imageBase64,
          message.image.id,
          supabase,
          'image/jpeg'
        );
      }
    }
  } else {
    content = `[${message.type}]`;
    messageType = message.type;
  }

  console.log(`📱 ${senderPhone}: ${content.substring(0, 50)}...`);

  // Get channel
  const { data: channel } = await supabase
    .from('messaging_channels')
    .select('*')
    .eq('meta_phone_number_id', phoneNumberId)
    .eq('channel_type', 'whatsapp')
    .eq('is_active', true)
    .single();

  if (!channel) {
    console.error('❌ No channel found');
    return;
  }

  // Get/create conversation
  let { data: conversation } = await supabase
    .from('messaging_conversations')
    .select('*')
    .eq('channel_id', channel.id)
    .eq('external_user_id', senderPhone)
    .single();

  if (!conversation) {
    const contactName = webhookValue.contacts?.[0]?.profile?.name || senderPhone;
    const { data: newConv } = await supabase
      .from('messaging_conversations')
      .insert({
        channel_id: channel.id,
        organization_id: channel.organization_id,
        channel_type: 'whatsapp',
        external_user_id: senderPhone,
        user_name: contactName,
        user_identifier: senderPhone,
        status: 'active',
        last_message_at: timestamp.toISOString(),
        last_message_preview: content.substring(0, 100) || '[Imagen]',
        unread_count: 1,
        ai_managed: true,
      })
      .select()
      .single();
    conversation = newConv;
  } else {
    await supabase
      .from('messaging_conversations')
      .update({
        last_message_at: timestamp.toISOString(),
        last_message_preview: content.substring(0, 100) || '[Imagen]',
        unread_count: (conversation.unread_count || 0) + 1,
      })
      .eq('id', conversation.id);
  }

  // Save inbound message - NOW WITH media_url and media_mime_type
  await supabase.from('messaging_messages').insert({
    conversation_id: conversation.id,
    channel_type: 'whatsapp',
    direction: 'inbound',
    sender_type: 'user',
    content: content || '[Imagen]',
    message_type: messageType,
    external_message_id: messageId,
    sent_at: timestamp.toISOString(),
    media_url: mediaUrl,           // NEW: Persisted image URL
    media_mime_type: mediaMimeType // NEW: MIME type
  });

  // Check if AI enabled
  if (channel.ai_enabled === false || conversation.ai_managed === false) return;
  if (messageType !== 'text' && messageType !== 'image') return;

  let aiResponse = '';

  if (imageBase64) {
    // ========== IMAGE: GPT-4o describe → embedding → match ==========
    console.log('🔢 Processing image with GPT-4o (detailed)...');
    
    // 1. Describe the image in detail
    const description = await describeImageWithGPT(imageBase64);
    
    if (description) {
      // 2. Create embedding from description
      const embedding = await createTextEmbedding(description);
      
      if (embedding) {
        // 3. Find matching products
        const matches = await findMatches(embedding, channel.organization_id, supabase);
        aiResponse = generateImageResponse(matches, content);
      } else {
        aiResponse = 'No pude procesar la imagen. ¿Podrías decirme el nombre del producto?';
      }
    } else {
      aiResponse = 'No pude analizar la imagen. ¿Podrías decirme el nombre del producto?';
    }
  } else {
    // ========== TEXT: GPT-4o-mini ==========
    const { data: products } = await supabase
      .from('product_embeddings')
      .select('product_title, product_handle, variants')
      .eq('organization_id', channel.organization_id);

    const { data: org } = await supabase
      .from('organizations')
      .select('shopify_credentials')
      .eq('id', channel.organization_id)
      .single();

    const { data: history } = await supabase
      .from('messaging_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('sent_at', { ascending: false })
      .limit(10);

    aiResponse = await generateTextResponse(
      content,
      (history || []).reverse(),
      channel.ai_config,
      products || [],
      org?.shopify_credentials?.public_domain || ''
    );
  }

  if (!aiResponse) return;

  // Send response
  const accessToken = Deno.env.get('META_WHATSAPP_TOKEN');
  const sendResponse = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: senderPhone,
        type: 'text',
        text: { body: aiResponse }
      }),
    }
  );

  if (sendResponse.ok) {
    await supabase.from('messaging_messages').insert({
      conversation_id: conversation.id,
      channel_type: 'whatsapp',
      direction: 'outbound',
      sender_type: 'ai',
      content: aiResponse,
      message_type: 'text',
      sent_at: new Date().toISOString(),
    });

    await supabase
      .from('messaging_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: aiResponse.substring(0, 100),
      })
      .eq('id', conversation.id);

    console.log('✅ Response sent');
  }
}
