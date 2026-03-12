import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// ─── Lifecycle Phase Detection ──────────────────────────────────

function detectPhase(
  daysActive: number,
  roas: number,
  lastSeenDaysAgo: number
): string {
  if (lastSeenDaysAgo > 3) return "inactive";
  if (daysActive <= 3) return "testing";
  if (daysActive <= 14 && roas >= 1.5) return "scaling";
  if (daysActive > 14 && roas >= 1.0) return "mature";
  if (roas < 1.0) return "declining";
  return "active";
}

// ─── Fatigue Detection ──────────────────────────────────────────
// Fatigue = 3 consecutive days of ROAS decline from peak

function detectFatigue(
  dailyData: Array<{ date: string; roas: number }>
): { fatigueDate: string | null; daysToFatigue: number | null } {
  if (dailyData.length < 4)
    return { fatigueDate: null, daysToFatigue: null };

  // Sort by date ascending
  const sorted = [...dailyData].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let peakRoas = 0;
  let peakIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].roas > peakRoas) {
      peakRoas = sorted[i].roas;
      peakIdx = i;
    }
  }

  // Look for 3 consecutive declines after peak
  let consecutiveDeclines = 0;
  for (let i = peakIdx + 1; i < sorted.length; i++) {
    if (sorted[i].roas < sorted[i - 1].roas) {
      consecutiveDeclines++;
      if (consecutiveDeclines >= 3) {
        const firstDeclineIdx = i - 2;
        return {
          fatigueDate: sorted[firstDeclineIdx].date,
          daysToFatigue: firstDeclineIdx,
        };
      }
    } else {
      consecutiveDeclines = 0;
    }
  }

  return { fatigueDate: null, daysToFatigue: null };
}

// ─── Week Helpers ───────────────────────────────────────────────

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().split("T")[0];
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().split("T")[0];
}

