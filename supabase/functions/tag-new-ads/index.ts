import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const MAX_ADS_PER_RUN = 20;
const AI_BATCH_SIZE = 10;

// ─── Creative Content Types ────────────────────────────────────

interface CreativeContent {
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  destinationUrl: string | null;
  callToAction: string | null;
  mediaType: string | null;
  videoId: string | null;
  thumbnailUrl: string | null;
}

// ─── Pre-Classification Rules ──────────────────────────────────

interface PreClassifyResult {
  creativeType: string | null;
  funnelStage: string | null;
  product: string | null;
  productName: string | null;
  landingPageType: string | null;
  offerType: string | null;
  offerValue: string | null;
  targetCountry: string | null;
  targetCities: string | null;
}

function parseDestinationUrl(url: string | null) {
  if (!url) return { type: null, productSlug: null, collectionSlug: null };
  try {
    const path = new URL(url).pathname;
    if (path.includes("/products/")) {
      const slug = path.split("/products/")[1]?.split(/[?#/]/)[0] || null;
      return { type: "product", productSlug: slug, collectionSlug: null };
    }
    if (path.includes("/collections/")) {
      const slug = path.split("/collections/")[1]?.split(/[?#/]/)[0] || null;
      return { type: "collection", productSlug: null, collectionSlug: slug };
    }
    if (path === "/" || path === "") {
      return { type: "home", productSlug: null, collectionSlug: null };
    }
    return { type: "page", productSlug: null, collectionSlug: null };
  } catch {
    return { type: null, productSlug: null, collectionSlug: null };
  }
}

function extractUGCHandle(adName: string | null): string | null {
  if (!adName) return null;
  const match = adName.match(/@([\w.]+)/);
  return match ? `@${match[1]}` : null;
}

function preClassify(
  content: CreativeContent,
  adName: string | null,
  campaignName: string | null
): PreClassifyResult {
  const nameLower = (adName || "").toLowerCase();
  const campaignLower = (campaignName || "").toLowerCase();
  const bodyLower = (content.primaryText || "").toLowerCase();

  // Creative type
  let creativeType: string | null = content.mediaType;
  if (nameLower.includes("ugc") || nameLower.includes("@")) creativeType = "ugc";
  else if (nameLower.includes("lifestyle")) creativeType = "lifestyle";
  else if (nameLower.includes("testimonio") || nameLower.includes("testimonial")) creativeType = "testimonial";
  else if (nameLower.includes("educativo") || nameLower.includes("educational")) creativeType = "educational";
  else if (nameLower.includes("unboxing")) creativeType = "unboxing";
  else if (nameLower.includes("static") || nameLower.includes("estático")) creativeType = "static";

  // Funnel stage
  let funnelStage: string | null = null;
  const tofuKw = ["tofu", "top", "awareness", "prospecting", "cold", "reach"];
  const mofuKw = ["mofu", "middle", "consideration", "engagement", "warm", "traffic"];
  const bofuKw = ["bofu", "bottom", "conversion", "retarget", "remarketing", "hot", "purchase", "dpa"];
  if (tofuKw.some((kw) => campaignLower.includes(kw))) funnelStage = "tofu";
  else if (mofuKw.some((kw) => campaignLower.includes(kw))) funnelStage = "mofu";
  else if (bofuKw.some((kw) => campaignLower.includes(kw))) funnelStage = "bofu";

  // Product
  const dest = parseDestinationUrl(content.destinationUrl);
  const product = dest.productSlug || dest.collectionSlug || null;
  const productName = product
    ? product.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  // Offer
  let offerType: string | null = null;
  let offerValue: string | null = null;
  const discountMatch = bodyLower.match(/(\d{1,3})%\s*(off|desc|dcto)/);
  if (discountMatch) { offerType = "discount"; offerValue = `${discountMatch[1]}%`; }
  else if (bodyLower.includes("envío gratis") || bodyLower.includes("free shipping")) { offerType = "free_shipping"; offerValue = "Envío gratis"; }
  else if (bodyLower.includes("2x1") || bodyLower.includes("bogo")) { offerType = "bogo"; offerValue = "2x1"; }
  else if (bodyLower.includes("bundle") || bodyLower.includes("combo") || bodyLower.includes("kit")) { offerType = "bundle"; offerValue = "Bundle/Kit"; }

  // Country from URL
  let targetCountry: string | null = null;
  if (content.destinationUrl) {
    if (content.destinationUrl.includes(".co/")) targetCountry = "CO";
    else if (content.destinationUrl.includes(".com/")) targetCountry = "US";
  }

  return {
    creativeType,
    funnelStage,
    product,
    productName,
    landingPageType: dest.type,
    offerType,
    offerValue,
    targetCountry,
    targetCities: null,
  };
}

// ─── AI Tagging with Claude ────────────────────────────────────

interface AITags {
  salesAngle: string | null;
  copyType: string | null;
  hookDescription: string | null;
}

async function aiTagBatch(
  ads: Array<{
    adId: string;
    adName: string | null;
    primaryText: string | null;
    headline: string | null;
    creativeType: string | null;
    product: string | null;
  }>,
  apiKey: string
): Promise<Map<string, AITags>> {
  const result = new Map<string, AITags>();

  const adDescriptions = ads
    .map(
      (a, i) =>
        `[Ad ${i + 1}] ad_id="${a.adId}"
  nombre: ${a.adName || "N/A"}
  tipo_creativo: ${a.creativeType || "N/A"}
  producto: ${a.product || "N/A"}
  texto_primario: ${(a.primaryText || "N/A").slice(0, 500)}
  headline: ${a.headline || "N/A"}`
    )
    .join("\n\n");

  const prompt = `Eres un analista de performance marketing. Clasifica cada ad con estos campos:

1. sales_angle: El ángulo de venta principal. Opciones: beneficio_producto, social_proof, urgencia, educativo, lifestyle, dolor_problema, comparación, autoridad, novedad, regalo, sostenibilidad, otro
2. copy_type: Estilo del copy. Opciones: storytelling, directo, pregunta, testimonio, lista_beneficios, estadística, emocional, humor, before_after, otro
3. hook_description: Descripción corta (max 15 palabras) del gancho principal del ad

Responde SOLO en JSON array, un objeto por ad:
[{"ad_id":"...","sales_angle":"...","copy_type":"...","hook_description":"..."}]

Ads a clasificar:
${adDescriptions}`;

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
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("Claude API error:", res.status, await res.text());
      return result;
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Could not parse AI response as JSON array");
      return result;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    for (const item of parsed) {
      result.set(item.ad_id, {
        salesAngle: item.sales_angle || null,
        copyType: item.copy_type || null,
        hookDescription: item.hook_description || null,
      });
    }
  } catch (err) {
    console.error("AI tagging error:", err);
  }

  return result;
}

// ─── Main Handler ──────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    console.log(`[tag-new-ads] Starting for org: ${organizationId}`);

    // ─── 1. Find ads in ad_creative_content that have NO entry in ad_tags ─

    // Get all ad_ids that already have tags
    const { data: taggedIds, error: taggedErr } = await supabase
      .from("ad_tags")
      .select("ad_id")
      .eq("organization_id", organizationId);

    if (taggedErr) throw new Error(`ad_tags query failed: ${taggedErr.message}`);

    const taggedSet = new Set((taggedIds || []).map((t) => t.ad_id));

    // Get all creative content
    const { data: allCreatives, error: creativesErr } = await supabase
      .from("ad_creative_content")
      .select("ad_id, ad_name, primary_text, headline, description, destination_url, call_to_action, media_type, video_id, thumbnail_url, ugc_creator_handle, campaign_name")
      .eq("organization_id", organizationId);

    if (creativesErr) throw new Error(`ad_creative_content query failed: ${creativesErr.message}`);

    // Filter to only untagged ads
    const untaggedAds = (allCreatives || []).filter((c) => !taggedSet.has(c.ad_id));
    const batch = untaggedAds.slice(0, MAX_ADS_PER_RUN);
    const remaining = untaggedAds.length - batch.length;

    console.log(`[tag-new-ads] Found ${untaggedAds.length} untagged ads, processing ${batch.length}`);

    if (batch.length === 0) {
      return new Response(
        JSON.stringify({ success: true, tagged: 0, remaining: 0, message: "All ads already tagged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 2. Pre-classify with rules ────────────────────────────────

    const tagRecords: Array<{
      adId: string;
      adName: string | null;
      rules: PreClassifyResult;
      ugcHandle: string | null;
      content: CreativeContent;
      campaignName: string | null;
    }> = [];

    for (const ad of batch) {
      const content: CreativeContent = {
        primaryText: ad.primary_text,
        headline: ad.headline,
        description: ad.description,
        destinationUrl: ad.destination_url,
        callToAction: ad.call_to_action,
        mediaType: ad.media_type,
        videoId: ad.video_id,
        thumbnailUrl: ad.thumbnail_url,
      };

      const rules = preClassify(content, ad.ad_name, ad.campaign_name || null);
      const ugcHandle = extractUGCHandle(ad.ad_name);

      tagRecords.push({
        adId: ad.ad_id,
        adName: ad.ad_name,
        rules,
        ugcHandle,
        content,
        campaignName: ad.campaign_name || null,
      });
    }

    // ─── 3. AI tagging ─────────────────────────────────────────────

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
    const aiAvailable = anthropicKey.length > 0;
    let aiTagged = 0;

    const aiTagsMap = new Map<string, AITags>();

    if (aiAvailable) {
      for (let i = 0; i < tagRecords.length; i += AI_BATCH_SIZE) {
        const aiBatch = tagRecords.slice(i, i + AI_BATCH_SIZE).map((t) => ({
          adId: t.adId,
          adName: t.adName,
          primaryText: t.content.primaryText,
          headline: t.content.headline,
          creativeType: t.rules.creativeType,
          product: t.rules.product,
        }));

        const batchResult = await aiTagBatch(aiBatch, anthropicKey);
        for (const [k, v] of batchResult) {
          aiTagsMap.set(k, v);
          aiTagged++;
        }

        if (i + AI_BATCH_SIZE < tagRecords.length) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } else {
      console.log("[tag-new-ads] ANTHROPIC_API_KEY not set — AI tagging skipped");
    }

    // ─── 4. Upsert to ad_tags ──────────────────────────────────────

    let tagged = 0;
    const errors: string[] = [];

    for (const tag of tagRecords) {
      try {
        const aiTags = aiTagsMap.get(tag.adId);

        const { error: upsertError } = await supabase
          .from("ad_tags")
          .upsert(
            {
              organization_id: organizationId,
              ad_id: tag.adId,
              ad_name: tag.adName,
              creative_type: tag.rules.creativeType,
              sales_angle: aiTags?.salesAngle || null,
              copy_type: aiTags?.copyType || null,
              hook_description: aiTags?.hookDescription || null,
              product: tag.rules.product,
              product_name: tag.rules.productName,
              landing_page_type: tag.rules.landingPageType,
              offer_type: tag.rules.offerType,
              offer_value: tag.rules.offerValue,
              funnel_stage: tag.rules.funnelStage,
              target_country: tag.rules.targetCountry,
              target_cities: tag.rules.targetCities,
              ugc_creator_handle: tag.ugcHandle,
              confidence: aiTags ? "alto" : "medio",
              tagged_by: aiTags ? "ai_auto" : "rules_only",
              ai_model: aiTags ? "claude-sonnet-4" : null,
              human_reviewed: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,ad_id" }
          );

        if (upsertError) {
          errors.push(`${tag.adName}: ${upsertError.message}`);
        } else {
          tagged++;
        }
      } catch (err) {
        errors.push(`${tag.adName}: ${err instanceof Error ? err.message : "Error"}`);
      }
    }

    console.log(`[tag-new-ads] Done: ${tagged} tagged, ${aiTagged} AI, ${remaining} remaining`);

    return new Response(
      JSON.stringify({
        success: true,
        tagged,
        aiTagged,
        remaining,
        aiAvailable,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[tag-new-ads] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
