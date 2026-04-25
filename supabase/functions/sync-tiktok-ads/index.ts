import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";

// TikTok's BASIC report rejects complete_payment* metrics for this account
// (they require pixel/EAPI configuration not yet active). Stick to generic
// conversion metrics until purchase tracking is wired through TikTok Pixel.
// Purchase value / ROAS will read 0 in tiktok_ad_metrics_daily and ad_metrics_daily
// for the tiktok_ads platform until then.
const ACCOUNT_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "conversion",
  "cpc",
  "cpm",
  "ctr",
  "conversion_rate",
  "cost_per_conversion",
];

const AD_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "conversion",
  "cpc",
  "cpm",
  "ctr",
  "conversion_rate",
  "cost_per_conversion",
  "video_play_actions",
  "video_watched_2s",
  "video_watched_6s",
  "video_views_p25",
  "video_views_p50",
  "video_views_p75",
  "video_views_p100",
];

interface ReportRow {
  dimensions: { stat_time_day: string; ad_id?: string };
  metrics: Record<string, string | number>;
}

async function fetchReport(
  accessToken: string,
  advertiserId: string,
  dataLevel: "AUCTION_ADVERTISER" | "AUCTION_AD",
  startDate: string,
  endDate: string,
  metrics: string[]
): Promise<ReportRow[]> {
  const dimensions =
    dataLevel === "AUCTION_AD" ? ["ad_id", "stat_time_day"] : ["stat_time_day"];

  const all: ReportRow[] = [];
  let page = 1;
  const pageSize = 1000;

  while (true) {
    const params = new URLSearchParams({
      advertiser_id: advertiserId,
      report_type: "BASIC",
      data_level: dataLevel,
      dimensions: JSON.stringify(dimensions),
      metrics: JSON.stringify(metrics),
      start_date: startDate,
      end_date: endDate,
      page: String(page),
      page_size: String(pageSize),
    });

    const res = await fetch(`${TIKTOK_API}/report/integrated/get/?${params}`, {
      headers: { "Access-Token": accessToken },
    });
    const json = await res.json();

    if (json.code !== 0) {
      throw new Error(
        `TikTok report error (data_level=${dataLevel}): ${json.message || JSON.stringify(json)}`
      );
    }

    const list: ReportRow[] = json.data?.list || [];
    all.push(...list);

    const totalPage = json.data?.page_info?.total_page ?? 1;
    if (page >= totalPage) break;
    page++;
  }

  return all;
}

async function fetchAdMetadata(
  accessToken: string,
  advertiserId: string,
  adIds: string[]
): Promise<any[]> {
  if (adIds.length === 0) return [];

  const all: any[] = [];
  // TikTok /ad/get/ supports up to 100 ad_ids per call
  for (let i = 0; i < adIds.length; i += 100) {
    const batch = adIds.slice(i, i + 100);
    const params = new URLSearchParams({
      advertiser_id: advertiserId,
      filtering: JSON.stringify({ ad_ids: batch }),
      fields: JSON.stringify([
        "ad_id",
        "ad_name",
        "adgroup_id",
        "adgroup_name",
        "campaign_id",
        "campaign_name",
        "ad_text",
        "call_to_action",
        "video_id",
        "image_ids",
        "image_urls",
        "landing_page_url",
        "ad_format",
        "operation_status",
      ]),
      page: "1",
      page_size: "100",
    });

    const res = await fetch(`${TIKTOK_API}/ad/get/?${params}`, {
      headers: { "Access-Token": accessToken },
    });
    const json = await res.json();

    if (json.code !== 0) {
      console.error(
        `TikTok /ad/get/ error: ${json.message || JSON.stringify(json)}`
      );
      continue;
    }

    all.push(...(json.data?.list || []));
  }

  return all;
}

