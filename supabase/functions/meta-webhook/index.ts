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

// Generate AI response using Minimax API (Elsa)
// Includes Shopify product catalog with prices & inventory + knowledge base
// OPTIMIZED: Compact catalog format, product limit, fallback on failure
async function generateAIResponse(
  userMessage: string,
  conversationHistory: any[],
  aiConfig: any,
  organizationId: string,
  supabaseClient: any,
  mediaContext?: { type: string; url?: string }
): Promise<string> {
  const MINIMAX_API_KEY = Deno.env.get('MINIMAX_API_KEY');
  const MINIMAX_GROUP_ID = Deno.env.get('MINIMAX_GROUP_ID');
  const MINIMAX_BASE_URL = Deno.env.get('MINIMAX_BASE_URL') || 'https://api.minimax.io/v1';
  const MINIMAX_MODEL = Deno.env.get('MINIMAX_MODEL') || 'MiniMax-M2';

  // Maximum characters for the entire system prompt (safe limit for Minimax)
  const MAX_SYSTEM_PROMPT_CHARS = 12000;
  // Maximum products to include in catalog
  const MAX_PRODUCTS = 60;

  console.log('🔑 [AI-KEY] MINIMAX_API_KEY present:', !!MINIMAX_API_KEY, '| prefix:', MINIMAX_API_KEY?.substring(0, 8) + '...');
  console.log('🔑 [AI-KEY] MINIMAX_GROUP_ID:', MINIMAX_GROUP_ID);

  if (!MINIMAX_API_KEY) {
    console.error('❌ MINIMAX_API_KEY not configured in Supabase secrets, cannot generate AI response');
    return '';
  }

  console.log('🤖 [AI-START] generateAIResponse called', {
    userMessage: userMessage?.substring(0, 50),
    hasMediaContext: !!mediaContext,
    mediaType: mediaContext?.type,
    organizationId,
    hasAiConfig: !!aiConfig,
  });

  try {
    // ========== 1. BUILD SYSTEM PROMPT ==========
    let systemPrompt = aiConfig?.systemPrompt || `Eres un asistente virtual amigable y profesional para una empresa.
Tu objetivo es ayudar a los clientes con sus consultas de manera clara y concisa.
Responde siempre en español.
Sé amable, útil y mantén las respuestas breves pero informativas.
Si no puedes ayudar con algo, indica que un humano se pondrá en contacto pronto.`;

    // Add tone instructions
    const toneMap: Record<string, string> = {
      'friendly': 'Usa un tono amigable y cercano. Puedes usar emojis ocasionalmente.',
      'formal': 'Usa un tono formal y respetuoso.',
      'casual': 'Usa un tono casual y relajado. Usa emojis libremente.',
      'professional': 'Usa un tono profesional y directo.'
    };
    if (aiConfig?.tone && toneMap[aiConfig.tone]) {
      systemPrompt += `\n\nTono: ${toneMap[aiConfig.tone]}`;
    }

    // Add response rules
    if (aiConfig?.rules && Array.isArray(aiConfig.rules) && aiConfig.rules.length > 0) {
      systemPrompt += '\n\n📋 REGLAS ESPECIALES:';
      aiConfig.rules.forEach((rule: any) => {
        if (rule.condition && rule.response) {
          systemPrompt += `\n- Cuando "${rule.condition}": ${rule.response}`;
        }
      });
    }

    // Add knowledge base context
    if (aiConfig?.knowledgeBase && Array.isArray(aiConfig.knowledgeBase) && aiConfig.knowledgeBase.length > 0) {
      systemPrompt += '\n\n📚 CONOCIMIENTO DE LA EMPRESA:';
      aiConfig.knowledgeBase.forEach((item: any) => {
        if (item.category === 'product') {
          const name = item.productName || item.title || '';
          if (name && item.content) {
            systemPrompt += `\n📦 ${name}: ${item.content}`;
          }
        } else if (item.title && item.content) {
          systemPrompt += `\n📋 ${item.title}: ${item.content}`;
        } else if (item.question && item.answer) {
          systemPrompt += `\nP: ${item.question} R: ${item.answer}`;
        }
      });
    }

    console.log('📝 [AI-PROMPT] Base prompt length:', systemPrompt.length, 'chars');

    // ========== 2. LOAD SHOPIFY PRODUCT CATALOG (COMPACT FORMAT) ==========
    let productCatalog = '';
    if (organizationId) {
      try {
        // Check which products are connected for AI
        const { data: connections } = await supabaseClient
          .from('ai_catalog_connections')
          .select('shopify_product_id')
          .eq('organization_id', organizationId)
          .eq('connected', true);

        const connectedProductIds = new Set(connections?.map((c: any) => c.shopify_product_id) || []);
        console.log(`📦 [AI-CATALOG] ${connectedProductIds.size} connected products`);

        // Get Shopify credentials
        const { data: org } = await supabaseClient
          .from('organizations')
          .select('shopify_credentials')
          .eq('id', organizationId)
          .single();

        const shopifyCredentials = org?.shopify_credentials as any;

        if (shopifyCredentials) {
          const shopifyDomain = shopifyCredentials.store_domain || shopifyCredentials.shopDomain;
          const accessToken = shopifyCredentials.access_token || shopifyCredentials.accessToken;

          if (shopifyDomain && accessToken) {
            try {
              const shopifyResponse = await fetch(
                `https://${shopifyDomain}/admin/api/2024-01/products.json?status=active&limit=250`,
                {
                  headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (shopifyResponse.ok) {
                const shopifyData = await shopifyResponse.json();
                const shopifyProducts = shopifyData.products || [];

                // Filter to connected products (or all if none specified)
                let connectedProducts = shopifyProducts.filter(
                  (p: any) => connectedProductIds.size === 0 || connectedProductIds.has(p.id)
                );

                // Limit number of products to prevent prompt overflow
                if (connectedProducts.length > MAX_PRODUCTS) {
                  console.log(`⚠️ [AI-CATALOG] Limiting from ${connectedProducts.length} to ${MAX_PRODUCTS} products`);
                  // Prioritize products with stock
                  connectedProducts.sort((a: any, b: any) => {
                    const stockA = (a.variants || []).reduce((s: number, v: any) => s + (v.inventory_quantity || 0), 0);
                    const stockB = (b.variants || []).reduce((s: number, v: any) => s + (v.inventory_quantity || 0), 0);
                    return stockB - stockA; // More stock first
                  });
                  connectedProducts = connectedProducts.slice(0, MAX_PRODUCTS);
                }

                if (connectedProducts.length > 0) {
                  // COMPACT FORMAT: One line per product to save tokens
                  productCatalog = '\n\n📦 CATÁLOGO (solo ofrece productos con stock>0):\n';

                  connectedProducts.forEach((product: any) => {
                    const variants = product.variants || [];
                    const totalStock = variants.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0);

                    if (totalStock === 0) {
                      productCatalog += `${product.title}: AGOTADO\n`;
                      return;
                    }

                    const price = variants[0]?.price
                      ? `$${Number(variants[0].price).toLocaleString('es-CO')}`
                      : '?';

                    // Compact variant info: only show variants with stock
                    const availableVariants = variants
                      .filter((v: any) => (v.inventory_quantity || 0) > 0)
                      .map((v: any) => `${v.title}(${v.inventory_quantity})`)
                      .join(',');

                    productCatalog += `${product.title}|${price}COP|${availableVariants}`;
                    if (product.product_type) {
                      productCatalog += `|${product.product_type}`;
                    }
                    productCatalog += '\n';
                  });

                  console.log(`📦 [AI-CATALOG] Loaded ${connectedProducts.length} products, catalog length: ${productCatalog.length} chars`);
                }
              } else {
                console.error('❌ [AI-CATALOG] Shopify API error:', shopifyResponse.status, await shopifyResponse.text());
              }
            } catch (shopifyErr) {
              console.error('❌ [AI-CATALOG] Shopify fetch error:', shopifyErr);
            }
          } else {
            console.log('⚠️ [AI-CATALOG] No Shopify domain/token configured');
          }
        } else {
          console.log('⚠️ [AI-CATALOG] No Shopify credentials found');
        }

        // Fallback: load from local products table if no Shopify catalog loaded
        if (!productCatalog) {
          const { data: products, error: productsError } = await supabaseClient
            .from('products')
            .select(`
              name, sku, base_price, category,
              product_variants (size, color, stock_quantity)
            `)
            .eq('organization_id', organizationId)
            .eq('status', 'active')
            .limit(MAX_PRODUCTS);

          if (!productsError && products && products.length > 0) {
            productCatalog = '\n\n📦 CATÁLOGO (solo ofrece productos con stock>0):\n';

            products.forEach((p: any) => {
              const price = p.base_price ? `$${Number(p.base_price).toLocaleString('es-CO')}` : '?';
              const variants = p.product_variants
                ?.filter((v: any) => (v.stock_quantity || 0) > 0)
                .map((v: any) => `${v.size || ''}${v.color ? ' ' + v.color : ''}(${v.stock_quantity})`)
                .join(',') || 'sin stock';

              productCatalog += `${p.name}|${price}COP|${variants}\n`;
            });

            console.log(`📦 [AI-CATALOG] Loaded ${products.length} local products as fallback`);
          }
        }
      } catch (err) {
        console.error('❌ [AI-CATALOG] Error loading product catalog:', err);
      }
    }

    // Append product catalog to system prompt (with size guard)
    if (productCatalog) {
      const spaceLeft = MAX_SYSTEM_PROMPT_CHARS - systemPrompt.length;
      if (productCatalog.length > spaceLeft) {
        console.log(`⚠️ [AI-PROMPT] Catalog too large (${productCatalog.length}), trimming to fit ${spaceLeft} chars`);
        productCatalog = productCatalog.substring(0, spaceLeft - 50) + '\n... (catálogo recortado por espacio)';
      }
      systemPrompt += productCatalog;
    }

    console.log('📝 [AI-PROMPT] Final system prompt length:', systemPrompt.length, 'chars');

    // ========== 3. BUILD USER MESSAGE ==========
    let finalUserMessage = userMessage;
    if (mediaContext?.type === 'image' && mediaContext.url) {
      finalUserMessage = userMessage || `[El cliente envió una imagen]`;
      console.log(`🖼️ Imagen recibida: ${mediaContext.url}`);
    } else if (mediaContext?.type === 'audio') {
      finalUserMessage = userMessage || `[El cliente envió un audio/nota de voz]`;
    } else if (mediaContext?.type === 'sticker') {
      return '¡Lindo sticker! 😊 ¿En qué puedo ayudarte?';
    }

    // ========== 4. CALL MINIMAX ==========
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content || ''
      })),
    ];
    messages.push({ role: 'user', content: finalUserMessage });

    console.log('🤖 [AI-MINIMAX] Calling Minimax', {
      model: MINIMAX_MODEL,
      systemPromptLen: systemPrompt.length,
      messagesCount: messages.length,
      totalChars: JSON.stringify(messages).length,
    });

    const requestBody: any = {
      model: MINIMAX_MODEL,
      messages,
      max_tokens: 800,
      temperature: 0.7,
    };

    if (MINIMAX_GROUP_ID) {
      requestBody.group_id = String(MINIMAX_GROUP_ID);
    }

    const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('❌ [AI-MINIMAX] API error:', response.status, responseText);

      // FALLBACK: If the full prompt is too large, retry WITHOUT the catalog
      if (response.status === 400 || response.status === 413 || response.status === 422) {
        console.log('🔄 [AI-FALLBACK] Retrying without product catalog...');
        const fallbackPrompt = aiConfig?.systemPrompt || systemPrompt.substring(0, 2000);
        const fallbackMessages = [
          { role: 'system', content: fallbackPrompt },
          ...conversationHistory.slice(-5).map((msg: any) => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: msg.content || ''
          })),
          { role: 'user', content: finalUserMessage }
        ];

        const fallbackBody: any = {
          model: MINIMAX_MODEL,
          messages: fallbackMessages,
          max_tokens: 500,
          temperature: 0.7,
        };
        if (MINIMAX_GROUP_ID) fallbackBody.group_id = String(MINIMAX_GROUP_ID);

        const fallbackResponse = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MINIMAX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fallbackBody),
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const fallbackText = fallbackData.choices?.[0]?.message?.content || '';
          console.log('✅ [AI-FALLBACK] Got response:', fallbackText.substring(0, 80));
          return fallbackText;
        } else {
          console.error('❌ [AI-FALLBACK] Also failed:', fallbackResponse.status, await fallbackResponse.text());
          return '';
        }
      }
      return '';
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('❌ [AI-MINIMAX] Failed to parse response JSON:', responseText.substring(0, 200));
      return '';
    }

    // Handle Minimax response format
    let aiResponse = '';
    if (data.choices?.[0]?.message?.content) {
      aiResponse = data.choices[0].message.content;
    } else if (data.choices?.[0]?.message && typeof data.choices[0].message === 'string') {
      aiResponse = data.choices[0].message;
    } else if (data.choices?.[0]?.delta?.content) {
      aiResponse = data.choices[0].delta.content;
    } else if (data.reply) {
      aiResponse = data.reply;
    } else if (data.text) {
      aiResponse = data.text;
    } else if (data.response) {
      aiResponse = data.response;
    }

    if (!aiResponse) {
      console.error('❌ [AI-MINIMAX] No response text found in:', JSON.stringify(data).substring(0, 500));
      return '';
    }

    // Strip <think>...</think> blocks that some models include as internal reasoning
    aiResponse = aiResponse.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();

    console.log('✅ [AI-MINIMAX] Response received:', aiResponse.substring(0, 100));
    return aiResponse;
  } catch (error) {
    console.error('❌ [AI-ERROR] Unhandled error in generateAIResponse:', error);
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
      console.log('========== WHATSAPP WEBHOOK RECEIVED ==========', JSON.stringify(body, null, 2));

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

      // WhatsApp messages are now handled exclusively by whatsapp-webhook function
      // Skip here to prevent duplicate AI responses
      if (body.object === 'whatsapp_business_account') {
        console.log('⚠️ [meta-webhook] WhatsApp now handled by whatsapp-webhook. Skipping.');
        return new Response(JSON.stringify({ success: true, skipped: 'whatsapp handled by whatsapp-webhook' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // LEGACY: Original WhatsApp processing (disabled)
      if (false && body.object === 'whatsapp_business_account') {
        for (const entry of toArray(body.entry)) {
          for (const change of toArray(entry.changes)) {
            if (change.field === 'messages') {
              const value = change.value;
              const phoneNumberId = value.metadata?.phone_number_id;

              console.log('========== PROCESSING WHATSAPP MESSAGE ==========', { phoneNumberId });

              // Process incoming messages
              for (const message of toArray(value.messages)) {
                const contactPhone = message.from;
                const externalMessageId = message.id;
                const timestamp = new Date(parseInt(message.timestamp) * 1000);

                // Get contact name
                const contact = toArray(value.contacts)?.find((c: any) => c.wa_id === contactPhone);
                const contactName = contact?.profile?.name || contactPhone;

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
                const { data: exactChannel } = await supabase
                  .from('messaging_channels')
                  .select('*')
                  .eq('meta_phone_number_id', phoneNumberId)
                  .eq('channel_type', 'whatsapp')
                  .single();

                if (exactChannel) {
                  channel = exactChannel;
                } else {
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
                    // Actualizar el phone_number_id del canal existente
                    await supabase
                      .from('messaging_channels')
                      .update({ meta_phone_number_id: phoneNumberId })
                      .eq('id', dosmicoChannel.id);
                    channel = dosmicoChannel;
                  } else {
                    // 3. Crear nuevo canal para Dosmicos
                    const { data: newChannel, error: createError } = await supabase
                      .from('messaging_channels')
                      .insert({
                        organization_id: DEFAULT_ORG_ID,
                        channel_type: 'whatsapp',
                        channel_name: 'WhatsApp Business',
                        meta_phone_number_id: phoneNumberId,
                        is_active: true,
                        ai_enabled: true,
                        webhook_verified: true,
                        ai_config: {
                          systemPrompt: `Eres un asistente de ventas amigable para una tienda de artesanías colombianas. \nTu rol es:\n- Responder preguntas sobre productos disponibles\n- Proporcionar información de precios y disponibilidad\n- Ayudar a los clientes con sus pedidos\n- Ser amable y usar emojis ocasionalmente\n\nReglas importantes:\n- Siempre saluda al cliente\n- Si no sabes algo, ofrece conectar con un humano\n- Mantén respuestas concisas pero informativas`,
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
                } else {
                  // Update existing conversation with preview that includes media info
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

                // Fetch real media URL if there's a media ID
                let mediaUrl: string | null = null;
                let mediaError: string | undefined;
                if (mediaId) {
                  console.log(`📥 Processing media: ${mediaId} (type: ${messageType})`);
                  const mediaResult = await fetchMediaUrl(mediaId, messageType, conversation.id, supabase);
                  mediaUrl = mediaResult.url;
                  mediaMimeType = mediaResult.mimeType || mediaMimeType;
                  mediaError = mediaResult.error;
                }

                // Resolve reply_to_message_id from WAMID to internal UUID
                let resolvedReplyToId: string | null = null;
                if (replyToMessageId) {
                  console.log(`🔗 Resolving reply WAMID: ${replyToMessageId}`);
                  const { data: replyMsg } = await supabase
                    .from('messaging_messages')
                    .select('id')
                    .eq('external_message_id', replyToMessageId)
                    .limit(1)
                    .single();
                  if (replyMsg) {
                    resolvedReplyToId = replyMsg.id;
                    console.log(`✅ Resolved reply to internal UUID: ${resolvedReplyToId}`);
                  } else {
                    console.log(`⚠️ Reply parent not found in DB, setting reply_to_message_id to null`);
                  }
                }

                // Insert message (skip for reaction type)
                if (messageType !== 'reaction') {
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
                    // Generate AI response if AI is enabled (AUTO-RESPONDER)
                    // Re-read ai_config fresh from DB to pick up any changes
                    // (e.g. knowledgeBase saved from the UI after the channel was loaded)
                    let aiConfig = channel.ai_config as any;
                    try {
                      const { data: freshChannel } = await supabase
                        .from('messaging_channels')
                        .select('ai_config')
                        .eq('id', channel.id)
                        .single();
                      if (freshChannel?.ai_config) {
                        aiConfig = freshChannel.ai_config as any;
                      }
                    } catch (e) {
                      console.warn('Could not refresh ai_config, using cached version');
                    }

                    // If this channel has no knowledgeBase, try to find one from
                    // another WhatsApp channel in the same organization (covers the
                    // case where the UI saved knowledge to a different channel row).
                    if (!aiConfig?.knowledgeBase || (Array.isArray(aiConfig.knowledgeBase) && aiConfig.knowledgeBase.length === 0)) {
                      try {
                        const { data: otherChannels } = await supabase
                          .from('messaging_channels')
                          .select('ai_config')
                          .eq('organization_id', channel.organization_id)
                          .eq('channel_type', 'whatsapp')
                          .neq('id', channel.id);

                        const donor = otherChannels?.find((ch: any) => {
                          const cfg = ch.ai_config as any;
                          return cfg?.knowledgeBase && Array.isArray(cfg.knowledgeBase) && cfg.knowledgeBase.length > 0;
                        });

                        if (donor) {
                          const donorConfig = donor.ai_config as any;
                          console.log(`📚 Found knowledgeBase (${donorConfig.knowledgeBase.length} items) in another channel, merging`);
                          aiConfig = { ...aiConfig, knowledgeBase: donorConfig.knowledgeBase };

                          // Persist the merge so we don't have to do this lookup every time
                          await supabase
                            .from('messaging_channels')
                            .update({ ai_config: aiConfig })
                            .eq('id', channel.id);
                        }
                      } catch (e) {
                        console.warn('Could not check other channels for knowledgeBase');
                      }
                    }

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

                    console.log('🔍 [AUTO-REPLY CHECK]', {
                      aiEnabledOnChannel,
                      aiEnabledOnConversation,
                      autoReplyEnabled,
                      shouldAutoReply,
                      channelAiEnabled: channel.ai_enabled,
                      freshAiManaged: freshConv?.ai_managed,
                      convAiManaged: conversation.ai_managed,
                      aiConfigAutoReply: aiConfig?.autoReply,
                      conversationId: conversation.id,
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
                        if (!withinBusinessHours) {
                          console.log('⏰ [AUTO-REPLY] Outside business hours (Colombia time), skipping');
                        }
                      }
                      console.log('⏰ [AUTO-REPLY] businessHours config:', aiConfig?.businessHours, '| withinBusinessHours:', withinBusinessHours);

                      if (withinBusinessHours) {
                        // Apply response delay if configured
                        const responseDelay = parseInt(aiConfig?.responseDelay) || 0;
                        if (responseDelay > 0) {
                          await new Promise(resolve => setTimeout(resolve, responseDelay * 1000));
                        }

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
                          url: mediaUrl || undefined,
                        } : undefined;

                        // Validate that image URL is from Supabase Storage before sending to AI
                        if (mediaContext?.type === 'image' && mediaContext.url) {
                          const sbUrl = Deno.env.get('SUPABASE_URL') || '';
                          if (!mediaContext.url.includes(sbUrl) && !mediaContext.url.includes('supabase')) {
                            console.warn('⚠️ Image URL is not from Supabase Storage, skipping image analysis');
                            mediaContext.url = undefined;
                          }
                        }

                        console.log('🤖 [AUTO-REPLY] Generating AI response for message:', content?.substring(0, 50));

                        const aiResponse = await generateAIResponse(
                          content,
                          (historyMessages || []).reverse(),
                          aiConfig,
                          channel.organization_id,
                          supabase,
                          mediaContext
                        );

                        if (aiResponse) {
                          console.log('📤 [AUTO-REPLY] Sending AI response via WhatsApp:', aiResponse.substring(0, 80));
                          const sendResult = await sendWhatsAppMessage(phoneNumberId, contactPhone, aiResponse);

                          if (sendResult) {
                            console.log('✅ [AUTO-REPLY] WhatsApp message sent, wamid:', sendResult.messages?.[0]?.id);
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
                              console.error('❌ [AUTO-REPLY] Failed to save AI message to DB:', aiMsgError);
                            } else {
                              console.log('✅ [AUTO-REPLY] AI message saved to DB');
                              await supabase
                                .from('messaging_conversations')
                                .update({
                                  last_message_preview: aiResponse.substring(0, 100),
                                  last_message_at: new Date().toISOString(),
                                })
                                .eq('id', conversation.id);
                            }
                          } else {
                            console.error('❌ [AUTO-REPLY] sendWhatsAppMessage returned null/undefined');
                          }
                        } else {
                          console.error('❌ [AUTO-REPLY] generateAIResponse returned empty string - AI did NOT respond');
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
                const ts = new Date(parseInt(status.timestamp) * 1000);

                const updateData: any = {};
                if (statusType === 'delivered') updateData.delivered_at = ts.toISOString();
                if (statusType === 'read') updateData.read_at = ts.toISOString();

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

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (err: any) {
      console.error('Webhook POST handler error:', err);
      return new Response(JSON.stringify({ success: false, error: err?.message || 'Error interno' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
