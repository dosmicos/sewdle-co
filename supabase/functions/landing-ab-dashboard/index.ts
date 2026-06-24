import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CM/visitante = métrica de decisión del A/B de landings.
// CM por orden con COSTEO POR ORDEN real (finance_settings de la org), no un % plano.
// Clave para el test de PRECIO: envío ($9.421) y handling ($3.000) son FIJOS por orden, así que
// pesan distinto entre $92.900 y $98.900 — un % plano sesgaría el CM. COGS y gateway sí escalan.
// Costos % se aplican sobre el BRUTO (precio lista; no bajan con el descuento) → el descuento
// golpea el CM casi 1:1. EXCLUYE ad spend (compartido entre brazos → se cancela en la comparación).
// Fallback al % plano (0.347 = variableExpenses/netSales del Prophit) si no hay finance_settings.
const FALLBACK_VAR_RATE = 0.347;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type AnyRow = Record<string, any>;
type VariantRole = "control" | "challenger";

interface Costs {
  mode: "per_order" | "flat";
  varRate: number; // efectivo, para fallback/metadata
  cogsPct: number;
  gatewayPct: number;
  shippingPerOrder: number;
  shippingPct: number;
  handlingPerOrder: number;
  handlingPct: number;
}

interface VariantStats {
  lpVersion: string; label: string; role: VariantRole;
  visits: number; orders: number; revenue: number;
  cvr: number | null; aov: number | null; rpv: number | null;
  cm: number; cmPerVisit: number | null;
}
interface SignificanceResult {
  upliftPct: number | null; z: number | null; pValue: number | null;
  confidencePct: number | null; significant: boolean; winner: VariantRole | "tie" | null;
}
interface TimePoint {
  day: string;
  controlVisits: number; controlOrders: number; controlCvr: number | null;
  challengerVisits: number; challengerOrders: number; challengerCvr: number | null;
}

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const dayKey = (iso: string): string => String(iso).slice(0, 10);

function resolveCosts(fs: AnyRow | null): Costs {
  if (!fs) {
    return { mode: "flat", varRate: FALLBACK_VAR_RATE, cogsPct: 0, gatewayPct: 0, shippingPerOrder: 0, shippingPct: FALLBACK_VAR_RATE, handlingPerOrder: 0, handlingPct: 0 };
  }
  return {
    mode: "per_order",
    varRate: FALLBACK_VAR_RATE,
    cogsPct: num(fs.cogs_percent) / 100,
    gatewayPct: num(fs.payment_gateway_percent) / 100,
    shippingPerOrder: fs.shipping_mode === "per_order_cost" ? num(fs.shipping_cost_per_order) : 0,
    shippingPct: fs.shipping_mode === "percent" ? num(fs.shipping_cost_percent) / 100 : 0,
    handlingPerOrder: fs.handling_mode === "per_order" ? num(fs.handling_fee_per_order) : 0,
    handlingPct: fs.handling_mode !== "per_order" ? num(fs.handling_cost_percent) / 100 : 0,
  };
}

// CM = revenue − costos variables. % sobre el BRUTO; envío/handling fijos por orden; gateway sobre lo cobrado.
function computeCm(revenue: number, grossRevenue: number, orders: number, c: Costs): number {
  if (c.mode === "flat") return revenue - grossRevenue * c.varRate;
  const cogs = grossRevenue * c.cogsPct;
  const gateway = revenue * c.gatewayPct;
  const shipping = c.shippingPerOrder * orders + grossRevenue * c.shippingPct;
  const handling = c.handlingPerOrder * orders + grossRevenue * c.handlingPct;
  return revenue - cogs - gateway - shipping - handling;
}

