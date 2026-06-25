import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// landing-ab-verdict — el "freno" automático del A/B de landings (fix P0 del audit de loops 2026-06-24).
// Cada día computa el veredicto de cada experimento 'running' con umbrales fijos y, en modo apply,
// cierra los que llegaron a estado terminal + (solo el de precio) apaga el descuento si el ancla NO ganó.
// Reusa la MISMA lógica de stats/CM/z-test que landing-ab-dashboard (fuente única de verdad de la medición).
// dryRun=true por defecto: solo computa y reporta, NO actúa. Umbrales aprobados por Julian 2026-06-24.
const FALLBACK_VAR_RATE = 0.347;
const MIN_DAYS = 7;
const MIN_ORDERS_PER_ARM = 30;
const CONFIDENCE_THRESHOLD = 95; // %
const MAX_DAYS = 21; // timeout -> INCONCLUSIVE
const RUANA_DISCOUNT_CODE = "RAB7KX9Q26";
const PRICE_ATTR = "lp_precio";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type AnyRow = Record<string, any>;
type VariantRole = "control" | "challenger";

interface Costs {
  mode: "per_order" | "flat";
  varRate: number; cogsPct: number; gatewayPct: number;
  shippingPerOrder: number; shippingPct: number; handlingPerOrder: number; handlingPct: number;
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

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function resolveCosts(fs: AnyRow | null): Costs {
  if (!fs) return { mode: "flat", varRate: FALLBACK_VAR_RATE, cogsPct: 0, gatewayPct: 0, shippingPerOrder: 0, shippingPct: FALLBACK_VAR_RATE, handlingPerOrder: 0, handlingPct: 0 };
  return {
    mode: "per_order", varRate: FALLBACK_VAR_RATE,
    cogsPct: num(fs.cogs_percent) / 100,
    gatewayPct: num(fs.payment_gateway_percent) / 100,
    shippingPerOrder: fs.shipping_mode === "per_order_cost" ? num(fs.shipping_cost_per_order) : 0,
    shippingPct: fs.shipping_mode === "percent" ? num(fs.shipping_cost_percent) / 100 : 0,
    handlingPerOrder: fs.handling_mode === "per_order" ? num(fs.handling_fee_per_order) : 0,
    handlingPct: fs.handling_mode !== "per_order" ? num(fs.handling_cost_percent) / 100 : 0,
  };
}
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
function proportionTest(co: number, cv: number, cho: number, chv: number): SignificanceResult {
  const empty: SignificanceResult = { upliftPct: null, z: null, pValue: null, confidencePct: null, significant: false, winner: null };
  if (cv <= 0 || chv <= 0) return empty;
  const p1 = co / cv, p2 = cho / chv;
  const upliftPct = p1 > 0 ? ((p2 - p1) / p1) * 100 : null;
  const pPool = (co + cho) / (cv + chv);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / cv + 1 / chv));
  if (!Number.isFinite(se) || se === 0) return { ...empty, upliftPct };
  const z = (p2 - p1) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  const confidencePct = (1 - pValue) * 100;
  const significant = confidencePct >= CONFIDENCE_THRESHOLD;
  const winner: SignificanceResult["winner"] = significant ? (p2 > p1 ? "challenger" : "control") : "tie";
  return { upliftPct, z, pValue, confidencePct, significant, winner };
}
function buildVariantStats(lpVersion: string, label: string, role: VariantRole, visits: number, orders: number, revenue: number, discounts: number, costs: Costs): VariantStats {
  const grossRevenue = revenue + discounts;
  const cm = computeCm(revenue, grossRevenue, orders, costs);
  return { lpVersion, label, role, visits, orders, revenue, cvr: visits > 0 ? orders / visits : null, aov: orders > 0 ? revenue / orders : null, rpv: visits > 0 ? revenue / visits : null, cm, cmPerVisit: visits > 0 ? cm / visits : null };
}
function daysBetween(startIso: string, endMs: number): number {
  const start = new Date(startIso).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((endMs - start) / (1000 * 60 * 60 * 24)));
}

