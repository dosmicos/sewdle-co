import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, systemPrompt, organizationId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("messaging-ai-chat: Processing request for org:", organizationId);
    console.log("messaging-ai-chat: Messages received:", messages?.length || 0);

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
          const aiConfig = channel.ai_config as Record<string, unknown>;
          
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
            rulesContext = '\n\n📋 REGLAS ESPECIALES DE RESPUESTA:\n';
            rulesContext += 'IMPORTANTE: Estas reglas son OBLIGATORIAS. Cuando detectes estas palabras clave, DEBES seguir la instrucción correspondiente:\n';
            aiConfig.rules.forEach((rule: unknown) => {
              if (rule.condition && rule.response) {
                rulesContext += `- Si el cliente menciona "${rule.condition}": ${rule.response}\n`;
              }
            });
            console.log(`Loaded ${aiConfig.rules.length} rules`);
          }

          // Get knowledge base
          if (aiConfig.knowledgeBase?.length > 0) {
            knowledgeContext = '\n\n📚 BASE DE CONOCIMIENTO DE LA EMPRESA:\n';
            knowledgeContext += 'Usa esta información para responder preguntas de los clientes:\n\n';
            
            aiConfig.knowledgeBase.forEach((item: unknown) => {
              if (item.category === 'product') {
                // Product knowledge
                knowledgeContext += `🏷️ PRODUCTO: ${item.productName || item.title}\n`;
                if (item.recommendWhen) {
                  knowledgeContext += `   Recomendar cuando: ${item.recommendWhen}\n`;
                }
                if (item.content) {
                  knowledgeContext += `   Detalles: ${item.content}\n`;
                }
                knowledgeContext += '\n';
              } else {
                // General knowledge
                if (item.title && item.content) {
                  knowledgeContext += `📌 ${item.title}:\n${item.content}\n\n`;
                } else if (item.question && item.answer) {
                  knowledgeContext += `❓ ${item.question}\n✅ ${item.answer}\n\n`;
                }
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
        // Get connected product IDs from ai_catalog_connections
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

        const shopifyCredentials = org?.shopify_credentials as Record<string, unknown>;

        if (shopifyCredentials && connectedProductIds.size > 0) {
          const shopifyDomain = shopifyCredentials.store_domain || shopifyCredentials.shopDomain;
          const accessToken = shopifyCredentials.access_token || shopifyCredentials.accessToken;
          
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
                const shopifyProducts = shopifyData.products || [];
                
                // Filter to only connected products
                const connectedProducts = shopifyProducts.filter(
                  (p: unknown) => connectedProductIds.has(p.id)
                );
                
                if (connectedProducts.length > 0) {
                  productCatalog = '\n\n📦 CATÁLOGO DE PRODUCTOS:\n';
                  productCatalog += 'Solo ofrece productos con stock disponible:\n\n';
                  
                  connectedProducts.forEach((product: unknown) => {
                    const variants = product.variants || [];
                    const totalStock = variants.reduce((sum: number, v: unknown) => sum + (v.inventory_quantity || 0), 0);
                    
                    if (totalStock === 0) {
                      productCatalog += `• ${product.title}: ❌ AGOTADO\n`;
                      return;
                    }
                    
                    const price = variants[0]?.price 
                      ? `$${Number(variants[0].price).toLocaleString('es-CO')} COP` 
                      : 'Consultar';
                    
                    const variantInfo = variants
                      .map((v: unknown) => {
                        const stock = v.inventory_quantity || 0;
                        return `${v.title}: ${stock > 0 ? `✅ ${stock}` : '❌'}`;
                      })
                      .join(' | ');
                    
                    productCatalog += `• ${product.title}\n`;
                    productCatalog += `  Precio: ${price}\n`;
                    productCatalog += `  Stock: ${variantInfo}\n\n`;
                  });
                  
                  console.log(`Loaded ${connectedProducts.length} products with Shopify inventory`);
                }
              }
            } catch (shopifyErr) {
              console.error("Error fetching Shopify products:", shopifyErr);
            }
          }
        }
      } catch (err) {
        console.error("Error loading products:", err);
      }
    }

    // Build the full system prompt with all context
    const basePrompt = savedSystemPrompt || systemPrompt || "Eres un asistente virtual amigable y profesional. Responde siempre en español.";
    
    let fullSystemPrompt = basePrompt;
    
    if (toneConfig) {
      fullSystemPrompt += `\n\n🎯 TONO DE COMUNICACIÓN:\n${toneConfig}`;
    }
    
    if (rulesContext) {
      fullSystemPrompt += rulesContext;
    }
    
    if (knowledgeContext) {
      fullSystemPrompt += knowledgeContext;
    }
    
    if (productCatalog) {
      fullSystemPrompt += productCatalog;
    }

    console.log("Full system prompt length:", fullSystemPrompt.length);
    console.log("System prompt preview:", fullSystemPrompt.substring(0, 500) + "...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...messages,
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en unos segundos." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Se requiere agregar créditos a tu cuenta de Lovable AI." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Error en el servicio de IA" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "";
    
    console.log("AI response generated:", aiResponse.substring(0, 100) + "...");

    return new Response(
      JSON.stringify({ response: aiResponse }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("messaging-ai-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
