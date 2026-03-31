import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-HOLIDAY-SUGGESTIONS] ${step}${detailsStr}`);
};

// Modelos a intentar en orden de preferencia
const GEMINI_MODELS = [
  'gemini-2.5-flash',
];

async function callGeminiWithFallback(apiKey: string, prompt: string): Promise<{ text: string; model: string }> {
  for (const model of GEMINI_MODELS) {
    logStep(`Trying model: ${model}`);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          })
        }
      );

      if (response.status === 404) {
        logStep(`Model ${model} not found (404), trying next...`);
        continue;
      }

      if (response.status === 429) {
        logStep(`Model ${model} rate limited (429)`);
        throw new Error("API rate limited. Intenta de nuevo en unos segundos.");
      }

      if (!response.ok) {
        const errorText = await response.text();
        logStep(`Model ${model} error`, { status: response.status, error: errorText.substring(0, 300) });
        continue;
      }

      const data = await response.json();
      const candidates = data.candidates || [];
      for (const candidate of candidates) {
        for (const part of (candidate.content?.parts || [])) {
          if (part.text) {
            logStep(`Model ${model} succeeded`);
            return { text: part.text, model };
          }
        }
      }

      logStep(`Model ${model} returned no text`);
      continue;
    } catch (error) {
      if ((error as Error).message.includes('rate limit')) throw error;
      logStep(`Model ${model} exception: ${(error as Error).message}`);
      continue;
    }
  }

  throw new Error(`Ningún modelo de Gemini disponible. Modelos intentados: ${GEMINI_MODELS.join(', ')}`);
}

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

    // 1. Verify JWT or service-role cron mode
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");

    let orgId: string;

    // Check if this is a service-role cron call with org_id in body
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);

    if (body.org_id && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      // Cron / service-role mode: org_id provided directly
      orgId = body.org_id;
      logStep("Service-role mode", { orgId });
    } else {
      // Normal user mode: verify JWT
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError) throw new Error(`Auth error: ${userError.message}`);
      const user = userData.user;
      logStep("User authenticated", { userId: user.id });

      // 2. Get profile and org
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .single();
      if (!profile) {
        return new Response(JSON.stringify({ error: 'Profile not found' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      orgId = profile.organization_id;
      logStep("Profile verified", { orgId });
    }

    // 3. Parse request (body already parsed above)
    const { year, market_filter } = body;
    if (!year) throw new Error("year is required");
    logStep("Request parsed", { year, market_filter });

    // 4. Call Gemini API with fallback
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

    // First, list available models to log them
    try {
      const modelsResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      if (modelsResp.ok) {
        const modelsData = await modelsResp.json();
        const modelNames = (modelsData.models || []).map((m: any) => m.name).filter((n: string) => n.includes('flash') || n.includes('pro'));
        logStep("Available Gemini models", { models: modelNames.slice(0, 10) });
      }
    } catch {
      logStep("Could not list models");
    }

    const systemPrompt = `Eres un experto en marketing de e-commerce para una marca de ropa térmica infantil (Dosmicos) que opera en Colombia y USA.

Genera una lista de fechas culturales, comerciales y de marca relevantes para campañas de marketing para el año ${year}.

Para cada fecha incluye:
- name: nombre del evento/holiday SIEMPRE en español (ej: "Día de la Madre", no "Mother's Day"). No dupliques la misma fecha con nombres diferentes.
- date: fecha exacta en formato YYYY-MM-DD (para el año ${year})
- market: "co" | "us" | "both"
- category: "cultural" | "commercial" | "brand" | "seasonal"
- expected_impact: "high" | "medium" | "low"
- why_now: explicación estratégica de POR QUÉ Dosmicos debería hacer campaña (conectar con ropa térmica infantil, mamás, frío, regalos)
- quarter_peak: "q1" | "q2" | "q3" | "q4"
- suggested_event_type: "promotion" | "cultural_moment" | "product_launch"
- campaign_idea: una idea breve de campaña específica para Dosmicos

Incluye: holidays nacionales de Colombia y USA, fechas comerciales (Black Friday, Cyber Monday, Prime Day), fechas de regalos (Día de la Madre, Navidad, Amor y Amistad), cambios de temporada relevantes para ropa térmica, back to school, y cualquier fecha emergente o trending que sea relevante.

Solo incluye fechas que sean posteriores a la fecha actual (${new Date().toISOString().split('T')[0]}). No incluyas fechas que ya pasaron.

${market_filter && market_filter !== 'both' ? `Filtra solo para el mercado: ${market_filter}` : 'Incluye ambos mercados: Colombia y USA.'}

Responde SOLO con un JSON array válido. No uses markdown, no uses backticks, solo el JSON puro.`;

    const { text: responseText, model: usedModel } = await callGeminiWithFallback(GEMINI_API_KEY, systemPrompt);
    logStep("Gemini response received", { model: usedModel });

    // 5. Extract JSON from response
    let suggestions: any[] = [];
    try {
      let cleanText = responseText.trim();
      // Limpiar markdown wrapping si existe
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
      }
      // Limpiar cualquier texto antes del primer [ o después del último ]
      const firstBracket = cleanText.indexOf('[');
      const lastBracket = cleanText.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleanText = cleanText.substring(firstBracket, lastBracket + 1);
      }
      suggestions = JSON.parse(cleanText);
    } catch {
      logStep("Failed to parse JSON", { text: responseText.substring(0, 300) });
      throw new Error("Gemini no devolvió un JSON válido");
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error("No se generaron sugerencias");
    }
    logStep("Suggestions parsed", { count: suggestions.length });

    // 6. Upsert into holiday_suggestions
    const rows = suggestions.map((s: any) => ({
      org_id: orgId,
      name: s.name,
      date: s.date,
      market: s.market || 'both',
      category: s.category || 'commercial',
      expected_impact: s.expected_impact || 'medium',
      why_now: s.why_now || null,
      quarter_peak: s.quarter_peak || null,
      suggested_event_type: s.suggested_event_type || 'promotion',
      campaign_idea: s.campaign_idea || null,
      status: 'suggested',
      is_ai_generated: true,
      source_model: usedModel,
      year: year,
    }));

    let insertedCount = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const { data: existing } = await supabaseAdmin
        .from('holiday_suggestions')
        .select('id, status')
        .eq('org_id', orgId)
        .eq('name', row.name)
        .eq('date', row.date)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted' || existing.status === 'dismissed') continue;
        const { error: updateError } = await supabaseAdmin
          .from('holiday_suggestions')
          .update({ ...row, status: existing.status, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (updateError) errors.push(`Update ${row.name}: ${updateError.message}`);
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('holiday_suggestions')
          .insert(row);
        if (insertError) {
          errors.push(`Insert ${row.name}: ${insertError.message}`);
        } else {
          insertedCount++;
        }
      }
    }

    if (errors.length > 0) {
      logStep("DB errors during upsert", { errors: errors.slice(0, 5) });
    }

    logStep("Upsert complete", { total: rows.length, newInserts: insertedCount, dbErrors: errors.length });

    // 7. Return all suggestions for this year
    const { data: allSuggestions } = await supabaseAdmin
      .from('holiday_suggestions')
      .select('*')
      .eq('org_id', orgId)
      .eq('year', year)
      .order('date', { ascending: true });

    return new Response(JSON.stringify({
      suggestions: allSuggestions || [],
      generated: rows.length,
      new_inserts: insertedCount,
      model_used: usedModel,
      db_errors: errors.length > 0 ? errors.slice(0, 3) : undefined,
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
