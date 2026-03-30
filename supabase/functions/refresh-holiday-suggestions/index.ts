import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REFRESH-HOLIDAY-SUGGESTIONS] ${step}${detailsStr}`);
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

    // 2. Get profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) throw new Error('Profile not found');
    const orgId = profile.organization_id;
    logStep("Profile verified", { orgId });

    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    // 3. Mark old years' suggestions as outdated (delete suggested ones from past years)
    const { data: outdated } = await supabaseAdmin
      .from('holiday_suggestions')
      .update({ updated_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .lt('year', currentYear)
      .eq('status', 'suggested')
      .select('id');
    logStep("Outdated suggestions marked", { count: outdated?.length || 0 });

    // 4. Generate for current year
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const generateForYear = async (year: number) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-holiday-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({ year }),
      });

      if (!response.ok) {
        const error = await response.text();
        logStep(`Generation failed for ${year}`, { error });
        return { year, error, suggestions: [] };
      }

      const data = await response.json();
      logStep(`Generated for ${year}`, { count: data.generated });
      return { year, ...data };
    };

    // Generate for both years
    const [currentYearResult, nextYearResult] = await Promise.all([
      generateForYear(currentYear),
      generateForYear(nextYear),
    ]);

    logStep("Refresh complete");

    return new Response(JSON.stringify({
      current_year: currentYearResult,
      next_year: nextYearResult,
      refreshed_at: new Date().toISOString(),
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
