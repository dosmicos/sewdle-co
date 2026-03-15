import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ADS_API = "https://googleads.googleapis.com/v17";

/**
 * Refreshes an access token using a refresh token.
 */
async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

// GAQL query to fetch daily account-level metrics
const GAQL_QUERY = `
  SELECT
    segments.date,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.conversions_value,
    metrics.cost_per_conversion,
    metrics.average_cpc,
    metrics.average_cpm,
    metrics.ctr
  FROM customer
  WHERE segments.date BETWEEN '{startDate}' AND '{endDate}'
  ORDER BY segments.date
`;

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

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET");
    const DEVELOPER_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !DEVELOPER_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Credenciales de Google Ads no configuradas en el servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the active Google Ads account for this organization
    const { data: adAccount, error: accountError } = await supabase
      .from("ad_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("platform", "google_ads")
      .eq("is_active", true)
      .single();

    if (accountError || !adAccount) {
      return new Response(
        JSON.stringify({
          error: "No hay cuenta de Google Ads conectada",
          needsReconnect: true,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The refresh token is stored in access_token column
    const storedRefreshToken = adAccount.refresh_token || adAccount.access_token;

    if (!storedRefreshToken) {
      return new Response(
        JSON.stringify({
          error: "No se encontró refresh token. Reconecta tu cuenta de Google Ads.",
          needsReconnect: true,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh the access token (Google access tokens expire in ~1 hour)
    let accessToken: string;
    try {
      accessToken = await refreshAccessToken(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        storedRefreshToken
      );
    } catch (refreshError) {
      console.error("Google Ads token refresh error:", refreshError);

      // Mark account as inactive
      await supabase
        .from("ad_accounts")
        .update({ is_active: false })
        .eq("id", adAccount.id);

      return new Response(
        JSON.stringify({
          error: "El token de Google Ads ha expirado o fue revocado. Reconecta tu cuenta.",
          needsReconnect: true,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customerId = adAccount.account_id;

    // Build the GAQL query with date range
    const query = GAQL_QUERY
      .replace("{startDate}", startDate)
      .replace("{endDate}", endDate);

    console.log(`Fetching Google Ads insights for customer ${customerId} from ${startDate} to ${endDate}`);

    // Query Google Ads API using searchStream
    const searchRes = await fetch(
      `${GOOGLE_ADS_API}/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": DEVELOPER_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );

    const searchData = await searchRes.json();

    // Handle Google Ads API errors
    if (searchData.error) {
      console.error("Google Ads API error:", searchData.error);

      if (searchData.error.code === 401) {
        await supabase
          .from("ad_accounts")
          .update({ is_active: false })
          .eq("id", adAccount.id);

        return new Response(
          JSON.stringify({
            error: "Token de Google Ads inválido. Reconecta tu cuenta.",
            needsReconnect: true,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          error: "Error de la API de Google Ads",
          details: searchData.error.message,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // searchStream returns an array of batches, each with a results array
    const allResults: any[] = [];
    if (Array.isArray(searchData)) {
      for (const batch of searchData) {
        if (batch.results) {
          allResults.push(...batch.results);
        }
      }
    }

    console.log(`Got ${allResults.length} days of data from Google Ads`);

    let syncedDays = 0;
    const errors: string[] = [];

    for (const result of allResults) {
      try {
        const date = result.segments?.date;
        if (!date) continue;

        const metrics = result.metrics || {};

        // Google Ads reports cost in micros (1/1,000,000 of the currency)
        const spend = (metrics.costMicros || 0) / 1_000_000;
        const impressions = metrics.impressions || 0;
        const clicks = metrics.clicks || 0;
        const conversions = metrics.conversions || 0;
        const conversionValue = metrics.conversionsValue || 0;

        // CPC and CPM come in micros too
        const cpc = (metrics.averageCpc || 0) / 1_000_000;
        const cpm = (metrics.averageCpm || 0) / 1_000_000;

        // CTR comes as a fraction (0.05 = 5%)
        const ctr = (metrics.ctr || 0) * 100;

        // CPA (cost per conversion) in micros
        const cpa = (metrics.costPerConversion || 0) / 1_000_000;

        // ROAS
        const roas = spend > 0 ? conversionValue / spend : 0;

        const { error: upsertError } = await supabase
          .from("ad_metrics_daily")
          .upsert(
            {
              organization_id: organizationId,
              platform: "google_ads",
              date,
              spend,
              impressions,
              clicks,
              conversions,
              conversion_value: conversionValue,
              purchases: Math.round(conversions), // Google Ads conversions ≈ purchases
              cpc,
              cpm,
              ctr,
              roas,
              cpa,
            },
            { onConflict: "organization_id,platform,date" }
          );

        if (upsertError) {
          console.error(`Error upserting ${date}:`, upsertError);
          errors.push(`${date}: ${upsertError.message}`);
        } else {
          syncedDays++;
        }
      } catch (dayError) {
        const date = result.segments?.date || "unknown";
        console.error(`Error processing day ${date}:`, dayError);
        errors.push(
          `${date}: ${dayError instanceof Error ? dayError.message : "Error desconocido"}`
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
        syncedDays,
        totalDays: allResults.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-google-ads error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
