/// <reference lib="deno.ns" />
// landing-ab-dashboard — computes the Landing A/B dashboard for growth.sewdle.co.
// Reads landing_ab_experiments + landing_ab_visits + RPC landing_ab_order_stats and returns,
// per experiment: per-variant stats (visits/orders/CVR/AOV/RPV), uplift + significance, and a
// cumulative day-by-day timeseries. Pattern mirrors growth-team-scorecard/index.ts (JWT + org).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildVariantStats,
  daysBetween,
  proportionTest,
  type ExperimentSummary,
  type LandingAbDashboardResponse,
  type TimePoint,
  type VariantStats,
} from "../_shared/landing-ab-dashboard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type AnyRow = Record<string, any>;

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const dayKey = (iso: string): string => String(iso).slice(0, 10);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({} as AnyRow));
    const organizationId = body?.organizationId;
    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const today = new Date();
    const periodEnd = body?.periodEnd ? String(body.periodEnd).slice(0, 10) : isoDate(today);
    const periodStart = body?.periodStart ? String(body.periodStart).slice(0, 10) : isoDate(addDays(new Date(`${periodEnd}T00:00:00Z`), -30));

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // 1. Experiments (registry)
    let expQ = sb.from("landing_ab_experiments").select("*").eq("organization_id", organizationId).order("started_at", { ascending: false });
    if (body?.experimentSlug) expQ = expQ.eq("slug", String(body.experimentSlug));
    const { data: experiments, error: expErr } = await expQ;
    if (expErr) throw expErr;

    // 2. Visits in window (Bogota day boundaries)
    const { data: visits } = await sb
      .from("landing_ab_visits")
      .select("experiment_slug, lp_version, occurred_at")
      .eq("organization_id", organizationId)
      .gte("occurred_at", `${periodStart}T00:00:00-05:00`)
      .lt("occurred_at", `${isoDate(addDays(new Date(`${periodEnd}T00:00:00Z`), 1))}T00:00:00-05:00`);

    // 3. Orders + revenue per lp_version per day (RPC extracts lp_version from note_attributes)
    const { data: orderStats } = await sb.rpc("landing_ab_order_stats", { p_org: organizationId, p_start: periodStart, p_end: periodEnd });

    const summaries = (experiments ?? []).map((exp: AnyRow) =>
      buildExperiment(exp, (visits ?? []) as AnyRow[], (orderStats ?? []) as AnyRow[]),
    );

    const response: LandingAbDashboardResponse = {
      period: { start: periodStart, end: periodEnd },
      experiments: summaries,
      metadata: {
        computedAt: today.toISOString(),
        notes: [
          "CVR = órdenes / visitas (visitas registradas por el split en la landing).",
          "RPV = revenue / visitas: la métrica justa entre variantes (tráfico y spend son compartidos).",
          "Significancia: z-test de 2 proporciones al 95%.",
        ],
      },
    };

    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("landing-ab-dashboard error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function buildExperiment(exp: AnyRow, allVisits: AnyRow[], allOrders: AnyRow[]): ExperimentSummary {
  const controlLp = exp.control_lp_version as string;
  const challengerLp = exp.challenger_lp_version as string;

  const visits = allVisits.filter((v) => v.experiment_slug === exp.slug && (v.lp_version === controlLp || v.lp_version === challengerLp));
  const orders = allOrders.filter((o) => o.lp_version === controlLp || o.lp_version === challengerLp);

  const cVisits = visits.filter((v) => v.lp_version === controlLp).length;
  const chVisits = visits.filter((v) => v.lp_version === challengerLp).length;
  let cOrders = 0, cRev = 0, chOrders = 0, chRev = 0;
  for (const o of orders) {
    if (o.lp_version === controlLp) { cOrders += num(o.orders); cRev += num(o.revenue); }
    else { chOrders += num(o.orders); chRev += num(o.revenue); }
  }

  const control: VariantStats = buildVariantStats(controlLp, exp.control_label ?? "Control", "control", cVisits, cOrders, cRev);
  const challenger: VariantStats = buildVariantStats(challengerLp, exp.challenger_label ?? "Retador", "challenger", chVisits, chOrders, chRev);
  const significance = proportionTest(cOrders, cVisits, chOrders, chVisits);

  // Cumulative timeseries by Bogota day.
  const days = new Set<string>();
  for (const v of visits) days.add(dayKey(v.occurred_at));
  for (const o of orders) days.add(dayKey(o.day));
  const sortedDays = [...days].sort();

  let cv = 0, co = 0, chv = 0, cho = 0;
  const timeseries: TimePoint[] = sortedDays.map((day) => {
    cv += visits.filter((v) => v.lp_version === controlLp && dayKey(v.occurred_at) === day).length;
    chv += visits.filter((v) => v.lp_version === challengerLp && dayKey(v.occurred_at) === day).length;
    co += orders.filter((o) => o.lp_version === controlLp && dayKey(o.day) === day).reduce((s, o) => s + num(o.orders), 0);
    cho += orders.filter((o) => o.lp_version === challengerLp && dayKey(o.day) === day).reduce((s, o) => s + num(o.orders), 0);
    return {
      day,
      controlVisits: cv, controlOrders: co, controlCvr: cv > 0 ? co / cv : null,
      challengerVisits: chv, challengerOrders: cho, challengerCvr: chv > 0 ? cho / chv : null,
    };
  });

  return {
    slug: exp.slug,
    name: exp.name,
    destinationPath: exp.destination_path,
    status: exp.status,
    startedAt: exp.started_at,
    endedAt: exp.ended_at ?? null,
    daysRunning: daysBetween(exp.started_at, exp.ended_at),
    control,
    challenger,
    significance,
    timeseries,
  };
}
