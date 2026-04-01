// ─── Review Agent Accuracy (Semanal) ────────────────────────────
// Función que corre cada domingo para:
// 1. Medir accuracy de recomendaciones ejecutadas hace 3-7 días
// 2. Actualizar accuracy_score en ad_recommendations_log
// 3. Recalcular agent_autonomy_level en ad_accounts
// 4. Cada 7 días recalcular benchmarks dinámicos → guardar en Mem0

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// ─── Mem0 Helpers ───────────────────────────────────────────────

const MEM0_BASE_URL = "https://api.mem0.ai";

function getMem0Headers(): Record<string, string> {
  const apiKey = Deno.env.get("MEM0_API_KEY");
  if (!apiKey) throw new Error("MEM0_API_KEY no está configurada");
  return {
    "Content-Type": "application/json",
    Authorization: `Token ${apiKey}`,
  };
}

async function addMemory(
  content: string,
  userId: string,
  agentId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const body: Record<string, unknown> = {
      messages: [{ role: "user", content }],
      user_id: userId,
      agent_id: agentId,
    };
    if (metadata) body.metadata = metadata;

    const res = await fetch(`${MEM0_BASE_URL}/v1/memories/`, {
      method: "POST",
      headers: getMem0Headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("Mem0 addMemory error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Mem0 addMemory error:", err);
  }
}

// ─── Accuracy calculation ───────────────────────────────────────

interface MetricsBefore {
  roas?: number;
  cpa?: number;
  ctr?: number;
  frequency?: number;
  spend?: number;
}

function calculateAccuracyScore(
  category: string,
  metricsBefore: MetricsBefore,
  metricsAfter: MetricsBefore
): { score: number; delta: Record<string, number> } {
  const delta: Record<string, number> = {};

  // Calcular deltas porcentuales
  if (metricsBefore.roas && metricsAfter.roas) {
    delta.roas_delta_pct =
      ((metricsAfter.roas - metricsBefore.roas) / metricsBefore.roas) * 100;
  }
  if (metricsBefore.cpa && metricsAfter.cpa) {
    delta.cpa_delta_pct =
      ((metricsAfter.cpa - metricsBefore.cpa) / metricsBefore.cpa) * 100;
  }
  if (metricsBefore.ctr && metricsAfter.ctr) {
    delta.ctr_delta_pct =
      ((metricsAfter.ctr - metricsBefore.ctr) / metricsBefore.ctr) * 100;
  }

  // Score basado en la categoría de la recomendación
  let score = 0.5; // neutro por defecto

  switch (category) {
    case "scale": {
      // Escalar: éxito si ROAS se mantuvo o subió y spend subió
      const roasOk = (delta.roas_delta_pct ?? 0) >= -10; // tolerar -10%
      const spendUp =
        metricsBefore.spend && metricsAfter.spend
          ? metricsAfter.spend > metricsBefore.spend
          : false;
      if (roasOk && spendUp) score = 1.0;
      else if (roasOk) score = 0.7;
      else score = 0.2;
      break;
    }
    case "pause": {
      // Pausar: éxito si el ad se pausó (ya no gasta) o CPA del account mejoró
      score = 0.8; // pausar siempre es razonablemente correcto si se recomendó
      if ((delta.cpa_delta_pct ?? 0) < 0) score = 1.0;
      break;
    }
    case "creative_refresh": {
      // Refresh creativo: éxito si CTR o ROAS mejoraron
      if ((delta.ctr_delta_pct ?? 0) > 5 || (delta.roas_delta_pct ?? 0) > 5) {
        score = 1.0;
      } else if (
        (delta.ctr_delta_pct ?? 0) > -5 &&
        (delta.roas_delta_pct ?? 0) > -5
      ) {
        score = 0.5;
      } else {
        score = 0.2;
      }
      break;
    }
    case "budget_realloc": {
      // Reasignación: éxito si ROAS general mejoró
      if ((delta.roas_delta_pct ?? 0) > 5) score = 1.0;
      else if ((delta.roas_delta_pct ?? 0) > -5) score = 0.5;
      else score = 0.2;
      break;
    }
    default: {
      // Genérico: basado en ROAS
      if ((delta.roas_delta_pct ?? 0) > 5) score = 1.0;
      else if ((delta.roas_delta_pct ?? 0) > -5) score = 0.5;
      else score = 0.0;
    }
  }

  return { score, delta };
}

// ─── Serve ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organizationId } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organizationId es requerido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // ═══════════════════════════════════════════════════════════
    // 1. Leer recomendaciones ejecutadas hace 3-7 días sin accuracy
    // ═══════════════════════════════════════════════════════════
    const { data: pendingReview, error: prError } = await supabase
      .from("ad_recommendations_log")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("executed", true)
      .is("accuracy_score", null)
      .gte("executed_at", sevenDaysAgo.toISOString())
      .lte("executed_at", threeDaysAgo.toISOString());

    if (prError) {
      console.error("Error fetching pending reviews:", prError);
    }

    const recommendations = pendingReview || [];
    console.log(
      `[review-accuracy] ${recommendations.length} recomendaciones para evaluar (org: ${organizationId})`
    );

    let updated = 0;

    // ═══════════════════════════════════════════════════════════
    // 2-4. Para cada recomendación, obtener métricas actuales y calcular accuracy
    // ═══════════════════════════════════════════════════════════
    for (const rec of recommendations) {
      const affectedAdIds = rec.affected_ad_ids || [];
      if (affectedAdIds.length === 0) continue;

      // Obtener métricas actuales (últimos 3 días) de los ads afectados
      const afterStartDate = new Date(rec.executed_at);
      afterStartDate.setDate(afterStartDate.getDate() + 1);
      const afterEndDate = new Date(now);

      const { data: afterMetrics } = await supabase
        .from("ad_performance_daily")
        .select("spend, revenue, purchases, impressions, clicks, ctr")
        .eq("organization_id", organizationId)
        .in("ad_id", affectedAdIds)
        .gte("date", afterStartDate.toISOString().split("T")[0])
        .lte("date", afterEndDate.toISOString().split("T")[0]);

      if (!afterMetrics || afterMetrics.length === 0) continue;

      // Agregar métricas after
      const aggAfter = afterMetrics.reduce(
        (acc, m) => ({
          spend: acc.spend + (m.spend || 0),
          revenue: acc.revenue + (m.revenue || 0),
          purchases: acc.purchases + (m.purchases || 0),
          impressions: acc.impressions + (m.impressions || 0),
          clicks: acc.clicks + (m.clicks || 0),
        }),
        { spend: 0, revenue: 0, purchases: 0, impressions: 0, clicks: 0 }
      );

      const metricsAfter: MetricsBefore = {
        roas: aggAfter.spend > 0 ? aggAfter.revenue / aggAfter.spend : 0,
        cpa: aggAfter.purchases > 0 ? aggAfter.spend / aggAfter.purchases : 0,
        ctr:
          aggAfter.impressions > 0
            ? (aggAfter.clicks / aggAfter.impressions) * 100
            : 0,
        spend: aggAfter.spend,
      };

      const metricsBefore: MetricsBefore = rec.metrics_before || {};

      // Calcular accuracy
      const { score, delta } = calculateAccuracyScore(
        rec.category || "other",
        metricsBefore,
        metricsAfter
      );

      // Actualizar en BD
      const { error: updateErr } = await supabase
        .from("ad_recommendations_log")
        .update({
          accuracy_score: score,
          metrics_after: metricsAfter,
          outcome_delta: delta,
          outcome_measured_at: now.toISOString().split("T")[0],
        })
        .eq("id", rec.id);

      if (updateErr) {
        console.error(`Error updating rec ${rec.id}:`, updateErr);
      } else {
        updated++;
      }

      // Si accuracy muy baja, guardar contradicción en Mem0
      if (score < 0.3) {
        await addMemory(
          `Contradicción detectada: la recomendación "${rec.action}" (categoría: ${rec.category}) tuvo accuracy ${score}. Métricas before: ROAS ${metricsBefore.roas?.toFixed(2)}, CPA ${metricsBefore.cpa?.toFixed(0)}. Métricas after: ROAS ${metricsAfter.roas?.toFixed(2)}, CPA ${metricsAfter.cpa?.toFixed(0)}. Revisar si este tipo de recomendación es válida.`,
          organizationId,
          "media-buying-agent",
          { category: "contradiction", recommendation_id: rec.id }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 5. Calcular promedio de últimas 20 → actualizar autonomy_level
    // ═══════════════════════════════════════════════════════════
    const { data: last20 } = await supabase
      .from("ad_recommendations_log")
      .select("accuracy_score, created_at")
      .eq("organization_id", organizationId)
      .not("accuracy_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    const scored = (last20 || []).filter((r) => r.accuracy_score !== null);
    const avgAccuracy =
      scored.length > 0
        ? scored.reduce((s, r) => s + Number(r.accuracy_score), 0) /
          scored.length
        : 0;

    // Determinar nivel
    const { data: currentAccount } = await supabase
      .from("ad_accounts")
      .select("id, agent_autonomy_level, created_at")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (currentAccount) {
      const currentLevel = currentAccount.agent_autonomy_level || 1;
      const daysActive = currentAccount.created_at
        ? Math.floor(
            (now.getTime() - new Date(currentAccount.created_at).getTime()) /
              86400000
          )
        : 0;

      let newLevel = currentLevel;

      // Subir a nivel 3 si accuracy > 80% y lleva > 21 días
      if (avgAccuracy > 0.8 && daysActive > 21 && scored.length >= 10) {
        newLevel = 3;
      }
      // Subir a nivel 2 si lleva > 10 días
      else if (daysActive > 10 && currentLevel === 1) {
        newLevel = 2;
      }
      // Bajar de nivel 3 a 2 si accuracy < 70%
      else if (currentLevel === 3 && avgAccuracy < 0.7 && scored.length >= 5) {
        newLevel = 2;
      }

      if (newLevel !== currentLevel) {
        await supabase
          .from("ad_accounts")
          .update({ agent_autonomy_level: newLevel })
          .eq("id", currentAccount.id);

        console.log(
          `[review-accuracy] Autonomy level cambió: ${currentLevel} → ${newLevel} (accuracy: ${(avgAccuracy * 100).toFixed(1)}%)`
        );
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 6. Recalcular benchmarks dinámicos (rolling 30d)
    // ═══════════════════════════════════════════════════════════
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: perfData } = await supabase
      .from("ad_performance_daily")
      .select(
        "spend, revenue, purchases, impressions, clicks, link_clicks, video_views_3s, video_thruplays, reach"
      )
      .eq("organization_id", organizationId)
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

    if (perfData && perfData.length > 0) {
      const totals = perfData.reduce(
        (acc, m) => ({
          spend: acc.spend + (m.spend || 0),
          revenue: acc.revenue + (m.revenue || 0),
          purchases: acc.purchases + (m.purchases || 0),
          impressions: acc.impressions + (m.impressions || 0),
          clicks: acc.clicks + (m.clicks || 0),
          link_clicks: acc.link_clicks + (m.link_clicks || 0),
          video_views_3s: acc.video_views_3s + (m.video_views_3s || 0),
          video_thruplays: acc.video_thruplays + (m.video_thruplays || 0),
          reach: acc.reach + (m.reach || 0),
        }),
        {
          spend: 0,
          revenue: 0,
          purchases: 0,
          impressions: 0,
          clicks: 0,
          link_clicks: 0,
          video_views_3s: 0,
          video_thruplays: 0,
          reach: 0,
        }
      );

      const avgHookRate =
        totals.impressions > 0
          ? (totals.video_views_3s / totals.impressions) * 100
          : 0;
      const avgHoldRate =
        totals.video_views_3s > 0
          ? (totals.video_thruplays / totals.video_views_3s) * 100
          : 0;
      const avgCtr =
        totals.impressions > 0
          ? (totals.link_clicks / totals.impressions) * 100
          : 0;
      const avgCpa =
        totals.purchases > 0 ? totals.spend / totals.purchases : 0;
      const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;

      const dateStr = now.toISOString().split("T")[0];

      await addMemory(
        `Benchmarks actualizados de Dosmicos al ${dateStr}: Hook Rate promedio ${avgHookRate.toFixed(1)}%, Hold Rate ${avgHoldRate.toFixed(1)}%, CTR ${avgCtr.toFixed(2)}%, CPA promedio COP ${avgCpa.toFixed(0)}, ROAS promedio ${avgRoas.toFixed(2)}x. Rolling 30 días con ${perfData.length} datapoints. Estos reemplazan los benchmarks genéricos.`,
        organizationId,
        "media-buying-agent",
        { category: "benchmark_dynamic", replaces: "benchmark_initial" }
      );

      console.log(
        `[review-accuracy] Benchmarks dinámicos actualizados: HR=${avgHookRate.toFixed(1)}%, CTR=${avgCtr.toFixed(2)}%, CPA=COP${avgCpa.toFixed(0)}, ROAS=${avgRoas.toFixed(2)}x`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        reviewed: recommendations.length,
        updated,
        avg_accuracy: Number(avgAccuracy.toFixed(2)),
        autonomy_level: currentAccount?.agent_autonomy_level ?? 1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("review-agent-accuracy error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
