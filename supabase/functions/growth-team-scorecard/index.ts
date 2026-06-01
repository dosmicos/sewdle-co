/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildKpi,
  resolveBogotaWeek,
  summarizeStaticCreatives,
  toBogotaIsoWindow,
  worstStatus,
  type Kpi,
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
  status: "green" | "yellow" | "red" | "missing";
  kpis: Record<string, Kpi>;
  notes: string[];
};

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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
  if (data) return data as GrowthWeeklyTarget;

  const fallback = resolveBogotaWeek(new Date(`${periodStart}T12:00:00Z`));
  return {
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
    static_creatives_target: 25,
    static_published_target: 20,
  };
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

function owner(label: string, role: string, kpis: Record<string, Kpi>, notes: string[] = []): OwnerScorecard {
  return { label, role, kpis, notes, status: worstStatus(Object.values(kpis).map((kpi) => kpi.status)) };
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

    const [target, prophit, ugc, foldersRes, assetsRes] = await Promise.all([
      fetchCurrentTarget(sb, organizationId, week.start, week.end),
      fetchProphitMetrics(authHeader, organizationId, week.start, week.end),
      fetchUgcMetrics(sb, organizationId, week.start, week.end),
      sb.from("growth_static_drive_folders").select("product_key, product_name, drive_folder_id").eq("organization_id", organizationId).eq("active", true).order("product_key"),
      sb.from("growth_static_drive_assets").select("drive_file_id, product_key, product_name, source_folder_id, file_name, created_time, attributed_person_key, attributed_person_label, web_view_link").eq("organization_id", organizationId).gte("created_time", `${week.start}T00:00:00.000Z`).lt("created_time", `${week.end}T00:00:00.000Z`).eq("trashed", false).order("created_time", { ascending: false }),
    ]);

    if (foldersRes.error) throw foldersRes.error;
    if (assetsRes.error) throw assetsRes.error;

    const current = prophit.current ?? {};
    const revenue = num(current.netSales ?? current.grossRevenue);
    const adSpend = num(current.adSpend);
    const mer = num(current.mer);
    const cmPercent = num(current.cmPercent);
    const newCustomers = num(current.newCustomerCount ?? current.newCustomers);
    const orders = num(current.orders);
    const aov = num(current.aov);
    const ncpa = newCustomers > 0 ? adSpend / newCustomers : null;
    const ncRevenuePercent = current.newCustomerRevenuePct === undefined ? null : num(current.newCustomerRevenuePct);

    const staticCreatives = summarizeStaticCreatives(
      (assetsRes.data ?? []) as StaticDriveAssetRow[],
      (foldersRes.data ?? []) as StaticDriveFolderRow[],
      week.start,
      week.end,
      num(target.static_creatives_target),
    );

    const company = {
      revenue: buildKpi(revenue, num(target.revenue_target), "higher_better"),
      adSpend: buildKpi(adSpend, num(target.ad_spend_budget), "higher_better"),
      mer: buildKpi(mer, num(target.mer_target), "higher_better"),
      cmPercent: buildKpi(cmPercent, num(target.cm_percent_target), "higher_better"),
      newCustomers: buildKpi(newCustomers || null, num(target.new_customers_target), "higher_better"),
      aov: buildKpi(aov || null, 150000, "higher_better"),
      ncpa: buildKpi(ncpa, 41700, "lower_better"),
      ncRevenuePercent: buildKpi(ncRevenuePercent, 10, "higher_better"),
    };

    const owners = {
      julian: owner("Julian", "Paid media + oferta", {
        spend: buildKpi(adSpend, num(target.ad_spend_budget), "higher_better"),
        mer: buildKpi(mer, num(target.mer_target), "higher_better"),
        aov: buildKpi(aov || null, 150000, "higher_better"),
        mutations: buildKpi(null, null, "higher_better"),
      }, ["Mutaciones/graduaciones y waste Testing pendientes de instrumentar en esta función."]),
      sebastian: owner("Sebastián", "UGC + CMD + unblockers", {
        ugcPieces: buildKpi(ugc.contentPieces, num(target.ugc_content_target), "higher_better"),
        activeCreators: buildKpi(ugc.activeCreators, num(target.ugc_active_creators_target), "higher_better"),
        activeLinks: buildKpi(ugc.activeLinks, 120, "higher_better"),
        cmdRevenue: buildKpi(ugc.cmdRevenue, null, "higher_better"),
        cmdOrders: buildKpi(ugc.cmdOrders, null, "higher_better"),
      }, ["Google query mix y pixel/NC-Rev deep-dive se muestran como blockers si no hay fuente conectada."]),
      angie: owner("Angie", "Creative execution", {
        staticsProduced: buildKpi(staticCreatives.byPerson.angie ?? 0, num(target.static_creatives_target), "higher_better"),
        staticsPublished: buildKpi(null, num(target.static_published_target), "higher_better"),
      }, ["Drive cuenta solo imágenes en carpetas Estáticos/static roots; UGC excluido."]),
      anaMaria: owner("Ana María", "Creative direction", {
        driveAttributedStatics: buildKpi(staticCreatives.byPerson.ana_maria ?? 0, null, "higher_better"),
        briefs: buildKpi(null, num(target.static_creatives_target), "higher_better"),
        firstFrames: buildKpi(null, num(target.static_creatives_target), "higher_better"),
      }, ["Falta tracker de briefs/hooks/first frames. info@dosmicos.co queda Shared/Sin asignar hasta confirmación."]),
    };

    const blockers: Array<{ severity: "red" | "yellow"; owner: string; message: string; due?: string }> = [];
    if (company.revenue.status === "red") blockers.push({ severity: "red", owner: "Julian", message: "Revenue <85% del milestone semanal: activar revisión CEO/growth en 24h." });
    if (company.mer.status === "red") blockers.push({ severity: "red", owner: "Julian", message: "MER por debajo del target semanal: revisar waste, scaling y oferta antes de escalar." });
    if (company.cmPercent.status === "red" || company.cmPercent.status === "missing") blockers.push({ severity: company.cmPercent.status === "missing" ? "yellow" : "red", owner: "Julian", message: "CM% post-tax no está verde: revisar variable expenses/impuestos/canal." });
    if (owners.sebastian.kpis.ugcPieces.status === "red") blockers.push({ severity: "red", owner: "Sebastián", message: "UGC piezas <32/40: bloqueo de supply creativo semanal." });
    if (staticCreatives.total < num(target.static_creatives_target)) blockers.push({ severity: staticCreatives.total < 20 ? "red" : "yellow", owner: "Angie/Ana María", message: `Static creatives ${staticCreatives.total}/${target.static_creatives_target}; UGC folders excluidos.` });
    blockers.push({ severity: "yellow", owner: "Ana María", message: "Instrumentar tracker de briefs/hooks/first frames para no depender de Drive metadata." });

    const response = {
      period: { label: target.label || week.label, start: week.start, end: week.end },
      milestone: target,
      company,
      owners,
      staticCreatives,
      blockers,
      metadata: {
        computedAt: new Date().toISOString(),
        sources: ["prophit-metrics", "ad_metrics_daily", "ugc_*", "growth_weekly_targets", "growth_static_drive_assets"],
        missingMetrics: ["mutations", "testing_waste", "statics_published", "briefs", "hooks", "first_frames", "google_query_mix", "pixel_nc_rev_deep_dive"],
        notes: ["info@dosmicos.co is mapped as shared/unassigned by default."],
        orders,
      },
    };

    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[growth-team-scorecard] Fatal:", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
