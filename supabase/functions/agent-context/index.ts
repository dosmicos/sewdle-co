// ─── Agent Context Endpoint ─────────────────────────────────────
// Retorna TODO el contexto del agente AI de ads en un solo call.
// Diseñado para Claude Cowork (scheduled remote agent) y debugging.
//
// Request:
//   POST /functions/v1/agent-context
//   Authorization: Bearer <service_role_key>
//   Body: { organizationId, scope: "full" | "daily" | "memory_only" }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// ─── Helpers ────────────────────────────────────────────────────

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

// ─── Serve ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organizationId, scope = "full" } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organizationId es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ═══════════════════════════════════════════════════════════
    // Scope: memory_only — learnings, benchmarks, rules desde BD
    // ═══════════════════════════════════════════════════════════
    if (scope === "memory_only") {
      const { data: learnings } = await supabase
        .from('agent_learnings')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(30);

      const { data: benchmarks } = await supabase
        .from('agent_benchmarks')
        .select('*')
        .eq('organization_id', organizationId);

      const { data: rules } = await supabase
        .from('agent_rules')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('times_correct', { ascending: false });

      return new Response(
        JSON.stringify({ learnings, benchmarks, rules }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // Organization info
    // ═══════════════════════════════════════════════════════════
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .single();

    // ═══════════════════════════════════════════════════════════
    // Agent status (de ad_accounts)
    // ═══════════════════════════════════════════════════════════
    const { data: adAccounts } = await supabase
      .from("ad_accounts")
      .select("id, platform, agent_autonomy_level, created_at")
      .eq("organization_id", organizationId)
      .eq("is_active", true);

    const autonomyLevel = adAccounts?.[0]?.agent_autonomy_level ?? 1;
    const accountCreatedAt = adAccounts?.[0]?.created_at;
    const daysActive = accountCreatedAt ? daysAgo(accountCreatedAt) : 0;

    // Accuracy de últimas 20 recomendaciones
    const { data: recentRecs } = await supabase
      .from("ad_recommendations_log")
      .select("accuracy_score")
      .eq("organization_id", organizationId)
      .not("accuracy_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    const scoredRecs = (recentRecs || []).filter(
      (r) => r.accuracy_score !== null
    );
    const avgAccuracy =
      scoredRecs.length > 0
        ? scoredRecs.reduce((s, r) => s + Number(r.accuracy_score), 0) /
          scoredRecs.length
        : 0;

    // Total recommendations & executed
    const { count: totalRecommendations } = await supabase
      .from("ad_recommendations_log")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId);

    const { count: totalExecuted } = await supabase
      .from("ad_recommendations_log")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("executed", true);

    const agentStatus = {
      autonomy_level: autonomyLevel,
      autonomy_label:
        autonomyLevel === 3
          ? "Actuando"
          : autonomyLevel === 2
          ? "Recomendando"
          : "Observando",
      accuracy_30d: Number(avgAccuracy.toFixed(2)),
      total_recommendations: totalRecommendations ?? 0,
      total_executed: totalExecuted ?? 0,
      days_active: daysActive,
    };

    // ═══════════════════════════════════════════════════════════
    // Latest report
    // ═══════════════════════════════════════════════════════════
    const { data: latestReport } = await supabase
      .from("ad_analysis_reports")
      .select("*")
      .eq("organization_id", organizationId)
      .order("report_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Scope daily: retorna solo status + latest report + alertas
    if (scope === "daily") {
      return new Response(
        JSON.stringify({
          organization: org,
          agent_status: agentStatus,
          latest_report: latestReport,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // Scope: full — todo el contexto
    // ═══════════════════════════════════════════════════════════

    // Métricas agregadas últimos 7 días
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysStr = sevenDaysAgo.toISOString().split("T")[0];

    const { data: metrics7d } = await supabase
      .from("ad_performance_daily")
      .select(
        "spend, revenue, purchases, impressions, clicks, link_clicks, reach, cpm, cpc, ctr"
      )
      .eq("organization_id", organizationId)
      .gte("date", sevenDaysStr);

    const agg7d = (metrics7d || []).reduce(
      (acc, m) => ({
        spend: acc.spend + (m.spend || 0),
        revenue: acc.revenue + (m.revenue || 0),
        purchases: acc.purchases + (m.purchases || 0),
        impressions: acc.impressions + (m.impressions || 0),
        clicks: acc.clicks + (m.clicks || 0),
        link_clicks: acc.link_clicks + (m.link_clicks || 0),
        reach: acc.reach + (m.reach || 0),
      }),
      {
        spend: 0,
        revenue: 0,
        purchases: 0,
        impressions: 0,
        clicks: 0,
        link_clicks: 0,
        reach: 0,
      }
    );

    const accountMetrics7d = {
      ...agg7d,
      roas: agg7d.spend > 0 ? agg7d.revenue / agg7d.spend : 0,
      cpa: agg7d.purchases > 0 ? agg7d.spend / agg7d.purchases : 0,
      ctr: agg7d.impressions > 0 ? (agg7d.clicks / agg7d.impressions) * 100 : 0,
      cpm: agg7d.impressions > 0 ? (agg7d.spend / agg7d.impressions) * 1000 : 0,
    };

    // Top 10 ads por spend (últimos 7 días)
    const { data: topAdsRaw } = await supabase
      .from("ad_performance_daily")
      .select("ad_id, ad_name, spend, revenue, purchases, impressions, clicks, ctr, cpm")
      .eq("organization_id", organizationId)
      .gte("date", sevenDaysStr)
      .order("spend", { ascending: false });

    // Agrupar por ad_id
    const adMap = new Map<
      string,
      { ad_id: string; ad_name: string; spend: number; revenue: number; purchases: number; impressions: number; clicks: number }
    >();
    for (const row of topAdsRaw || []) {
      const existing = adMap.get(row.ad_id) || {
        ad_id: row.ad_id,
        ad_name: row.ad_name || row.ad_id,
        spend: 0,
        revenue: 0,
        purchases: 0,
        impressions: 0,
        clicks: 0,
      };
      existing.spend += row.spend || 0;
      existing.revenue += row.revenue || 0;
      existing.purchases += row.purchases || 0;
      existing.impressions += row.impressions || 0;
      existing.clicks += row.clicks || 0;
      adMap.set(row.ad_id, existing);
    }
    const topAds = Array.from(adMap.values())
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10)
      .map((a) => ({
        ...a,
        roas: a.spend > 0 ? a.revenue / a.spend : 0,
        cpa: a.purchases > 0 ? a.spend / a.purchases : 0,
        ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      }));

    // Fatigued ads (de ad_lifecycle)
    const { data: fatiguedAds } = await supabase
      .from("ad_lifecycle")
      .select("ad_id, ad_name, current_status, days_active, days_to_fatigue, lifetime_roas, lifetime_cpa")
      .eq("organization_id", organizationId)
      .eq("current_status", "declining")
      .order("lifetime_spend", { ascending: false })
      .limit(10);

    // Pending recommendations
    const { data: pendingRecs } = await supabase
      .from("ad_recommendations_log")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("executed", false)
      .order("created_at", { ascending: false })
      .limit(20);

    // Monthly targets (de finance_settings o monthly_targets)
    const { data: monthlyTargets } = await supabase
      .from("monthly_targets")
      .select("*")
      .eq("organization_id", organizationId)
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Learnings desde agent_learnings
    const { data: agentLearnings } = await supabase
      .from('agent_learnings')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(30);

    // Benchmarks desde agent_benchmarks
    const { data: agentBenchmarks } = await supabase
      .from('agent_benchmarks')
      .select('*')
      .eq('organization_id', organizationId);

    // Reglas desde agent_rules
    const { data: agentRules } = await supabase
      .from('agent_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('times_correct', { ascending: false });

    const benchmarks = (agentBenchmarks && agentBenchmarks.length > 0)
      ? {
          source: "dynamic" as const,
          metrics: agentBenchmarks.map(b => ({
            metric: b.metric,
            value_good: b.value_good,
            value_avg: b.value_avg,
            value_bad: b.value_bad,
            source: b.source,
          })),
        }
      : {
          source: "initial" as const,
          hook_rate: { good: 30, bad: 20, avg: 25 },
          hold_rate: { good: 25, bad: 15, avg: 20 },
          ctr: { good: 1.5, bad: 0.8, avg: 1.15 },
          cpa: { target: 45000, avg_30d: accountMetrics7d.cpa },
        };

    // Prophit System fórmulas clave
    const prophitSystem = {
      hierarchy: "Contribution Margin > MER > AMER > Channel ROAS",
      mer_formula: "Revenue Total / Ad Spend Total",
      amer_formula: "New Customer Revenue / Ad Spend",
      cm_formula: "Net Sales - COGS - Variable Expenses - Ad Spend",
      mer_target: "3-5x",
    };

    return new Response(
      JSON.stringify({
        organization: org,
        agent_status: agentStatus,
        latest_report: latestReport,
        account_metrics_7d: accountMetrics7d,
        top_ads_active: topAds,
        fatigued_ads: fatiguedAds || [],
        pending_recommendations: pendingRecs || [],
        learnings: (agentLearnings || []).map((l) => ({
          id: l.id,
          category: l.category,
          content: l.content,
          confidence: l.confidence,
          source: l.source,
        })),
        benchmarks,
        rules: (agentRules || []).map((r) => ({
          id: r.id,
          rule: r.rule,
          times_applied: r.times_applied,
          times_correct: r.times_correct,
        })),
        monthly_targets: monthlyTargets,
        prophit_system: prophitSystem,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("agent-context error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
