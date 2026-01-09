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

    // Load products if organizationId is provided
    let productCatalog = '';
    if (organizationId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: products, error: productsError } = await supabase
          .from('products')
          .select(`
            name, 
            sku, 
            base_price, 
            category,
            description,
            product_variants (size, color, stock_quantity, sku_variant)
          `)
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .limit(30);

        if (productsError) {
          console.error("Error loading products:", productsError);
        } else if (products && products.length > 0) {
          productCatalog = '\n\n📦 CATÁLOGO DE PRODUCTOS DISPONIBLES:\n';
          products.forEach((p: any) => {
            const price = p.base_price 
              ? `$${Number(p.base_price).toLocaleString('es-CO')} COP` 
              : 'Precio: Consultar';
            
            const variants = p.product_variants
              ?.filter((v: any) => (v.stock_quantity || 0) > 0)
              ?.map((v: any) => {
                const size = v.size || '';
                const color = v.color || '';
                const stock = v.stock_quantity || 0;
                return `${size}${color ? ` ${color}` : ''} (Stock: ${stock})`;
              })
              .join(', ') || 'Sin stock disponible';
            
            // Clean HTML from description
            const cleanDescription = p.description 
              ? p.description.replace(/<[^>]*>/g, '').substring(0, 100) 
              : '';
            
            productCatalog += `\n• ${p.name}`;
            productCatalog += `\n  Precio: ${price}`;
            productCatalog += `\n  Tallas/Variantes disponibles: ${variants}`;
            if (cleanDescription) {
              productCatalog += `\n  ${cleanDescription}`;
            }
            productCatalog += '\n';
          });
          
          console.log(`Loaded ${products.length} products for context`);
        }
      } catch (err) {
        console.error("Error loading products:", err);
      }
    }

    // Build the full system prompt
    const fullSystemPrompt = (systemPrompt || "Eres un asistente virtual amigable. Responde siempre en español.") + productCatalog;

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
        max_tokens: 500,
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