// ─── Main Handler ───────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Falta organizationId" }),
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

    // ═══════════════════════════════════════════════════════════
    // Load all performance data
    // ═══════════════════════════════════════════════════════════

    console.log(`Loading performance data for org ${organizationId}...`);

    const { data: perfData, error: perfError } = await supabase
      .from("ad_performance_daily")
      .select("*")
      .eq("organization_id", organizationId)
      .order("date", { ascending: true });

    if (perfError) {
      return new Response(
        JSON.stringify({
          error: "Error loading performance data",
          details: perfError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!perfData || perfData.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No performance data to compute",
          lifecycle: 0,
          weeklySummaries: 0,
          patterns: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load tags for pattern computation
    const { data: tagsData } = await supabase
      .from("ad_tags")
      .select("*")
      .eq("organization_id", organizationId);

    const tagsMap = new Map<string, any>();
    for (const tag of tagsData || []) {
      tagsMap.set(tag.ad_id, tag);
    }

    console.log(
      `Loaded ${perfData.length} daily rows, ${tagsMap.size} tags`
    );

    const today = new Date().toISOString().split("T")[0];

    // ═══════════════════════════════════════════════════════════
    // 1. Ad Lifecycle
    // ═══════════════════════════════════════════════════════════

    console.log("[1] Computing ad lifecycle...");

    // Group performance data by ad_id
    const adGroups = new Map<string, any[]>();
    for (const row of perfData) {
      const existing = adGroups.get(row.ad_id) || [];
      existing.push(row);
      adGroups.set(row.ad_id, existing);
    }

    let lifecycleCount = 0;
    const lifecycleErrors: string[] = [];

    for (const [adId, rows] of adGroups) {
      try {
        const sorted = rows.sort(
          (a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const firstSeen = sorted[0].date;
        const lastSeen = sorted[sorted.length - 1].date;
        const daysActive =
          Math.ceil(
            (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) /
              (1000 * 60 * 60 * 24)
          ) + 1;

        const totalSpend = sorted.reduce(
          (s: number, r: any) => s + parseFloat(r.spend || 0),
          0
        );
        const totalRevenue = sorted.reduce(
          (s: number, r: any) => s + parseFloat(r.revenue || 0),
          0
        );
        const totalPurchases = sorted.reduce(
          (s: number, r: any) => s + (r.purchases || 0),
          0
        );
        const lifetimeRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
        const lifetimeCpa =
          totalPurchases > 0 ? totalSpend / totalPurchases : 0;

        // Best ROAS day
        let bestRoasDay = sorted[0].date;
        let bestRoasValue = 0;
        for (const row of sorted) {
          const rowRoas = parseFloat(row.roas || 0);
          if (rowRoas > bestRoasValue) {
            bestRoasValue = rowRoas;
            bestRoasDay = row.date;
          }
        }

        // Fatigue detection
        const dailyRoas = sorted.map((r: any) => ({
          date: r.date,
          roas: parseFloat(r.roas || 0),
        }));
        const { fatigueDate, daysToFatigue } = detectFatigue(dailyRoas);

        // Phase
        const lastSeenDaysAgo = Math.ceil(
          (new Date(today).getTime() - new Date(lastSeen).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        const currentStatus = detectPhase(
          daysActive,
          lifetimeRoas,
          lastSeenDaysAgo
        );

        const { error: upsertError } = await supabase
          .from("ad_lifecycle")
          .upsert(
            {
              organization_id: organizationId,
              ad_id: adId,
              ad_name: sorted[sorted.length - 1].ad_name,
              first_seen: firstSeen,
              last_seen: lastSeen,
              days_active: daysActive,
              lifetime_spend: totalSpend,
              lifetime_revenue: totalRevenue,
              lifetime_purchases: totalPurchases,
              lifetime_roas: lifetimeRoas,
              lifetime_cpa: lifetimeCpa,
              best_roas_day: bestRoasDay,
              best_roas_value: bestRoasValue,
              fatigue_start_date: fatigueDate,
              days_to_fatigue: daysToFatigue,
              current_status: currentStatus,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,ad_id" }
          );

        if (upsertError) {
          lifecycleErrors.push(`${adId}: ${upsertError.message}`);
        } else {
          lifecycleCount++;
        }
      } catch (err) {
        lifecycleErrors.push(
          `${adId}: ${err instanceof Error ? err.message : "Error"}`
        );
      }
    }

    console.log(
      `[1] Computed lifecycle for ${lifecycleCount}/${adGroups.size} ads`
    );

    // ═══════════════════════════════════════════════════════════
    // 2. Weekly Ad Summary
    // ═══════════════════════════════════════════════════════════

    console.log("[2] Computing weekly summaries...");

    // Group by ad_id + week
    const weeklyGroups = new Map<string, any[]>();
    for (const row of perfData) {
      const weekStart = getWeekStart(row.date);
      const key = `${row.ad_id}__${weekStart}`;
      const existing = weeklyGroups.get(key) || [];
      existing.push(row);
      weeklyGroups.set(key, existing);
    }

    let weeklyCount = 0;
    const weeklyErrors: string[] = [];

    // Collect weekly ROAS per ad for trend computation
    const adWeeklyRoas = new Map<string, Map<string, number>>();

    const weeklyRecords: Array<{
      key: string;
      adId: string;
      weekStart: string;
      record: any;
    }> = [];

    for (const [key, rows] of weeklyGroups) {
      const [adId, weekStart] = key.split("__");
      const weekEnd = getWeekEnd(weekStart);

      const totalSpend = rows.reduce(
        (s: number, r: any) => s + parseFloat(r.spend || 0),
        0
      );
      const totalRevenue = rows.reduce(
        (s: number, r: any) => s + parseFloat(r.revenue || 0),
        0
      );
      const totalPurchases = rows.reduce(
        (s: number, r: any) => s + (r.purchases || 0),
        0
      );
      const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const avgCpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
      const avgCtr =
        rows.reduce(
          (s: number, r: any) => s + parseFloat(r.ctr || 0),
          0
        ) / rows.length;
      const avgFrequency =
        rows.reduce(
          (s: number, r: any) => s + parseFloat(r.frequency || 0),
          0
        ) / rows.length;

      // Track for trend computation
      if (!adWeeklyRoas.has(adId)) adWeeklyRoas.set(adId, new Map());
      adWeeklyRoas.get(adId)!.set(weekStart, avgRoas);

      // Status based on ROAS
      let status = "active";
      if (avgRoas >= 2.0) status = "star";
      else if (avgRoas >= 1.0) status = "profitable";
      else if (avgRoas > 0 && avgRoas < 1.0) status = "underperforming";
      else if (totalSpend === 0) status = "paused";

      weeklyRecords.push({
        key,
        adId,
        weekStart,
        record: {
          organization_id: organizationId,
          week_start: weekStart,
          week_end: weekEnd,
          ad_id: adId,
          ad_name: rows[rows.length - 1].ad_name,
          total_spend: totalSpend,
          total_revenue: totalRevenue,
          total_purchases: totalPurchases,
          avg_roas: avgRoas,
          avg_cpa: avgCpa,
          avg_ctr: avgCtr,
          avg_frequency: avgFrequency,
          roas_trend: 0, // computed below
          status,
          computed_at: new Date().toISOString(),
        },
      });
    }

    // Compute ROAS trends (vs prior week)
    for (const rec of weeklyRecords) {
      const weekMap = adWeeklyRoas.get(rec.adId);
      if (weekMap) {
        const weekDate = new Date(rec.weekStart + "T00:00:00Z");
        weekDate.setUTCDate(weekDate.getUTCDate() - 7);
        const priorWeek = weekDate.toISOString().split("T")[0];
        const priorRoas = weekMap.get(priorWeek);
        if (priorRoas !== undefined && priorRoas > 0) {
          rec.record.roas_trend =
            ((rec.record.avg_roas - priorRoas) / priorRoas) * 100;
        }
      }

      const { error: upsertError } = await supabase
        .from("weekly_ad_summary")
        .upsert(rec.record, {
          onConflict: "organization_id,week_start,ad_id",
        });

      if (upsertError) {
        weeklyErrors.push(`${rec.key}: ${upsertError.message}`);
      } else {
        weeklyCount++;
      }
    }

    console.log(
      `[2] Computed ${weeklyCount}/${weeklyGroups.size} weekly summaries`
    );

    // ═══════════════════════════════════════════════════════════
    // 3. Performance Patterns by Dimension
    // ═══════════════════════════════════════════════════════════

    console.log("[3] Computing performance patterns...");

    const DIMENSIONS = [
      "creative_type",
      "sales_angle",
      "product",
      "audience_type",
      "audience_gender",
      "is_advantage_plus",
      "target_country",
      "funnel_stage",
      "offer_type",
    ];

    const PERIOD_CONFIGS = [
      { type: "7d", days: 7 },
      { type: "30d", days: 30 },
    ];

    let patternsCount = 0;
    const patternsErrors: string[] = [];

    for (const periodConfig of PERIOD_CONFIGS) {
      const periodEnd = new Date(today);
      const periodStart = new Date(today);
      periodStart.setDate(periodStart.getDate() - periodConfig.days);

      const periodStartStr = periodStart.toISOString().split("T")[0];
      const periodEndStr = periodEnd.toISOString().split("T")[0];

      // Filter performance data to this period
      const periodData = perfData.filter(
        (r: any) => r.date >= periodStartStr && r.date <= periodEndStr
      );

      for (const dimension of DIMENSIONS) {
        // Group by dimension value
        const dimGroups = new Map<
          string,
          { adIds: Set<string>; rows: any[] }
        >();

        for (const row of periodData) {
          const tags = tagsMap.get(row.ad_id);
          if (!tags) continue;

          let dimValue: string | null = null;

          if (dimension === "is_advantage_plus") {
            dimValue = tags.is_advantage_plus ? "Advantage+" : "Manual";
          } else {
            dimValue = tags[dimension] || null;
          }

          if (!dimValue) continue;

          if (!dimGroups.has(dimValue)) {
            dimGroups.set(dimValue, { adIds: new Set(), rows: [] });
          }
          const group = dimGroups.get(dimValue)!;
          group.adIds.add(row.ad_id);
          group.rows.push(row);
        }

        // Compute aggregates per dimension value
        const dimRecords: Array<{ value: string; record: any }> = [];

        for (const [dimValue, group] of dimGroups) {
          const totalSpend = group.rows.reduce(
            (s: number, r: any) => s + parseFloat(r.spend || 0),
            0
          );
          const totalRevenue = group.rows.reduce(
            (s: number, r: any) => s + parseFloat(r.revenue || 0),
            0
          );
          const totalPurchases = group.rows.reduce(
            (s: number, r: any) => s + (r.purchases || 0),
            0
          );
          const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
          const avgCpa =
            totalPurchases > 0 ? totalSpend / totalPurchases : 0;
          const avgCtr =
            group.rows.reduce(
              (s: number, r: any) => s + parseFloat(r.ctr || 0),
              0
            ) / group.rows.length;
          const avgHookRate =
            group.rows.filter((r: any) => r.hook_rate != null).length > 0
              ? group.rows.reduce(
                  (s: number, r: any) =>
                    s + parseFloat(r.hook_rate || 0),
                  0
                ) /
                group.rows.filter((r: any) => r.hook_rate != null).length
              : null;

          dimRecords.push({
            value: dimValue,
            record: {
              organization_id: organizationId,
              dimension,
              dimension_value: dimValue,
              period_start: periodStartStr,
              period_end: periodEndStr,
              period_type: periodConfig.type,
              total_ads: group.adIds.size,
              total_spend: totalSpend,
              total_revenue: totalRevenue,
              total_purchases: totalPurchases,
              avg_roas: avgRoas,
              avg_cpa: avgCpa,
              avg_ctr: avgCtr,
              avg_hook_rate: avgHookRate,
              median_days_to_fatigue: null, // computed later if needed
              roas_rank: 0, // set below
              computed_at: new Date().toISOString(),
            },
          });
        }

        // Sort by ROAS desc and assign rank
        dimRecords.sort(
          (a, b) => b.record.avg_roas - a.record.avg_roas
        );
        dimRecords.forEach((rec, idx) => {
          rec.record.roas_rank = idx + 1;
        });

        // Upsert
        for (const rec of dimRecords) {
          const { error: upsertError } = await supabase
            .from("performance_patterns")
            .upsert(rec.record, {
              onConflict:
                "organization_id,dimension,dimension_value,period_start,period_type",
            });

          if (upsertError) {
            patternsErrors.push(
              `${dimension}/${rec.value}: ${upsertError.message}`
            );
          } else {
            patternsCount++;
          }
        }
      }
    }

    console.log(`[3] Computed ${patternsCount} pattern records`);

    return new Response(
      JSON.stringify({
        success: true,
        lifecycle: lifecycleCount,
        lifecycleErrors:
          lifecycleErrors.length > 0 ? lifecycleErrors : undefined,
        weeklySummaries: weeklyCount,
        weeklyErrors:
          weeklyErrors.length > 0 ? weeklyErrors : undefined,
        patterns: patternsCount,
        patternsErrors:
          patternsErrors.length > 0 ? patternsErrors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("compute-ad-intelligence error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
