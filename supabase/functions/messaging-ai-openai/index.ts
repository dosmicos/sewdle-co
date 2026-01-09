import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extract product ID from AI response
function extractProductIdFromResponse(aiResponse: string): number | null {
  const match = aiResponse.match(/\[PRODUCT_IMAGE_ID:(\d+)\]/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// Remove product image tag from response
function cleanAIResponse(aiResponse: string): string {
  return aiResponse.replace(/\[PRODUCT_IMAGE_ID:\d+\]/g, '').trim();
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
    const { messages, systemPrompt, organizationId } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
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
            knowledgeContext = '\n\n📚 CONOCIMIENTO DE LA EMPRESA:\n';
            aiConfig.knowledgeBase.forEach((item: any) => {
              if (item.category) {
                knowledgeContext += `\n[${item.category}]\n`;
              }
              if (item.question && item.answer) {
                knowledgeContext += `P: ${item.question}\nR: ${item.answer}\n`;
              } else if (item.title && item.content) {
                knowledgeContext += `${item.title}: ${item.content}\n`;
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
    let shopifyCredentials: any = null;
    let productImageMap: Record<number, string> = {}; // Map Shopify ID -> image URL
    
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
                  productCatalog = '\n\n📦 CATÁLOGO DE PRODUCTOS DISPONIBLES:\n';
                  productCatalog += 'IMPORTANTE: Solo ofrece productos que tengan stock disponible (Stock > 0). Si un producto no tiene stock, indica que está agotado.\n\n';
                  productCatalog += '🖼️ INSTRUCCIÓN DE IMÁGENES: PUEDES Y DEBES mostrar fotos de productos. Cuando recomiendes o el cliente pida ver un producto específico, agrega al final de tu respuesta: [PRODUCT_IMAGE_ID:ID_DEL_PRODUCTO] donde ID es el número que aparece en paréntesis junto al nombre.\n\n';
                  
                  connectedProducts.forEach((product) => {
                    const variants = product.variants || [];
                    const totalStock = variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0);
                    
                    // Store image URL in map
                    const imageUrl = product.image?.src || product.images?.[0]?.src;
                    if (imageUrl) {
                      productImageMap[product.id] = imageUrl;
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
                        return `${v.title}: ${stockStatus}`;
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
    
    // Add image instruction at the beginning
    fullSystemPrompt += '\n\n🖼️ CAPACIDAD DE ENVIAR IMÁGENES:\nSÍ puedes mostrar fotos de productos. Cuando el cliente pida ver una foto o cuando recomiendes un producto específico, DEBES agregar al final de tu respuesta el tag: [PRODUCT_IMAGE_ID:ID] usando el ID del producto del catálogo. NUNCA digas que no puedes mostrar imágenes.';
    
    if (toneConfig) {
      fullSystemPrompt += `\n\n${toneConfig}`;
    }
    
    fullSystemPrompt += knowledgeContext;
    fullSystemPrompt += rulesContext;
    fullSystemPrompt += productCatalog;

    console.log("Full system prompt length:", fullSystemPrompt.length);
    console.log("Calling OpenAI GPT-4o-mini with", messages?.length || 0, "messages");

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
    const rawAiResponse = data.choices?.[0]?.message?.content || "";
    
    console.log("OpenAI raw response:", rawAiResponse.substring(0, 150) + "...");

    // Extract product ID and clean response
    const productId = extractProductIdFromResponse(rawAiResponse);
    const cleanedResponse = cleanAIResponse(rawAiResponse);
    
    let productImageUrl: string | null = null;
    
    // If AI mentioned a product, get the image
    if (productId) {
      console.log(`AI mentioned product ID: ${productId}, looking for image...`);
      
      // First check our cached map
      if (productImageMap[productId]) {
        productImageUrl = productImageMap[productId];
        console.log(`Found image in cache for product ${productId}`);
      } else if (shopifyCredentials) {
        // Fetch from Shopify if not in cache
        productImageUrl = await fetchShopifyProductImage(productId, shopifyCredentials);
      }
      
      if (productImageUrl) {
        console.log(`Product image URL found: ${productImageUrl.substring(0, 50)}...`);
      } else {
        console.log(`No image found for product ${productId}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        response: cleanedResponse,
        product_image_url: productImageUrl,
        product_id: productId
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
