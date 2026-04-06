import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// ─── Scoring Functions ──────────────────────────────────────────

function computeRoasScore(avgRoas: number): number {
  if (avgRoas >= 5.0) return 100;
  if (avgRoas >= 4.0) return 90;
  if (avgRoas >= 3.0) return 75;
  if (avgRoas >= 2.5) return 60;
  if (avgRoas >= 2.0) return 45;
  if (avgRoas >= 1.5) return 30;
  return 15;
}

function computeEngagementScore(
  avgCtr: number | null,
  avgHookRate: number | null
): number {
  let score = 0;

  // CTR component (0-50)
  const ctr = avgCtr ?? 0;
  if (ctr >= 2.5) score += 50;
  else if (ctr >= 1.8) score += 40;
  else if (ctr >= 1.2) score += 30;
  else if (ctr >= 0.8) score += 20;
  else score += 10;

  // Hook Rate component (0-50)
  const hookRate = avgHookRate ?? 0;
  if (hookRate >= 45) score += 50;
  else if (hookRate >= 35) score += 40;
  else if (hookRate >= 25) score += 30;
  else if (hookRate >= 15) score += 20;
  else score += 10;

  return score;
}

function computeConversionScore(
  avgLpConv: number | null,
  avgHoldRate: number | null
): number {
  let score = 0;

  // LP Conv component (0-50)
  const lpConv = avgLpConv ?? 0;
  if (lpConv >= 5.0) score += 50;
  else if (lpConv >= 3.5) score += 40;
  else if (lpConv >= 2.0) score += 30;
  else if (lpConv >= 1.0) score += 20;
  else score += 10;

  // Hold Rate component (0-50)
  const holdRate = avgHoldRate ?? 0;
  if (holdRate >= 40) score += 50;
  else if (holdRate >= 30) score += 40;
  else if (holdRate >= 20) score += 30;
  else score += 15;

  return score;
}

function computeConsistencyScore(
  bestRoas: number | null,
  worstRoas: number | null,
  avgRoas: number
): number {
  if (!bestRoas || !worstRoas || avgRoas <= 0) return 50;
  const spread = (bestRoas - worstRoas) / avgRoas;
  if (spread < 0.3) return 95;
  if (spread < 0.5) return 80;
  if (spread < 0.8) return 60;
  if (spread < 1.2) return 40;
  return 20;
}

function computeRoiScore(
  lifetimeRevenue: number,
  totalPaid: number
): number | null {
  if (!totalPaid || totalPaid === 0) return null;
  const roi = lifetimeRevenue / totalPaid;
  if (roi >= 20) return 100;
  if (roi >= 10) return 85;
  if (roi >= 5) return 70;
  if (roi >= 3) return 55;
  if (roi >= 1) return 35;
  return 15;
}

function computeOverallAndTier(scores: {
  roasScore: number;
  engagementScore: number;
  conversionScore: number;
  consistencyScore: number;
  totalAds: number;
  totalDays: number;
  lifetimeSpend: number;
}): { overallScore: number; tier: string } {
  // Minimum data requirement: 3 ads with >$150k COP spend
  if (
    scores.totalAds < 3 ||
    scores.lifetimeSpend < 150000
  ) {
    return { overallScore: 0, tier: "new" };
  }

  const overall =
    scores.roasScore * 0.4 +
    scores.engagementScore * 0.2 +
    scores.conversionScore * 0.25 +
    scores.consistencyScore * 0.15;

  let tier: string;
  if (overall >= 85) tier = "S";
  else if (overall >= 70) tier = "A";
  else if (overall >= 55) tier = "B";
  else if (overall >= 40) tier = "C";
  else tier = "D";

  return {
    overallScore: Math.round(overall * 100) / 100,
    tier,
  };
}

function computeRecommendation(
  tier: string,
  totalAds: number,
  distinctProducts: number,
  avgHookRate: number | null,
  avgLpConv: number | null
): string | null {
  if (tier === "new") return "new_creator_watch";
  if (tier === "S" || tier === "A") {
    if (distinctProducts <= 2) return "test_new_product";
    return "assign_more_work";
  }
  if (tier === "C") {
    // Good hooks but low conversion → needs direction
    if ((avgHookRate ?? 0) > 25 && (avgLpConv ?? 0) < 2.0) {
      return "needs_direction";
    }
    return "needs_direction";
  }
  if (tier === "D" && totalAds >= 5) return "pause_collaboration";
  return null;
}

