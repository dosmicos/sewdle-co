/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildKpi,
  normalizePercentMetric,
  resolveBogotaWeek,
  scorecardCustomerKey,
  summarizeCustomerAcquisition,
  summarizeStaticCreatives,
  toBogotaIsoWindow,
  worstStatus,
  type Kpi,
  type KpiStatus,
  type StaticDriveAssetRow,
  type StaticDriveFolderRow,
} from "../_shared/growth-team-scorecard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

type SupabaseAny = any;

type GrowthWeeklyTarget = {
  id: string;
  label: string;
  period_start: string;
  period_end: string;
  revenue_target: number;
  ad_spend_budget: number;
  mer_target: number;
  cm_percent_target: number;
  new_customers_target: number;
  ugc_content_target: number;
  ugc_active_creators_target: number;
  static_creatives_target: number;
  static_published_target: number;
};

type OwnerScorecard = {
  label: string;
  role: string;
  status: KpiStatus;
  kpis: Record<string, Kpi>;
  notes: string[];
};

type RiskMatrixRow = {
  key: string;
  label: string;
  owner: string;
  actual: number | null;
  target: number | null;
  status: KpiStatus;
  trigger: string;
  valueType: "cop" | "number" | "percent" | "mer";
};

type AdPerformanceRow = {
  ad_id?: string | null;
  spend?: number | string | null;
  revenue?: number | string | null;
  purchases?: number | string | null;
  clicks?: number | string | null;
  impressions?: number | string | null;
  add_to_cart?: number | string | null;
  landing_page_views?: number | string | null;
};

type AdTagRow = {
  ad_id?: string | null;
  product?: string | null;
  product_name?: string | null;
  creative_type?: string | null;
  hook_description?: string | null;
  specific_angle?: string | null;
  hook_pattern?: string | null;
  ugc_creator_handle?: string | null;
};

type KiraAngleStatus = "winner" | "promising" | "loser" | "needs_data";

type KiraAngleSummary = {
  specific_angle: string;
  label: string;
  product: string | null;
  creative_type: string | null;
  hook_pattern: string | null;
  best_hook: string | null;
  total_spend: number;
  total_revenue: number;
  total_purchases: number;
  roas: number;
  cpa: number;
  ctr: number;
  ad_count: number;
  status: KiraAngleStatus;
};

type KiraCreativeDirectionSummary = {
  reportAvailable: boolean;
  rankedAngles: KiraAngleSummary[];
  winnerCount: number;
  promisingCount: number;
  loserCount: number;
  focusAngles: string[];
  totalTaggedAds: number;
  totalSpend: number;
};

const SPECIFIC_ANGLE_LABELS: Record<string, string> = {
  sleeping_se_destapa_sin_cobijas: "Sleeping — se destapa / sin cobijas",
  sleeping_rutina_noche_tranquila: "Sleeping — rutina de noche tranquila",
  sleeping_tog_clima_correcto: "Sleeping — TOG / clima correcto",
  sleeping_bebe_abrigado_sin_sobrecalentar: "Sleeping — bebé abrigado sin sobrecalentar",
  ruana_facil_de_poner: "Ruana — fácil de poner",
  ruana_cobijita_puesta: "Ruana — cobijita puesta",
  ruana_animalitos_ninos_la_aman: "Ruana — animalitos que los niños aman",
  ruana_regalo_util: "Ruana — regalo útil",
  ruana_casa_carro_jardin: "Ruana — casa / carro / jardín",
  parka_tierra_fria: "Parka — tierra fría",
  parka_frio_lluvia_salidas: "Parka — frío / lluvia / salidas",
  parka_viaje_clima_frio: "Parka — viaje a clima frío",
  parka_abrigo_sin_peso: "Parka — abrigo sin peso",
  generic_product_benefit: "Beneficio de producto genérico",
  unknown: "Sin ángulo claro",
};

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function maybeNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function kpiWithStatus(actual: number | null, target: number | null, direction: "higher_better" | "lower_better", status: KpiStatus): Kpi {
  const base = buildKpi(actual, target, direction);
  return { ...base, status };
}

function strictMerKpi(actual: number | null, target: number | null): Kpi {
  if (actual === null || target === null || target === 0) return buildKpi(actual, target, "higher_better");
  const status: KpiStatus = actual >= target ? "green" : actual >= target * 0.9 ? "yellow" : "red";
  return kpiWithStatus(actual, target, "higher_better", status);
}

