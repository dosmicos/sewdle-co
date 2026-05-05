import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[EXTRACT-BRAND] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    logStep("User authenticated", { userId: user.id });

    // Admin check
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'Administrador')) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const orgId = profile.organization_id;
    logStep("Admin verified", { orgId });

    // Mark as extracting
    await supabaseAdmin
      .from('brand_guides')
      .upsert({
        organization_id: orgId,
        extraction_status: 'extracting',
        created_by: user.id,
      }, { onConflict: 'organization_id' });

    // Fetch organization info
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('name, shopify_store_url, branding')
      .eq('id', orgId)
      .single();
    logStep("Organization loaded", { name: org?.name, storeUrl: org?.shopify_store_url });

    // Fetch products with images
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('name, image_url, base_price, category')
      .eq('organization_id', orgId)
      .not('image_url', 'is', null)
      .limit(6);
    logStep("Products fetched", { count: products?.length || 0 });

    if (!products || products.length === 0) {
      await supabaseAdmin
        .from('brand_guides')
        .update({ extraction_status: 'failed' })
        .eq('organization_id', orgId);
      throw new Error("No hay productos con imágenes. Sincroniza tus productos desde Shopify primero.");
    }

    // Download product images as base64
    const imageParts: any[] = [];
    const productImageUrls: string[] = [];

    for (const product of products) {
      if (!product.image_url) continue;
      try {
        const imgResponse = await fetch(product.image_url);
        if (!imgResponse.ok) continue;
        const imgBuffer = await imgResponse.arrayBuffer();
        const bytes = new Uint8Array(imgBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Img = btoa(binary);
        const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';
        imageParts.push({ inline_data: { mime_type: mimeType, data: base64Img } });
        productImageUrls.push(product.image_url);
      } catch (e) {
        logStep("Failed to fetch product image", { url: product.image_url, error: (e as Error).message });
      }
    }
    logStep("Images downloaded", { count: imageParts.length });

    // Build product context
    const productContext = products.map(p =>
      `- ${p.name} (${p.category || 'sin categoría'}) - $${p.base_price || 'N/A'}`
    ).join('\n');

    // Build Gemini prompt
    const analysisPrompt = `Analiza estas imágenes de productos y la información de la tienda para extraer una guía de identidad de marca completa.

Tienda: ${org?.name || 'Sin nombre'}
URL: ${org?.shopify_store_url || 'No disponible'}
Branding existente: ${JSON.stringify(org?.branding || {})}

Productos:
${productContext}

Analiza cuidadosamente las imágenes de productos y extrae:
1. La paleta de colores predominante (colores que se repiten en productos y estilo)
2. El estilo visual (minimalista, colorido, artesanal, moderno, etc.)
3. La voz de marca implícita (seria, juguetona, premium, casual, etc.)
4. El público objetivo probable basado en los productos y estilo
5. Lineamientos de diseño para mantener consistencia

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin explicaciones) con esta estructura exacta:
{
  "brand_name": "${org?.name || ''}",
  "tagline": "un tagline sugerido corto y memorable",
  "brand_voice": "3-5 adjetivos que describan la voz (ej: 'Cálida, cercana, artesanal')",
  "brand_tone": "descripción del tono (ej: 'Casual y amigable con toques de profesionalismo')",
  "target_audience": "descripción del público objetivo",
  "primary_color": "#hexcolor",
  "secondary_color": "#hexcolor",
  "accent_color": "#hexcolor",
  "colors": [{"hex": "#...", "name": "nombre del color", "usage": "uso sugerido"}],
  "fonts": {"heading": "fuente sugerida para títulos", "body": "fuente sugerida para cuerpo"},
  "visual_style": "descripción del estilo visual en 2-3 oraciones",
  "mood_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "do_list": ["guía 1 de lo que SÍ hacer", "guía 2", "guía 3", "guía 4"],
  "dont_list": ["guía 1 de lo que NO hacer", "guía 2", "guía 3", "guía 4"],
  "prompt_prefix": "Un párrafo completo de 100-150 palabras que debe agregarse al inicio de cualquier prompt de generación de imágenes publicitarias para esta marca. Incluye referencias específicas a colores (con hex), estilo visual, tono, y guías de composición. Debe ser en español."
}`;

    // Call Gemini API
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

    const parts: any[] = [...imageParts, { text: analysisPrompt }];

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      logStep("Gemini API error", { status: geminiResponse.status, error: errorText });
      await supabaseAdmin
        .from('brand_guides')
        .update({ extraction_status: 'failed' })
        .eq('organization_id', orgId);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    logStep("Gemini response received");

    // Extract text response
    let textResponse = '';
    const candidates = geminiData.candidates || [];
    for (const candidate of candidates) {
      for (const part of (candidate.content?.parts || [])) {
        if (part.text) textResponse += part.text;
      }
    }

    // Parse JSON from response
    let brandData: any;
    try {
      // Try direct parse first
      brandData = JSON.parse(textResponse);
    } catch {
      // Try extracting JSON from markdown code fences
      const jsonMatch = textResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        brandData = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try finding JSON object in text
        const objMatch = textResponse.match(/\{[\s\S]*\}/);
        if (objMatch) {
          brandData = JSON.parse(objMatch[0]);
        } else {
          throw new Error("No se pudo parsear la respuesta de Gemini");
        }
      }
    }
    logStep("Brand data parsed", { keys: Object.keys(brandData) });

    // Upsert brand guide
    const { data: brandGuide, error: upsertError } = await supabaseAdmin
      .from('brand_guides')
      .upsert({
        organization_id: orgId,
        brand_name: brandData.brand_name || org?.name || null,
        tagline: brandData.tagline || null,
        brand_voice: brandData.brand_voice || null,
        brand_tone: brandData.brand_tone || null,
        target_audience: brandData.target_audience || null,
        primary_color: brandData.primary_color || null,
        secondary_color: brandData.secondary_color || null,
        accent_color: brandData.accent_color || null,
        colors: brandData.colors || [],
        fonts: brandData.fonts || {},
        logo_url: null,
        product_image_urls: productImageUrls,
        mood_keywords: brandData.mood_keywords || [],
        visual_style: brandData.visual_style || null,
        do_list: brandData.do_list || [],
        dont_list: brandData.dont_list || [],
        prompt_prefix: brandData.prompt_prefix || null,
        source: 'auto',
        extraction_status: 'complete',
        last_extracted_at: new Date().toISOString(),
        created_by: user.id,
      }, { onConflict: 'organization_id' })
      .select()
      .single();

    if (upsertError) {
      logStep("Upsert error", { error: upsertError.message });
      throw new Error(`Error guardando guía: ${upsertError.message}`);
    }

    logStep("Brand guide saved successfully", { id: brandGuide?.id });

    return new Response(JSON.stringify({
      success: true,
      brand_guide: brandGuide,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logStep("ERROR", { message: (error as Error).message });
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