interface Verdict {
  state: "RUNNING" | "WIN" | "LOSE" | "INCONCLUSIVE";
  decisionMetric: "cvr" | "cm_per_visit";
  winnerRole: VariantRole | null;
  winnerLpVersion: string | null;
  reason: string;
  gates: { daysRunning: number; minOrdersPerArm: number; confidencePct: number | null; daysOk: boolean; ordersOk: boolean; sigOk: boolean };
}
function decideVerdict(attrKey: string, control: VariantStats, challenger: VariantStats, sig: SignificanceResult, daysRunning: number): Verdict {
  const isPrice = attrKey === PRICE_ATTR;
  const decisionMetric: Verdict["decisionMetric"] = isPrice ? "cm_per_visit" : "cvr";
  const minOrders = Math.min(control.orders, challenger.orders);
  const conf = sig.confidencePct;
  const daysOk = daysRunning >= MIN_DAYS;
  const ordersOk = minOrders >= MIN_ORDERS_PER_ARM;
  const sigOk = sig.significant && (conf ?? 0) >= CONFIDENCE_THRESHOLD;
  const gates = { daysRunning, minOrdersPerArm: minOrders, confidencePct: conf, daysOk, ordersOk, sigOk };
  if (daysOk && ordersOk && sigOk) {
    let winnerRole: VariantRole;
    if (isPrice) {
      const cCm = control.cmPerVisit ?? -Infinity;
      const chCm = challenger.cmPerVisit ?? -Infinity;
      winnerRole = chCm >= cCm ? "challenger" : "control";
    } else {
      winnerRole = sig.winner === "challenger" ? "challenger" : "control";
    }
    const state: Verdict["state"] = winnerRole === "challenger" ? "WIN" : "LOSE";
    return { state, decisionMetric, winnerRole, winnerLpVersion: winnerRole === "challenger" ? challenger.lpVersion : control.lpVersion, reason: `Significativo (${conf?.toFixed(1)}% conf, ${daysRunning}d, ${minOrders} órd/brazo). Gana ${winnerRole} por ${decisionMetric}.`, gates };
  }
  if (daysRunning >= MAX_DAYS) {
    return { state: "INCONCLUSIVE", decisionMetric, winnerRole: "control", winnerLpVersion: control.lpVersion, reason: `Timeout ${MAX_DAYS}d sin significancia (conf ${conf?.toFixed(1) ?? "n/a"}%). Cierra al control (status quo).`, gates };
  }
  const missing: string[] = [];
  if (!daysOk) missing.push(`días ${daysRunning}/${MIN_DAYS}`);
  if (!ordersOk) missing.push(`órd ${minOrders}/${MIN_ORDERS_PER_ARM} por brazo`);
  if (!sigOk) missing.push(`conf ${conf?.toFixed(1) ?? "n/a"}%/${CONFIDENCE_THRESHOLD}%`);
  return { state: "RUNNING", decisionMetric, winnerRole: null, winnerLpVersion: null, reason: `Sigue (falta: ${missing.join(", ")}).`, gates };
}

