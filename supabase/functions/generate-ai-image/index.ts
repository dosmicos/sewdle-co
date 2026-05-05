import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-AI-IMAGE] ${step}${detailsStr}`);
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

    // 1. Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    logStep("User authenticated", { userId: user.id });

    // 2. Get profile and verify admin
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

    // 3. Rate limit check
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from('ai_image_generations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('created_at', today.toISOString());
    if ((count ?? 0) >= 50) {
      return new Response(JSON.stringify({ error: 'Daily limit reached (50/day)', count }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    logStep("Rate limit OK", { used: count, limit: 50 });

    // 4. Parse request
    const { mode, prompt, resolution = '2K', output_format = 'png', seed_image_ids = [], base_image, template_id } = await req.json();
    if (!mode || !prompt) throw new Error("mode and prompt are required");
    logStep("Request parsed", { mode, resolution, seedCount: seed_image_ids.length });

    // 5. Fetch template if needed
    let finalPrompt = prompt;
    if (mode === 'template' && template_id) {
      const { data: template } = await supabaseAdmin
        .from('ai_templates')
        .select('prompt_base')
        .eq('id', template_id)
        .single();
      if (template) {
        finalPrompt = `${template.prompt_base}. ${prompt}`;
      }
    }

    // 6. Fetch seed image URLs
    const seedImageUrls: string[] = [];
    if (seed_image_ids.length > 0) {
      const { data: seeds } = await supabaseAdmin
        .from('ai_seed_images')
        .select('image_url')
        .in('id', seed_image_ids);
      if (seeds) {
        for (const s of seeds) seedImageUrls.push(s.image_url);
      }
      if (seedImageUrls.length > 0) {
        finalPrompt = `Use these reference images as style guide. ${finalPrompt}`;
      }
    }
    logStep("Prompt built", { promptLength: finalPrompt.length, seedUrls: seedImageUrls.length });

    // 7. Call Gemini API (Nano Banana 2)
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

    const parts: any[] = [];

    // Add seed images as inline_data
    for (const url of seedImageUrls) {
      try {
        const imgResponse = await fetch(url);
        if (!imgResponse.ok) continue;
        const imgBuffer = await imgResponse.arrayBuffer();
        const bytes = new Uint8Array(imgBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Img = btoa(binary);
        const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';
        parts.push({ inline_data: { mime_type: mimeType, data: base64Img } });
      } catch (e) {
        logStep("Failed to fetch seed image", { url, error: (e as Error).message });
      }
    }

    // Add base image for edit mode
    if (mode === 'edit' && base_image) {
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: base_image } });
    }

    // Add text prompt
    parts.push({ text: finalPrompt });

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      logStep("Gemini API error", { status: geminiResponse.status, error: errorText });

      if (geminiResponse.status === 429) {
        throw new Error("API rate limited. Intenta de nuevo en unos segundos.");
      }
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    logStep("Gemini response received");

    // 8. Extract image from response
    let imageBase64 = '';
    let imageMimeType = 'image/png';
    const candidates = geminiData.candidates || [];
    for (const candidate of candidates) {
      for (const part of (candidate.content?.parts || [])) {
        if (part.inlineData || part.inline_data) {
          const inlineData = part.inlineData || part.inline_data;
          imageBase64 = inlineData.data;
          imageMimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
          break;
        }
      }
      if (imageBase64) break;
    }

    if (!imageBase64) {
      // Check if there's a text response with a refusal
      let textResponse = '';
      for (const candidate of candidates) {
        for (const part of (candidate.content?.parts || [])) {
          if (part.text) textResponse += part.text;
        }
      }
      logStep("No image in response", { textResponse: textResponse.substring(0, 200) });
      throw new Error("No se pudo generar la imagen. Intenta con un prompt diferente.");
    }
    logStep("Image extracted", { mimeType: imageMimeType, size: imageBase64.length });

    // 9. Upload to temp storage
    const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    const ext = imageMimeType.includes('png') ? 'png' : 'jpeg';
    const fileName = `${orgId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('publicidad-temp')
      .upload(fileName, bytes, {
        contentType: imageMimeType,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);
    logStep("Image uploaded to temp storage", { path: uploadData.path });

    // 10. Create signed URL (1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('publicidad-temp')
      .createSignedUrl(uploadData.path, 3600);

    if (signedUrlError) throw new Error(`Signed URL error: ${signedUrlError.message}`);
    logStep("Signed URL created");

    // 11. Save generation record
    const { data: generation, error: genError } = await supabaseAdmin
      .from('ai_image_generations')
      .insert({
        organization_id: orgId,
        user_id: user.id,
        mode,
        prompt: finalPrompt,
        template_id: template_id || null,
        base_image_url: base_image ? 'base64-provided' : null,
        resolution,
        output_format: ext,
        config: { seed_image_ids }
      })
      .select('id')
      .single();

    if (genError) logStep("Failed to save generation record", { error: genError.message });

    // Save seed junction records
    if (generation && seed_image_ids.length > 0) {
      const junctionRows = seed_image_ids.map((seedId: string) => ({
        generation_id: generation.id,
        seed_image_id: seedId
      }));
      await supabaseAdmin.from('ai_generation_seeds').insert(junctionRows);
    }

    logStep("Generation complete", { generationId: generation?.id });

    return new Response(JSON.stringify({
      image_url: signedUrlData.signedUrl,
      generation_id: generation?.id,
      generations_today: (count ?? 0) + 1
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