function cmKpi(actual: number | null, target = 25): Kpi {
  if (actual === null) return buildKpi(actual, target, "higher_better");
  const status: KpiStatus = actual >= target ? "green" : actual >= 22 ? "yellow" : "red";
  return kpiWithStatus(actual, target, "higher_better", status);
}

function ncRevenueKpi(actual: number | null, target = 10): Kpi {
  if (actual === null) return buildKpi(actual, target, "higher_better");
  const status: KpiStatus = actual >= target ? "green" : actual >= 5 ? "yellow" : "red";
  return kpiWithStatus(actual, target, "higher_better", status);
}

function wasteRateKpi(actual: number | null): Kpi {
  if (actual === null) return buildKpi(actual, 30, "lower_better");
  const status: KpiStatus = actual <= 30 ? "green" : actual <= 40 ? "yellow" : "red";
  return kpiWithStatus(actual, 30, "lower_better", status);
}

function frequencyKpi(actual: number | null): Kpi {
  if (actual === null) return buildKpi(actual, 2.5, "lower_better");
  const status: KpiStatus = actual < 2.5 ? "green" : actual <= 3 ? "yellow" : "red";
  return kpiWithStatus(actual, 2.5, "lower_better", status);
}

function stockKpi(actual: number | null): Kpi {
  if (actual === null) return buildKpi(actual, 30, "higher_better");
  const status: KpiStatus = actual >= 30 ? "green" : actual >= 15 ? "yellow" : "red";
  return kpiWithStatus(actual, 30, "higher_better", status);
}

function maxZeroKpi(actual: number | null): Kpi {
  if (actual === null) return buildKpi(actual, 0, "lower_better");
  const status: KpiStatus = actual === 0 ? "green" : actual <= 2 ? "yellow" : "red";
  return kpiWithStatus(actual, 0, "lower_better", status);
}

function binaryAvailabilityKpi(available: boolean): Kpi {
  return buildKpi(available ? 1 : 0, 1, "higher_better");
}

function creativeSupplyKpi(actual: number | null, target: number): Kpi {
  if (actual === null) return buildKpi(actual, target, "higher_better");
  const yellowFloor = target === 40 ? 32 : 24;
  const status: KpiStatus = actual >= target ? "green" : actual >= yellowFloor ? "yellow" : "red";
  return kpiWithStatus(actual, target, "higher_better", status);
}

function normalizeJune600mTarget(target: GrowthWeeklyTarget): GrowthWeeklyTarget {
  const june600mTargets: Record<string, Partial<GrowthWeeklyTarget>> = {
    "2026-06-01": { label: "Semana 1 · Jun 1–7", revenue_target: 105000000, ad_spend_budget: 30000000, mer_target: 3.5, new_customers_target: 600 },
    "2026-06-08": { label: "Semana 2 · Jun 8–14", revenue_target: 140000000, ad_spend_budget: 36000000, mer_target: 3.89, new_customers_target: 850 },
    "2026-06-15": { label: "Semana 3 · Jun 15–21", revenue_target: 160000000, ad_spend_budget: 38000000, mer_target: 4.21, new_customers_target: 950 },
    "2026-06-22": { label: "Semana 4 · Jun 22–28", revenue_target: 170000000, ad_spend_budget: 40000000, mer_target: 4.25, new_customers_target: 1000 },
    "2026-06-29": { label: "Final · Jun 29–30", revenue_target: 25000000, ad_spend_budget: 6000000, mer_target: 4.17, new_customers_target: 200 },
  };
  const override = june600mTargets[target.period_start];
  if (!override) return target;
  return {
    ...target,
    ...override,
    cm_percent_target: 25,
    ugc_content_target: 40,
    ugc_active_creators_target: 35,
    static_creatives_target: 30,
    static_published_target: 24,
  };
}

async function fetchCurrentTarget(sb: SupabaseAny, organizationId: string, periodStart: string, periodEnd: string): Promise<GrowthWeeklyTarget> {
  const { data, error } = await sb
    .from("growth_weekly_targets")
    .select("*")
    .eq("organization_id", organizationId)
    .lte("period_start", periodStart)
    .gte("period_end", periodEnd)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return normalizeJune600mTarget(data as GrowthWeeklyTarget);

  const fallback = resolveBogotaWeek(new Date(`${periodStart}T12:00:00Z`));
  return normalizeJune600mTarget({
    id: "fallback",
    label: fallback.label,
    period_start: periodStart,
    period_end: periodEnd,
    revenue_target: 0,
    ad_spend_budget: 0,
    mer_target: 4,
    cm_percent_target: 25,
    new_customers_target: 0,
    ugc_content_target: 40,
    ugc_active_creators_target: 35,
    static_creatives_target: 30,
    static_published_target: 24,
  });
}

