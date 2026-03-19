import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extract ALL product IDs from AI response (up to 10)
function extractProductIdsFromResponse(aiResponse: string): number[] {
  const regex = /\[PRODUCT_IMAGE_ID:(\d+)\]/g;
  const ids: number[] = [];
  let match;
  while ((match = regex.exec(aiResponse)) !== null) {
    const id = parseInt(match[1], 10);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, 10); // Limit to 10 products max
}

// Remove product image tags from response
function cleanAIResponse(aiResponse: string): string {
  return aiResponse.replace(/\[PRODUCT_IMAGE_ID:\d+\]/g, '').replace(/\[NO_IMAGES\]/g, '').trim();
}

// Cache external image to Supabase Storage and return public URL
async function cacheImageToStorage(
  imageUrl: string,
  productId: number,
  organizationId: string,
  supabase: any
): Promise<string | null> {
  try {
    console.log(`Caching image for product ${productId}...`);
    
    // Fetch image from Shopify
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Check file size (max 10MB)
    if (uint8Array.length > 10 * 1024 * 1024) {
      console.error('Image too large, skipping cache');
      return imageUrl; // Return original URL as fallback
    }
    
    // Determine extension
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `products/${organizationId}/${productId}.${ext}`;
    
    // Upload to Supabase Storage with upsert
    const { error: uploadError } = await supabase.storage
      .from('messaging-media')
      .upload(path, uint8Array, {
        contentType,
        upsert: true
      });
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return imageUrl; // Return original URL as fallback
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('messaging-media')
      .getPublicUrl(path);
    
    const publicUrl = publicUrlData?.publicUrl;
    console.log(`Image cached successfully: ${publicUrl?.substring(0, 50)}...`);
    
    return publicUrl || imageUrl;
  } catch (err) {
    console.error('Error caching image:', err);
    return imageUrl; // Return original URL as fallback
  }
}

