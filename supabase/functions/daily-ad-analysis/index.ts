import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { searchMemories, addMemory } from "./mem0.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

// ─── Tipos ──────────────────────────────────────────────────────

interface Alert {
  level: "red" | "yellow" | "green";
  type: string;
  message: string;
  adId?: string;
  adName?: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

interface AdScorecard {
  ad_id: string;
  ad_name: string;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  hook_rate: number;
  hold_rate: number;
  frequency: number;
  impressions: number;
  clicks: number;
  purchases: number;
  benchmark_7d: {
    ctr: number;
    hook_rate: number;
    hold_rate: number;
    cpa: number;
  };
}

interface Recommendation {
  category: string;
  priority: string;
  action: string;
  rationale: string;
  affected_ad_ids: string[];
  confidence: number;
}

// ─── Helpers ────────────────────────────────────────────────────

function safe(n: number | null | undefined, fallback = 0): number {
  return n != null && isFinite(n) ? n : fallback;
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function formatCOP(n: number): string {
  return `COP ${Math.round(n).toLocaleString("es-CO")}`;
}

// ─── Cálculo de métricas por ad ─────────────────────────────────

function buildAdScorecard(
  todayRows: any[],
  rolling7d: any[]
): AdScorecard[] {
  // Agrupar today por ad_id
  const todayByAd = new Map<string, any>();
  for (const r of todayRows) {
    const existing = todayByAd.get(r.ad_id);
    if (!existing) {
      todayByAd.set(r.ad_id, { ...r });
    } else {
      // Sumar si hay múltiples filas (por breakdown)
      existing.spend += safe(r.spend);
      existing.impressions += safe(r.impressions);
      existing.clicks += safe(r.clicks);
      existing.purchases += safe(r.purchases);
      existing.revenue += safe(r.revenue);
      existing.video_views_3s += safe(r.video_views_3s);
      existing.video_thruplays += safe(r.video_thruplays);
    }
  }

  // Calcular benchmarks 7d por ad
  const bench7d = new Map<string, { ctr: number[]; hookRate: number[]; holdRate: number[]; cpa: number[] }>();
  for (const r of rolling7d) {
    if (!bench7d.has(r.ad_id)) {
      bench7d.set(r.ad_id, { ctr: [], hookRate: [], holdRate: [], cpa: [] });
    }
    const b = bench7d.get(r.ad_id)!;
    if (safe(r.impressions) > 0) {
      b.ctr.push(pct(safe(r.clicks), safe(r.impressions)));
      b.hookRate.push(pct(safe(r.video_views_3s), safe(r.impressions)));
    }
    if (safe(r.video_views_3s) > 0) {
      b.holdRate.push(pct(safe(r.video_thruplays), safe(r.video_views_3s)));
    }
    if (safe(r.purchases) > 0) {
      b.cpa.push(safe(r.spend) / safe(r.purchases));
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const scorecards: AdScorecard[] = [];
  for (const [adId, r] of todayByAd) {
    const spend = safe(r.spend);
    const impressions = safe(r.impressions);
    const clicks = safe(r.clicks);
    const purchases = safe(r.purchases);
    const revenue = safe(r.revenue);
    const views3s = safe(r.video_views_3s);
    const thruplays = safe(r.video_thruplays);

    const b7 = bench7d.get(adId) || { ctr: [], hookRate: [], holdRate: [], cpa: [] };

    scorecards.push({
      ad_id: adId,
      ad_name: r.ad_name || adId,
      spend,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
      cpa: purchases > 0 ? spend / purchases : 0,
      ctr: pct(clicks, impressions),
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      hook_rate: pct(views3s, impressions),
      hold_rate: pct(thruplays, views3s),
      frequency: safe(r.frequency),
      impressions,
      clicks,
      purchases,
      benchmark_7d: {
        ctr: avg(b7.ctr),
        hook_rate: avg(b7.hookRate),
        hold_rate: avg(b7.holdRate),
        cpa: avg(b7.cpa),
      },
    });
  }

  return scorecards.sort((a, b) => b.spend - a.spend);
}

// ─── Alertas determinísticas ────────────────────────────────────

function generateAlerts(
  scorecards: AdScorecard[],
  accountMetrics: {
    totalSpend: number;
    totalRevenue: number;
    mer: number;
    avgRoas: number;
    avgCpa: number;
  },
  targets: { cpa_target?: number; roas_target?: number } | null,
  fatigueAds: any[]
): Alert[] {
  const alerts: Alert[] = [];
  const cpaTarget = targets?.cpa_target || 0;
  const roasTarget = targets?.roas_target || 0;

  // Alertas a nivel de cuenta
  if (roasTarget > 0 && accountMetrics.avgRoas < roasTarget * 0.5) {
    alerts.push({
      level: "red",
      type: "account_roas_critical",
      message: `ROAS de cuenta (${accountMetrics.avgRoas.toFixed(2)}x) está por debajo del 50% del target (${roasTarget}x)`,
      metric: "roas",
      value: accountMetrics.avgRoas,
      threshold: roasTarget * 0.5,
    });
  }

  for (const sc of scorecards) {
    // ROJO: CPA > 2x target
    if (cpaTarget > 0 && sc.cpa > cpaTarget * 2 && sc.purchases > 0) {
      alerts.push({
        level: "red",
        type: "cpa_critical",
        message: `${sc.ad_name}: CPA (${formatCOP(sc.cpa)}) es más del doble del target (${formatCOP(cpaTarget)})`,
        adId: sc.ad_id,
        adName: sc.ad_name,
        metric: "cpa",
        value: sc.cpa,
        threshold: cpaTarget * 2,
      });
    }

    // ROJO: ROAS < 0.5x target
    if (roasTarget > 0 && sc.roas < roasTarget * 0.5 && sc.spend > 0) {
      alerts.push({
        level: "red",
        type: "roas_critical",
        message: `${sc.ad_name}: ROAS (${sc.roas.toFixed(2)}x) por debajo del 50% del target`,
        adId: sc.ad_id,
        adName: sc.ad_name,
        metric: "roas",
        value: sc.roas,
        threshold: roasTarget * 0.5,
      });
    }

    // AMARILLO: CTR < 1%
    if (sc.ctr < 1 && sc.impressions > 500) {
      alerts.push({
        level: "yellow",
        type: "low_ctr",
        message: `${sc.ad_name}: CTR bajo (${sc.ctr.toFixed(2)}%)`,
        adId: sc.ad_id,
        adName: sc.ad_name,
        metric: "ctr",
        value: sc.ctr,
        threshold: 1,
      });
    }

    // AMARILLO: Hook Rate < 20%
    if (sc.hook_rate < 20 && sc.impressions > 500) {
      alerts.push({
        level: "yellow",
        type: "low_hook_rate",
        message: `${sc.ad_name}: Hook Rate bajo (${sc.hook_rate.toFixed(1)}%)`,
        adId: sc.ad_id,
        adName: sc.ad_name,
        metric: "hook_rate",
        value: sc.hook_rate,
        threshold: 20,
      });
    }

    // AMARILLO: Frequency > 3
    if (sc.frequency > 3) {
      alerts.push({
        level: "yellow",
        type: "high_frequency",
        message: `${sc.ad_name}: Frequency alta (${sc.frequency.toFixed(1)}) — posible saturación de audiencia`,
        adId: sc.ad_id,
        adName: sc.ad_name,
        metric: "frequency",
        value: sc.frequency,
        threshold: 3,
      });
    }

    // VERDE: Nuevo ad con ROAS > 2x en primeros 3 días
    if (sc.roas > 2 && sc.spend > 0) {
      const isNew = sc.benchmark_7d.ctr === 0; // Sin historial 7d = nuevo
      if (isNew) {
        alerts.push({
          level: "green",
          type: "new_ad_winner",
          message: `${sc.ad_name}: Nuevo ad con ROAS excelente (${sc.roas.toFixed(2)}x) — candidato para escalar`,
          adId: sc.ad_id,
          adName: sc.ad_name,
          metric: "roas",
          value: sc.roas,
        });
      }
    }
  }

  // Alertas de fatigue desde ad_lifecycle
  for (const f of fatigueAds) {
    alerts.push({
      level: "yellow",
      type: "creative_fatigue",
      message: `${f.ad_name || f.ad_id}: Señales de fatigue — CTR cayendo + frequency subiendo`,
      adId: f.ad_id,
      adName: f.ad_name,
      metric: "fatigue",
    });
  }

  return alerts;
}

// ─── Pacing de presupuesto ──────────────────────────────────────

function calculatePacing(
  totalSpendMonth: number,
  monthlyBudget: number,
  dayOfMonth: number,
  daysInMonth: number
): { pacing_pct: number; status: string; projected_spend: number } {
  const expectedSpend = (monthlyBudget / daysInMonth) * dayOfMonth;
  const pacing_pct = expectedSpend > 0 ? (totalSpendMonth / expectedSpend) * 100 : 0;
  const projected_spend = dayOfMonth > 0 ? (totalSpendMonth / dayOfMonth) * daysInMonth : 0;

  let status = "on_track";
  if (pacing_pct > 110) status = "overspending";
  else if (pacing_pct < 85) status = "underspending";

  return { pacing_pct, status, projected_spend };
}

// ─── Llamada a Claude API ───────────────────────────────────────

async function callClaudeAnalysis(
  accountMetrics: any,
  scorecards: AdScorecard[],
  alerts: Alert[],
  pacing: any,
  memories: any[],
  autonomyLevel: number,
  analysisDate: string
): Promise<{
  executive_summary: string;
  recommendations: Recommendation[];
  new_learnings: string[];
} | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY no configurada");
    return null;
  }

  const memoriesContext = memories.length > 0
    ? memories.map((m: any) => `- ${m.memory || m.content || JSON.stringify(m)}`).join("\n")
    : "No hay memorias previas. Este es un análisis temprano.";

  const systemPrompt = `Eres el Ad Intelligence Agent de Sewdle, un analista experto de Meta Ads basado en el Prophit System de Taylor Holiday (Common Thread Collective).

## Framework Prophit System
- Jerarquía: Contribution Margin > MER > AMER > Channel ROAS
- MER = Revenue Total / Ad Spend Total (métrica norte)
- AMER = New Customer Revenue / Ad Spend (eficiencia de adquisición)
- Channel ROAS es proxy, NO gobierna decisiones
- Moneda: COP (Pesos Colombianos)

## Tu nivel de autonomía actual: Nivel ${autonomyLevel}
${autonomyLevel === 1 ? "OBSERVAR: Solo analiza y reporta. No sugieras acciones de ejecución directa." : ""}
${autonomyLevel === 2 ? "RECOMENDAR: Genera recomendaciones priorizadas con nivel de confianza. El humano decide si ejecutar." : ""}
${autonomyLevel === 3 ? "ACTUAR: Puedes sugerir acciones automáticas para ads que cumplan criterios estrictos (CPA > 2x target con frequency > 3.5 = pausar, CPA < 0.7x target = escalar +20%)." : ""}

## Memorias del agente (aprendizajes previos):
${memoriesContext}

## Reglas clave:
- Nunca subir budget más de 20-30% por día
- Kill rápido: 2x CPA target sin conversión = pausar
- Portfolio: 60% winners, 20% testing, 20% scaling
- Siempre considerar estacionalidad y peaks comerciales de la marca

Responde SIEMPRE en JSON válido con esta estructura exacta:
{
  "executive_summary": "Resumen ejecutivo de 2-4 párrafos en español",
  "recommendations": [
    {
      "category": "scale|pause|creative_refresh|budget_realloc|test",
      "priority": "critical|high|medium|low",
      "action": "Acción específica a tomar",
      "rationale": "Por qué esta acción",
      "affected_ad_ids": ["id1"],
      "confidence": 0.85
    }
  ],
  "new_learnings": [
    "Aprendizaje nuevo que vale la pena recordar para futuros análisis"
  ]
}`;

  const userMessage = `Analiza el rendimiento de ads para la fecha ${analysisDate}.

## Métricas de cuenta:
- Spend total: ${formatCOP(accountMetrics.totalSpend)}
- Revenue total: ${formatCOP(accountMetrics.totalRevenue)}
- MER: ${accountMetrics.mer.toFixed(2)}x
- ROAS promedio: ${accountMetrics.avgRoas.toFixed(2)}x
- CPA promedio: ${formatCOP(accountMetrics.avgCpa)}
- Ads activos: ${accountMetrics.activeAds}

## Pacing mensual:
- Pacing: ${pacing.pacing_pct.toFixed(0)}% (${pacing.status})
- Gasto proyectado fin de mes: ${formatCOP(pacing.projected_spend)}

## Top ads (por spend):
${scorecards.slice(0, 15).map((sc, i) => `${i + 1}. ${sc.ad_name}
   Spend: ${formatCOP(sc.spend)} | Revenue: ${formatCOP(sc.revenue)} | ROAS: ${sc.roas.toFixed(2)}x
   CPA: ${formatCOP(sc.cpa)} | CTR: ${sc.ctr.toFixed(2)}% | CPM: ${formatCOP(sc.cpm)}
   Hook Rate: ${sc.hook_rate.toFixed(1)}% | Hold Rate: ${sc.hold_rate.toFixed(1)}% | Freq: ${sc.frequency.toFixed(1)}
   Benchmark 7d — CTR: ${sc.benchmark_7d.ctr.toFixed(2)}% | Hook: ${sc.benchmark_7d.hook_rate.toFixed(1)}% | CPA: ${formatCOP(sc.benchmark_7d.cpa)}`).join("\n\n")}

## Alertas detectadas:
${alerts.length > 0
    ? alerts.map(a => `[${a.level.toUpperCase()}] ${a.message}`).join("\n")
    : "Sin alertas críticas."
  }

Genera tu análisis completo.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      console.error("Claude API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    // Extraer JSON del response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No se pudo parsear la respuesta de Claude como JSON");
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("Error llamando Claude API:", err);
    return null;
  }
}

// ─── Acciones automáticas (Nivel 3) ────────────────────────────

async function executeAutoActions(
  recommendations: Recommendation[],
  adAccountId: string,
  accessToken: string,
  supabase: any,
  organizationId: string,
  reportId: string
): Promise<{ executed: number; actions: any[] }> {
  const actions: any[] = [];
  let executed = 0;

  for (const rec of recommendations) {
    // Solo ejecutar acciones de alta confianza
    if (rec.confidence < 0.8) continue;

    // Pausar ads con CPA crítico
    if (rec.category === "pause" && rec.priority === "critical") {
      for (const adId of rec.affected_ad_ids) {
        try {
          const res = await fetch(`${GRAPH_API}/${adId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "PAUSED",
              access_token: accessToken,
            }),
          });

          const result = await res.json();
          const action = {
            ad_id: adId,
            action: "pause",
            success: res.ok,
            result,
          };
          actions.push(action);

          if (res.ok) {
            executed++;
            console.log(`Auto-paused ad ${adId}`);
          } else {
            console.error(`Error pausando ad ${adId}:`, result);
          }
        } catch (err) {
          console.error(`Error en auto-pause de ${adId}:`, err);
        }
      }
    }

    // Escalar budget de ads winners
    if (rec.category === "scale" && rec.priority === "high") {
      for (const adId of rec.affected_ad_ids) {
        try {
          // Obtener el adset del ad para cambiar budget
          const adRes = await fetch(
            `${GRAPH_API}/${adId}?fields=adset_id&access_token=${accessToken}`
          );
          const adData = await adRes.json();
          const adsetId = adData.adset_id;

          if (!adsetId) continue;

          // Obtener budget actual
          const adsetRes = await fetch(
            `${GRAPH_API}/${adsetId}?fields=daily_budget&access_token=${accessToken}`
          );
          const adsetData = await adsetRes.json();
          const currentBudget = parseInt(adsetData.daily_budget || "0");

          if (currentBudget <= 0) continue;

          // Incrementar 20% (nunca más de 30%)
          const newBudget = Math.round(currentBudget * 1.2);

          const updateRes = await fetch(`${GRAPH_API}/${adsetId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              daily_budget: newBudget.toString(),
              access_token: accessToken,
            }),
          });

          const updateResult = await updateRes.json();
          const action = {
            ad_id: adId,
            adset_id: adsetId,
            action: "scale_budget",
            before: currentBudget,
            after: newBudget,
            success: updateRes.ok,
            result: updateResult,
          };
          actions.push(action);

          if (updateRes.ok) {
            executed++;
            console.log(`Auto-scaled adset ${adsetId}: ${currentBudget} → ${newBudget}`);
          }
        } catch (err) {
          console.error(`Error en auto-scale de ${adId}:`, err);
        }
      }
    }
  }

  // Logear acciones automáticas
  for (const action of actions) {
    await supabase.from("ad_recommendations_log").insert({
      organization_id: organizationId,
      report_id: reportId,
      recommendation_date: new Date().toISOString().split("T")[0],
      category: action.action === "pause" ? "pause" : "scale",
      priority: "critical",
      action: `Auto-${action.action}: ${action.ad_id}`,
      rationale: "Ejecutado automáticamente por el agente (Nivel 3)",
      affected_ad_ids: [action.ad_id],
      confidence: 0.9,
      executed: true,
      executed_at: new Date().toISOString(),
      executed_by: "agent",
      auto_executed: true,
      metrics_before: action.before ? { daily_budget: action.before } : null,
    });
  }

  return { executed, actions };
}

// ─── Main Handler ───────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organizationId, analysisDate } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organizationId es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dateToAnalyze = analysisDate || new Date(Date.now() - 86400000).toISOString().split("T")[0];
    console.log(`Iniciando análisis para org ${organizationId}, fecha ${dateToAnalyze}`);

    // Crear cliente Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── 1. Determinar nivel de autonomía ───────────────────────
    const { data: adAccounts } = await supabase
      .from("ad_accounts")
      .select("id, account_id, access_token, agent_autonomy_level")
      .eq("organization_id", organizationId)
      .eq("platform", "meta")
      .limit(1)
      .single();

    const autonomyLevel = adAccounts?.agent_autonomy_level || 1;
    const accessToken = adAccounts?.access_token || "";
    const adAccountDbId = adAccounts?.id;
    console.log(`Nivel de autonomía: ${autonomyLevel}`);

    // ─── 2. Queries a Supabase ──────────────────────────────────

    // Performance de hoy
    const { data: todayPerf } = await supabase
      .from("ad_performance_daily")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("date", dateToAnalyze);

    // Rolling 7d para benchmarks
    const date7dAgo = new Date(new Date(dateToAnalyze).getTime() - 7 * 86400000)
      .toISOString().split("T")[0];
    const { data: rolling7d } = await supabase
      .from("ad_performance_daily")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("date", date7dAgo)
      .lt("date", dateToAnalyze);

    // Rolling 30d para promedios de cuenta
    const date30dAgo = new Date(new Date(dateToAnalyze).getTime() - 30 * 86400000)
      .toISOString().split("T")[0];
    const { data: rolling30d } = await supabase
      .from("ad_performance_daily")
      .select("spend, revenue, purchases")
      .eq("organization_id", organizationId)
      .gte("date", date30dAgo)
      .lte("date", dateToAnalyze);

    // Lifecycle para fatigue
    const { data: lifecycleData } = await supabase
      .from("ad_lifecycle")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("fatigue_detected", true);

    // Tags para contexto creativo
    const { data: adTags } = await supabase
      .from("ad_tags")
      .select("ad_id, tag_type, tag_value")
      .eq("organization_id", organizationId);

    // Monthly targets
    const analysisMonth = dateToAnalyze.substring(0, 7); // YYYY-MM
    const { data: targets } = await supabase
      .from("monthly_targets")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("month", analysisMonth)
      .limit(1)
      .single();

    // Spend acumulado del mes para pacing
    const monthStart = `${analysisMonth}-01`;
    const { data: monthSpendData } = await supabase
      .from("ad_performance_daily")
      .select("spend")
      .eq("organization_id", organizationId)
      .gte("date", monthStart)
      .lte("date", dateToAnalyze);

    if (!todayPerf || todayPerf.length === 0) {
      console.log("No hay datos de performance para la fecha indicada");
      return new Response(
        JSON.stringify({
          status: "no_data",
          message: `No hay datos de ad_performance_daily para ${dateToAnalyze}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 3. Buscar memorias en Mem0 ─────────────────────────────

    const memories = await searchMemories(
      "rendimiento ads ROAS CPA patrones benchmarks",
      organizationId,
      "media-buying-agent",
      15
    );
    console.log(`Memorias encontradas: ${memories.length}`);

    // ─── 4. Calcular métricas determinísticas ───────────────────

    // Scorecards por ad
    const scorecards = buildAdScorecard(todayPerf, rolling7d || []);

    // Métricas de cuenta
    const totalSpend = todayPerf.reduce((s: number, r: any) => s + safe(r.spend), 0);
    const totalRevenue = todayPerf.reduce((s: number, r: any) => s + safe(r.revenue), 0);
    const totalPurchases = todayPerf.reduce((s: number, r: any) => s + safe(r.purchases), 0);
    const mer = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const avgRoas = mer; // A nivel de cuenta, MER = ROAS blended
    const avgCpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
    const activeAds = new Set(todayPerf.map((r: any) => r.ad_id)).size;

    const accountMetrics = { totalSpend, totalRevenue, mer, avgRoas, avgCpa, activeAds };

    // Pacing
    const totalSpendMonth = (monthSpendData || []).reduce(
      (s: number, r: any) => s + safe(r.spend), 0
    );
    const analysisDateObj = new Date(dateToAnalyze);
    const dayOfMonth = analysisDateObj.getDate();
    const daysInMonth = new Date(
      analysisDateObj.getFullYear(),
      analysisDateObj.getMonth() + 1,
      0
    ).getDate();
    const monthlyBudget = targets?.ad_spend_budget || 0;
    const pacing = calculatePacing(totalSpendMonth, monthlyBudget, dayOfMonth, daysInMonth);

    // ─── 5. Generar alertas ─────────────────────────────────────

    const alerts = generateAlerts(
      scorecards,
      accountMetrics,
      targets ? { cpa_target: targets.cpa_target, roas_target: targets.roas_target } : null,
      lifecycleData || []
    );
    console.log(`Alertas generadas: ${alerts.length}`);

    // ─── 6. Llamar Claude API ───────────────────────────────────

    const aiAnalysis = await callClaudeAnalysis(
      accountMetrics,
      scorecards,
      alerts,
      pacing,
      memories,
      autonomyLevel,
      dateToAnalyze
    );

    // ─── 7. Guardar reporte en BD ───────────────────────────────

    const reportData = {
      organization_id: organizationId,
      analysis_date: dateToAnalyze,
      autonomy_level: autonomyLevel,
      account_metrics: accountMetrics,
      pacing,
      alerts,
      scorecards_count: scorecards.length,
      top_scorecards: scorecards.slice(0, 15),
      executive_summary: aiAnalysis?.executive_summary || "Análisis no disponible — error en Claude API",
      ai_recommendations: aiAnalysis?.recommendations || [],
      new_learnings: aiAnalysis?.new_learnings || [],
      memories_used: memories.length,
      created_at: new Date().toISOString(),
    };

    const { data: report, error: reportError } = await supabase
      .from("ad_analysis_reports")
      .insert(reportData)
      .select("id")
      .single();

    if (reportError) {
      console.error("Error guardando reporte:", reportError);
    }

    const reportId = report?.id;

    // Guardar recomendaciones individuales
    if (aiAnalysis?.recommendations && reportId) {
      const recsToInsert = aiAnalysis.recommendations.map((rec: Recommendation) => ({
        organization_id: organizationId,
        report_id: reportId,
        recommendation_date: dateToAnalyze,
        category: rec.category,
        priority: rec.priority,
        action: rec.action,
        rationale: rec.rationale,
        affected_ad_ids: rec.affected_ad_ids,
        confidence: rec.confidence,
        executed: false,
        metrics_before: null,
      }));

      const { error: recsError } = await supabase
        .from("ad_recommendations_log")
        .insert(recsToInsert);

      if (recsError) {
        console.error("Error guardando recomendaciones:", recsError);
      }
    }

    // ─── 8. Guardar new_learnings en Mem0 ───────────────────────

    if (aiAnalysis?.new_learnings) {
      for (const learning of aiAnalysis.new_learnings) {
        await addMemory(
          learning,
          organizationId,
          "media-buying-agent",
          {
            category: "learning",
            source: "daily-analysis",
            date: dateToAnalyze,
            report_id: reportId,
          }
        );
      }
      console.log(`Guardados ${aiAnalysis.new_learnings.length} learnings en Mem0`);
    }

    // ─── 9. Acciones automáticas (Nivel 3) ──────────────────────

    let autoActions = null;
    if (autonomyLevel >= 3 && aiAnalysis?.recommendations && accessToken) {
      // Verificar accuracy promedio antes de actuar
      const { data: recentRecs } = await supabase
        .from("ad_recommendations_log")
        .select("accuracy_score")
        .eq("organization_id", organizationId)
        .not("accuracy_score", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);

      const scores = (recentRecs || [])
        .map((r: any) => r.accuracy_score)
        .filter((s: number) => s != null);
      const avgAccuracy = scores.length > 0
        ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
        : 0;

      if (avgAccuracy >= 0.8 && scores.length >= 10) {
        console.log(`Accuracy ${avgAccuracy.toFixed(2)} >= 0.80 — ejecutando acciones automáticas`);
        autoActions = await executeAutoActions(
          aiAnalysis.recommendations,
          adAccounts?.account_id || "",
          accessToken,
          supabase,
          organizationId,
          reportId
        );
        console.log(`Acciones automáticas ejecutadas: ${autoActions.executed}`);
      } else {
        console.log(`Accuracy ${avgAccuracy.toFixed(2)} insuficiente o muy pocas muestras (${scores.length}) — no se ejecutan acciones automáticas`);
        // Si accuracy es muy baja, bajar a Nivel 2
        if (avgAccuracy < 0.7 && scores.length >= 10) {
          await supabase
            .from("ad_accounts")
            .update({ agent_autonomy_level: 2 })
            .eq("id", adAccountDbId);
          console.log("Accuracy < 0.70 — bajando a Nivel 2");
        }
      }
    }

    // ─── 10. Respuesta ──────────────────────────────────────────

    const response = {
      status: "success",
      report_id: reportId,
      analysis_date: dateToAnalyze,
      autonomy_level: autonomyLevel,
      account_metrics: accountMetrics,
      pacing,
      alerts_count: alerts.length,
      alerts,
      scorecards_count: scorecards.length,
      executive_summary: aiAnalysis?.executive_summary || null,
      recommendations_count: aiAnalysis?.recommendations?.length || 0,
      recommendations: aiAnalysis?.recommendations || [],
      new_learnings: aiAnalysis?.new_learnings || [],
      memories_used: memories.length,
      auto_actions: autoActions,
    };

    console.log(`Análisis completado. Reporte: ${reportId}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error en daily-ad-analysis:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