async function fetchProphitMetrics(authHeader: string, organizationId: string, periodStart: string, periodEnd: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const currentRange = toBogotaIsoWindow(periodStart, periodEnd);
  const res = await fetch(`${supabaseUrl}/functions/v1/prophit-metrics`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organizationId,
      currentRange,
      previousRange: null,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`prophit-metrics failed ${res.status}: ${text}`);
  }
  return await res.json();
}

async function fetchUgcMetrics(sb: SupabaseAny, organizationId: string, periodStart: string, periodEnd: string) {
  const startIso = `${periodStart}T00:00:00.000Z`;
  const endIso = `${periodEnd}T00:00:00.000Z`;
  const activeStatuses = ["aceptado", "producto_enviado", "producto_recibido", "video_en_revision", "video_aprobado", "publicado"];

  const [videosRes, campaignsRes, linksRes, ordersRes] = await Promise.all([
    sb.from("ugc_videos").select("id, creator_id, created_at, status").eq("organization_id", organizationId).gte("created_at", startIso).lt("created_at", endIso),
    sb.from("ugc_campaigns").select("id, creator_id, status").eq("organization_id", organizationId).in("status", activeStatuses),
    sb.from("ugc_discount_links").select("id, is_active").eq("organization_id", organizationId).eq("is_active", true),
    sb.from("ugc_attributed_orders").select("id, order_total, order_date").eq("organization_id", organizationId).gte("order_date", startIso).lt("order_date", endIso),
  ]);

  for (const res of [videosRes, campaignsRes, linksRes, ordersRes]) {
    if (res.error) throw res.error;
  }

  const activeCreators = new Set((campaignsRes.data ?? []).map((row: { creator_id: string }) => row.creator_id));
  const cmdRevenue = (ordersRes.data ?? []).reduce((sum: number, row: { order_total?: number | string }) => sum + num(row.order_total), 0);

  return {
    contentPieces: (videosRes.data ?? []).length,
    activeCreators: activeCreators.size,
    activeLinks: (linksRes.data ?? []).length,
    cmdOrders: (ordersRes.data ?? []).length,
    cmdRevenue,
  };
}

function angleLabel(angle?: string | null): string {
  if (!angle) return SPECIFIC_ANGLE_LABELS.unknown;
  return SPECIFIC_ANGLE_LABELS[angle] ?? angle.replace(/_/g, " ");
}

function angleDecisionStatus(input: { spend: number; purchases: number; roas: number; cpa: number; adCount: number }): KiraAngleStatus {
  const { spend, purchases, roas, cpa, adCount } = input;
  if (spend >= 150000 && purchases >= 3 && roas >= 1.8 && (adCount >= 2 || spend >= 250000)) return "winner";
  if (spend >= 120000 && (purchases === 0 || (cpa > 0 && cpa >= 120000 && roas < 1.2))) return "loser";
  if ((purchases >= 1 && roas >= 1.5) || (spend >= 80000 && roas >= 1.5)) return "promising";
  return "needs_data";
}

function topByValue(map: Map<string, number>): string | null {
  const [top] = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  return top?.[0] ?? null;
}