// ─── Main Handler ───────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organizationId } = await req.json();
    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organizationId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`[UGC Scores] Starting for org: ${organizationId}`);

    // ─── 1. Load UGC ads from both ad_tags AND ad_creative_content ─
    // ad_tags may be incomplete if AI tagging timed out, so we also
    // check ad_creative_content which is always written first during sync.

    const { data: adTags, error: tagsErr } = await supabase
      .from("ad_tags")
      .select("ad_id, ad_name, ugc_creator_handle, product, sales_angle, creative_type, funnel_stage")
      .eq("organization_id", organizationId)
      .not("ugc_creator_handle", "is", null);

    if (tagsErr) throw new Error(`ad_tags query failed: ${tagsErr.message}`);

    // Also load from ad_creative_content (always written during sync, even without AI tagging)
    const { data: creativeHandles, error: creativeErr } = await supabase
      .from("ad_creative_content")
      .select("ad_id, ad_name, ugc_creator_handle")
      .eq("organization_id", organizationId)
      .not("ugc_creator_handle", "is", null);

    if (creativeErr) console.warn(`[UGC Scores] ad_creative_content query failed: ${creativeErr.message}`);

    // Merge: use ad_tags as primary source, fill gaps from ad_creative_content
    const adTagsMap = new Map<string, typeof adTags[0]>();
    for (const tag of adTags || []) {
      adTagsMap.set(tag.ad_id, tag);
    }

    // Add any UGC ads from ad_creative_content that are missing from ad_tags
    for (const cc of creativeHandles || []) {
      if (!adTagsMap.has(cc.ad_id)) {
        adTagsMap.set(cc.ad_id, {
          ad_id: cc.ad_id,
          ad_name: cc.ad_name,
          ugc_creator_handle: cc.ugc_creator_handle,
          product: null,
          sales_angle: null,
          creative_type: "ugc",
          funnel_stage: null,
        });
      }
    }

    const mergedAdTags = Array.from(adTagsMap.values());

    if (mergedAdTags.length === 0) {
      return new Response(
        JSON.stringify({ success: true, creatorsScored: 0, message: "No UGC ads found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[UGC Scores] Found ${mergedAdTags.length} UGC ads (${adTags?.length || 0} from ad_tags, ${creativeHandles?.length || 0} from ad_creative_content)`);

    // Group ads by handle
    const adsByHandle = new Map<string, typeof mergedAdTags>();
    for (const tag of mergedAdTags) {
      const handle = tag.ugc_creator_handle!;
      if (!adsByHandle.has(handle)) adsByHandle.set(handle, []);
      adsByHandle.get(handle)!.push(tag);
    }

    // ─── 2. Load ad_performance_daily for all UGC ad_ids ────────
    const allAdIds = mergedAdTags.map((t) => t.ad_id);
    const { data: perfData, error: perfErr } = await supabase
      .from("ad_performance_daily")
      .select("ad_id, date, spend, revenue, purchases, impressions, clicks, link_clicks, ctr, cpa, roas, hook_rate, hold_rate, lp_conv_rate, landing_page_views")
      .eq("organization_id", organizationId)
      .in("ad_id", allAdIds);

    if (perfErr) throw new Error(`ad_performance_daily query failed: ${perfErr.message}`);

    // Group perf by ad_id
    const perfByAd = new Map<string, typeof perfData>();
    for (const row of perfData || []) {
      if (!perfByAd.has(row.ad_id)) perfByAd.set(row.ad_id, []);
      perfByAd.get(row.ad_id)!.push(row);
    }

    // ─── 3. Load existing ugc_creators ──────────────────────────
    const { data: existingCreators, error: creatorsErr } = await supabase
      .from("ugc_creators")
      .select("id, instagram_handle, name, tiktok_handle")
      .eq("organization_id", organizationId);

    if (creatorsErr) throw new Error(`ugc_creators query failed: ${creatorsErr.message}`);

    // Map by handle (lowercase for matching)
    const creatorsMap = new Map<string, { id: string; name: string }>();
    for (const c of existingCreators || []) {
      if (c.instagram_handle) {
        creatorsMap.set(c.instagram_handle.toLowerCase(), { id: c.id, name: c.name });
      }
      if (c.tiktok_handle) {
        creatorsMap.set(c.tiktok_handle.toLowerCase(), { id: c.id, name: c.name });
      }
    }

    // ─── 4. Load campaign payments (for ROI score) ──────────────
    const { data: campaigns } = await supabase
      .from("ugc_campaigns")
      .select("creator_id, agreed_payment")
      .eq("organization_id", organizationId);

    const paymentsByCreator = new Map<string, number>();
    for (const c of campaigns || []) {
      const current = paymentsByCreator.get(c.creator_id) || 0;
      paymentsByCreator.set(c.creator_id, current + (c.agreed_payment || 0));
    }

    // ─── 5. Process each creator handle ─────────────────────────
    let creatorsScored = 0;
    let adsLinked = 0;
    let autoCreated = 0;
    const errors: string[] = [];

    for (const [handle, handleAds] of adsByHandle) {
      try {
        const strippedHandle = handle.replace(/^@/, "").toLowerCase();
        let creator = creatorsMap.get(strippedHandle);

        // Auto-create if not found
        if (!creator) {
          const displayName = strippedHandle.charAt(0).toUpperCase() + strippedHandle.slice(1);
          const { data: newCreator, error: createErr } = await supabase
            .from("ugc_creators")
            .insert({
              organization_id: organizationId,
              name: displayName,
              instagram_handle: strippedHandle,
              status: "activo",
              avatar_url: `https://unavatar.io/instagram/${strippedHandle}`,
              platform: "instagram",
            })
            .select("id, name")
            .single();

          if (createErr) {
            // Might already exist via tiktok_handle or race condition
            console.warn(`[UGC Scores] Failed to auto-create ${strippedHandle}: ${createErr.message}`);
            continue;
          }

          creator = { id: newCreator.id, name: newCreator.name };
          creatorsMap.set(strippedHandle, creator);
          autoCreated++;
          console.log(`[UGC Scores] Auto-created creator: ${strippedHandle}`);
        }

        // ─── Aggregate metrics across all this creator's ads ────
        let totalSpend = 0,
          totalRevenue = 0,
          totalPurchases = 0,
          totalImpressions = 0,
          totalClicks = 0,
          totalLinkClicks = 0,
          totalDaysData = 0;

        let sumCtr = 0,
          ctrCount = 0;
        let sumHookRate = 0,
          hookCount = 0;
        let sumHoldRate = 0,
          holdCount = 0;
        let sumLpConv = 0,
          lpConvCount = 0;
        let sumLandingViews = 0;

        let bestAdId: string | null = null,
          bestAdRoas = -1;
        let worstAdId: string | null = null,
          worstAdRoas = Infinity;

        const adRoasValues: number[] = [];
        const productRoas = new Map<string, { spend: number; revenue: number }>();
        const angleRoas = new Map<string, { spend: number; revenue: number }>();
        const distinctProducts = new Set<string>();

        // Per-ad processing
        const creatorAdUpserts: any[] = [];

        for (const adTag of handleAds) {
          const adPerf = perfByAd.get(adTag.ad_id) || [];
          if (adPerf.length === 0) continue;

          // Aggregate this ad's daily data
          let adSpend = 0,
            adRevenue = 0,
            adPurchases = 0;
          let adSumCtr = 0,
            adCtrN = 0;
          let adSumHook = 0,
            adHookN = 0;
          let adSumHold = 0,
            adHoldN = 0;
          let adSumLpConv = 0,
            adLpConvN = 0;

          const dates = adPerf.map((r) => r.date).sort();
          const firstSeen = dates[0];
          const lastSeen = dates[dates.length - 1];
          const daysActive = dates.length;

          for (const row of adPerf) {
            adSpend += Number(row.spend) || 0;
            adRevenue += Number(row.revenue) || 0;
            adPurchases += Number(row.purchases) || 0;
            if (row.ctr != null) { adSumCtr += Number(row.ctr); adCtrN++; }
            if (row.hook_rate != null) { adSumHook += Number(row.hook_rate); adHookN++; }
            if (row.hold_rate != null) { adSumHold += Number(row.hold_rate); adHoldN++; }
            if (row.lp_conv_rate != null) { adSumLpConv += Number(row.lp_conv_rate); adLpConvN++; }
          }

          const adRoas = adSpend > 0 ? adRevenue / adSpend : 0;
          const adCpa = adPurchases > 0 ? adSpend / adPurchases : 0;

          // Track best/worst
          if (adSpend > 10000 && adRoas > bestAdRoas) {
            bestAdRoas = adRoas;
            bestAdId = adTag.ad_id;
          }
          if (adSpend > 10000 && adRoas < worstAdRoas) {
            worstAdRoas = adRoas;
            worstAdId = adTag.ad_id;
          }
          if (adSpend > 10000) adRoasValues.push(adRoas);

          // Track products/angles
          if (adTag.product) {
            distinctProducts.add(adTag.product);
            const curr = productRoas.get(adTag.product) || { spend: 0, revenue: 0 };
            productRoas.set(adTag.product, {
              spend: curr.spend + adSpend,
              revenue: curr.revenue + adRevenue,
            });
          }
          if (adTag.sales_angle) {
            const curr = angleRoas.get(adTag.sales_angle) || { spend: 0, revenue: 0 };
            angleRoas.set(adTag.sales_angle, {
              spend: curr.spend + adSpend,
              revenue: curr.revenue + adRevenue,
            });
          }

          // Accumulate creator totals
          totalSpend += adSpend;
          totalRevenue += adRevenue;
          totalPurchases += adPurchases;
          totalDaysData += daysActive;
          if (adCtrN > 0) { sumCtr += adSumCtr; ctrCount += adCtrN; }
          if (adHookN > 0) { sumHookRate += adSumHook; hookCount += adHookN; }
          if (adHoldN > 0) { sumHoldRate += adSumHold; holdCount += adHoldN; }
          if (adLpConvN > 0) { sumLpConv += adSumLpConv; lpConvCount += adLpConvN; }

          // Determine ad lifecycle status
          const daysSinceLastSeen = Math.floor(
            (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24)
          );
          let adStatus = "active";
          if (daysSinceLastSeen > 3) adStatus = "inactive";
          else if (adRoas < 1.0 && daysActive > 7) adStatus = "fatigued";

          creatorAdUpserts.push({
            organization_id: organizationId,
            creator_id: creator.id,
            ad_id: adTag.ad_id,
            ad_name: adTag.ad_name,
            total_spend: Math.round(adSpend * 100) / 100,
            total_revenue: Math.round(adRevenue * 100) / 100,
            total_purchases: adPurchases,
            roas: Math.round(adRoas * 10000) / 10000,
            cpa: Math.round(adCpa * 100) / 100,
            avg_ctr: adCtrN > 0 ? Math.round((adSumCtr / adCtrN) * 10000) / 10000 : null,
            avg_hook_rate: adHookN > 0 ? Math.round((adSumHook / adHookN) * 100) / 100 : null,
            avg_hold_rate: adHoldN > 0 ? Math.round((adSumHold / adHoldN) * 100) / 100 : null,
            avg_lp_conv_rate: adLpConvN > 0 ? Math.round((adSumLpConv / adLpConvN) * 10000) / 10000 : null,
            product: adTag.product,
            sales_angle: adTag.sales_angle,
            creative_type: adTag.creative_type,
            first_seen: firstSeen,
            last_seen: lastSeen,
            days_active: daysActive,
            current_status: adStatus,
            computed_at: new Date().toISOString(),
          });
          adsLinked++;
        }

        // ─── Upsert ugc_creator_ads (batch) ──────────────────────
        if (creatorAdUpserts.length > 0) {
          const { error: adUpsertErr } = await supabase
            .from("ugc_creator_ads")
            .upsert(creatorAdUpserts, {
              onConflict: "organization_id,creator_id,ad_id",
            });
          if (adUpsertErr) {
            console.warn(`[UGC Scores] ugc_creator_ads upsert error for ${strippedHandle}: ${adUpsertErr.message}`);
          }
        }

        // ─── Compute creator-level averages ──────────────────────
        const totalAds = handleAds.length;
        const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
        const avgCtr = ctrCount > 0 ? sumCtr / ctrCount : null;
        const avgCpa = totalPurchases > 0 ? totalSpend / totalPurchases : null;
        const avgHookRate = hookCount > 0 ? sumHookRate / hookCount : null;
        const avgHoldRate = holdCount > 0 ? sumHoldRate / holdCount : null;
        const avgLpConvRate = lpConvCount > 0 ? sumLpConv / lpConvCount : null;

        // Fix worst when no qualifying ads
        if (worstAdRoas === Infinity) worstAdRoas = 0;

        // ─── Compute scores ──────────────────────────────────────
        const roasScore = computeRoasScore(avgRoas);
        const engagementScore = computeEngagementScore(avgCtr, avgHookRate);
        const conversionScore = computeConversionScore(avgLpConvRate, avgHoldRate);
        const consistencyScore = computeConsistencyScore(
          bestAdRoas > 0 ? bestAdRoas : null,
          worstAdRoas > 0 ? worstAdRoas : null,
          avgRoas
        );
        const totalPaid = paymentsByCreator.get(creator.id) || 0;
        const roiScore = computeRoiScore(totalRevenue, totalPaid);

        const { overallScore, tier } = computeOverallAndTier({
          roasScore,
          engagementScore,
          conversionScore,
          consistencyScore,
          totalAds,
          totalDays: totalDaysData,
          lifetimeSpend: totalSpend,
        });

        // ─── Best product / best angle ───────────────────────────
        let bestProduct: string | null = null,
          bestProductRoas = 0;
        for (const [product, data] of productRoas) {
          const roas = data.spend > 0 ? data.revenue / data.spend : 0;
          if (roas > bestProductRoas && data.spend > 10000) {
            bestProductRoas = roas;
            bestProduct = product;
          }
        }

        let bestAngle: string | null = null,
          bestAngleRoas = 0;
        for (const [angle, data] of angleRoas) {
          const roas = data.spend > 0 ? data.revenue / data.spend : 0;
          if (roas > bestAngleRoas && data.spend > 10000) {
            bestAngleRoas = roas;
            bestAngle = angle;
          }
        }

        // ─── Recommendation ──────────────────────────────────────
        const recommendation = computeRecommendation(
          tier,
          totalAds,
          distinctProducts.size,
          avgHookRate,
          avgLpConvRate
        );

        // ─── Update ugc_creators ─────────────────────────────────
        const { error: updateErr } = await supabase
          .from("ugc_creators")
          .update({
            overall_score: overallScore,
            roas_score: roasScore,
            engagement_score: engagementScore,
            conversion_score: conversionScore,
            consistency_score: consistencyScore,
            roi_score: roiScore,
            tier,
            lifetime_spend: Math.round(totalSpend * 100) / 100,
            lifetime_revenue: Math.round(totalRevenue * 100) / 100,
            lifetime_roas: Math.round(avgRoas * 10000) / 10000,
            lifetime_purchases: totalPurchases,
            total_ads: totalAds,
            avg_ctr: avgCtr ? Math.round(avgCtr * 10000) / 10000 : null,
            avg_cpa: avgCpa ? Math.round(avgCpa * 100) / 100 : null,
            avg_hook_rate: avgHookRate ? Math.round(avgHookRate * 100) / 100 : null,
            avg_hold_rate: avgHoldRate ? Math.round(avgHoldRate * 100) / 100 : null,
            avg_lp_conv_rate: avgLpConvRate ? Math.round(avgLpConvRate * 10000) / 10000 : null,
            best_ad_id: bestAdId,
            best_ad_roas: bestAdRoas > 0 ? Math.round(bestAdRoas * 10000) / 10000 : null,
            worst_ad_id: worstAdId,
            worst_ad_roas: worstAdRoas > 0 ? Math.round(worstAdRoas * 10000) / 10000 : null,
            best_product: bestProduct,
            best_product_roas: bestProductRoas > 0 ? Math.round(bestProductRoas * 10000) / 10000 : null,
            best_angle: bestAngle,
            best_angle_roas: bestAngleRoas > 0 ? Math.round(bestAngleRoas * 10000) / 10000 : null,
            recommendation,
            scores_computed_at: new Date().toISOString(),
          })
          .eq("id", creator.id);

        if (updateErr) {
          errors.push(`Update ${strippedHandle}: ${updateErr.message}`);
        } else {
          creatorsScored++;
          console.log(
            `[UGC Scores] ${strippedHandle}: tier=${tier} score=${overallScore} roas=${avgRoas.toFixed(2)} ads=${totalAds}`
          );
        }
      } catch (err) {
        errors.push(`Handle ${handle}: ${(err as Error).message}`);
      }
    }

    console.log(
      `[UGC Scores] Done: ${creatorsScored} scored, ${adsLinked} ads linked, ${autoCreated} auto-created`
    );

    return new Response(
      JSON.stringify({
        success: true,
        creatorsScored,
        adsLinked,
        autoCreated,
        totalHandles: adsByHandle.size,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[UGC Scores] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