function num(v: any): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
function int(v: any): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: adAccount, error: accountError } = await supabase
      .from("ad_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("platform", "tiktok_ads")
      .eq("is_active", true)
      .single();

    if (accountError || !adAccount) {
      return new Response(
        JSON.stringify({
          error: "No hay cuenta de TikTok Ads conectada",
          needsReconnect: true,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = adAccount.access_token;
    const advertiserId = adAccount.account_id;

    // ─── 1) Account-level report → ad_metrics_daily ─────────────────
    let accountRows: ReportRow[];
    try {
      accountRows = await fetchReport(
        accessToken,
        advertiserId,
        "AUCTION_ADVERTISER",
        startDate,
        endDate,
        ACCOUNT_METRICS
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // TikTok auth-related codes: 40105 (token invalid), 40000-40099 generic
      if (/40105|invalid_token|access token/i.test(msg)) {
        await supabase
          .from("ad_accounts")
          .update({ is_active: false })
          .eq("id", adAccount.id);
        return new Response(
          JSON.stringify({
            error: "Token de TikTok inválido. Reconecta tu cuenta.",
            needsReconnect: true,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    // ─── 2) Ad-level report (run BEFORE account-level upsert so we can
    //        aggregate payment totals by date) ─────────────────────────
    const adRows = await fetchReport(
      accessToken,
      advertiserId,
      "AUCTION_AD",
      startDate,
      endDate,
      AD_METRICS
    );

    let syncedAdDays = 0;
    const adIdsSet = new Set<string>();

    for (const row of adRows) {
      const adId = row.dimensions.ad_id;
      if (!adId) continue;
      adIdsSet.add(adId);

      const m = row.metrics;
      const date = row.dimensions.stat_time_day;

      const { error: upErr } = await supabase
        .from("tiktok_ad_metrics_daily")
        .upsert(
          {
            organization_id: organizationId,
            tiktok_ad_id: adId,
            date,
            spend: num(m.spend),
            impressions: int(m.impressions),
            clicks: int(m.clicks),
            conversions: int(m.conversion),
            conversion_value: 0,
            purchases: 0,
            video_views: int(m.video_play_actions),
            video_views_2s: int(m.video_watched_2s),
            video_views_6s: int(m.video_watched_6s),
            video_views_p25: int(m.video_views_p25),
            video_views_p50: int(m.video_views_p50),
            video_views_p75: int(m.video_views_p75),
            video_views_p100: int(m.video_views_p100),
            cpc: num(m.cpc),
            cpm: num(m.cpm),
            ctr: num(m.ctr),
            cvr: num(m.conversion_rate),
            roas: 0,
            cpa: 0,
          },
          { onConflict: "organization_id,tiktok_ad_id,date" }
        );

      if (upErr) {
        console.error(`Error upserting ad ${adId} ${date}:`, upErr);
      } else {
        syncedAdDays++;
      }
    }

    // ─── Account-level upsert → ad_metrics_daily ────────────────────
    let syncedDays = 0;
    for (const row of accountRows) {
      const m = row.metrics;
      const date = row.dimensions.stat_time_day;
      const spend = num(m.spend);

      const { error: upErr } = await supabase
        .from("ad_metrics_daily")
        .upsert(
          {
            organization_id: organizationId,
            platform: "tiktok_ads",
            date,
            spend,
            impressions: int(m.impressions),
            clicks: int(m.clicks),
            conversions: int(m.conversion),
            conversion_value: 0,
            purchases: 0,
            cpc: num(m.cpc),
            cpm: num(m.cpm),
            ctr: num(m.ctr),
            roas: 0,
            cpa: 0,
          },
          { onConflict: "organization_id,platform,date" }
        );

      if (upErr) {
        console.error(`Error upserting account-level ${date}:`, upErr);
      } else {
        syncedDays++;
      }
    }

    // ─── 3) Ad metadata → tiktok_ads ────────────────────────────────
    const adMetadata = await fetchAdMetadata(
      accessToken,
      advertiserId,
      Array.from(adIdsSet)
    );

    let syncedAds = 0;
    for (const ad of adMetadata) {
      const { error: upErr } = await supabase.from("tiktok_ads").upsert(
        {
          organization_id: organizationId,
          advertiser_id: advertiserId,
          tiktok_ad_id: ad.ad_id,
          tiktok_adgroup_id: ad.adgroup_id ?? null,
          tiktok_campaign_id: ad.campaign_id ?? null,
          ad_name: ad.ad_name ?? null,
          adgroup_name: ad.adgroup_name ?? null,
          campaign_name: ad.campaign_name ?? null,
          ad_text: ad.ad_text ?? null,
          call_to_action: ad.call_to_action ?? null,
          video_id: ad.video_id ?? null,
          image_urls: Array.isArray(ad.image_urls) ? ad.image_urls : [],
          landing_url: ad.landing_page_url ?? null,
          ad_format: ad.ad_format ?? null,
          status: ad.operation_status ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,tiktok_ad_id" }
      );

      if (upErr) {
        console.error(`Error upserting tiktok_ads ${ad.ad_id}:`, upErr);
      } else {
        syncedAds++;
      }
    }

    await supabase
      .from("ad_accounts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", adAccount.id);

    return new Response(
      JSON.stringify({
        success: true,
        syncedDays,
        syncedAdDays,
        syncedAds,
        uniqueAds: adIdsSet.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-tiktok-ads error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