async function fetchKiraCreativeDirection(sb: SupabaseAny, organizationId: string, periodStart: string, periodEnd: string): Promise<KiraCreativeDirectionSummary> {
  const { data: perfData, error } = await sb
    .from("ad_performance_daily")
    .select("ad_id, spend, revenue, purchases, clicks, impressions, add_to_cart, landing_page_views")
    .eq("organization_id", organizationId)
    .gte("date", periodStart)
    .lt("date", periodEnd);

  if (error) throw error;

  const rows = ((perfData ?? []) as AdPerformanceRow[]).filter((row) => row.ad_id);
  const adIds = Array.from(new Set(rows.map((row) => row.ad_id).filter(Boolean))) as string[];
  if (adIds.length === 0) {
    return { reportAvailable: false, rankedAngles: [], winnerCount: 0, promisingCount: 0, loserCount: 0, focusAngles: [], totalTaggedAds: 0, totalSpend: 0 };
  }

  const tagsMap = new Map<string, AdTagRow>();
  for (let i = 0; i < adIds.length; i += 500) {
    const batch = adIds.slice(i, i + 500);
    const { data: tagsData, error: tagsError } = await sb
      .from("ad_tags")
      .select("ad_id, product, product_name, creative_type, hook_description, specific_angle, hook_pattern, ugc_creator_handle")
      .eq("organization_id", organizationId)
      .in("ad_id", batch);
    if (tagsError) throw tagsError;
    for (const tag of (tagsData ?? []) as AdTagRow[]) {
      if (tag.ad_id) tagsMap.set(tag.ad_id, tag);
    }
  }

  const groups = new Map<string, {
    adIds: Set<string>;
    spend: number;
    revenue: number;
    purchases: number;
    clicks: number;
    impressions: number;
    productCounts: Map<string, number>;
    creativeCounts: Map<string, number>;
    hookPatternCounts: Map<string, number>;
    hookRevenue: Map<string, number>;
  }>();

  const addCount = (map: Map<string, number>, key: string | null | undefined, increment = 1) => {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + increment);
  };

  let totalTaggedAds = 0;
  for (const row of rows) {
    const adId = row.ad_id!;
    const tag = tagsMap.get(adId);
    const angle = tag?.specific_angle;
    if (!angle || angle === "unknown") continue;
    totalTaggedAds += 1;

    if (!groups.has(angle)) {
      groups.set(angle, {
        adIds: new Set(),
        spend: 0,
        revenue: 0,
        purchases: 0,
        clicks: 0,
        impressions: 0,
        productCounts: new Map(),
        creativeCounts: new Map(),
        hookPatternCounts: new Map(),
        hookRevenue: new Map(),
      });
    }

    const group = groups.get(angle)!;
    const spend = num(row.spend);
    const revenue = num(row.revenue);
    group.adIds.add(adId);
    group.spend += spend;
    group.revenue += revenue;
    group.purchases += num(row.purchases);
    group.clicks += num(row.clicks);
    group.impressions += num(row.impressions);
    addCount(group.productCounts, tag?.product_name || tag?.product);
    addCount(group.creativeCounts, tag?.creative_type);
    addCount(group.hookPatternCounts, tag?.hook_pattern);
    addCount(group.hookRevenue, tag?.hook_description, revenue);
  }

  const rankedAngles = Array.from(groups.entries()).map(([angle, group]) => {
    const roas = group.spend > 0 ? group.revenue / group.spend : 0;
    const cpa = group.purchases > 0 ? group.spend / group.purchases : 0;
    const ctr = group.impressions > 0 ? (group.clicks / group.impressions) * 100 : 0;
    const status = angleDecisionStatus({ spend: group.spend, purchases: group.purchases, roas, cpa, adCount: group.adIds.size });
    return {
      specific_angle: angle,
      label: angleLabel(angle),
      product: topByValue(group.productCounts),
      creative_type: topByValue(group.creativeCounts),
      hook_pattern: topByValue(group.hookPatternCounts),
      best_hook: topByValue(group.hookRevenue),
      total_spend: group.spend,
      total_revenue: group.revenue,
      total_purchases: group.purchases,
      roas,
      cpa,
      ctr,
      ad_count: group.adIds.size,
      status,
    };
  }).sort((a, b) => {
    const rank: Record<KiraAngleStatus, number> = { winner: 0, promising: 1, needs_data: 2, loser: 3 };
    const statusDiff = rank[a.status] - rank[b.status];
    if (statusDiff !== 0) return statusDiff;
    if (b.total_purchases !== a.total_purchases) return b.total_purchases - a.total_purchases;
    return b.roas - a.roas;
  });

  const winnerCount = rankedAngles.filter((angle) => angle.status === "winner").length;
  const promisingCount = rankedAngles.filter((angle) => angle.status === "promising").length;
  const loserCount = rankedAngles.filter((angle) => angle.status === "loser").length;
  const focusAngles = rankedAngles
    .filter((angle) => angle.status === "winner" || angle.status === "promising")
    .slice(0, 3)
    .map((angle) => angle.label);

  return {
    reportAvailable: rankedAngles.length > 0,
    rankedAngles,
    winnerCount,
    promisingCount,
    loserCount,
    focusAngles,
    totalTaggedAds,
    totalSpend: rankedAngles.reduce((sum, angle) => sum + angle.total_spend, 0),
  };
}

