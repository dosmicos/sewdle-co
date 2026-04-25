import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";

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
  // complete_payment_value was rejected at AUCTION_AD level previously,
  // but complete_payment_roas alone (the ROAS) is documented as valid in
  // TikTok's metric reference and not in any rejection list we've seen.
  // Conversion value is then derived as roas × spend.
  "complete_payment_roas",
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

    // ─── 1) Ad-level report ──────────────────────────────────────────
    let adRows: ReportRow[];
    try {
      adRows = await fetchReport(
        accessToken,
        advertiserId,
        "AUCTION_AD",
        startDate,
        endDate,
        AD_METRICS
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
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

    // ─── 2) Fetch metadata first to know which ads are active ────────
    // Active = operation_status === 'ENABLE'. ad_metrics_daily aggregates only
    // active ads so the dashboard ROAS reflects current campaign performance,
    // not retroactive spend from paused ads.
    const adIdsSet = new Set<string>();
    for (const row of adRows) {
      if (row.dimensions.ad_id) adIdsSet.add(row.dimensions.ad_id);
    }

    const adMetadata = await fetchAdMetadata(
      accessToken,
      advertiserId,
      Array.from(adIdsSet)
    );

    const activeAdIds = new Set<string>();
    for (const ad of adMetadata) {
      if (ad.operation_status === "ENABLE") activeAdIds.add(ad.ad_id);
    }

    // ─── 3) Loop ad rows: upsert per-ad (all) and aggregate active to
    //        activeDailyTotals for the account-level row ──────────────
    const activeDailyTotals = new Map<
      string,
      {
        spend: number;
        impressions: number;
        clicks: number;
        conversions: number;
        conversionValue: number;
        purchases: number;
      }
    >();

    let syncedAdDays = 0;

    for (const row of adRows) {
      const adId = row.dimensions.ad_id;
      if (!adId) continue;

      const m = row.metrics;
      const date = row.dimensions.stat_time_day;
      const spend = num(m.spend);
      // m.conversion mirrors the campaign's optimization event (Complete Payment
      // for Dosmicos' Shopify pixel) and matches the "Conversiones / Compras"
      // column in TikTok UI. Pixel-specific names like total_purchase return 0.
      const purchases = int(m.conversion);
      const conversions = int(m.conversion);
      const impressions = int(m.impressions);
      const clicks = int(m.clicks);
      // Revenue derived from complete_payment_roas × spend (matches
      // "ROAS de Pago completado (sitio web)" × spend in TikTok UI).
      const roas = num(m.complete_payment_roas);
      const conversionValue = roas * spend;
      const cpa = num(m.cost_per_conversion);

      const { error: upErr } = await supabase
        .from("tiktok_ad_metrics_daily")
        .upsert(
          {
            organization_id: organizationId,
            tiktok_ad_id: adId,
            date,
            spend,
            impressions,
            clicks,
            conversions,
            conversion_value: conversionValue,
            purchases,
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
            roas,
            cpa,
          },
          { onConflict: "organization_id,tiktok_ad_id,date" }
        );

      if (upErr) {
        console.error(`Error upserting ad ${adId} ${date}:`, upErr);
      } else {
        syncedAdDays++;
      }

      if (activeAdIds.has(adId)) {
        const existing = activeDailyTotals.get(date) ?? {
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          conversionValue: 0,
          purchases: 0,
        };
        existing.spend += spend;
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.conversions += conversions;
        existing.conversionValue += conversionValue;
        existing.purchases += purchases;
        activeDailyTotals.set(date, existing);
      }
    }

    // ─── 4) Upsert ad_metrics_daily from active-only daily totals ────
    let syncedDays = 0;
    for (const [date, t] of activeDailyTotals) {
      const cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
      const cpm = t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0;
      const ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
      const roas = t.spend > 0 ? t.conversionValue / t.spend : 0;
      const cpa = t.purchases > 0 ? t.spend / t.purchases : 0;

      const { error: upErr } = await supabase
        .from("ad_metrics_daily")
        .upsert(
          {
            organization_id: organizationId,
            platform: "tiktok_ads",
            date,
            spend: t.spend,
            impressions: t.impressions,
            clicks: t.clicks,
            conversions: t.conversions,
            conversion_value: t.conversionValue,
            purchases: t.purchases,
            cpc,
            cpm,
            ctr,
            roas,
            cpa,
          },
          { onConflict: "organization_id,platform,date" }
        );

      if (upErr) {
        console.error(`Error upserting account-level ${date}:`, upErr);
      } else {
        syncedDays++;
      }
    }

    // ─── 5) Upsert ad metadata → tiktok_ads ─────────────────────────
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
        activeAds: activeAdIds.size,
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
