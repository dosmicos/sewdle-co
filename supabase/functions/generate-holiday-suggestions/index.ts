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
    const orgId = profile.organization_id;
    logStep("Profile verified", { orgId });

    // 3. Parse request
    const { year, market_filter } = await req.json();
    if (!year) throw new Error("year is required");
    logStep("Request parsed", { year, market_filter });

    // 4. Call Gemini API
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

    const systemPrompt = `Eres un experto en marketing de e-commerce para una marca de ropa térmica infantil (Dosmicos) que opera en Colombia y USA.

Genera una lista de fechas culturales, comerciales y de marca relevantes para campañas de marketing para el año ${year}.

Para cada fecha incluye:
- name: nombre del evento/holiday
- date: fecha exacta en formato YYYY-MM-DD (para el año ${year})
- market: "co" | "us" | "both"
- category: "cultural" | "commercial" | "brand" | "seasonal"
- expected_impact: "high" | "medium" | "low"
- why_now: explicación estratégica de POR QUÉ Dosmicos debería hacer campaña (conectar con ropa térmica infantil, mamás, frío, regalos)
- quarter_peak: "q1" | "q2" | "q3" | "q4"
- suggested_event_type: "promotion" | "cultural_moment" | "product_launch"
- campaign_idea: una idea breve de campaña específica para Dosmicos

Incluye: holidays nacionales de Colombia y USA, fechas comerciales (Black Friday, Cyber Monday, Prime Day), fechas de regalos (Día de la Madre, Navidad, Amor y Amistad), cambios de temporada relevantes para ropa térmica, back to school, y cualquier fecha emergente o trending que sea relevante.

${market_filter && market_filter !== 'both' ? `Filtra solo para el mercado: ${market_filter}` : 'Incluye ambos mercados: Colombia y USA.'}

Responde SOLO con un JSON array válido.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
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

    // 5. Extract JSON from response
    let suggestions: any[] = [];
    const candidates = geminiData.candidates || [];
    for (const candidate of candidates) {
      for (const part of (candidate.content?.parts || [])) {
        if (part.text) {
          try {
            suggestions = JSON.parse(part.text);
          } catch {
            logStep("Failed to parse JSON from Gemini", { text: part.text.substring(0, 200) });
            throw new Error("Gemini no devolvió un JSON válido");
          }
        }
      }
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
      source_model: 'gemini-2.0-flash',
      year: year,
    }));

    // Upsert: don't duplicate if same org+name+date exists
    let insertedCount = 0;
    for (const row of rows) {
      const { data: existing } = await supabaseAdmin
        .from('holiday_suggestions')
        .select('id, status')
        .eq('org_id', orgId)
        .eq('name', row.name)
        .eq('date', row.date)
        .maybeSingle();

      if (existing) {
        // Don't overwrite accepted or dismissed
        if (existing.status === 'accepted' || existing.status === 'dismissed') {
          continue;
        }
        await supabaseAdmin
          .from('holiday_suggestions')
          .update({
            ...row,
            status: existing.status, // preserve current status
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('holiday_suggestions')
          .insert(row);
        if (!insertError) insertedCount++;
      }
    }

    logStep("Upsert complete", { total: rows.length, newInserts: insertedCount });

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
