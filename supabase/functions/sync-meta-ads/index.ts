import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

// Fields we request from the Meta Marketing API
const INSIGHT_FIELDS = [
  "spend",
  "impressions",
  "clicks",
  "cpc",
  "cpm",
  "ctr",
  "actions",
  "action_values",
  "cost_per_action_type",
  "purchase_roas",
].join(",");

/**
 * Extracts purchases count from the `actions` array.
 * Meta returns actions as: [{ action_type: "purchase", value: "5" }, ...]
 */
function extractPurchases(actions: any[] | undefined): number {
  if (!actions) return 0;
  const purchaseAction = actions.find(
    (a: any) =>
      a.action_type === "purchase" ||
      a.action_type === "offsite_conversion.fb_pixel_purchase"
  );
  return purchaseAction ? parseInt(purchaseAction.value, 10) : 0;
}

/**
 * Extracts conversion value (purchase value) from `action_values` array.
 */
function extractConversionValue(actionValues: any[] | undefined): number {
  if (!actionValues) return 0;
  const purchaseValue = actionValues.find(
    (a: any) =>
      a.action_type === "purchase" ||
      a.action_type === "offsite_conversion.fb_pixel_purchase"
  );
  return purchaseValue ? parseFloat(purchaseValue.value) : 0;
}

/**
 * Extracts cost per purchase from `cost_per_action_type` array.
 */
function extractCPA(costPerAction: any[] | undefined): number {
  if (!costPerAction) return 0;
  const purchaseCost = costPerAction.find(
    (a: any) =>
      a.action_type === "purchase" ||
      a.action_type === "offsite_conversion.fb_pixel_purchase"
  );
  return purchaseCost ? parseFloat(purchaseCost.value) : 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId, startDate, endDate } = await req.json();

    if (!organizationId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "Faltan campos: organizationId, startDate, endDate" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the active Meta ad account for this organization
    const { data: adAccount, error: accountError } = await supabase
      .from("ad_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("platform", "meta")
      .eq("is_active", true)
      .single();

    if (accountError || !adAccount) {
      return new Response(
        JSON.stringify({
          error: "No hay cuenta de Meta Ads conectada",
          needsReconnect: true,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check token expiration
    if (adAccount.token_expires_at && new Date(adAccount.token_expires_at) < new Date()) {
      // Mark account as inactive
      await supabase
        .from("ad_accounts")
        .update({ is_active: false })
        .eq("id", adAccount.id);

      return new Response(
        JSON.stringify({
          error: "El token de Meta Ads ha expirado. Reconecta tu cuenta.",
          needsReconnect: true,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = adAccount.access_token;
    const accountId = adAccount.account_id;

    // Fetch insights from Meta Marketing API with daily breakdown
    const insightsUrl = `${GRAPH_API}/act_${accountId}/insights?fields=${INSIGHT_FIELDS}&time_range={"since":"${startDate}","until":"${endDate}"}&time_increment=1&access_token=${accessToken}&limit=500`;

    console.log(`Fetching Meta insights for account ${accountId} from ${startDate} to ${endDate}`);

    const insightsRes = await fetch(insightsUrl);
    const insightsData = await insightsRes.json();

    // Handle Meta API errors
    if (insightsData.error) {
      console.error("Meta API error:", insightsData.error);

      // Token expired or invalid
      if (
        insightsData.error.code === 190 ||
        insightsData.error.type === "OAuthException"
      ) {
        await supabase
          .from("ad_accounts")
          .update({ is_active: false })
          .eq("id", adAccount.id);

        return new Response(
          JSON.stringify({
            error: "Token de Meta inválido o expirado. Reconecta tu cuenta.",
            needsReconnect: true,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          error: "Error de la API de Meta",
          details: insightsData.error.message,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process each day's data and upsert into ad_metrics_daily
    const dailyInsights = insightsData.data || [];
    let syncedDays = 0;
    const errors: string[] = [];

    // Handle pagination if needed
    let allInsights = [...dailyInsights];
    let nextPage = insightsData.paging?.next;

    while (nextPage) {
      const nextRes = await fetch(nextPage);
      const nextData = await nextRes.json();
      if (nextData.data) {
        allInsights = [...allInsights, ...nextData.data];
      }
      nextPage = nextData.paging?.next;
    }

    console.log(`Got ${allInsights.length} days of data from Meta`);

    for (const day of allInsights) {
      try {
        const spend = parseFloat(day.spend || "0");
        const impressions = parseInt(day.impressions || "0", 10);
        const clicks = parseInt(day.clicks || "0", 10);
        const cpc = parseFloat(day.cpc || "0");
        const cpm = parseFloat(day.cpm || "0");
        const ctr = parseFloat(day.ctr || "0");
        const purchases = extractPurchases(day.actions);
        const conversionValue = extractConversionValue(day.action_values);
        const cpa = extractCPA(day.cost_per_action_type);

        // ROAS from Meta (if available) or calculate
        let roas = 0;
        if (day.purchase_roas && day.purchase_roas.length > 0) {
          roas = parseFloat(day.purchase_roas[0].value || "0");
        } else if (spend > 0) {
          roas = conversionValue / spend;
        }

        const { error: upsertError } = await supabase
          .from("ad_metrics_daily")
          .upsert(
            {
              organization_id: organizationId,
              platform: "meta",
              date: day.date_start,
              spend,
              impressions,
              clicks,
              conversions: purchases,
              conversion_value: conversionValue,
              purchases,
              cpc,
              cpm,
              ctr,
              roas,
              cpa,
            },
            { onConflict: "organization_id,platform,date" }
          );

        if (upsertError) {
          console.error(`Error upserting ${day.date_start}:`, upsertError);
          errors.push(`${day.date_start}: ${upsertError.message}`);
        } else {
          syncedDays++;
        }
      } catch (dayError) {
        console.error(`Error processing day ${day.date_start}:`, dayError);
        errors.push(
          `${day.date_start}: ${dayError instanceof Error ? dayError.message : "Error desconocido"}`
        );
      }
    }

    // Update last sync timestamp on the ad account
    await supabase
      .from("ad_accounts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", adAccount.id);

    return new Response(
      JSON.stringify({
        success: true,
        syncedDays,
        totalDays: allInsights.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-meta-ads error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