type AcquisitionOrderRow = {
  customer_id?: string | number | null;
  customer_email?: string | null;
  current_total_price?: string | number | null;
  total_price?: string | number | null;
};

async function fetchAcquisitionOrders(sb: SupabaseAny, organizationId: string, startIso: string, endIso: string): Promise<AcquisitionOrderRow[]> {
  const pageSize = 1000;
  const rows: AcquisitionOrderRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from("shopify_orders")
      .select("customer_id, customer_email, current_total_price:raw_data->current_total_price, total_price, financial_status, cancelled_at, created_at_shopify")
      .eq("organization_id", organizationId)
      .gte("created_at_shopify", startIso)
      .lte("created_at_shopify", endIso)
      .not("financial_status", "eq", "voided")
      .is("cancelled_at", null)
      .order("created_at_shopify", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch.filter((row: { financial_status?: string | null }) => row.financial_status !== "refunded"));
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function fetchPriorReturningKeys(sb: SupabaseAny, organizationId: string, orders: AcquisitionOrderRow[], startIso: string): Promise<Set<string>> {
  const periodCustomerIds = new Set<string | number>();
  const periodEmailsOnly = new Set<string>();

  for (const order of orders) {
    if (order.customer_id != null) {
      periodCustomerIds.add(order.customer_id);
    } else if (order.customer_email) {
      periodEmailsOnly.add(order.customer_email.trim().toLowerCase());
    }
  }

  const returningKeys = new Set<string>();
  const idArray = Array.from(periodCustomerIds);
  for (let i = 0; i < idArray.length; i += 200) {
    const batch = idArray.slice(i, i + 200);
    const { data, error } = await sb
      .from("shopify_orders")
      .select("customer_id")
      .eq("organization_id", organizationId)
      .lt("created_at_shopify", startIso)
      .in("customer_id", batch)
      .is("cancelled_at", null)
      .not("financial_status", "eq", "voided")
      .limit(50000);
    if (error) throw error;
    for (const row of data ?? []) {
      const key = scorecardCustomerKey(row);
      if (key) returningKeys.add(key);
    }
  }

  const emailArray = Array.from(periodEmailsOnly);
  for (let i = 0; i < emailArray.length; i += 200) {
    const batch = emailArray.slice(i, i + 200);
    const { data, error } = await sb
      .from("shopify_orders")
      .select("customer_email")
      .eq("organization_id", organizationId)
      .lt("created_at_shopify", startIso)
      .in("customer_email", batch)
      .is("customer_id", null)
      .is("cancelled_at", null)
      .not("financial_status", "eq", "voided")
      .limit(50000);
    if (error) throw error;
    for (const row of data ?? []) {
      const key = scorecardCustomerKey(row);
      if (key) returningKeys.add(key);
    }
  }

  return returningKeys;
}

async function fetchCustomerAcquisitionMetrics(sb: SupabaseAny, organizationId: string, periodStart: string, periodEnd: string) {
  const range = toBogotaIsoWindow(periodStart, periodEnd);
  const orders = await fetchAcquisitionOrders(sb, organizationId, range.start, range.end);
  const priorReturningKeys = await fetchPriorReturningKeys(sb, organizationId, orders, range.start);
  return summarizeCustomerAcquisition(orders, priorReturningKeys);
}

function owner(label: string, role: string, kpis: Record<string, Kpi>, notes: string[] = []): OwnerScorecard {
  return { label, role, kpis, notes, status: worstStatus(Object.values(kpis).map((kpi) => kpi.status)) };
}

function riskRow(key: string, label: string, ownerName: string, kpi: Kpi, trigger: string, valueType: RiskMatrixRow["valueType"]): RiskMatrixRow {
  return { key, label, owner: ownerName, actual: kpi.actual, target: kpi.target, status: kpi.status, trigger, valueType };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const week = body?.periodStart && body?.periodEnd
      ? { label: "Semana seleccionada", start: String(body.periodStart), end: String(body.periodEnd) }
      : resolveBogotaWeek();
    const organizationId = body?.organizationId;
    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authHeader } } });

    const [target, prophit, customerAcquisition, ugc, kiraCreativeDirection, foldersRes, assetsRes] = await Promise.all([
      fetchCurrentTarget(sb, organizationId, week.start, week.end),
      fetchProphitMetrics(authHeader, organizationId, week.start, week.end),
      fetchCustomerAcquisitionMetrics(sb, organizationId, week.start, week.end),
      fetchUgcMetrics(sb, organizationId, week.start, week.end),
      fetchKiraCreativeDirection(sb, organizationId, week.start, week.end),
      sb.from("growth_static_drive_folders").select("product_key, product_name, drive_folder_id").eq("organization_id", organizationId).eq("active", true).order("product_key"),
      sb.from("growth_static_drive_assets").select("drive_file_id, product_key, product_name, source_folder_id, file_name, created_time, attributed_person_key, attributed_person_label, web_view_link").eq("organization_id", organizationId).gte("created_time", `${week.start}T00:00:00.000Z`).lt("created_time", `${week.end}T00:00:00.000Z`).eq("trashed", false).order("created_time", { ascending: false }),
    ]);

    if (foldersRes.error) throw foldersRes.error;
    if (assetsRes.error) throw assetsRes.error;

    const current = prophit.current ?? {};
    const revenue = maybeNum(current.netSales ?? current.grossRevenue);
    const adSpend = maybeNum(current.adSpend);
    const mer = maybeNum(current.mer);
    const cmPercent = maybeNum(current.cmPercent);
    const computedNewCustomers = customerAcquisition.newCustomerCount;
    const newCustomersFromProphit = maybeNum(current.newCustomerCount ?? current.newCustomers);
    const newCustomers = computedNewCustomers > 0 || newCustomersFromProphit === null
      ? computedNewCustomers
      : newCustomersFromProphit;
    const orders = maybeNum(current.orders);
    const aov = maybeNum(current.aov);
    const ncpa = adSpend !== null && newCustomers !== null && newCustomers > 0 ? adSpend / newCustomers : null;
    const computedNcRevenuePercent = revenue !== null && revenue > 0
      ? (customerAcquisition.newCustomerRevenue / revenue) * 100
      : null;
    const ncRevenuePercent = computedNcRevenuePercent ?? normalizePercentMetric(maybeNum(current.newCustomerRevenuePct));

    const staticCreatives = summarizeStaticCreatives(
      (assetsRes.data ?? []) as StaticDriveAssetRow[],
      (foldersRes.data ?? []) as StaticDriveFolderRow[],
      week.start,
      week.end,
      num(target.static_creatives_target),
    );

    const revenueKpi = buildKpi(revenue, num(target.revenue_target), "higher_better");
    const adSpendKpi = buildKpi(adSpend, num(target.ad_spend_budget), "higher_better");
    const merKpi = strictMerKpi(mer, num(target.mer_target));
    const cmPercentKpi = cmKpi(cmPercent, num(target.cm_percent_target));
    const ncRevenuePercentKpi = ncRevenueKpi(ncRevenuePercent, 10);
    const ugcPiecesKpi = creativeSupplyKpi(ugc.contentPieces, num(target.ugc_content_target));
    const staticsProducedKpi = creativeSupplyKpi(staticCreatives.total, num(target.static_creatives_target));
    const kiraSalesAngleReportKpi = binaryAvailabilityKpi(kiraCreativeDirection.reportAvailable);
    const kiraTopAnglesKpi = buildKpi(kiraCreativeDirection.rankedAngles.length, 3, "higher_better");
    const kiraFocusDefinedKpi = binaryAvailabilityKpi(kiraCreativeDirection.focusAngles.length > 0);
    const kiraAnglesAtRiskKpi = maxZeroKpi(kiraCreativeDirection.loserCount);
    const kiraFocusNote = kiraCreativeDirection.focusAngles.length > 0
      ? `Foco semanal sugerido desde AngleOS: ${kiraCreativeDirection.focusAngles.join(" · ")}.`
      : "AngleOS no encontró winners/promising suficientes para definir foco semanal automático.";
    const kiraSourceNote = kiraCreativeDirection.reportAvailable
      ? `Conectado a ad_tags + ad_performance_daily: ${kiraCreativeDirection.rankedAngles.length} ángulos rankeados, ${kiraCreativeDirection.winnerCount} winners, ${kiraCreativeDirection.promisingCount} promising y ${kiraCreativeDirection.loserCount} en riesgo.`
      : "Sin ángulos estructurados en ad_tags/ad_performance_daily para la semana seleccionada; revisar sync/tagging AngleOS.";
    const wasteKpi = wasteRateKpi(null);
    const frequencyWinnersKpi = frequencyKpi(null);
    const stockActiveSkuKpi = stockKpi(null);

    const company = {
      revenue: revenueKpi,
      adSpend: adSpendKpi,
      mer: merKpi,
      cmPercent: cmPercentKpi,
      newCustomers: buildKpi(newCustomers, num(target.new_customers_target), "higher_better"),
      aov: buildKpi(aov, 150000, "higher_better"),
      ncpa: buildKpi(ncpa, 41700, "lower_better"),
      ncRevenuePercent: ncRevenuePercentKpi,
    };

    const owners = {
      julian: owner("Julian", "Paid media + oferta", {
        spend: adSpendKpi,
        mer: merKpi,
        aov: company.aov,
        mutations: buildKpi(null, null, "higher_better"),
        graduatedAds: buildKpi(null, 3, "higher_better"),
        testingWaste: wasteKpi,
      }, ["Dueño de Google/pixel/costos/margen; Sebastián solo expone status/unblockers cuando aplique."]),
      sebastian: owner("Sebastián", "UGC + CMD + web/email unblockers", {
        ugcPieces: ugcPiecesKpi,
        activeCreators: buildKpi(ugc.activeCreators, num(target.ugc_active_creators_target), "higher_better"),
        activeLinks: buildKpi(ugc.activeLinks, 120, "higher_better"),
        cmdRevenue: buildKpi(ugc.cmdRevenue, null, "higher_better"),
        cmdOrders: buildKpi(ugc.cmdOrders, null, "higher_better"),
      }),
      creativeProduction: owner("Angie + Ana María", "Producción creativa 50/50", {
        staticsProduced: staticsProducedKpi,
        angieStatics: buildKpi(staticCreatives.byPerson.angie ?? 0, 15, "higher_better"),
        anaMariaStatics: buildKpi(staticCreatives.byPerson.ana_maria ?? 0, 15, "higher_better"),
        staticsPublished: buildKpi(null, num(target.static_published_target), "higher_better"),
        needsReviewBacklog: buildKpi(null, null, "lower_better"),
        trackerCompleteness: buildKpi(null, null, "higher_better"),
      }, ["Meta semanal: 30 piezas producidas entre las dos (~15 c/u) y 24 publicadas/testeadas. info@dosmicos.co sigue Shared/Sin asignar."]),
      kira: owner("Kira", "Dirección creativa IA", {
        salesAngleReport: kiraSalesAngleReportKpi,
        topAnglesRanked: kiraTopAnglesKpi,
        focusDefined: kiraFocusDefinedKpi,
        anglesAtRisk: kiraAnglesAtRiskKpi,
      }, [kiraSourceNote, kiraFocusNote, "Fuente estructurada: AngleOS/ad_tags + ad_performance_daily; no toca el perfil/proceso de Kira."]),
      hermes: owner("Hermes", "Ops & publicación IA", {
        publishedToTesting: buildKpi(null, null, "higher_better"),
        graduatedAds: buildKpi(null, 3, "higher_better"),
        mutations: buildKpi(null, null, "higher_better"),
        metaWrapperStatus: buildKpi(null, null, "higher_better"),
      }, ["Debe publicar al Testing ABO, graduar winners y ejecutar mutations aprobadas; pendiente conectar ledger Meta/cron en dashboard."]),
    };

    const riskMatrix: RiskMatrixRow[] = [
      riskRow("revenue", "Revenue 7d vs milestone", "Company/Julian", company.revenue, "Rojo <85% → emergency CEO review 24h.", "cop"),
      riskRow("mer", "MER 7d", "Julian", company.mer, "Rojo >10% debajo del target → no escalar sin excepción.", "mer"),
      riskRow("cmPercent", "CM% post-tax 7d", "Julian", company.cmPercent, "Rojo <22% → audit variable expenses/impuestos/canal.", "percent"),
      riskRow("ncRevenuePercent", "NC-Rev% 7d", "Julian/Hermes", company.ncRevenuePercent, "Rojo <5% → no escalar paid; revisar acquisition mix/pixel.", "percent"),
      riskRow("testingWaste", "Waste rate Testing", "Hermes", wasteKpi, "Rojo >40% → pausa batch obligatoria bajo reglas aprobadas.", "percent"),
      riskRow("frequencyWinners", "Frequency winners", "Hermes", frequencyWinnersKpi, "Rojo >3.0 → rotar creative o expandir audiencia/lane.", "number"),
      riskRow("stockActiveSku", "Stock SKU activo", "Julian/Ops", stockActiveSkuKpi, "Rojo <15 unidades → limitar/pausar ads del SKU.", "number"),
      riskRow("ugcPieces", "UGC piezas semana", "Sebastián", ugcPiecesKpi, "Rojo <32/40 → escalación supply UGC.", "number"),
      riskRow("staticsProduced", "Statics producidos", "Angie + Ana María", staticsProducedKpi, "Rojo <24/30 → bloqueo creativo; war room de hooks.", "number"),
    ];

    const blockers: Array<{ severity: "red" | "yellow"; owner: string; message: string; due?: string }> = [];
    if (company.revenue.status === "red") blockers.push({ severity: "red", owner: "Julian", message: "Revenue <85% del milestone semanal: activar revisión CEO/growth en 24h." });
    if (company.mer.status === "red") blockers.push({ severity: "red", owner: "Julian", message: "MER >10% debajo del target semanal: revisar waste, scaling y oferta antes de escalar." });
    if (company.cmPercent.status === "red" || company.cmPercent.status === "missing") blockers.push({ severity: company.cmPercent.status === "missing" ? "yellow" : "red", owner: "Julian", message: "CM% post-tax no está verde o no disponible: instrumentar/auditar margen real." });
    if (company.ncRevenuePercent.status === "red" || company.ncRevenuePercent.status === "missing") blockers.push({ severity: company.ncRevenuePercent.status === "missing" ? "yellow" : "red", owner: "Julian/Hermes", message: "NC-Rev% no está verde o no disponible: revisar acquisition mix/pixel antes de escalar paid." });
    if (owners.sebastian.kpis.ugcPieces.status === "red") blockers.push({ severity: "red", owner: "Sebastián", message: "UGC piezas <32/40: bloqueo de supply creativo semanal." });
    if (staticCreatives.total < num(target.static_creatives_target)) blockers.push({ severity: staticCreatives.total < 24 ? "red" : "yellow", owner: "Angie + Ana María", message: `Static creatives ${staticCreatives.total}/${target.static_creatives_target}; objetivo 50/50 y UGC folders excluidos.` });
    if (!kiraCreativeDirection.reportAvailable) blockers.push({ severity: "yellow", owner: "Kira", message: "AngleOS no tiene sales-angle report/foco semanal estructurado para la semana seleccionada." });
    else if (kiraCreativeDirection.focusAngles.length === 0) blockers.push({ severity: "yellow", owner: "Kira", message: "Hay ángulos rankeados, pero ningún winner/promising para foco semanal automático." });
    if (kiraCreativeDirection.loserCount > 2) blockers.push({ severity: "yellow", owner: "Kira", message: `${kiraCreativeDirection.loserCount} ángulos en riesgo/loser: revisar antes de pedir más producción.` });
    blockers.push({ severity: "yellow", owner: "Hermes", message: "Conectar ledger Meta para published, graduations, waste, wrapper status y mutations." });

    const missingMetrics = ["mutations", "graduated_ads", "testing_waste", "frequency_winners", "stock_active_sku", "statics_published", "needs_review_backlog", "tracker_completeness", "hermes_meta_wrapper_status", "google_query_mix", "pixel_nc_rev_deep_dive"];
    if (!kiraCreativeDirection.reportAvailable) missingMetrics.push("kira_sales_angle_report", "kira_focus");

    const response = {
      period: { label: target.label || week.label, start: week.start, end: week.end },
      milestone: target,
      company,
      owners,
      staticCreatives,
      riskMatrix,
      blockers,
      metadata: {
        computedAt: new Date().toISOString(),
        sources: ["prophit-metrics", "shopify_orders customer acquisition", "ad_metrics_daily", "ugc_*", "growth_weekly_targets", "growth_static_drive_assets", "ad_tags AngleOS", "ad_performance_daily AngleOS"],
        missingMetrics,
        notes: [
          "June 600M dashboard uses non-linear weekly milestones from the 2026-06-01 operating anexo.",
          "Angie + Ana María are both producers 50/50; Kira owns creative direction; Hermes owns publication/scaling ops.",
          "info@dosmicos.co is mapped as shared/unassigned by default.",
        ],
        orders,
        customerAcquisition,
        kiraCreativeDirection,
      },
    };

    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[growth-team-scorecard] Fatal:", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