// Fetch product image from Shopify using organization credentials
async function fetchShopifyProductImage(
  productId: number, 
  shopifyCredentials: any
): Promise<string | null> {
  if (!shopifyCredentials) {
    console.log('No Shopify credentials provided');
    return null;
  }

  const storeDomain = shopifyCredentials.store_domain || shopifyCredentials.shopDomain;
  const accessToken = shopifyCredentials.access_token || shopifyCredentials.accessToken;

  if (!storeDomain || !accessToken) {
    console.log('Incomplete Shopify credentials');
    return null;
  }

  try {
    const cleanDomain = storeDomain.replace('.myshopify.com', '');
    const url = `https://${cleanDomain}.myshopify.com/admin/api/2024-01/products/${productId}.json`;
    
    console.log(`Fetching Shopify product image for ID: ${productId}`);
    
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Shopify API error:', response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.product?.image?.src || data.product?.images?.[0]?.src;
    
    if (imageUrl) {
      console.log(`Found Shopify image for product ${productId}`);
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Shopify product image:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, messages, systemPrompt, organizationId, conversationId } = body;
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    // Handle test-connection action - just verify API key exists without making calls
    if (action === 'test-connection') {
      console.log("messaging-ai-openai: Testing connection for org:", organizationId);
      
      if (!OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({ connected: false, error: "OPENAI_API_KEY is not configured" }), 
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Optionally verify the API key is valid by making a simple models list request
      try {
        const modelsResponse = await fetch("https://api.openai.com/v1/models", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
        });
        
        if (modelsResponse.ok) {
          return new Response(
            JSON.stringify({ connected: true, success: true }), 
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const errorText = await modelsResponse.text();
          console.error("OpenAI API key validation failed:", modelsResponse.status, errorText);
          return new Response(
            JSON.stringify({ connected: false, error: "API Key inválida" }), 
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (fetchError) {
        console.error("Error validating OpenAI API key:", fetchError);
        return new Response(
          JSON.stringify({ connected: false, error: "Error al validar API Key" }), 
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("messaging-ai-openai: Processing request for org:", organizationId);
    console.log("messaging-ai-openai: Messages received:", messages?.length || 0);
    console.log("messaging-ai-openai: User message:", messages?.[messages?.length - 1]?.content || 'none');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Load AI config (knowledge base, rules, etc.) from messaging_channels
    let knowledgeContext = '';
    let rulesContext = '';
    let savedSystemPrompt = '';
    let toneConfig = '';

    if (organizationId) {
      try {
        const { data: channel, error: channelError } = await supabase
          .from('messaging_channels')
          .select('ai_config')
          .eq('organization_id', organizationId)
          .eq('channel_type', 'whatsapp')
          .order('is_active', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (channelError) {
          console.error("Error loading channel config:", channelError);
        } else if (channel?.ai_config) {
          const aiConfig = channel.ai_config as any;
          
          // Get saved system prompt
          if (aiConfig.systemPrompt) {
            savedSystemPrompt = aiConfig.systemPrompt;
            console.log("Loaded saved system prompt");
          }

          // Get tone
          if (aiConfig.tone) {
            const toneMap: Record<string, string> = {
              'friendly': 'Usa un tono amigable y cercano. Puedes usar emojis ocasionalmente.',
              'formal': 'Usa un tono formal y respetuoso.',
              'casual': 'Usa un tono casual y relajado. Usa emojis libremente.',
              'professional': 'Usa un tono profesional y directo.'
            };
            toneConfig = toneMap[aiConfig.tone] || '';
            console.log("Loaded tone:", aiConfig.tone);
          }

          // Get rules
          if (aiConfig.rules?.length > 0) {
            rulesContext = '\n\n📋 REGLAS ESPECIALES:\n';
            aiConfig.rules.forEach((rule: any) => {
              if (rule.condition && rule.response) {
                rulesContext += `- Cuando el usuario mencione "${rule.condition}": ${rule.response}\n`;
              }
            });
            console.log(`Loaded ${aiConfig.rules.length} rules`);
          }

          // Get knowledge base
          if (aiConfig.knowledgeBase?.length > 0) {
            knowledgeContext = '\n\n📚 CONOCIMIENTO DE LA EMPRESA:\nUSA ESTA INFORMACIÓN para responder a las preguntas de los clientes:\n';
            aiConfig.knowledgeBase.forEach((item: any) => {
              if (item.category === 'product') {
                // Product knowledge
                const name = item.productName || item.title || '';
                if (name && item.content) {
                  knowledgeContext += `\n📦 Producto: ${name}`;
                  if (item.recommendWhen) {
                    knowledgeContext += `\n   Recomendar cuando: ${item.recommendWhen}`;
                  }
                  knowledgeContext += `\n   Detalles: ${item.content}\n`;
                }
              } else if (item.title && item.content) {
                // General knowledge (new format)
                knowledgeContext += `\n📋 ${item.title}:\n   ${item.content}\n`;
              } else if (item.question && item.answer) {
                // Legacy Q&A format
                knowledgeContext += `\nP: ${item.question}\nR: ${item.answer}\n`;
              }
            });
            console.log(`Loaded ${aiConfig.knowledgeBase.length} knowledge items`);
          }
        }
      } catch (err) {
        console.error("Error loading AI config:", err);
      }
    }

    // Load products with Shopify inventory if organizationId is provided
    let productCatalog = '';
    let allShopifyProducts: any[] = []; // Store for product ID validation
    let shopifyCredentials: any = null;
    let productImageMap: Record<number, { url: string; title: string }> = {}; // Map Shopify ID -> image URL + title
    
    if (organizationId) {
      try {
        // First, get connected product IDs from ai_catalog_connections
        const { data: connections } = await supabase
          .from('ai_catalog_connections')
          .select('shopify_product_id')
          .eq('organization_id', organizationId)
          .eq('connected', true);

        const connectedProductIds = new Set(connections?.map(c => c.shopify_product_id) || []);
        console.log(`Found ${connectedProductIds.size} connected products for AI`);

        // Get organization's Shopify credentials
        const { data: org } = await supabase
          .from('organizations')
          .select('shopify_credentials')
          .eq('id', organizationId)
          .single();

        shopifyCredentials = org?.shopify_credentials;

        interface ShopifyVariant {
          id: number;
          sku: string;
          title: string;
          price: string;
          inventory_quantity: number;
        }

        interface ShopifyProduct {
          id: number;
          title: string;
          body_html?: string;
          product_type?: string;
          variants: ShopifyVariant[];
          image?: { src: string };
          images?: { src: string }[];
        }
        
        // Fetch real-time inventory from Shopify if credentials exist
        if (shopifyCredentials) {
          const creds = shopifyCredentials as any;
          const shopifyDomain = creds.store_domain || creds.shopDomain;
          const accessToken = creds.access_token || creds.accessToken;
          
          if (shopifyDomain && accessToken) {
            try {
              console.log("Fetching Shopify products with inventory...");
              
              // Fetch products with inventory from Shopify
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
                const shopifyProducts: ShopifyProduct[] = shopifyData.products || [];
                
                // Filter to only connected products
                const connectedProducts = shopifyProducts.filter(
                  p => connectedProductIds.size === 0 || connectedProductIds.has(p.id)
                );
                
                if (connectedProducts.length > 0) {
                  allShopifyProducts = connectedProducts; // Store for validation
                  productCatalog = '\n\n📦 CATÁLOGO DE PRODUCTOS DISPONIBLES:\n';
                  productCatalog += 'IMPORTANTE: Solo ofrece productos que tengan stock disponible (Stock > 0). Si un producto no tiene stock, indica que está agotado.\n\n';
                  productCatalog += '⚠️ REGLA OBLIGATORIA DE IMÁGENES - DEBES SEGUIR ESTO SIEMPRE:\n';
                  productCatalog += 'CADA VEZ que menciones un producto por su nombre, DEBES agregar el tag [PRODUCT_IMAGE_ID:ID] inmediatamente después.\n';
                  productCatalog += 'Esto es OBLIGATORIO, no opcional. Los clientes esperan ver fotos de los productos.\n\n';
                  productCatalog += 'Formato correcto (SIEMPRE usa este formato):\n';
                  productCatalog += '"1. Ruana Caballo [PRODUCT_IMAGE_ID:8842923606251] - Precio: $94.900 COP"\n';
                  productCatalog += '"2. Ruana Capibara [PRODUCT_IMAGE_ID:8842934517995] - Precio: $94.900 COP"\n\n';
                  productCatalog += 'Formato INCORRECTO (NO hagas esto):\n';
                  productCatalog += '"1. Ruana Caballo - Precio: $94.900 COP" (falta el tag de imagen)\n\n';
                  productCatalog += 'Puedes incluir hasta 10 productos con imágenes en una sola respuesta.\n\n';
                  
                  connectedProducts.forEach((product) => {
                    const variants = product.variants || [];
                    const totalStock = variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0);
                    
                    // Store image URL and title in map
                    const imageUrl = product.image?.src || product.images?.[0]?.src;
                    if (imageUrl) {
                      productImageMap[product.id] = { url: imageUrl, title: product.title };
                    }
                    
                    // Skip products with no stock
                    if (totalStock === 0) {
                      productCatalog += `• ${product.title} (ID:${product.id}): ❌ AGOTADO (no ofrecer)\n`;
                      return;
                    }
                    
                    const price = variants[0]?.price 
                      ? `$${Number(variants[0].price).toLocaleString('es-CO')} COP` 
                      : 'Consultar';
                    
                    const variantInfo = variants
                      .map(v => {
                        const stock = v.inventory_quantity || 0;
                        const stockStatus = stock > 0 ? `✅ ${stock}` : '❌';
                        return `${v.title} (variantId:${v.id}, SKU:${v.sku || 'N/A'}): ${stockStatus}`;
                      })
                      .join(' | ');
                    
                    // Clean HTML from description
                    const cleanDescription = product.body_html 
                      ? product.body_html.replace(/<[^>]*>/g, '').substring(0, 100) 
                      : '';
                    
                    productCatalog += `\n• ${product.title} (ID:${product.id})`;
                    productCatalog += `\n  Precio: ${price}`;
                    productCatalog += `\n  Variantes: ${variantInfo}`;
                    if (product.product_type) {
                      productCatalog += `\n  Categoría: ${product.product_type}`;
                    }
                    if (cleanDescription) {
                      productCatalog += `\n  ${cleanDescription}`;
                    }
                    productCatalog += '\n';
                  });
                  
                  console.log(`Loaded ${connectedProducts.length} connected products with real-time Shopify inventory`);
                  console.log(`Product image map has ${Object.keys(productImageMap).length} entries`);
                }
              } else {
                console.error("Shopify API error:", shopifyResponse.status);
              }
            } catch (shopifyErr) {
              console.error("Error fetching Shopify products:", shopifyErr);
            }
          }
        }

        // Fallback to local products if no Shopify data
        if (!productCatalog) {
          const { data: products, error: productsError } = await supabase
            .from('products')
            .select(`
              name, 
              sku, 
              base_price, 
              category,
              description,
              product_variants (id, size, color, stock_quantity, sku_variant)
            `)
            .eq('organization_id', organizationId)
            .eq('status', 'active')
            .limit(50);

          if (!productsError && products && products.length > 0) {
            productCatalog = '\n\n📦 CATÁLOGO DE PRODUCTOS DISPONIBLES:\n';
            productCatalog += 'IMPORTANTE: Solo ofrece productos que tengan stock disponible.\n';
            
            products.forEach((p: any) => {
              const price = p.base_price 
                ? `$${Number(p.base_price).toLocaleString('es-CO')} COP` 
                : 'Precio: Consultar';
              
              const variants = p.product_variants
                ?.map((v: any) => {
                  const size = v.size || '';
                  const color = v.color || '';
                  const stock = v.stock_quantity || 0;
                  const stockStatus = stock > 0 ? `✅ ${stock} unidades` : '❌ Agotado';
                  return `${size}${color ? ` ${color}` : ''}: ${stockStatus}`;
                })
                .join(' | ') || 'Sin variantes';
              
              productCatalog += `\n• ${p.name}`;
              productCatalog += `\n  Precio: ${price}`;
              productCatalog += `\n  Disponibilidad: ${variants}`;
              productCatalog += '\n';
            });
            
            console.log(`Loaded ${products.length} local products for context`);
          }
        }
      } catch (err) {
        console.error("Error loading products:", err);
      }
    }

    // Build the full system prompt with all context
    // Priority: saved prompt > provided prompt > default
    const basePrompt = savedSystemPrompt || systemPrompt || "Eres un asistente virtual amigable. Responde siempre en español.";
    
    let fullSystemPrompt = basePrompt;

    // Add current date/time context so AI knows what day it is
    // IMPORTANT: Intl.DateTimeFormat with timeZone is UNRELIABLE in Deno/Supabase Edge Functions.
    // Use manual UTC-5 offset calculation instead (proven to work in meta-webhook).
    const now = new Date();
    const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000; // UTC-5 in milliseconds
    const colombiaTime = new Date(now.getTime() + COLOMBIA_OFFSET_MS + (now.getTimezoneOffset() * 60 * 1000));
    const colYear = colombiaTime.getFullYear();
    const colMonth = colombiaTime.getMonth() + 1; // 0-indexed → 1-indexed
    const colDay = colombiaTime.getDate();
    const colHour = String(colombiaTime.getHours()).padStart(2, '0');
    const colMinute = String(colombiaTime.getMinutes()).padStart(2, '0');
    const colWeekdayNum = colombiaTime.getDay(); // 0=Sunday, 1=Monday, ...

    const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const diaSemana = diasSemana[colWeekdayNum];
    const mes = meses[colMonth] || '';

    console.log(`📅 Colombia time (manual UTC-5): ${diaSemana} ${colDay} de ${mes} de ${colYear}, ${colHour}:${colMinute} (UTC now: ${now.toISOString()}, weekdayNum: ${colWeekdayNum})`);
    fullSystemPrompt += `\n\n📅 FECHA Y HORA ACTUAL (DATO VERIFICADO, SIEMPRE CORRECTO): Hoy es ${diaSemana} ${colDay} de ${mes} de ${colYear}, son las ${colHour}:${colMinute} (hora Colombia). ⚠️ IMPORTANTE: Si en mensajes anteriores de esta conversación se mencionó un día de la semana diferente, ESO ESTABA MAL. El día correcto es ${diaSemana.toUpperCase()}. Basa TODAS tus respuestas sobre despachos, entregas y disponibilidad en este dato.`;

    // Add smart product recommendation strategy
    fullSystemPrompt += '\n\n👕 GUÍA DE TALLAS RUANAS — OBLIGATORIO SEGUIR ESTA TABLA:\n⚠️ REGLA #1: El número de talla NO es igual a la edad. NUNCA asumas que "4 años = talla 4". SIEMPRE busca la edad en esta tabla:\n| Talla | Estatura     | Edad          |\n| 2     | 60-76 cm     | 3 a 12 meses  |\n| 4     | 77-88 cm     | 1 a 2 años    |\n| 6     | 90-100 cm    | 3 a 4 años    |\n| 8     | 100-110 cm   | 4 a 5 años    |\n| 10    | 115-123 cm   | 6 a 7 años    |\n| 12    | 125-133 cm   | 8 a 9 años    |\n\nREGLA #2: Si la edad está en el LÍMITE entre dos tallas, recomienda la talla MAYOR para que le dure más tiempo.\nREGLA #3: Si el cliente da edad Y estatura, prioriza la estatura para mayor precisión.\nREGLA #4: Si solo da edad, pregunta la estatura para ser más preciso, o recomienda según la tabla.\n\nEJEMPLOS DE RECOMENDACIÓN CORRECTA:\n- Bebé de 6 meses → Talla 2 (NO talla 6)\n- Niño de 1 año → Talla 4 (NO talla 1)\n- Niño de 2 años → Talla 4 (NO talla 2)\n- Niño de 3 años → Talla 6 (NO talla 3)\n- Niño de 4 años → Talla 8 (está en el límite 6/8, se recomienda la mayor)\n- Niño de 5 años → Talla 8 (NO talla 5)\n- Niño de 6 años → Talla 10 (NO talla 6)\n- Niño de 7 años → Talla 10 (NO talla 7)\n- Niño de 8 años → Talla 12 (NO talla 8)';

    fullSystemPrompt += '\n\n🔗 ESTRATEGIA DE RECOMENDACIÓN DE PRODUCTOS — MUY IMPORTANTE:\nCuando el cliente pregunte por productos de una CATEGORÍA o TALLA específica (ej: "ruanas talla 10", "sleeping bags talla 2"):\n- PRIMERO recomienda la talla adecuada si mencionan edad/estatura\n- LUEGO envía el LINK de la colección filtrada por talla desde tu base de conocimiento\n- NO envíes fotos individuales de cada producto, el link les permite ver TODOS los diseños\n- Agrega el tag [NO_IMAGES] al final de tu respuesta cuando envíes un link de colección\n\n🔗 REGLA OBLIGATORIA DE LINKS — NUNCA MODIFICAR URLs:\n- SIEMPRE copia el link EXACTO de tu base de conocimiento, carácter por carácter. NUNCA modifiques, reconstruyas ni inventes URLs.\n- NUNCA uses formato markdown para links. NO escribas [texto](url). WhatsApp NO soporta markdown.\n- Envía el link como texto plano en una línea separada.\n- Formato CORRECTO:\n  Aquí puedes ver los diseños disponibles en talla 2:\n  https://dosmicos.co/collections/ruanas?talla_custom=2+%283+-+12+meses%29\n- Formato INCORRECTO (NO hagas esto):\n  [Ruanas talla 2](https://dosmicos.co/collections/ruanas?talla_custom=2+%283+-+12+meses%29)\n- Si no encuentras el link exacto en tu base de conocimiento para una talla específica, indica al cliente que visite dosmicos.co y filtre por talla.\n\n🖼️ ENVÍO DE FOTOS INDIVIDUALES — SOLO CUANDO EL CLIENTE LAS PIDA:\n- SOLO incluye tags [PRODUCT_IMAGE_ID:ID] cuando el cliente EXPLÍCITAMENTE pida ver fotos de un producto específico\n- Si el cliente pregunta por un producto ESPECÍFICO por nombre, ahí sí puedes incluir la foto\n- Ejemplo: "Claro, aquí te muestro la Ruana Caballo [PRODUCT_IMAGE_ID:123]"\n- NUNCA digas que no puedes mostrar imágenes\n\n🎨 CONSULTAS POR COLOR U OTROS ATRIBUTOS — REGLA CRÍTICA:\n- Los productos de Dosmicos tienen SOLO variantes de TALLA (2, 4, 6, 8, 10, 12), NO variantes de color.\n- El color es parte del DISEÑO del producto. Ejemplo: "Ruana Unicornio" ES morada/lila por diseño, "Ruana Dinosaurio" ES verde, etc.\n- Cuando un cliente dice "unicornio morada", "la rosada", "el azul", está describiendo el producto por su apariencia visual. Busca el producto por NOMBRE (ignorando el color) y verifica la TALLA.\n- NUNCA digas que un producto "no está disponible" solo porque el cliente mencionó un color que no aparece como variante. Los colores NO son variantes.\n- Si no puedes identificar qué producto quiere por el color, pregunta cuál diseño/animal le interesa, o envía el link de la colección.';
    
    if (toneConfig) {
      fullSystemPrompt += `\n\n${toneConfig}`;
    }
    
    fullSystemPrompt += knowledgeContext;
    fullSystemPrompt += rulesContext;
    fullSystemPrompt += productCatalog;

    // Check for pending order confirmations in this conversation
    if (conversationId) {
      try {
        const { data: pendingConfirmations } = await supabase
          .from('order_confirmations')
          .select('order_number, status, customer_name')
          .eq('conversation_id', conversationId)
          .in('status', ['pending', 'confirmed'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (pendingConfirmations && pendingConfirmations.length > 0) {
          const pc = pendingConfirmations[0];
          fullSystemPrompt += `\n\n🚨 PEDIDO YA EXISTENTE EN ESTA CONVERSACIÓN — NO CREAR OTRO:
- Pedido #${pc.order_number} ya fue creado (estado: ${pc.status === 'pending' ? 'pendiente de confirmación del cliente' : 'confirmado'}).
- Si el cliente dice "SI", "confirmo", "ok", o cualquier afirmación, responde que su pedido #${pc.order_number} está confirmado y será despachado pronto.
- NUNCA llames create_order. El pedido YA EXISTE en Shopify.
- Si el cliente quiere CAMBIAR algo del pedido (dirección, producto, talla), dile que se comunique con un asesor.
- Si el cliente quiere hacer una compra COMPLETAMENTE DIFERENTE (otro producto adicional), ahí sí puedes proceder normalmente.`;
          console.log(`📋 Added pending order context: #${pc.order_number} (${pc.status})`);
        }
      } catch (err) {
        console.warn('Could not check pending confirmations:', err);
      }
    }

    // Add shipping policy (critical for correct order creation)
    fullSystemPrompt += `\n\n📦 POLÍTICA DE ENVÍOS DOSMICOS — DEBES calcular y agregar el costo de envío a CADA pedido:

ENVÍO GRATIS desde $150.000 en casi todo Colombia (excepto zonas remotas).

BOGOTÁ:
- Estándar: $3.000 (1-3 días hábiles) → GRATIS si pedido ≥ $150.000
- Express: $14.000 (12 horas) → NO aplica envío gratis, NO pago contra entrega, solo pago anticipado

MEDELLÍN Y RESTO DE ANTIOQUIA: $5.000 → GRATIS desde $150.000

ZONA 1 — $5.000 / GRATIS desde $150.000:
Atlántico, Bolívar, Boyacá, Caldas, Cauca, Cesar, Córdoba, Cundinamarca, Guaviare, Huila, Magdalena, Meta, Nariño, Norte de Santander, Putumayo, Quindío, Risaralda, Santander, Sucre, Tolima, Valle del Cauca

ZONA 2 — $6.000 / GRATIS desde $150.000:
Arauca, Caquetá, Casanare

ZONA 3 — $10.000 (SIN envío gratis):
La Guajira

ZONA 4 — $22.000 (SIN envío gratis):
Amazonas, Vaupés, Vichada

ZONA 5 — $30.000 (SIN envío gratis):
Guainía, Archipiélago de San Andrés, Providencia y Santa Catalina

REGLAS OBLIGATORIAS PARA CREAR PEDIDOS:
1. SIEMPRE preguntar la ciudad y departamento ANTES de crear el pedido
2. Calcular el costo de envío según la zona del departamento
3. Si el total de productos ≥ $150.000 Y la zona aplica envío gratis → shippingCost = 0
4. ⚠️ CRÍTICO — FLUJO OBLIGATORIO EN 2 PASOS:
   PASO 1: ANTES de llamar create_order, envía UN MENSAJE al cliente con el desglose completo:
   - Producto(s) y precio(s)
   - Costo de envío según la zona (ej: "Envío estándar Bogotá: $3.000")
   - Total final (productos + envío)
   - Pregunta: "¿Confirmas el pedido?"
   PASO 2: SOLO después de que el cliente CONFIRME, llama create_order con el shippingCost correcto.
   NUNCA llames create_order en el mismo turno que presentas el desglose. SIEMPRE espera confirmación.
5. Express Bogotá: NO acepta pago contra entrega, debe pagar anticipadamente
6. Pasar el campo shippingCost con el valor correcto al llamar create_order (DEBE coincidir con lo que le mostraste al cliente en el desglose)
7. Si el cliente NO especifica express, asumir envío estándar
8. URGENCIA EN BOGOTÁ: Si el cliente menciona que necesita el pedido rápido, urgente, para un evento próximo (baby shower, cumpleaños, etc.), o en general expresa prisa → SIEMPRE ofrecer el envío EXPRESS ($14.000, entrega en 12 horas) como opción además del estándar. Explicar las diferencias para que el cliente elija.

⚠️ REGLA CRÍTICA SOBRE PRECIOS Y ENVÍO — NO CAMBIAR NUNCA EL CÁLCULO:
- El total SIEMPRE es: precio del producto + costo de envío. El link de pago NO tiene costo adicional.
- Si el cliente pregunta "¿por qué cobran más?", "¿los 3.000 son por el link?", "aquí dice otro precio", SIEMPRE explica que el monto adicional es el COSTO DE ENVÍO, no un cargo extra del link de pago.
- Ejemplo de respuesta correcta: "Los $3.000 adicionales son el costo de envío estándar a Bogotá. El link de pago no tiene ningún cargo adicional. 😊"
- NUNCA digas que el envío es gratis si el total de productos es MENOR a $150.000. Haz la comparación correcta: $114.900 es MENOR que $150.000, por lo tanto NO aplica envío gratis.
- NUNCA te contradigas ni cambies el precio que ya calculaste solo porque el cliente lo cuestione. Si tu cálculo original era correcto, defiéndelo y explícalo.
- Si cometiste un error real, corrígelo UNA VEZ y no vuelvas a cambiar.`;

    // Add image handling rules
    fullSystemPrompt += `\n\n📸 CUANDO EL CLIENTE ENVÍA IMÁGENES — REGLA CRÍTICA:
- TÚ SÍ PUEDES TOMAR PEDIDOS. NUNCA digas "no puedo tomar pedidos por aquí" ni nada similar. Tu función principal ES crear pedidos.
- Si el cliente envía una imagen o screenshot de productos (de la tienda, Instagram, etc.), analiza la imagen para identificar qué productos quiere.
- Si puedes reconocer los productos en la imagen, menciónalos por nombre y pregunta la talla y cantidad.
- Si NO puedes identificar los productos en la imagen, pregunta amablemente: "¡Qué lindos productos! ¿Me podrías decir el nombre del producto o diseño que te interesa y la talla que necesitas? Así te ayudo a crear tu pedido. 😊"
- NUNCA respondas que no puedes ayudar. SIEMPRE intenta avanzar hacia la venta.`;

    // Add size/talla validation rules
    fullSystemPrompt += `\n\n👕 REGLA DE TALLAS — OBLIGATORIO ANTES DE CREAR PEDIDO:
1. NUNCA crear un pedido sin confirmar la talla/variante con el cliente
2. Si el producto tiene variantes/tallas (aparecen en el catálogo como "Talla X (variantId:123, SKU:ABC)"), SIEMPRE preguntar cuál quiere ANTES de crear el pedido
3. Si el cliente dice solo la edad del bebé/niño, recomienda la talla apropiada y CONFIRMA con el cliente antes de proceder
4. Al llamar create_order, SIEMPRE incluye el SKU de la variante elegida (aparece en el catálogo como "SKU:XXX"). El SKU es ÚNICO por variante y es el identificador más confiable.
5. Usa el variantId Y el SKU correctos del catálogo al llamar create_order
6. Si el cliente no menciona talla y el producto tiene múltiples tallas, PREGUNTA antes de continuar
7. Si el producto solo tiene una variante (ej: "Default Title"), puedes usar esa directamente sin preguntar
8. FLUJO CORRECTO: Recopilar datos del cliente → Preguntar talla → Confirmar pedido → Crear pedido con variantId + SKU correctos`;

    // Add data collection rules for orders (cedula + no IDs)
    fullSystemPrompt += `\n\n🆔 REGLA DE DATOS PARA PEDIDOS — OBLIGATORIO:
- NUNCA pidas al cliente el ID del producto ni el variantId, ellos NO conocen estos datos técnicos
- TÚ debes identificar el productId y variantId del catálogo usando el NOMBRE del producto que el cliente menciona
- Ejemplo: si dice "quiero la ruana del caballo talla M", busca "Ruana Caballo" en el catálogo, usa su ID y el variantId de Talla M
- SIEMPRE pide la cédula de ciudadanía del cliente antes de crear el pedido

📝 DATOS OBLIGATORIOS que debes recopilar antes de crear un pedido:
1. Nombre completo
2. Cédula de ciudadanía
3. Correo electrónico
4. Teléfono
5. Dirección completa
6. Ciudad y departamento
7. Producto y talla confirmados (TÚ resuelves los IDs internamente del catálogo, NUNCA se los pidas al cliente)
8. Método de pago (link de pago o contra entrega) — SIEMPRE preguntar antes de crear el pedido`;

    // Add order status lookup instructions
    fullSystemPrompt += `\n\n📋 CONSULTA DE ESTADO DE PEDIDOS:
- Si el cliente pregunta por el estado de su pedido, envío o compra, usa la función lookup_order_status
- PRIMERO pide al cliente su número de pedido O el correo electrónico con el que hizo la compra
- Si el cliente no proporciona ninguno de los dos, PREGUNTA antes de buscar
- Muestra toda la información relevante: estado de pago, estado de envío, y tracking si existe
- Si hay número de seguimiento, compártelo junto con la transportadora
- Sé empático y claro al comunicar el estado del pedido`;

    // Add payment method rules
    fullSystemPrompt += `\n\n💳 REGLA DE MÉTODO DE PAGO — OBLIGATORIO ANTES DE CREAR PEDIDO:
1. SIEMPRE preguntar al cliente cómo desea pagar ANTES de crear el pedido
2. Ofrecer SOLO estas dos opciones:
   - 📲 Link de pago (pago online con tarjeta, PSE, Nequi, Daviplata, etc.)
   - 💵 Contra entrega (pago en efectivo al recibir el pedido)
3. NO crear el pedido hasta que el cliente haya elegido su método de pago
4. Si el cliente elige "contra entrega", pasar paymentMethod="contra_entrega" al llamar create_order
5. Si el cliente elige "link de pago" o pago online, pasar paymentMethod="link_de_pago" al llamar create_order
6. NUNCA asumir el método de pago, SIEMPRE preguntar`;

    // Add multi-product order rules
    fullSystemPrompt += `\n\n📦 REGLA DE PEDIDOS CON MÚLTIPLES PRODUCTOS — CRÍTICO, OBLIGATORIO:
1. Cuando el cliente pide VARIOS productos, SIEMPRE crea UN SOLO pedido con TODOS los productos en el array "lineItems".
2. NUNCA llames create_order múltiples veces para el mismo pedido. Incluye TODOS los productos en UNA SOLA llamada.
3. Ejemplo: Si el cliente pide "Ruana de Mico talla 4 y Ruana de Canguro talla 4", llama create_order UNA VEZ con lineItems que contenga ambos productos.`;

    // Add anti-duplication order rules
    fullSystemPrompt += `\n\n🚫 REGLA ANTI-DUPLICACIÓN DE PEDIDOS — CRÍTICO, OBLIGATORIO:
1. NUNCA crees un pedido duplicado. Si en el historial de esta conversación ya existe un mensaje tuyo que confirma la creación de un pedido (ej: "Tu pedido ha sido creado exitosamente", "Número de pedido: #") o ya enviaste un LINK DE PAGO, NO llames create_order de nuevo.
2. Si el cliente responde "SI", "Sí", "OK", "Gracias", "Perfecto", "Dale", "Listo", "Bueno" o CUALQUIER confirmación simple después de que ya se creó un pedido o se envió un link de pago, NO crees otro pedido. Solo responde amablemente confirmando que su pedido está en proceso.
3. Solo crea un NUEVO pedido si el cliente EXPLÍCITAMENTE pide un producto DIFERENTE o dice claramente que quiere hacer OTRA compra adicional.
4. Si recibes un mensaje que parece ser una respuesta automática de otra empresa/negocio (ej: "Gracias por comunicarte con X empresa"), ignóralo y NO crees un pedido.
5. Antes de llamar create_order, SIEMPRE verifica en el historial de la conversación si ya creaste un pedido o enviaste un link de pago. Si ya hay uno, NO crees otro.

⚠️ REGLA CRÍTICA SOBRE LINKS DE PAGO:
- Si ya enviaste un link de pago (ej: "TU LINK DE PAGO: https://checkout.bold.co/..."), el pedido se crea AUTOMÁTICAMENTE cuando el cliente paga. NO necesitas llamar create_order de nuevo.
- Si el cliente dice "ya pagué", "pago realizado", "listo el pago", o envía un comprobante de pago, NUNCA llames create_order. Responde: "¡Gracias! Tu pago está siendo procesado. En unos momentos recibirás la confirmación de tu pedido con el número de orden. 😊"
- Si el cliente pregunta por su pedido después de pagar, dile que su pago está siendo procesado y que recibirá confirmación pronto.
- NUNCA generes un segundo link de pago para el mismo pedido.`;

    // Add final reminder at the end of prompt (recency effect - models pay more attention to end)
    fullSystemPrompt += '\n\n🔔 RECORDATORIO FINAL:\n- ⚠️ PRECIOS — REGLA CRÍTICA: SIEMPRE tienes los precios de TODOS los productos en tu catálogo. NUNCA digas "no tengo esa información" sobre precios. Si el cliente pregunta "qué precio tiene" o "cuánto cuesta", busca el producto en el catálogo arriba y responde con el precio. Todos los precios están en COP. Si el cliente pregunta el precio después de que enviaste un link de colección, indica el precio general de la categoría (ej: "Las ruanas tienen un precio de $94.900 COP") o lista los precios si varían.\n- Para consultas de CATEGORÍA o TALLA: envía el LINK de la colección filtrada, NO fotos individuales. Agrega [NO_IMAGES] al final.\n- Para consultas de un PRODUCTO ESPECÍFICO o cuando el cliente PIDA fotos: incluye [PRODUCT_IMAGE_ID:ID].\n- NUNCA crear un pedido sin preguntar la talla si el producto tiene múltiples variantes/tallas.\n- SIEMPRE pasar el variantId Y el SKU correctos del catálogo al crear el pedido. El SKU es único por variante y es el más confiable.\n- NUNCA pidas IDs de producto al cliente. Resuelve productId, variantId y SKU del catálogo internamente.\n- SIEMPRE pide la cédula de ciudadanía antes de crear el pedido.\n- Si preguntan por un pedido, usa lookup_order_status con el número de pedido o correo.\n- LINKS: SIEMPRE copia el URL EXACTO de tu base de conocimiento. NUNCA uses formato markdown [texto](url). Envía los links como texto plano.\n- ⚠️ CRÍTICO al llamar create_order: El campo productName debe ser el nombre EXACTO del catálogo, productId/variantId deben corresponder a ESE producto, y el SKU debe ser el de la variante elegida. NUNCA confundas IDs de un producto con otro. El SKU es el identificador más confiable.\n- ⚠️ ANTI-DUPLICACIÓN: Si ya creaste un pedido O enviaste un link de pago en esta conversación, NO llames create_order de nuevo. Si el cliente dice "ya pagué" o "pago realizado", responde que su pago está siendo procesado, NUNCA generes otro link.\n- ⚠️ MÚLTIPLES PRODUCTOS: Si el cliente pide varios productos, incluye TODOS en el array lineItems en UNA SOLA llamada a create_order. NUNCA hagas múltiples llamadas.';

    console.log("Full system prompt length:", fullSystemPrompt.length);
    console.log("Calling OpenAI GPT-4o-mini with", messages?.length || 0, "messages");

    // Function definitions for order creation and payment
    const functions = [
      {
        name: "create_order",
        description: "Crea UN SOLO pedido en Shopify con TODOS los productos que el cliente quiere comprar. SIEMPRE incluye TODOS los productos en el array lineItems en UNA SOLA llamada. NUNCA llames esta función múltiples veces para el mismo pedido.",
        parameters: {
          type: "object",
          properties: {
            customerName: { type: "string", description: "Nombre completo del cliente" },
            cedula: { type: "string", description: "Número de cédula de ciudadanía del cliente" },
            email: { type: "string", description: "Correo electrónico del cliente" },
            phone: { type: "string", description: "Número de teléfono del cliente" },
            address: { type: "string", description: "Dirección de envío completa" },
            city: { type: "string", description: "Ciudad de envío" },
            department: { type: "string", description: "Departamento de envío" },
            neighborhood: { type: "string", description: "Barrio (opcional)" },
            lineItems: {
              type: "array",
              description: "Lista de TODOS los productos del pedido. Incluye TODOS los productos en este array. NUNCA hagas múltiples llamadas a create_order.",
              items: {
                type: "object",
                properties: {
                  productId: { type: "number", description: "ID numérico del producto en Shopify. Obtener del catálogo." },
                  productName: { type: "string", description: "Nombre EXACTO del producto tal como aparece en el catálogo." },
                  variantId: { type: "number", description: "ID numérico del variante/talla en Shopify. Obtener del catálogo." },
                  variantName: { type: "string", description: "Nombre de la talla/variante elegida." },
                  sku: { type: "string", description: "SKU único de la variante elegida. Obtener del catálogo (ej: SKU:RUANA-POLLITO-4). Es el identificador más confiable para la variante." },
                  quantity: { type: "number", description: "Cantidad de este producto (default 1)" }
                },
                required: ["productId", "productName", "variantId", "variantName", "sku"]
              },
              minItems: 1
            },
            notes: { type: "string", description: "Notas adicionales (opcional)" },
            shippingCost: { type: "number", description: "Costo de envío en COP calculado según la política de envíos. Si aplica envío gratis (pedido ≥$150.000 en zonas elegibles), pasar 0." },
            paymentMethod: { type: "string", enum: ["link_de_pago", "contra_entrega"], description: "Método de pago elegido por el cliente. 'link_de_pago' genera un link de pago online. 'contra_entrega' es pago contra entrega (COD)." }
          },
          required: ["customerName", "cedula", "email", "phone", "address", "city", "department", "lineItems", "shippingCost", "paymentMethod"]
        }
      },
      {
        name: "create_payment_link",
        description: "Crea un link de pago con Bold después de que se haya creado un pedido. Usa esta función SOLO después de haber creado el pedido.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Monto total del pedido en pesos colombianos (COP)" },
            description: { type: "string", description: "Descripción del pago (ej: Pedido #123 - Dosmicos)" },
            customerEmail: { type: "string", description: "Correo electrónico del cliente" },
            orderId: { type: "number", description: "ID del pedido en Shopify (opcional)" }
          },
          required: ["amount", "description", "customerEmail"]
        }
      },
      {
        name: "lookup_order_status",
        description: "Busca el estado de un pedido existente por número de pedido o correo electrónico del cliente. Devuelve estado de pago, envío y tracking si existe.",
        parameters: {
          type: "object",
          properties: {
            orderNumber: { type: "string", description: "Número de pedido (ej: 1234 o #1234)" },
            email: { type: "string", description: "Correo electrónico del cliente para buscar su pedido más reciente" }
          }
        }
      }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...(messages || []),
        ],
        functions: functions,
        function_call: "auto",
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes de OpenAI excedido. Intenta en unos segundos." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "API key de OpenAI inválida." }), 
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Error en el servicio de OpenAI" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // Check if AI wants to call a function
    const functionCall = data.choices?.[0]?.message?.function_call;
    
    if (functionCall) {
      console.log("AI wants to call function:", functionCall.name);
      
      if (functionCall.name === "create_order") {
        try {
          const orderArgs = JSON.parse(functionCall.arguments);
          const paymentMethod = orderArgs.paymentMethod || 'link_de_pago';
          console.log("Creating order with args:", orderArgs, "Payment method:", paymentMethod);

          // Build lineItems array - support both new format (lineItems) and legacy single-product format
          let lineItems: Array<{productId: number; productName: string; variantId: number; variantName: string; sku?: string; quantity: number}> = [];

          if (orderArgs.lineItems && Array.isArray(orderArgs.lineItems) && orderArgs.lineItems.length > 0) {
            lineItems = orderArgs.lineItems;
          } else if (orderArgs.productId) {
            // Legacy single-product format - convert to lineItems
            lineItems = [{
              productId: orderArgs.productId,
              productName: orderArgs.productName || '',
              variantId: orderArgs.variantId,
              variantName: orderArgs.variantName || '',
              quantity: orderArgs.quantity || 1
            }];
          }

          if (lineItems.length === 0) {
            console.error("❌ No line items provided in order");
            return new Response(
              JSON.stringify({
                response: "Lo siento, hubo un error al crear tu pedido. No se encontraron productos. Por favor intenta de nuevo.",
                order_created: false,
                error: "No line items"
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // 🛡️ SKU-FIRST PRODUCT RESOLUTION: SKU is the UNIQUE identifier per variant.
          // The AI gets names right but may confuse IDs between similar products (e.g., "Ruana Mapache" vs "Ruana Mapache Adulto").
          // ALWAYS resolve by SKU first (searches across ALL products), then fall back to name matching.
          const normalizeForMatch = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

          const scoreProductMatch = (catalogTitle: string, aiName: string): number => {
            const a = normalizeForMatch(catalogTitle);
            const b = normalizeForMatch(aiName);
            if (a === b) return 100;
            if (a.includes(b) || b.includes(a)) return 80;
            const aWords = a.split(/\s+/).filter(w => w.length > 2);
            const bWords = b.split(/\s+/).filter(w => w.length > 2);
            if (bWords.length === 0) return 0;
            const matches = bWords.filter(bw => aWords.some(aw => aw.includes(bw) || bw.includes(aw)));
            return Math.round((matches.length / bWords.length) * 70);
          };

          for (const item of lineItems) {
            if (allShopifyProducts.length === 0) continue;

            const origPid = item.productId;
            const origVid = item.variantId;
            const origSku = item.sku;

            // ========== PRODUCTNAME + VARIANTNAME RESOLUTION ==========
            // The AI confirms the correct product name and size/talla to the customer,
            // but sends WRONG IDs, SKUs, and variantIds. NEVER trust AI-provided IDs or SKUs.
            // ALWAYS resolve from productName + variantName (the only reliable fields).

            if (!item.productName) {
              console.warn(`⚠️ No productName for item. Keeping AI-provided IDs (pid:${item.productId}, vid:${item.variantId}).`);
              continue;
            }

            // Step 1: Find product by name
            let bestProduct: any = null;
            let bestScore = 0;

            for (const p of allShopifyProducts) {
              const score = scoreProductMatch(p.title, item.productName);
              if (score > bestScore) {
                bestScore = score;
                bestProduct = p;
              }
            }

            if (!bestProduct || bestScore < 50) {
              console.warn(`⚠️ No product match found for "${item.productName}" (best score: ${bestScore}). Keeping AI-provided IDs.`);
              continue;
            }

            const pidChanged = bestProduct.id !== item.productId;
            if (pidChanged) {
              console.log(`🔄 NAME-RESOLVED product: AI said "${item.productName}" (pid:${item.productId}) → catalog "${bestProduct.title}" (pid:${bestProduct.id}) [score:${bestScore}]`);
            } else {
              console.log(`✅ Product confirmed by name: "${bestProduct.title}" (pid:${bestProduct.id}) [score:${bestScore}]`);
            }
            item.productId = bestProduct.id;

            // Step 2: Resolve variant within matched product
            const variants = bestProduct.variants || [];
            if (variants.length <= 1) {
              if (variants.length === 1) {
                item.variantId = variants[0].id;
                item.sku = variants[0].sku || '';
                console.log(`  ✅ Single variant: ${variants[0].title} (vid:${variants[0].id}, SKU:${variants[0].sku})`);
              }
              continue;
            }

            // Extract size number from variantName (the ONLY reliable variant identifier)
            const sizeMatch = (item.variantName || '').match(/(\d+)/);
            let resolvedVariant: any = null;

            if (sizeMatch) {
              const targetSize = sizeMatch[1];

              // First try: exact size number match at the START of variant title
              // This prevents "4" matching "14" or "4" matching "Talla 4 - 6 años" incorrectly
              resolvedVariant = variants.find((v: any) => {
                const vTitle = (v.title || '').trim();
                // Match if variant title starts with the size number (e.g., "4 (1 a 2 años)")
                // or is exactly the number, or matches "Talla X" pattern
                const vSizeMatch = vTitle.match(/^(\d+)/);
                return vSizeMatch && vSizeMatch[1] === targetSize;
              });

              // Second try: any number in the variant title that matches
              if (!resolvedVariant) {
                resolvedVariant = variants.find((v: any) => {
                  const vTitle = (v.title || '').trim();
                  // Split all numbers from variant title and check for exact match
                  const allNumbers = vTitle.match(/\d+/g) || [];
                  // The FIRST number in the title is the size (e.g., "4 (1 a 2 años)" → 4, not 1 or 2)
                  return allNumbers.length > 0 && allNumbers[0] === targetSize;
                });
              }

              if (resolvedVariant) {
                const vidChanged = String(resolvedVariant.id) !== String(origVid);
                console.log(`  ${vidChanged ? '🔄' : '✅'} SIZE-RESOLVED variant: AI said "${item.variantName}" (vid:${origVid}) → "${resolvedVariant.title}" (vid:${resolvedVariant.id}, SKU:${resolvedVariant.sku})${vidChanged ? ' [CORRECTED]' : ''}`);
              }
            }

            // Fallback: name-based variant match
            if (!resolvedVariant && item.variantName) {
              const aiVariant = normalizeForMatch(item.variantName);
              resolvedVariant = variants.find((v: any) => {
                const vTitle = normalizeForMatch(v.title);
                return vTitle.includes(aiVariant) || aiVariant.includes(vTitle);
              });
              if (resolvedVariant) {
                console.log(`  🔄 NAME-RESOLVED variant: "${item.variantName}" → "${resolvedVariant.title}" (vid:${resolvedVariant.id}, SKU:${resolvedVariant.sku})`);
              }
            }

            if (resolvedVariant) {
              item.variantId = resolvedVariant.id;
              // ALWAYS set SKU from the resolved variant, never trust AI-provided SKU
              item.sku = resolvedVariant.sku || '';
            } else {
              console.warn(`  ⚠️ Could not resolve variant "${item.variantName}" for "${bestProduct.title}". Available: ${variants.map((v: any) => `"${v.title}"(vid:${v.id})`).join(', ')}. Keeping AI variantId ${item.variantId}.`);
            }

            // Log summary if anything changed
            if (item.productId !== origPid || String(item.variantId) !== String(origVid) || item.sku !== origSku) {
              console.log(`  📋 RESOLUTION SUMMARY: pid:${origPid}→${item.productId}, vid:${origVid}→${item.variantId}, sku:${origSku}→${item.sku}`);
            }
          }

          console.log(`📦 Processing order with ${lineItems.length} line item(s):`, lineItems.map(i => `${i.productName} (pid:${i.productId}, vid:${i.variantId}, sku:${i.sku || 'N/A'})`).join(', '));

          let responseText = '';
          let paymentUrl = '';

          // ======= SHIPPING COST: Calculate server-side but respect express shipping from AI =======
          const rawAiShipping = Number(orderArgs.shippingCost) || 0;
          console.log(`  📦 SHIPPING DEBUG: AI sent shippingCost="${rawAiShipping}" (type=${typeof orderArgs.shippingCost})`);

          // Helper: find variant price with fallback
          const getVariantPrice = (item: any): number => {
            const product = allShopifyProducts.find((p: any) => p.id === item.productId);
            if (!product) {
              console.warn(`  ⚠️ Product ${item.productId} (${item.productName}) NOT found in allShopifyProducts`);
              return 0;
            }
            // Try exact variant match first
            const variant = product.variants?.find((v: any) => String(v.id) === String(item.variantId));
            if (variant?.price) {
              return Number(variant.price);
            }
            // Fallback: try matching variant by name/size
            if (item.variantName) {
              const variantByName = product.variants?.find((v: any) => {
                const vTitle = (v.title || '').toLowerCase();
                const aiVariant = item.variantName.toLowerCase();
                return vTitle.includes(aiVariant) || aiVariant.includes(vTitle);
              });
              if (variantByName?.price) {
                console.log(`  🔄 Variant price fallback by name: "${item.variantName}" → variant ${variantByName.id} @ $${variantByName.price}`);
                return Number(variantByName.price);
              }
            }
            // Last fallback: use first variant price (all variants usually same price)
            if (product.variants?.length > 0 && product.variants[0]?.price) {
              console.log(`  🔄 Variant price fallback: using first variant of "${product.title}" @ $${product.variants[0].price}`);
              return Number(product.variants[0].price);
            }
            console.warn(`  ⚠️ Could not find ANY price for product ${item.productId} (${item.productName})`);
            return 0;
          };

          // Calculate product total for shipping determination
          let productTotalForShipping = 0;
          for (const item of lineItems) {
            const price = getVariantPrice(item);
            productTotalForShipping += price * (item.quantity || 1);
          }
          console.log(`  💵 Product total for shipping calc: $${productTotalForShipping}`);

          // 🏙️ Bogotá D.C. correction: AI often sends "Cundinamarca" for Bogotá, but Bogotá is its own district
          const normalizedCity = (orderArgs.city || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          if (normalizedCity === 'bogota' || normalizedCity === 'bogota d.c.' || normalizedCity === 'bogota dc') {
            if ((orderArgs.department || '').toLowerCase().includes('cundinamarca')) {
              console.log(`🏙️ Bogotá correction: department "${orderArgs.department}" → "Bogotá D.C."`);
              orderArgs.department = 'Bogotá D.C.';
            }
            // Also normalize the city name
            orderArgs.city = 'Bogotá';
          }

          // Always calculate shipping from department
          let calculatedShippingCost = 0;
          const dept = (orderArgs.department || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const city = (orderArgs.city || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

          const shippingZones: Record<string, number> = {
            'bogota': 3000, 'antioquia': 5000,
            'atlantico': 5000, 'bolivar': 5000, 'boyaca': 5000, 'caldas': 5000, 'cauca': 5000,
            'cesar': 5000, 'cordoba': 5000, 'cundinamarca': 5000, 'guaviare': 5000, 'huila': 5000,
            'magdalena': 5000, 'meta': 5000, 'narino': 5000, 'norte de santander': 5000,
            'putumayo': 5000, 'quindio': 5000, 'risaralda': 5000, 'santander': 5000,
            'sucre': 5000, 'tolima': 5000, 'valle del cauca': 5000,
            'arauca': 6000, 'caqueta': 6000, 'casanare': 6000,
            'la guajira': 10000, 'guajira': 10000,
            'amazonas': 22000, 'vaupes': 22000, 'vichada': 22000,
            'guainia': 30000, 'san andres': 30000, 'san andres y providencia': 30000,
            'archipielago de san andres': 30000, 'providencia': 30000,
          };

          const noFreeShippingZones = ['la guajira', 'guajira', 'amazonas', 'vaupes', 'vichada', 'guainia', 'san andres', 'san andres y providencia', 'archipielago de san andres', 'providencia'];

          // Check Bogotá first (city or department)
          const isBogota = city.includes('bogota') || dept.includes('bogota');
          const matchedZone = isBogota ? 'bogota' : Object.keys(shippingZones).find(zone => dept.includes(zone));

          // Check if AI is requesting express shipping (Bogotá express = $14,000)
          const isExpressRequest = isBogota && rawAiShipping === 14000;

          if (isExpressRequest) {
            // AI confirmed express shipping with the customer — respect it
            calculatedShippingCost = 14000;
            console.log(`  🚀 EXPRESS shipping: Bogotá express $14,000 (AI confirmed with customer)`);
          } else if (matchedZone) {
            const isNoFreeShipping = noFreeShippingZones.some(z => dept.includes(z));

            if (productTotalForShipping >= 150000 && !isNoFreeShipping) {
              calculatedShippingCost = 0;
              console.log(`  🎉 Free shipping: product total $${productTotalForShipping} >= $150,000`);
            } else {
              calculatedShippingCost = shippingZones[matchedZone];
              console.log(`  📦 Standard shipping: $${calculatedShippingCost} (product total $${productTotalForShipping} < $150,000, zone="${matchedZone}")`);
            }
          } else {
            calculatedShippingCost = 5000;
            console.log(`  ⚠️ No zone match for dept="${orderArgs.department}", city="${orderArgs.city}", using default $5,000`);
          }

          // Safety check: if AI sent a valid shipping cost that's higher than standard (e.g., remote zones),
          // and it's within a reasonable range, respect it
          if (!isExpressRequest && rawAiShipping > calculatedShippingCost && rawAiShipping <= 30000) {
            console.log(`  🔄 AI shipping ($${rawAiShipping}) > calculated ($${calculatedShippingCost}). Using AI value (may be express or remote zone).`);
            calculatedShippingCost = rawAiShipping;
          }
          console.log(`  📦 FINAL calculatedShippingCost: $${calculatedShippingCost}`);

          if (paymentMethod === 'contra_entrega') {
            // ======= CONTRA ENTREGA: Create Shopify order immediately =======
            const { data: orderResult, error: orderError } = await supabase.functions.invoke('create-shopify-order', {
              body: {
                orderData: {
                  customerName: orderArgs.customerName,
                  cedula: orderArgs.cedula || '',
                  email: orderArgs.email,
                  phone: orderArgs.phone,
                  address: orderArgs.address,
                  city: orderArgs.city,
                  department: orderArgs.department,
                  neighborhood: orderArgs.neighborhood || '',
                  lineItems: lineItems,
                  notes: orderArgs.notes || '',
                  shippingCost: calculatedShippingCost,
                  paymentMethod: paymentMethod
                },
                organizationId: organizationId
              }
            });

            if (orderError) {
              console.error("Order creation error:", orderError);
              return new Response(
                JSON.stringify({
                  response: "Lo siento, hubo un inconveniente al crear tu pedido. No te preocupes, ya te conecto con un asesor que te ayudará a completar tu compra. 😊",
                  order_created: false,
                  needs_attention: true,
                  error: orderError.message
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            console.log("Order created successfully:", orderResult);

            responseText = `¡Perfecto! Tu pedido ha sido creado exitosamente! 🎉\n\n` +
              `📋 Número de pedido: #${orderResult.orderNumber}\n` +
              `💰 Total: $${Number(orderResult.totalPrice).toLocaleString('es-CO')} COP\n\n` +
              `💵 Método de pago: Contra entrega\n` +
              `Pagarás el total al momento de recibir tu pedido.\n\n` +
              `Te enviaremos la información de seguimiento cuando tu pedido sea despachado. ¡Gracias por tu compra!`;

            return new Response(
              JSON.stringify({
                response: responseText,
                order_created: true,
                orderId: orderResult.orderId,
                orderNumber: orderResult.orderNumber,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );

          } else {
            // ======= LINK DE PAGO: Generate payment link FIRST, order created after payment =======
            console.log("💳 Link de pago flow: generating payment link before creating order...");

            // 🚫 SERVER-SIDE ANTI-DUPLICATION: Check if there's already a pending/paid order for this phone
            const customerPhone = orderArgs.phone;
            if (customerPhone) {
              const { data: existingOrders } = await supabase
                .from('pending_orders')
                .select('*')
                .eq('customer_phone', customerPhone)
                .in('status', ['pending_payment', 'paid', 'order_created'])
                .order('created_at', { ascending: false })
                .limit(1);

              if (existingOrders && existingOrders.length > 0) {
                const existing = existingOrders[0];
                console.log(`🚫 DUPLICATE CHECK: Found existing order for phone ${customerPhone} — status: ${existing.status}, ref: ${existing.bold_reference}, created: ${existing.created_at}`);

                // If order already created in Shopify, just confirm
                if (existing.status === 'order_created') {
                  return new Response(
                    JSON.stringify({
                      response: `¡Tu pedido ya fue creado exitosamente! 🎉 Tu número de pedido es #${existing.shopify_order_number}. Te enviaremos la información de seguimiento cuando sea despachado. ¡Gracias por tu compra! 😊`,
                      order_created: true,
                      duplicate_blocked: true,
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }

                // If pending_payment or paid: the Bold webhook may have failed.
                // Create the Shopify order now as fallback using the stored pending_order data.
                if (existing.status === 'pending_payment' || existing.status === 'paid') {
                  console.log(`🔄 FALLBACK ORDER CREATION: Bold webhook may have failed. Creating Shopify order from pending_order ${existing.id}...`);

                  try {
                    const pendingLineItems = existing.line_items as any[];

                    // Update pending order status to 'paid' (customer confirmed payment)
                    await supabase
                      .from('pending_orders')
                      .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', existing.id);

                    // Create the Shopify order using the stored pending_order data
                    const { data: orderResult, error: orderError } = await supabase.functions.invoke('create-shopify-order', {
                      body: {
                        orderData: {
                          customerName: existing.customer_name,
                          cedula: existing.cedula || '',
                          email: existing.customer_email,
                          phone: existing.customer_phone,
                          address: existing.address,
                          city: existing.city,
                          department: existing.department,
                          neighborhood: existing.neighborhood || '',
                          lineItems: pendingLineItems,
                          notes: (existing.notes || '') + ' | Pago confirmado por cliente (fallback)',
                          shippingCost: existing.shipping_cost || 0,
                          paymentMethod: 'link_de_pago'
                        },
                        organizationId: organizationId
                      }
                    });

                    if (orderError) {
                      console.error("Fallback order creation error:", orderError);
                      return new Response(
                        JSON.stringify({
                          response: "Lo siento, hubo un inconveniente al crear tu pedido. No te preocupes, ya te conecto con un asesor que te ayudará. 😊",
                          order_created: false,
                          needs_attention: true,
                          error: orderError.message
                        }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                      );
                    }

                    console.log("✅ Fallback order created successfully:", orderResult);

                    // Update pending order with Shopify order info
                    await supabase
                      .from('pending_orders')
                      .update({
                        status: 'order_created',
                        shopify_order_id: String(orderResult.orderId),
                        shopify_order_number: String(orderResult.orderNumber),
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', existing.id);

                    return new Response(
                      JSON.stringify({
                        response: `¡Tu pago ha sido confirmado y tu pedido ha sido creado exitosamente! 🎉\n\n📋 Número de pedido: #${orderResult.orderNumber}\n💰 Total: $${Number(orderResult.totalPrice).toLocaleString('es-CO')} COP\n\nTe enviaremos la información de seguimiento cuando tu pedido sea despachado. ¡Gracias por tu compra! 😊`,
                        order_created: true,
                        orderId: orderResult.orderId,
                        orderNumber: orderResult.orderNumber,
                      }),
                      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                  } catch (fallbackErr) {
                    console.error("Fallback order creation exception:", fallbackErr);
                    return new Response(
                      JSON.stringify({
                        response: "¡Tu pago fue recibido! Estamos procesando tu pedido. En unos momentos recibirás la confirmación. 😊",
                        order_created: false,
                        needs_attention: true,
                      }),
                      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                  }
                }
              }
            }

            // Calculate total from product variant prices (reuse getVariantPrice helper)
            let productTotal = 0;
            for (const item of lineItems) {
              const price = getVariantPrice(item);
              const itemTotal = price * (item.quantity || 1);
              productTotal += itemTotal;
              console.log(`  💵 ${item.productName} x${item.quantity || 1} @ $${price} = $${itemTotal}`);
            }

            // Validate product total before proceeding
            if (productTotal <= 0) {
              console.error(`❌ Product total is $0 — could not resolve variant prices for: ${lineItems.map(i => `${i.productName}(pid:${i.productId},vid:${i.variantId})`).join(', ')}`);
              console.error(`  allShopifyProducts has ${allShopifyProducts.length} products`);
              return new Response(
                JSON.stringify({
                  response: "Lo siento, hubo un inconveniente al calcular el total de tu pedido. No te preocupes, ya te conecto con un asesor que te ayudará a completar tu compra. 😊",
                  order_created: false,
                  needs_attention: true,
                  error: "Could not calculate product total — variant price lookup failed"
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            // Use shared shipping calculation from above
            const shippingCost = calculatedShippingCost;
            const totalAmount = productTotal + shippingCost;
            console.log(`  📦 Products: $${productTotal} + Shipping: $${shippingCost} = Total: $${totalAmount}`);

            // Generate Bold payment link and store pending order
            const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('create-bold-payment-link', {
              body: {
                amount: Math.round(totalAmount),
                description: `Pedido Dosmicos - ${lineItems.map(i => i.productName).join(', ')}`.substring(0, 100),
                customerEmail: orderArgs.email,
                customerName: orderArgs.customerName,
                customerPhone: orderArgs.phone,
                organizationId: organizationId,
                orderData: {
                  cedula: orderArgs.cedula || '',
                  address: orderArgs.address,
                  city: orderArgs.city,
                  department: orderArgs.department,
                  neighborhood: orderArgs.neighborhood || '',
                  lineItems: lineItems,
                  notes: orderArgs.notes || '',
                  shippingCost: shippingCost,
                }
              }
            });

            if (paymentError) {
              console.error("Payment link error:", paymentError);
              return new Response(
                JSON.stringify({
                  response: "Lo siento, hubo un inconveniente al generar tu link de pago. No te preocupes, ya te conecto con un asesor que te ayudará a completar tu compra. 😊",
                  order_created: false,
                  needs_attention: true,
                  error: paymentError.message
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            console.log("Payment link created:", paymentResult);
            paymentUrl = paymentResult.paymentUrl;

            responseText = `¡Perfecto! Hemos generado tu link de pago 🎉\n\n` +
              `💰 Total: $${totalAmount.toLocaleString('es-CO')} COP\n\n` +
              `💳 *TU LINK DE PAGO:*\n${paymentUrl}\n\n` +
              `Haz clic para pagar con tarjeta, PSE, Nequi, Bancolombia y más métodos de pago.\n\n` +
              `Una vez confirmemos tu pago, crearemos tu pedido y te enviaremos la confirmación. ¡Gracias! 😊`;

            return new Response(
              JSON.stringify({
                response: responseText,
                order_created: false,
                payment_link_generated: true,
                paymentUrl: paymentUrl
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

        } catch (err) {
          console.error("Error parsing function call:", err);
        }
      }
      
      // Handle create_payment_link function
      if (functionCall.name === "create_payment_link") {
        try {
          const paymentArgs = JSON.parse(functionCall.arguments);
          console.log("Creating payment link with args:", paymentArgs);
          
          // Call the create-bold-payment-link function
          const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('create-bold-payment-link', {
            body: {
              amount: paymentArgs.amount,
              description: paymentArgs.description,
              customerEmail: paymentArgs.customerEmail,
              orderId: paymentArgs.orderId,
              organizationId: organizationId
            }
          });
          
          if (paymentError) {
            console.error("Payment link error:", paymentError);
            return new Response(
              JSON.stringify({ 
                response: "Lo siento, hubo un error al crear el link de pago. Por favor intenta de nuevo.",
                payment_link_created: false,
                error: paymentError.message
              }), 
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          console.log("Payment link created:", paymentResult);
          
          const responseText = `¡Tu link de pago está listo! 💳\n\n` +
            `Monto: $${Number(paymentArgs.amount).toLocaleString('es-CO')} COP\n\n` +
            `Haz clic en el siguiente enlace para pagar:\n${paymentResult.paymentUrl}\n\n` +
            `🎯 El link de pago incluye todos los métodos de pago: Tarjeta de crédito, PSE, Nequi, Daviplata, y más.\n\n` +
            `Una vez realizado el pago, recibirás la confirmación automáticamente.`;
          
          return new Response(
            JSON.stringify({ 
              response: responseText,
              payment_link_created: true,
              paymentUrl: paymentResult.paymentUrl,
              paymentLinkId: paymentResult.paymentLinkId
            }), 
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
          
        } catch (err) {
          console.error("Error parsing payment function call:", err);
        }
      }

      // Handle order status lookup
      if (functionCall.name === "lookup_order_status") {
        try {
          const lookupArgs = JSON.parse(functionCall.arguments);
          console.log("Looking up order status with args:", lookupArgs);

          if (!lookupArgs.orderNumber && !lookupArgs.email) {
            return new Response(
              JSON.stringify({
                response: "Para consultar el estado de tu pedido necesito tu número de pedido o el correo electrónico con el que realizaste la compra. ¿Podrías proporcionarme alguno de los dos?"
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          let orderData: any = null;

          // Step A: Search in local shopify_orders table first
          if (lookupArgs.orderNumber) {
            const normalized = lookupArgs.orderNumber.replace('#', '').trim();
            console.log(`🔍 Searching order by number: ${normalized}`);

            const { data: orders } = await supabase
              .from('shopify_orders')
              .select('shopify_order_id, order_number, financial_status, fulfillment_status, total_price, created_at_shopify, customer_email, customer_first_name, customer_last_name, shipping_address, order_status_url')
              .eq('organization_id', organizationId)
              .or(`order_number.eq.${normalized},order_number.eq.#${normalized}`)
              .limit(1);

            if (orders && orders.length > 0) {
              orderData = orders[0];
              console.log(`✅ Found order in local DB: #${orderData.order_number}`);
            }
          } else if (lookupArgs.email) {
            console.log(`🔍 Searching order by email: ${lookupArgs.email}`);

            const { data: orders } = await supabase
              .from('shopify_orders')
              .select('shopify_order_id, order_number, financial_status, fulfillment_status, total_price, created_at_shopify, customer_email, customer_first_name, customer_last_name, shipping_address, order_status_url')
              .eq('organization_id', organizationId)
              .eq('customer_email', lookupArgs.email.toLowerCase().trim())
              .order('created_at_shopify', { ascending: false })
              .limit(1);

            if (orders && orders.length > 0) {
              orderData = orders[0];
              console.log(`✅ Found order in local DB by email: #${orderData.order_number}`);
            }
          }

          // Step B: Fallback to Shopify API if not found locally
          if (!orderData && shopifyCredentials) {
            const creds = shopifyCredentials as any;
            const shopifyDomain = creds.store_domain || creds.shopDomain;
            const shopifyToken = creds.access_token || creds.accessToken;

            if (shopifyDomain && shopifyToken) {
              try {
                let shopifyUrl = '';
                if (lookupArgs.orderNumber) {
                  const normalized = lookupArgs.orderNumber.replace('#', '').trim();
                  shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/orders.json?name=%23${normalized}&status=any&limit=1`;
                } else if (lookupArgs.email) {
                  shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/orders.json?email=${encodeURIComponent(lookupArgs.email.trim())}&status=any&limit=1`;
                }

                console.log(`🔍 Fallback: Searching Shopify API: ${shopifyUrl}`);
                const shopifyResp = await fetch(shopifyUrl, {
                  headers: {
                    'X-Shopify-Access-Token': shopifyToken,
                    'Content-Type': 'application/json',
                  },
                });

                if (shopifyResp.ok) {
                  const shopifyData = await shopifyResp.json();
                  const shopifyOrders = shopifyData.orders || [];
                  if (shopifyOrders.length > 0) {
                    const o = shopifyOrders[0];
                    orderData = {
                      shopify_order_id: o.id,
                      order_number: o.order_number || o.name,
                      financial_status: o.financial_status,
                      fulfillment_status: o.fulfillment_status,
                      total_price: o.total_price,
                      created_at_shopify: o.created_at,
                      customer_email: o.email,
                      customer_first_name: o.customer?.first_name || '',
                      customer_last_name: o.customer?.last_name || '',
                      shipping_address: o.shipping_address,
                      order_status_url: o.order_status_url,
                      // Extract fulfillment tracking from Shopify directly
                      fulfillments: o.fulfillments || [],
                    };
                    console.log(`✅ Found order via Shopify API: #${orderData.order_number}`);
                  }
                } else {
                  console.error(`❌ Shopify API error: ${shopifyResp.status}`);
                }
              } catch (shopifyErr) {
                console.error("Error fetching from Shopify API:", shopifyErr);
              }
            }
          }

          // Step C: If still no order found
          if (!orderData) {
            const searchTerm = lookupArgs.orderNumber ? `número #${lookupArgs.orderNumber}` : `correo ${lookupArgs.email}`;
            return new Response(
              JSON.stringify({
                response: `No encontré ningún pedido con ${searchTerm}. ¿Podrías verificar el dato e intentar de nuevo? También puedes probar con tu ${lookupArgs.orderNumber ? 'correo electrónico' : 'número de pedido'}.`
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Step D: Search for tracking info in shipping_labels
          let trackingInfo: any = null;
          const { data: label } = await supabase
            .from('shipping_labels')
            .select('tracking_number, carrier, status')
            .eq('shopify_order_id', orderData.shopify_order_id)
            .eq('organization_id', organizationId)
            .maybeSingle();

          if (label?.tracking_number) {
            trackingInfo = { ...label };

            // Step E: Get live tracking from Envia
            try {
              console.log(`📍 Getting live tracking for ${label.tracking_number}...`);
              const { data: trackResult, error: trackError } = await supabase.functions.invoke('envia-track', {
                body: {
                  tracking_number: label.tracking_number,
                  carrier: label.carrier
                }
              });

              if (!trackError && trackResult?.success) {
                trackingInfo.live_status = trackResult.status;
                trackingInfo.last_event = trackResult.events?.[trackResult.events.length - 1]?.description || null;
                trackingInfo.estimated_delivery = trackResult.estimated_delivery || null;
                console.log(`✅ Live tracking: ${trackResult.status}`);
              }
            } catch (trackErr) {
              console.error("Error getting live tracking:", trackErr);
            }
          }

          // Also check Shopify fulfillment tracking (from API fallback)
          if (!trackingInfo && orderData.fulfillments?.length > 0) {
            const fulfillment = orderData.fulfillments[orderData.fulfillments.length - 1];
            if (fulfillment.tracking_number) {
              trackingInfo = {
                tracking_number: fulfillment.tracking_number,
                carrier: fulfillment.tracking_company || 'Transportadora',
                status: fulfillment.status || 'in_transit',
                tracking_url: fulfillment.tracking_url || null,
              };
            }
          }

          // Step F: Build formatted response
          const orderNum = String(orderData.order_number).replace('#', '');
          const financialMap: Record<string, string> = {
            'paid': '✅ Pagado',
            'pending': '⏳ Pendiente de pago',
            'partially_paid': '⚠️ Parcialmente pagado',
            'refunded': '↩️ Reembolsado',
            'voided': '❌ Anulado',
            'authorized': '🔄 Autorizado (pendiente de captura)',
          };
          const fulfillmentMap: Record<string, string> = {
            'fulfilled': '📦 Enviado',
            'partial': '📦 Parcialmente enviado',
            'unfulfilled': '🏭 En preparación',
            'null': '🏭 En preparación',
          };

          const paymentStatus = financialMap[orderData.financial_status] || `Estado: ${orderData.financial_status || 'desconocido'}`;
          const fulfillmentStatus = fulfillmentMap[orderData.fulfillment_status || 'null'] || fulfillmentMap['null'];
          const total = orderData.total_price ? `$${Number(orderData.total_price).toLocaleString('es-CO')} COP` : 'N/A';

          let responseText = `📦 *Pedido #${orderNum}*\n\n`;
          responseText += `💰 Pago: ${paymentStatus}\n`;
          responseText += `🚚 Envío: ${fulfillmentStatus}\n`;
          responseText += `💵 Total: ${total}\n`;

          if (trackingInfo) {
            const trackingStatusMap: Record<string, string> = {
              'delivered': '✅ Entregado',
              'in_transit': '🚚 En tránsito',
              'created': '📋 Guía creada',
              'returned': '↩️ Devuelto',
              'exception': '⚠️ Novedad',
              'pending': '⏳ Pendiente de recolección',
              'cancelled': '❌ Cancelado',
            };
            const liveStatus = trackingInfo.live_status || trackingInfo.status;
            const statusText = trackingStatusMap[liveStatus] || `Estado: ${liveStatus}`;

            responseText += `\n📍 *Tracking:*\n`;
            responseText += `- Guía: ${trackingInfo.tracking_number}\n`;
            responseText += `- Transportadora: ${trackingInfo.carrier}\n`;
            responseText += `- Estado: ${statusText}\n`;

            if (trackingInfo.last_event) {
              responseText += `- Último evento: ${trackingInfo.last_event}\n`;
            }
            if (trackingInfo.estimated_delivery) {
              responseText += `- Entrega estimada: ${trackingInfo.estimated_delivery}\n`;
            }
            if (trackingInfo.tracking_url) {
              responseText += `\n🔗 Rastrea tu envío aquí: ${trackingInfo.tracking_url}\n`;
            }
          } else if (orderData.fulfillment_status !== 'fulfilled') {
            responseText += `\n📌 Tu pedido aún no ha sido despachado. Te notificaremos cuando sea enviado con el número de seguimiento.`;
          }

          if (orderData.order_status_url) {
            responseText += `\n\n🔗 Ver detalles completos: ${orderData.order_status_url}`;
          }

          console.log(`✅ Order status response built for #${orderNum}`);

          return new Response(
            JSON.stringify({
              response: responseText,
              order_lookup: true,
              orderNumber: orderNum,
              financialStatus: orderData.financial_status,
              fulfillmentStatus: orderData.fulfillment_status
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );

        } catch (err) {
          console.error("Error in lookup_order_status:", err);
          return new Response(
            JSON.stringify({
              response: "Lo siento, hubo un error al consultar el estado de tu pedido. Por favor intenta de nuevo en unos momentos."
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const rawAiResponse = data.choices?.[0]?.message?.content || "";
    
    console.log("OpenAI raw response:", rawAiResponse.substring(0, 200) + "...");

    // Check if AI opted to send collection link instead of individual images
    const noImagesRequested = rawAiResponse.includes('[NO_IMAGES]');

    // Extract ALL product IDs and clean response
    const productIds = noImagesRequested ? [] : extractProductIdsFromResponse(rawAiResponse);
    const cleanedResponse = cleanAIResponse(rawAiResponse);

    if (noImagesRequested) {
      console.log('📎 AI sent collection link — skipping individual product images');
    }
    
    console.log(`Found ${productIds.length} product IDs in response:`, productIds);
    
    // Build product images array
    const productImages: Array<{ product_id: number; image_url: string; product_name: string }> = [];
    
    for (const productId of productIds) {
      let imageUrl: string | null = null;
      let productName = '';
      
      // First check our cached map
      if (productImageMap[productId]) {
        imageUrl = productImageMap[productId].url;
        productName = productImageMap[productId].title;
        console.log(`Found image in cache for product ${productId}: ${productName}`);
      } else if (shopifyCredentials) {
        // Fetch from Shopify if not in cache
        imageUrl = await fetchShopifyProductImage(productId, shopifyCredentials);
        productName = `Producto ${productId}`;
      }
      
      if (imageUrl) {
        // Cache the image in Supabase Storage for reliable delivery
        const cachedUrl = await cacheImageToStorage(imageUrl, productId, organizationId, supabase);
        
        productImages.push({
          product_id: productId,
          image_url: cachedUrl || imageUrl,
          product_name: productName
        });
        
        console.log(`Added image for product ${productId}: ${productName}`);
      } else {
        console.log(`No image found for product ${productId}`);
      }
    }
    
    console.log(`Returning ${productImages.length} product images`);

    return new Response(
      JSON.stringify({ 
        response: cleanedResponse,
        product_images: productImages,
        // Keep legacy fields for backwards compatibility
        product_image_url: productImages[0]?.image_url || null,
        product_id: productIds[0] || null
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("messaging-ai-openai error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
