import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

const AD_INSIGHT_FIELDS = [
  "campaign_name",
  "campaign_id",
  "adset_name",
  "adset_id",
  "ad_name",
  "ad_id",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "cpm",
  "clicks",
  "ctr",
  "cpc",
  "inline_link_clicks",
  "inline_link_click_ctr",
  "actions",
  "action_values",
  "cost_per_action_type",
  "video_thruplay_watched_actions",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p95_watched_actions",
  "video_p100_watched_actions",
  "video_avg_time_watched_actions",
].join(",");

/** Extract a value from Meta's actions/action_values/cost_per_action_type arrays */
function extractFromActions(
  actions: any[] | undefined,
  actionType: string
): number {
  if (!actions) return 0;
  const match = actions.find(
    (a: any) =>
      a.action_type === actionType ||
      a.action_type === `offsite_conversion.fb_pixel_${actionType}`
  );
  return match ? parseFloat(match.value) : 0;
}

/** Extract video metric value from video action arrays */
function extractVideoMetric(videoActions: any[] | undefined): number {
  if (!videoActions || videoActions.length === 0) return 0;
  // Video actions come as [{action_type: "video_view", value: "123"}]
  const match = videoActions.find(
    (a: any) => a.action_type === "video_view"
  );
  return match ? parseInt(match.value, 10) : 0;
}

