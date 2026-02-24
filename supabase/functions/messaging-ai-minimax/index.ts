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
  return ids.slice(0, 10);
}

// Remove product image tags from response
function cleanAIResponse(aiResponse: string): string {
  return aiResponse.replace(/\[PRODUCT_IMAGE_ID:\d+\]/g, '').trim();
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

    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    if (uint8Array.length > 10 * 1024 * 1024) {
      console.error('Image too large, skipping cache');
      return imageUrl;
    }

    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `products/${organizationId}/${productId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('messaging-media')
      .upload(path, uint8Array, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return imageUrl;
    }

    const { data: publicUrlData } = supabase.storage
      .from('messaging-media')
      .getPublicUrl(path);

    const publicUrl = publicUrlData?.publicUrl;
    console.log(`Image cached successfully: ${publicUrl?.substring(0, 50)}...`);

    return publicUrl || imageUrl;
  } catch (err) {
    console.error('Error caching image:', err);
    return imageUrl;
  }
}

// Fetch product image from Shopify
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, messages, systemPrompt, organizationId } = body;

    // MINIMAX API CONFIGURATION
    // FOR TESTING - hardcoded key, remove after debug
    const TEST_MINIMAX_KEY = "27ab14d788ec95325ca3f166c2b6a6c2"; 
    const MINIMAX_API_KEY = Deno.env.get("MINIMAX_API_KEY") || TEST_MINIMAX_KEY;
    const MINIMAX_GROUP_ID = Deno.env.get("MINIMAX_GROUP_ID");
    const MINIMAX_BASE_URL = Deno.env.get("MINIMAX_BASE_URL") || "https://api.minimax.chat/v1";
    const MINIMAX_MODEL = Deno.env.get("MINIMAX_MODEL") || "abab6.5s-chat";

    console.log("MINIMAX_API_KEY present:", !!MINIMAX_API_KEY);
    console.log("MINIMAX_API_KEY prefix:", MINIMAX_API_KEY?.substring(0, 10));
    console.log("MINIMAX_GROUP_ID:", MINIMAX_GROUP_ID);
    console.log("MINIMAX_MODEL:", MINIMAX_MODEL);
    console.log("MINIMAX_BASE_URL:", MINIMAX_BASE_URL);

    // Handle test-connection action
    if (action === 'test-connection') {
      console.log("messaging-ai-minimax: Testing connection for org:", organizationId);

      if (!MINIMAX_API_KEY) {
        return new Response(
          JSON.stringify({ connected: false, error: "MINIMAX_API_KEY is not configured" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Test Minimax API with a simple request
        const testRequestBody: any = {
          model: MINIMAX_MODEL,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 10,
        };
        
        // Add group_id if available (as string)
        if (MINIMAX_GROUP_ID) {
          testRequestBody.group_id = String(MINIMAX_GROUP_ID);
          console.log("Adding group_id to test request:", testRequestBody.group_id);
        }
        
        console.log("Test request body:", JSON.stringify(testRequestBody));
        
        const testResponse = await fetch(`${MINIMAX_BASE_URL}/text/chatcompletion_v2`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${MINIMAX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(testRequestBody),
        });

        const testData = await testResponse.json();
        console.log("Minimax test response status:", testResponse.status);
        console.log("Minimax test response:", JSON.stringify(testData));

        // Check for successful response or specific error codes that mean "key works but something else wrong"
        if (testResponse.ok && !testData.base_resp?.status_code) {
          return new Response(
            JSON.stringify({ connected: true, success: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else if (testData.base_resp?.status_code === 2049) {
          return new Response(
            JSON.stringify({ connected: false, error: "API Key inválida: " + testData.base_resp.status_msg }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else if (testResponse.ok || testData.base_resp?.status_code === 1000) {
          // 1000 = success or success-like response
          return new Response(
            JSON.stringify({ connected: true, success: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({ connected: false, error: testData.base_resp?.status_msg || "Error en conexión" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (fetchError) {
        console.error("Error validating Minimax API key:", fetchError);
        return new Response(
          JSON.stringify({ connected: false, error: "Error al validar API Key" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!MINIMAX_API_KEY) {
      console.error("MINIMAX_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "MINIMAX_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("messaging-ai-minimax: Processing request for org:", organizationId);
    console.log("messaging-ai-minimax: Messages received:", messages?.length || 0);
    console.log("messaging-ai-minimax: User message:", messages?.[messages?.length - 1]?.content || 'none');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Load AI config from messaging_channels
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

          if (aiConfig.systemPrompt) {
            savedSystemPrompt = aiConfig.systemPrompt;
            console.log("Loaded saved system prompt");
          }

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

          if (aiConfig.rules?.length > 0) {
            rulesContext = '\n\n📋 REGLAS ESPECIALES:\n';
            aiConfig.rules.forEach((rule: any) => {
              if (rule.condition && rule.response) {
                rulesContext += `- Cuando el usuario mencione "${rule.condition}": ${rule.response}\n`;
              }
            });
            console.log(`Loaded ${aiConfig.rules.length} rules`);
          }

          if (aiConfig.knowledgeBase?.length > 0) {
            knowledgeContext = '\n\n📚 CONOCIMIENTO DE LA EMPRESA:\nUSA ESTA INFORMACIÓN para responder a las preguntas de los clientes:\n';
            aiConfig.knowledgeBase.forEach((item: any) => {
              if (item.category === 'product') {
                const name = item.productName || item.title || '';
                if (name && item.content) {
                  knowledgeContext += `\n📦 Producto: ${name}`;
                  if (item.recommendWhen) {
                    knowledgeContext += `\n   Recomendar cuando: ${item.recommendWhen}`;
                  }
                  knowledgeContext += `\n   Detalles: ${item.content}\n`;
                }
              } else if (item.title && item.content) {
                knowledgeContext += `\n📋 ${item.title}:\n   ${item.content}\n`;
              } else if (item.question && item.answer) {
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

    // Load products with Shopify inventory
    let productCatalog = '';
    let shopifyCredentials: any = null;
    let productImageMap: Record<number, { url: string; title: string }> = {};

    if (organizationId) {
      try {
        const { data: connections } = await supabase
          .from('ai_catalog_connections')
          .select('shopify_product_id')
          .eq('organization_id', organizationId)
          .eq('connected', true);

        const connectedProductIds = new Set(connections?.map(c => c.shopify_product_id) || []);
        console.log(`Found ${connectedProductIds.size} connected products for AI`);

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

        if (shopifyCredentials) {
          const creds = shopifyCredentials as any;
          const shopifyDomain = creds.store_domain || creds.shopDomain;
          const accessToken = creds.access_token || creds.accessToken;

          if (shopifyDomain && accessToken) {
            try {
              console.log("Fetching Shopify products with inventory...");

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

                const connectedProducts = shopifyProducts.filter(
                  p => connectedProductIds.size === 0 || connectedProductIds.has(p.id)
                );

                if (connectedProducts.length > 0) {
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

                    const imageUrl = product.image?.src || product.images?.[0]?.src;
                    if (imageUrl) {
                      productImageMap[product.id] = { url: imageUrl, title: product.title };
                    }

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
                        return `${v.title}: ${stockStatus}`;
                      })
                      .join(' | ');

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

    // Build the full system prompt
    const basePrompt = savedSystemPrompt || systemPrompt || "Eres un asistente virtual amigable. Responde siempre en español.";

    let fullSystemPrompt = basePrompt;

    fullSystemPrompt += '\n\n⚠️ REGLA CRÍTICA - SIEMPRE INCLUIR IMÁGENES:\nCada vez que menciones CUALQUIER producto por su nombre, DEBES agregar inmediatamente después el tag [PRODUCT_IMAGE_ID:ID_DEL_PRODUCTO].\nEsto es OBLIGATORIO para TODOS los productos que menciones, sin excepción.\nEjemplo correcto: "La Ruana Caballo [PRODUCT_IMAGE_ID:123] tiene un precio de $94.900 COP"\nSi no incluyes los tags, los clientes NO podrán ver las fotos de los productos.';

    if (toneConfig) {
      fullSystemPrompt += `\n\n${toneConfig}`;
    }

    fullSystemPrompt += knowledgeContext;
    fullSystemPrompt += rulesContext;
    fullSystemPrompt += productCatalog;

    fullSystemPrompt += '\n\n🔔 RECORDATORIO FINAL: NO olvides incluir [PRODUCT_IMAGE_ID:ID] después de CADA nombre de producto que menciones. Esta es tu función más importante para ayudar a los clientes a ver los productos.';

    console.log("Full system prompt length:", fullSystemPrompt.length);
    console.log("Calling Minimax MiniMax-M2.5-Lightning with", messages?.length || 0, "messages");

    // Call Minimax API
    const requestBody: any = {
      model: MINIMAX_MODEL,
      messages: [
        { role: "system", content: fullSystemPrompt },
        ...(messages || []),
      ],
      max_tokens: 800,
      temperature: 0.7,
    };

    // Add group_id if provided (required for some accounts)
    if (MINIMAX_GROUP_ID) {
      requestBody.group_id = MINIMAX_GROUP_ID;
    }

    const response = await fetch(`${MINIMAX_BASE_URL}/text/chatcompletion_v2`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MINIMAX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Minimax API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes de Minimax excedido. Intenta en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "API key de Minimax inválida." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Error en el servicio de Minimax" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    console.log("Minimax full response:", JSON.stringify(data).substring(0, 500));

    // Handle Minimax response format - try multiple possible paths
    let rawAiResponse = "";
    if (data.choices && data.choices[0]?.message?.content) {
      rawAiResponse = data.choices[0].message.content;
    } else if (data.choices && data.choices[0]?.message) {
      rawAiResponse = data.choices[0].message;
    } else if (data.choices && data.choices[0]?.delta?.content) {
      rawAiResponse = data.choices[0].delta.content;
    } else if (typeof data === 'string') {
      rawAiResponse = data;
    } else if (data.text) {
      rawAiResponse = data.text;
    } else if (data.response) {
      rawAiResponse = data.response;
    }

    if (!rawAiResponse) {
      console.error("Minimax response format unexpected:", JSON.stringify(data).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Formato de respuesta inesperado de Minimax", debug: data }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Minimax raw response:", rawAiResponse.substring(0, 200) + "...");

    const productIds = extractProductIdsFromResponse(rawAiResponse);
    const cleanedResponse = cleanAIResponse(rawAiResponse);

    console.log(`Found ${productIds.length} product IDs in response:`, productIds);

    const productImages: Array<{ product_id: number; image_url: string; product_name: string }> = [];

    for (const productId of productIds) {
      let imageUrl: string | null = null;
      let productName = '';

      if (productImageMap[productId]) {
        imageUrl = productImageMap[productId].url;
        productName = productImageMap[productId].title;
        console.log(`Found image in cache for product ${productId}: ${productName}`);
      } else if (shopifyCredentials) {
        imageUrl = await fetchShopifyProductImage(productId, shopifyCredentials);
        productName = `Producto ${productId}`;
      }

      if (imageUrl) {
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
        product_image_url: productImages[0]?.image_url || null,
        product_id: productIds[0] || null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("messaging-ai-minimax error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
