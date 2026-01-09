import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (organizationId) {
      try {
        // Get organization's Shopify credentials
        const { data: org } = await supabase
          .from('organizations')
          .select('shopify_credentials')
          .eq('id', organizationId)
          .single();

        let shopifyInventory: Map<string, number> = new Map();
        
        // Fetch real-time inventory from Shopify if credentials exist
        if (org?.shopify_credentials) {
          const creds = org.shopify_credentials as any;
          const shopifyDomain = creds.store_domain || creds.shopDomain;
          const accessToken = creds.access_token || creds.accessToken;
          
          if (shopifyDomain && accessToken) {
            try {
              console.log("Fetching Shopify inventory...");
              
              // Fetch products with inventory from Shopify
              const shopifyResponse = await fetch(
                `https://${shopifyDomain}/admin/api/2024-01/products.json?status=active&limit=250&fields=id,title,variants`,
                {
                  headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json',
                  },
                }
              );
              
              if (shopifyResponse.ok) {
                const shopifyData = await shopifyResponse.json();
                
                // Build inventory map: variant_id -> inventory_quantity
                shopifyData.products?.forEach((product: any) => {
                  product.variants?.forEach((variant: any) => {
                    if (variant.sku) {
                      shopifyInventory.set(variant.sku, variant.inventory_quantity || 0);
                    }
                    // Also map by variant ID
                    shopifyInventory.set(`variant_${variant.id}`, variant.inventory_quantity || 0);
                  });
                });
                
                console.log(`Loaded Shopify inventory for ${shopifyInventory.size} variants`);
              } else {
                console.error("Shopify API error:", shopifyResponse.status);
              }
            } catch (shopifyErr) {
              console.error("Error fetching Shopify inventory:", shopifyErr);
            }
          }
        }

        // Load products from database
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select(`
            name, 
            sku, 
            base_price, 
            category,
            description,
            shopify_variant_id,
            product_variants (id, size, color, stock_quantity, sku_variant, shopify_variant_id)
          `)
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .limit(50);

        if (productsError) {
          console.error("Error loading products:", productsError);
        } else if (products && products.length > 0) {
          productCatalog = '\n\n📦 CATÁLOGO DE PRODUCTOS DISPONIBLES:\n';
          productCatalog += 'IMPORTANTE: Solo ofrece productos que tengan stock disponible (Stock > 0). Si un producto no tiene stock, indica que está agotado.\n';
          
          products.forEach((p: any) => {
            const price = p.base_price 
              ? `$${Number(p.base_price).toLocaleString('es-CO')} COP` 
              : 'Precio: Consultar';
            
            const variants = p.product_variants
              ?.map((v: any) => {
                const size = v.size || '';
                const color = v.color || '';
                
                // Try to get stock from Shopify first, fallback to local
                let stock = v.stock_quantity || 0;
                if (v.sku_variant && shopifyInventory.has(v.sku_variant)) {
                  stock = shopifyInventory.get(v.sku_variant) || 0;
                } else if (v.shopify_variant_id && shopifyInventory.has(`variant_${v.shopify_variant_id}`)) {
                  stock = shopifyInventory.get(`variant_${v.shopify_variant_id}`) || 0;
                }
                
                const stockStatus = stock > 0 ? `✅ ${stock} unidades` : '❌ Agotado';
                return `${size}${color ? ` ${color}` : ''}: ${stockStatus}`;
              })
              .join(' | ') || 'Sin variantes';
            
            // Clean HTML from description
            const cleanDescription = p.description 
              ? p.description.replace(/<[^>]*>/g, '').substring(0, 100) 
              : '';
            
            productCatalog += `\n• ${p.name}`;
            productCatalog += `\n  Precio: ${price}`;
            productCatalog += `\n  Disponibilidad: ${variants}`;
            if (cleanDescription) {
              productCatalog += `\n  ${cleanDescription}`;
            }
            productCatalog += '\n';
          });
          
          console.log(`Loaded ${products.length} products with inventory for context`);
        }
      } catch (err) {
        console.error("Error loading products:", err);
      }
    }

    // Build the full system prompt with all context
    // Priority: saved prompt > provided prompt > default
    const basePrompt = savedSystemPrompt || systemPrompt || "Eres un asistente virtual amigable. Responde siempre en español.";
    
    let fullSystemPrompt = basePrompt;
    
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
    const aiResponse = data.choices?.[0]?.message?.content || "";
    
    console.log("OpenAI response received:", aiResponse.substring(0, 100) + "...");

    return new Response(
      JSON.stringify({ response: aiResponse }), 
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