/** Fetch with retry and exponential backoff for rate limits */
async function fetchWithRetry(
  url: string,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url);

    if (res.ok) return res;

    const body = await res.json().catch(() => null);
    const errorCode = body?.error?.code;

    // Rate limit errors (32 = API Too Many Calls, 17 = User request limit)
    if ((errorCode === 32 || errorCode === 17) && attempt < maxRetries) {
      const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      console.log(
        `Rate limited (code ${errorCode}), retrying in ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    // Return the response as-is for other errors
    return new Response(JSON.stringify(body), {
      status: res.status,
      headers: res.headers,
    });
  }

  throw new Error("Max retries exceeded");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId, startDate, endDate } = await req.json();

    if (!organizationId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({
          error: "Faltan campos: organizationId, startDate, endDate",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the active Meta ad account
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
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check token expiration
    if (
      adAccount.token_expires_at &&
      new Date(adAccount.token_expires_at) < new Date()
    ) {
      await supabase
        .from("ad_accounts")
        .update({ is_active: false })
        .eq("id", adAccount.id);

      return new Response(
        JSON.stringify({
          error: "El token de Meta Ads ha expirado. Reconecta tu cuenta.",
          needsReconnect: true,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const accessToken = adAccount.access_token;
    const accountId = adAccount.account_id;

    // Build the insights URL with ad-level breakdown
    const filtering = encodeURIComponent(
      JSON.stringify([
        {
          field: "ad.effective_status",
          operator: "IN",
          value: ["ACTIVE"],
        },
      ])
    );
    const timeRange = encodeURIComponent(
      JSON.stringify({ since: startDate, until: endDate })
    );

    const insightsUrl =
      `${GRAPH_API}/act_${accountId}/insights` +
      `?level=ad` +
      `&fields=${AD_INSIGHT_FIELDS}` +
      `&time_range=${timeRange}` +
      `&time_increment=1` +
      `&filtering=${filtering}` +
      `&limit=500` +
      `&access_token=${accessToken}`;

    console.log(
      `Fetching ad-level insights for account ${accountId} from ${startDate} to ${endDate}`
    );

    const insightsRes = await fetchWithRetry(insightsUrl);
    const insightsData = await insightsRes.json();

    // Handle Meta API errors
    if (insightsData.error) {
      console.error("Meta API error:", insightsData.error);

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
            error:
              "Token de Meta inválido o expirado. Reconecta tu cuenta.",
            needsReconnect: true,
          }),
          {
            status: 401,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: "Error de la API de Meta",
          details: insightsData.error.message,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Collect all pages of results
    let allInsights = [...(insightsData.data || [])];
    let nextPage = insightsData.paging?.next;

    while (nextPage) {
      const nextRes = await fetchWithRetry(nextPage);
      const nextData = await nextRes.json();
      if (nextData.data) {
        allInsights = [...allInsights, ...nextData.data];
      }
      nextPage = nextData.paging?.next;
    }

    console.log(`Got ${allInsights.length} ad-day rows from Meta`);

    let syncedAds = 0;
    const errors: string[] = [];

    for (const row of allInsights) {
      try {
        const spend = parseFloat(row.spend || "0");
        const impressions = parseInt(row.impressions || "0", 10);
        const reach = parseInt(row.reach || "0", 10);
        const frequency = parseFloat(row.frequency || "0");
        const cpm = parseFloat(row.cpm || "0");
        const clicks = parseInt(row.clicks || "0", 10);
        const linkClicks = parseInt(row.inline_link_clicks || "0", 10);
        const ctr = parseFloat(row.ctr || "0");
        const cpc = parseFloat(row.cpc || "0");

        // Parse conversion metrics from actions arrays
        const purchases = extractFromActions(row.actions, "purchase");
        const revenue = extractFromActions(row.action_values, "purchase");
        const addToCart = extractFromActions(row.actions, "add_to_cart");
        const initiateCheckout = extractFromActions(
          row.actions,
          "initiate_checkout"
        );
        const landingPageViews = extractFromActions(
          row.actions,
          "landing_page_view"
        );

        // Parse video metrics
        const videoThruplay = extractVideoMetric(
          row.video_thruplay_watched_actions
        );
        const videoP25 = extractVideoMetric(
          row.video_p25_watched_actions
        );
        const videoP50 = extractVideoMetric(
          row.video_p50_watched_actions
        );
        const videoP75 = extractVideoMetric(
          row.video_p75_watched_actions
        );
        const videoP95 = extractVideoMetric(
          row.video_p95_watched_actions
        );
        const videoP100 = extractVideoMetric(
          row.video_p100_watched_actions
        );
        const videoAvgTime = row.video_avg_time_watched_actions?.[0]?.value
          ? parseFloat(row.video_avg_time_watched_actions[0].value)
          : null;

        // Calculate derived metrics
        const roas = spend > 0 ? revenue / spend : 0;
        const cpa = purchases > 0 ? spend / purchases : 0;
        const hookRate =
          impressions > 0 && videoThruplay > 0
            ? (videoThruplay / impressions) * 100
            : null;
        const holdRate =
          videoThruplay > 0 && videoP75 > 0
            ? (videoP75 / videoThruplay) * 100
            : null;
        const lpConvRate =
          landingPageViews > 0
            ? (purchases / landingPageViews) * 100
            : null;
        const atcRate =
          landingPageViews > 0
            ? (addToCart / landingPageViews) * 100
            : null;

        const { error: upsertError } = await supabase
          .from("ad_performance_daily")
          .upsert(
            {
              organization_id: organizationId,
              date: row.date_start,
              ad_id: row.ad_id,
              ad_name: row.ad_name,
              campaign_id: row.campaign_id,
              campaign_name: row.campaign_name,
              adset_id: row.adset_id,
              adset_name: row.adset_name,
              spend,
              impressions,
              reach,
              frequency,
              cpm,
              clicks,
              link_clicks: linkClicks,
              ctr,
              cpc,
              purchases,
              revenue,
              add_to_cart: addToCart,
              initiate_checkout: initiateCheckout,
              landing_page_views: landingPageViews,
              video_thruplay: videoThruplay || null,
              video_p25: videoP25 || null,
              video_p50: videoP50 || null,
              video_p75: videoP75 || null,
              video_p95: videoP95 || null,
              video_p100: videoP100 || null,
              video_avg_time: videoAvgTime,
              roas,
              cpa,
              hook_rate: hookRate,
              hold_rate: holdRate,
              lp_conv_rate: lpConvRate,
              atc_rate: atcRate,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,date,ad_id" }
          );

        if (upsertError) {
          console.error(
            `Error upserting ad ${row.ad_id} on ${row.date_start}:`,
            upsertError
          );
          errors.push(
            `${row.ad_name} (${row.date_start}): ${upsertError.message}`
          );
        } else {
          syncedAds++;
        }
      } catch (rowError) {
        console.error(`Error processing ad ${row.ad_id}:`, rowError);
        errors.push(
          `${row.ad_name}: ${
            rowError instanceof Error ? rowError.message : "Error desconocido"
          }`
        );
      }
    }

    // Update last sync timestamp
    await supabase
      .from("ad_accounts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", adAccount.id);

    return new Response(
      JSON.stringify({
        success: true,
        syncedAds,
        totalAds: allInsights.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-meta-ad-performance error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
