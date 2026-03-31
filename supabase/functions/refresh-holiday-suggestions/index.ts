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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceKey,
      { auth: { persistSession: false } }
    );

    // Determine auth mode: cron (no user auth) vs user-initiated
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";
    let orgIds: string[] = [];
    let isCronMode = false;

    // Try to authenticate as a user first
    if (authHeader && token !== serviceKey) {
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (!userError && userData?.user) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('organization_id')
          .eq('id', userData.user.id)
          .single();
        if (profile) {
          orgIds = [profile.organization_id];
          logStep("User mode", { orgId: profile.organization_id });
        }
      }
    }

    // If no user was authenticated, treat as cron mode (all orgs)
    if (orgIds.length === 0) {
      isCronMode = true;
      logStep("Cron mode: refreshing all organizations");

      const { data: orgs, error: orgsError } = await supabaseAdmin
        .from('organizations')
        .select('id');
      if (orgsError) throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
      orgIds = (orgs || []).map((o: any) => o.id);
      logStep("Organizations found", { count: orgIds.length });
    }

    const today = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    const results: any[] = [];

    for (const orgId of orgIds) {
      logStep(`Processing org: ${orgId}`);

      // 1. Auto-dismiss past suggestions that are still 'suggested'
      const { data: dismissed, error: dismissError } = await supabaseAdmin
        .from('holiday_suggestions')
        .update({ status: 'dismissed', updated_at: new Date().toISOString() })
        .eq('org_id', orgId)
        .eq('status', 'suggested')
        .lt('date', today)
        .select('id, name, date');

      if (dismissError) {
        logStep(`Dismiss error for org ${orgId}`, { error: dismissError.message });
      } else {
        logStep(`Dismissed past suggestions`, { orgId, count: dismissed?.length || 0 });
      }

      // 2. Regenerate suggestions for current year via generate-holiday-suggestions
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/generate-holiday-suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
          },
          body: JSON.stringify({
            year: currentYear,
            org_id: orgId,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logStep(`Generation failed for org ${orgId}`, { status: response.status, error: errorText.substring(0, 300) });
          results.push({ org_id: orgId, dismissed: dismissed?.length || 0, generated: 0, error: errorText.substring(0, 200) });
        } else {
          const data = await response.json();
          logStep(`Generated for org ${orgId}`, { count: data.generated });
          results.push({ org_id: orgId, dismissed: dismissed?.length || 0, generated: data.generated, new_inserts: data.new_inserts });
        }
      } catch (genError) {
        logStep(`Generation exception for org ${orgId}`, { error: (genError as Error).message });
        results.push({ org_id: orgId, dismissed: dismissed?.length || 0, generated: 0, error: (genError as Error).message });
      }
    }

    logStep("Refresh complete", { orgsProcessed: results.length });

    return new Response(JSON.stringify({
      results,
      refreshed_at: new Date().toISOString(),
      orgs_processed: results.length,
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