function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  let p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (x > 0) p = 1 - p;
  return p;
}
function proportionTest(controlOrders: number, controlVisits: number, challengerOrders: number, challengerVisits: number): SignificanceResult {
  const empty: SignificanceResult = { upliftPct: null, z: null, pValue: null, confidencePct: null, significant: false, winner: null };
  if (controlVisits <= 0 || challengerVisits <= 0) return empty;
  const p1 = controlOrders / controlVisits;
  const p2 = challengerOrders / challengerVisits;
  const upliftPct = p1 > 0 ? ((p2 - p1) / p1) * 100 : null;
  const pPool = (controlOrders + challengerOrders) / (controlVisits + challengerVisits);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / controlVisits + 1 / challengerVisits));
  if (!Number.isFinite(se) || se === 0) return { ...empty, upliftPct };
  const z = (p2 - p1) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  const confidencePct = (1 - pValue) * 100;
  const significant = confidencePct >= 95;
  const winner: SignificanceResult["winner"] = significant ? (p2 > p1 ? "challenger" : "control") : "tie";
  return { upliftPct, z, pValue, confidencePct, significant, winner };
}
function buildVariantStats(lpVersion: string, label: string, role: VariantRole, visits: number, orders: number, revenue: number, discounts: number, costs: Costs): VariantStats {
  const grossRevenue = revenue + discounts;
  const cm = computeCm(revenue, grossRevenue, orders, costs);
  return {
    lpVersion, label, role, visits, orders, revenue,
    cvr: visits > 0 ? orders / visits : null,
    aov: orders > 0 ? revenue / orders : null,
    rpv: visits > 0 ? revenue / visits : null,
    cm,
    cmPerVisit: visits > 0 ? cm / visits : null,
  };
}
function daysBetween(startIso: string, endIso?: string | null): number {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

function buildExperiment(exp: AnyRow, allVisits: AnyRow[], keyedOrders: AnyRow[], costs: Costs) {
  const controlLp = exp.control_lp_version as string;
  const challengerLp = exp.challenger_lp_version as string;
  const visits = allVisits.filter((v) => v.experiment_slug === exp.slug && (v.lp_version === controlLp || v.lp_version === challengerLp));
  const orders = keyedOrders.filter((o) => o.variant === controlLp || o.variant === challengerLp);
  const cVisits = visits.filter((v) => v.lp_version === controlLp).length;
  const chVisits = visits.filter((v) => v.lp_version === challengerLp).length;
  let cOrders = 0, cRev = 0, cDisc = 0, chOrders = 0, chRev = 0, chDisc = 0;
  for (const o of orders) {
    if (o.variant === controlLp) { cOrders += num(o.orders); cRev += num(o.revenue); cDisc += num(o.discounts); }
    else { chOrders += num(o.orders); chRev += num(o.revenue); chDisc += num(o.discounts); }
  }
  const control = buildVariantStats(controlLp, exp.control_label ?? "Control", "control", cVisits, cOrders, cRev, cDisc, costs);
  const challenger = buildVariantStats(challengerLp, exp.challenger_label ?? "Retador", "challenger", chVisits, chOrders, chRev, chDisc, costs);
  const significance = proportionTest(cOrders, cVisits, chOrders, chVisits);
  const cmPerVisitUpliftPct = (control.cmPerVisit && control.cmPerVisit !== 0 && challenger.cmPerVisit != null)
    ? ((challenger.cmPerVisit - control.cmPerVisit) / Math.abs(control.cmPerVisit)) * 100 : null;
  const days = new Set<string>();
  for (const v of visits) days.add(dayKey(v.occurred_at));
  for (const o of orders) days.add(dayKey(o.day));
  const sortedDays = [...days].sort();
  let cv = 0, co = 0, chv = 0, cho = 0;
  const timeseries: TimePoint[] = sortedDays.map((day) => {
    cv += visits.filter((v) => v.lp_version === controlLp && dayKey(v.occurred_at) === day).length;
    chv += visits.filter((v) => v.lp_version === challengerLp && dayKey(v.occurred_at) === day).length;
    co += orders.filter((o) => o.variant === controlLp && dayKey(o.day) === day).reduce((s: number, o: AnyRow) => s + num(o.orders), 0);
    cho += orders.filter((o) => o.variant === challengerLp && dayKey(o.day) === day).reduce((s: number, o: AnyRow) => s + num(o.orders), 0);
    return { day, controlVisits: cv, controlOrders: co, controlCvr: cv > 0 ? co / cv : null, challengerVisits: chv, challengerOrders: cho, challengerCvr: chv > 0 ? cho / chv : null };
  });
  return {
    slug: exp.slug, name: exp.name, destinationPath: exp.destination_path, status: exp.status,
    startedAt: exp.started_at, endedAt: exp.ended_at ?? null, daysRunning: daysBetween(exp.started_at, exp.ended_at),
    attributeKey: (exp.attribute_key as string) || "lp_version",
    control, challenger, significance, cmPerVisitUpliftPct, timeseries,
  };
}

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
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { global: { headers: { Authorization: authHeader } } });

    // Costeo por orden real desde finance_settings (envío/handling fijos por orden + COGS/gateway %).
    const { data: fs } = await sb.from("finance_settings")
      .select("cogs_percent, payment_gateway_percent, shipping_mode, shipping_cost_percent, shipping_cost_per_order, handling_mode, handling_cost_percent, handling_fee_per_order")
      .eq("organization_id", organizationId).maybeSingle();
    const costs = resolveCosts(fs as AnyRow | null);

    let expQ = sb.from("landing_ab_experiments").select("*").eq("organization_id", organizationId).order("started_at", { ascending: false });
    if (body?.experimentSlug) expQ = expQ.eq("slug", String(body.experimentSlug));
    const { data: experiments, error: expErr } = await expQ;
    if (expErr) throw expErr;
    const { data: visits } = await sb.from("landing_ab_visits")
      .select("experiment_slug, lp_version, occurred_at")
      .eq("organization_id", organizationId)
      .gte("occurred_at", `${periodStart}T00:00:00-05:00`)
      .lt("occurred_at", `${isoDate(addDays(new Date(`${periodEnd}T00:00:00Z`), 1))}T00:00:00-05:00`);
    const attrKeys = [...new Set((experiments ?? []).map((e: AnyRow) => (e.attribute_key as string) || "lp_version"))];
    const ordersByKey: Record<string, AnyRow[]> = {};
    for (const k of attrKeys) {
      const { data } = await sb.rpc("landing_ab_order_stats_keyed", { p_org: organizationId, p_start: periodStart, p_end: periodEnd, p_attr: k });
      ordersByKey[k] = (data ?? []) as AnyRow[];
    }
    const summaries = (experiments ?? []).map((exp: AnyRow) => {
      const key = (exp.attribute_key as string) || "lp_version";
      return buildExperiment(exp, (visits ?? []) as AnyRow[], ordersByKey[key] ?? [], costs);
    });
    const response = {
      period: { start: periodStart, end: periodEnd },
      experiments: summaries,
      metadata: {
        computedAt: today.toISOString(),
        varRate: costs.mode === "flat" ? costs.varRate : null,
        costModel: costs.mode === "per_order"
          ? { type: "per_order", cogsPct: costs.cogsPct, gatewayPct: costs.gatewayPct, shippingPerOrder: costs.shippingPerOrder, handlingPerOrder: costs.handlingPerOrder }
          : { type: "flat", varRate: costs.varRate },
        notes: [
          "CVR = ordenes / visitas (visitas por el split en la landing). Diagnostico.",
          "RPV = revenue / visita (descuenta el menor ticket del retador).",
          "CM/visitante = (revenue - costos variables) / visitas. METRICA DE DECISION.",
          "Costos: COGS+gateway % sobre el bruto/cobrado; envio+handling FIJOS por orden (finance_settings). El descuento golpea el CM casi 1:1.",
          "Cada experimento se mide POOLED sobre el otro (su attribute_key): asignacion ortogonal => efecto principal sin sesgo. La interaccion 2x2 queda sub-potenciada con bajo volumen.",
          "Significancia CVR: z-test de 2 proporciones al 95%. CM/visita: uplift puntual (test continuo pendiente).",
        ],
      },
    };
    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("landing-ab-dashboard error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