async function deactivateDiscount(sb: any, organizationId: string, dryRun: boolean): Promise<{ attempted: boolean; success: boolean; detail: string }> {
  if (dryRun) return { attempted: false, success: false, detail: `DRY-RUN: apagaría el descuento ${RUANA_DISCOUNT_CODE}` };
  // Credenciales Shopify desde la DB (organizations.shopify_credentials), no env — patrón de create-shopify-order.
  const { data: org } = await sb.from("organizations").select("shopify_credentials").eq("id", organizationId).single();
  const creds = org?.shopify_credentials ?? {};
  const shop = creds.store_domain ?? creds.shopDomain;
  const token = creds.access_token ?? creds.accessToken;
  if (!shop || !token) return { attempted: true, success: false, detail: `NO_CREDS: faltan credenciales Shopify en organizations.shopify_credentials para apagar ${RUANA_DISCOUNT_CODE}` };
  try {
    const api = `https://${shop}/admin/api/2024-10/graphql.json`;
    const findQ = `query($code:String!){ codeDiscountNodeByCode(code:$code){ id } }`;
    const fr = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: findQ, variables: { code: RUANA_DISCOUNT_CODE } }) });
    const fj = await fr.json();
    const id = fj?.data?.codeDiscountNodeByCode?.id;
    if (!id) return { attempted: true, success: false, detail: `descuento ${RUANA_DISCOUNT_CODE} no encontrado (resp: ${JSON.stringify(fj?.errors ?? fj?.data ?? {})})` };
    const mq = `mutation($id:ID!){ discountCodeDeactivate(id:$id){ userErrors{ field message } } }`;
    const mr = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: mq, variables: { id } }) });
    const mj = await mr.json();
    const errs = mj?.data?.discountCodeDeactivate?.userErrors ?? [];
    if (errs.length) return { attempted: true, success: false, detail: `userErrors: ${JSON.stringify(errs)}` };
    return { attempted: true, success: true, detail: `descuento ${RUANA_DISCOUNT_CODE} desactivado (${id})` };
  } catch (e) {
    return { attempted: true, success: false, detail: `error: ${(e as Error).message}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  try {
    const body = await req.json().catch(() => ({} as AnyRow));
    const organizationId = body?.organizationId ?? "cb497af2-3f29-4bb4-be53-91b7f19e5ffb";
    const dryRun = body?.dryRun === false ? false : true; // SEGURO por defecto: solo actúa con dryRun:false explícito
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: fs } = await sb.from("finance_settings")
      .select("cogs_percent, payment_gateway_percent, shipping_mode, shipping_cost_percent, shipping_cost_per_order, handling_mode, handling_cost_percent, handling_fee_per_order")
      .eq("organization_id", organizationId).maybeSingle();
    const costs = resolveCosts(fs as AnyRow | null);

    let expQ = sb.from("landing_ab_experiments").select("*").eq("organization_id", organizationId).eq("status", "running");
    if (body?.experimentSlug) expQ = expQ.eq("slug", String(body.experimentSlug));
    const { data: experiments, error: expErr } = await expQ;
    if (expErr) throw expErr;

    const nowMs = Date.now();
    const results: AnyRow[] = [];
    let discountActed = false;

    for (const exp of (experiments ?? []) as AnyRow[]) {
      const attrKey = (exp.attribute_key as string) || "lp_version";
      const controlLp = exp.control_lp_version as string;
      const challengerLp = exp.challenger_lp_version as string;
      const startDate = isoDate(addDays(new Date(exp.started_at), -1));
      const endDate = isoDate(new Date(nowMs));

      // Contar en la DB (count exact, head) — NO traer filas: PostgREST capa a 1000 y sesgaría el conteo.
      const visitCount = async (lp: string): Promise<number> => {
        const { count } = await sb.from("landing_ab_visits").select("*", { count: "exact", head: true })
          .eq("organization_id", organizationId).eq("experiment_slug", exp.slug).eq("lp_version", lp);
        return count ?? 0;
      };
      const cVisits = await visitCount(controlLp);
      const chVisits = await visitCount(challengerLp);

      const { data: ord } = await sb.rpc("landing_ab_order_stats_keyed", { p_org: organizationId, p_start: startDate, p_end: endDate, p_attr: attrKey });
      let cO = 0, cR = 0, cD = 0, chO = 0, chR = 0, chD = 0;
      for (const o of (ord ?? []) as AnyRow[]) {
        if (o.variant === controlLp) { cO += num(o.orders); cR += num(o.revenue); cD += num(o.discounts); }
        else if (o.variant === challengerLp) { chO += num(o.orders); chR += num(o.revenue); chD += num(o.discounts); }
      }
      const control = buildVariantStats(controlLp, exp.control_label ?? "Control", "control", cVisits, cO, cR, cD, costs);
      const challenger = buildVariantStats(challengerLp, exp.challenger_label ?? "Retador", "challenger", chVisits, chO, chR, chD, costs);
      const significance = proportionTest(cO, cVisits, chO, chVisits);
      const daysRunning = daysBetween(exp.started_at, nowMs);
      const verdict = decideVerdict(attrKey, control, challenger, significance, daysRunning);
      const terminal = verdict.state !== "RUNNING";
      const isPrice = attrKey === PRICE_ATTR;
      const anchorWon = verdict.winnerRole === "challenger"; // para el de precio, challenger = ancla
      const shouldDeactivateDiscount = terminal && isPrice && !anchorWon;

      const actions: AnyRow = { closeExperiment: null, deactivateDiscount: null };
      if (terminal) {
        if (!dryRun) {
          const { error: upErr } = await sb.from("landing_ab_experiments").update({
            status: "decided", winner_lp_version: verdict.winnerLpVersion, ended_at: new Date(nowMs).toISOString(),
            notes: `[${verdict.state}] ${verdict.reason} (auto-veredicto ${new Date(nowMs).toISOString()})`,
          }).eq("id", exp.id).eq("status", "running");
          actions.closeExperiment = upErr ? { ok: false, detail: upErr.message } : { ok: true, detail: `status=decided, winner=${verdict.winnerLpVersion}` };
          try {
            await sb.from("landing_ab_verdicts").insert({
              organization_id: organizationId, experiment_slug: exp.slug, state: verdict.state,
              decision_metric: verdict.decisionMetric, winner_lp_version: verdict.winnerLpVersion,
              days_running: daysRunning, confidence_pct: significance.confidencePct, reason: verdict.reason,
              control_orders: cO, control_visits: cVisits, challenger_orders: chO, challenger_visits: chVisits,
              applied: true,
            });
          } catch (_) { /* tabla opcional */ }
        } else {
          actions.closeExperiment = { ok: false, detail: `DRY-RUN: cerraría status=decided, winner=${verdict.winnerLpVersion}` };
        }
        if (shouldDeactivateDiscount) {
          actions.deactivateDiscount = await deactivateDiscount(sb, organizationId, dryRun);
          if (!dryRun && actions.deactivateDiscount.success) discountActed = true;
        }
      }

      results.push({
        slug: exp.slug, name: exp.name, attributeKey: attrKey, daysRunning,
        control: { lp: controlLp, label: control.label, visits: cVisits, orders: cO, cvr: control.cvr, cmPerVisit: control.cmPerVisit, rpv: control.rpv },
        challenger: { lp: challengerLp, label: challenger.label, visits: chVisits, orders: chO, cvr: challenger.cvr, cmPerVisit: challenger.cmPerVisit, rpv: challenger.rpv },
        significance: { confidencePct: significance.confidencePct, upliftPct: significance.upliftPct, significant: significance.significant },
        cmPerVisitUpliftPct: (control.cmPerVisit && control.cmPerVisit !== 0 && challenger.cmPerVisit != null) ? ((challenger.cmPerVisit - control.cmPerVisit) / Math.abs(control.cmPerVisit)) * 100 : null,
        verdict, actions,
      });
    }

    return new Response(JSON.stringify({
      ok: true, dryRun, computedAt: new Date(nowMs).toISOString(),
      thresholds: { MIN_DAYS, MIN_ORDERS_PER_ARM, CONFIDENCE_THRESHOLD, MAX_DAYS },
      costModel: costs.mode, discountActed, experiments: results,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("landing-ab-verdict error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
