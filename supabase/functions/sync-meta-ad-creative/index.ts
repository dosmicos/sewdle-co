import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

const AD_CREATIVE_FIELDS = [
  "name",
  "status",
  "effective_status",
  "adset_id",
  "campaign_id",
  "creative{body,title,link_url,thumbnail_url,video_id,call_to_action_type,object_story_spec,asset_feed_spec}",
].join(",");

const ADSET_FIELDS = [
  "name",
  "targeting",
  "optimization_goal",
  "billing_event",
  "daily_budget",
  "lifetime_budget",
  "bid_strategy",
  "promoted_object",
  "campaign_id",
].join(",");

// ─── Helpers ────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res;

    const body = await res.json().catch(() => null);
    const errorCode = body?.error?.code;

    if ((errorCode === 32 || errorCode === 17) && attempt < maxRetries) {
      const delay = Math.pow(2, attempt + 1) * 1000;
      console.log(
        `Rate limited (code ${errorCode}), retrying in ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    return new Response(JSON.stringify(body), {
      status: res.status,
      headers: res.headers,
    });
  }
  throw new Error("Max retries exceeded");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Creative Parsing ───────────────────────────────────────────

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

function parseCreative(ad: any): CreativeContent {
  const creative = ad.creative || {};
  const oss = creative.object_story_spec || {};
  const afs = creative.asset_feed_spec || {};

  let primaryText = creative.body || null;
  let headline = creative.title || null;
  let destinationUrl = creative.link_url || null;
  let callToAction = creative.call_to_action_type || null;
  let mediaType: string | null = null;
  let videoId = creative.video_id || null;
  let thumbnailUrl = creative.thumbnail_url || null;
  let description: string | null = null;

  // Parse object_story_spec (single creative)
  if (oss.video_data) {
    mediaType = "video";
    primaryText = primaryText || oss.video_data.message || null;
    headline = headline || oss.video_data.title || null;
    description = oss.video_data.link_description || null;
    videoId = videoId || oss.video_data.video_id || null;
    thumbnailUrl = thumbnailUrl || oss.video_data.image_url || null;
    callToAction =
      callToAction || oss.video_data.call_to_action?.type || null;
    destinationUrl =
      destinationUrl ||
      oss.video_data.call_to_action?.value?.link || null;
  } else if (oss.link_data) {
    mediaType = oss.link_data.child_attachments ? "carousel" : "image";
    primaryText = primaryText || oss.link_data.message || null;
    headline = headline || oss.link_data.name || null;
    description = oss.link_data.description || null;
    destinationUrl = destinationUrl || oss.link_data.link || null;
    callToAction =
      callToAction || oss.link_data.call_to_action?.type || null;
    thumbnailUrl = thumbnailUrl || oss.link_data.picture || null;
  } else if (oss.photo_data) {
    mediaType = "image";
    primaryText = primaryText || oss.photo_data.caption || null;
    thumbnailUrl = thumbnailUrl || oss.photo_data.url || null;
  } else if (oss.template_data) {
    mediaType = "carousel";
  }

  // Parse asset_feed_spec (dynamic creative) — take first element
  if (!primaryText && afs.bodies?.length > 0) {
    primaryText = afs.bodies[0].text || null;
  }
  if (!headline && afs.titles?.length > 0) {
    headline = afs.titles[0].text || null;
  }
  if (!description && afs.descriptions?.length > 0) {
    description = afs.descriptions[0].text || null;
  }
  if (!destinationUrl && afs.link_urls?.length > 0) {
    destinationUrl = afs.link_urls[0].website_url || null;
  }
  if (!mediaType && afs.videos?.length > 0) {
    mediaType = "video";
    videoId = videoId || afs.videos[0].video_id || null;
  } else if (!mediaType && afs.images?.length > 0) {
    mediaType = "image";
  }

  return {
    primaryText,
    headline,
    description,
    destinationUrl,
    callToAction,
    mediaType,
    videoId,
    thumbnailUrl,
  };
}

function extractUGCHandle(adName: string | null): string | null {
  if (!adName) return null;
  const match = adName.match(/@([\w.]+)/);
  return match ? `@${match[1]}` : null;
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
      const slug =
        path.split("/collections/")[1]?.split(/[?#/]/)[0] || null;
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

// ─── Audience Detection ─────────────────────────────────────────

interface AudienceData {
  audienceType: string;
  audienceTypeDetail: string;
  ageMin: number | null;
  ageMax: number | null;
  ageRange: string | null;
  gender: string;
  countries: any;
  cities: any;
  regions: any;
  locationSummary: string;
  interests: any;
  behaviors: any;
  interestsSummary: string;
  customAudiencesIncluded: any;
  customAudiencesExcluded: any;
  audiencesSummary: string;
  isAdvantagePlus: boolean;
  platforms: any;
  positions: any;
  placementsSummary: string;
  rawTargeting: any;
}

function detectAudienceType(
  targeting: any,
  customAudiences: any[] | null
): { type: string; detail: string } {
  if (!targeting) return { type: "broad", detail: "Sin targeting definido" };

  // Advantage+ detection
  if (
    targeting.targeting_automation?.advantage_audience === 1 ||
    targeting.targeting_optimization === "expansion_all"
  ) {
    return { type: "advantage_plus", detail: "Advantage+ Audience" };
  }

  // Custom audiences analysis
  if (customAudiences && customAudiences.length > 0) {
    const names = customAudiences.map((a: any) =>
      (a.name || "").toLowerCase()
    );

    // Lookalike detection
    const lal = names.find(
      (n: string) => n.includes("lookalike") || n.includes("lal")
    );
    if (lal) {
      return { type: "lookalike", detail: `Lookalike: ${lal}` };
    }

    // Retargeting detection
    const retarget = names.find(
      (n: string) =>
        n.includes("retarget") ||
        n.includes("remarketing") ||
        n.includes("website visitor") ||
        n.includes("visitantes") ||
        n.includes("engaged") ||
        n.includes("ig_engagers") ||
        n.includes("fb_engagers") ||
        n.includes("video_viewers") ||
        n.includes("view content")
    );
    if (retarget) {
      return { type: "retargeting", detail: `Retargeting: ${retarget}` };
    }

    // Purchaser/customer audiences
    const purchasers = names.find(
      (n: string) =>
        n.includes("comprador") ||
        n.includes("purchaser") ||
        n.includes("customer") ||
        n.includes("buyer") ||
        n.includes("clientes")
    );
    if (purchasers) {
      return {
        type: "custom_compradores",
        detail: `Compradores: ${purchasers}`,
      };
    }

    return {
      type: "custom_other",
      detail: `Custom: ${names.slice(0, 3).join(", ")}`,
    };
  }

  // Interest-based
  if (
    targeting.flexible_spec?.length > 0 ||
    targeting.interests?.length > 0
  ) {
    const interestNames: string[] = [];
    for (const spec of targeting.flexible_spec || []) {
      for (const interest of spec.interests || []) {
        interestNames.push(interest.name || interest.id);
      }
      for (const behavior of spec.behaviors || []) {
        interestNames.push(behavior.name || behavior.id);
      }
    }
    for (const interest of targeting.interests || []) {
      interestNames.push(interest.name || interest.id);
    }
    return {
      type: "interest",
      detail: interestNames.slice(0, 5).join(", ") || "Interests",
    };
  }

  return { type: "broad", detail: "Sin restricciones de audiencia" };
}

function parseGender(genderArray: number[] | undefined): string {
  if (!genderArray || genderArray.length === 0) return "all";
  if (genderArray.length === 2) return "all";
  if (genderArray.includes(1)) return "male";
  if (genderArray.includes(2)) return "female";
  return "all";
}

function buildLocationSummary(targeting: any): string {
  const parts: string[] = [];
  const geo = targeting?.geo_locations || {};
  if (geo.countries?.length) parts.push(geo.countries.join(", "));
  if (geo.cities?.length)
    parts.push(geo.cities.map((c: any) => c.name).join(", "));
  if (geo.regions?.length)
    parts.push(geo.regions.map((r: any) => r.name).join(", "));
  return parts.join(" | ") || "Global";
}

function buildInterestsSummary(targeting: any): string {
  const names: string[] = [];
  for (const spec of targeting?.flexible_spec || []) {
    for (const interest of spec.interests || []) {
      names.push(interest.name);
    }
    for (const behavior of spec.behaviors || []) {
      names.push(behavior.name);
    }
  }
  return names.slice(0, 10).join(", ") || "";
}

function buildAudiencesSummary(
  included: any[] | null,
  excluded: any[] | null
): string {
  const parts: string[] = [];
  if (included?.length) {
    parts.push(
      `Incluye: ${included.map((a: any) => a.name || a.id).join(", ")}`
    );
  }
  if (excluded?.length) {
    parts.push(
      `Excluye: ${excluded.map((a: any) => a.name || a.id).join(", ")}`
    );
  }
  return parts.join(" | ");
}

function buildPlacementsSummary(targeting: any): string {
  const parts: string[] = [];
  const pubs = targeting?.publisher_platforms;
  const positions = targeting?.facebook_positions ||
    targeting?.instagram_positions || [];
  if (pubs?.length) parts.push(pubs.join(", "));
  if (positions.length) parts.push(positions.join(", "));
  return parts.join(" — ") || "Automatic";
}

// ─── Pre-Classification Rules ───────────────────────────────────

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

function preClassify(
  content: CreativeContent,
  adName: string | null,
  campaignName: string | null,
  audience: AudienceData | null
): PreClassifyResult {
  const nameLower = (adName || "").toLowerCase();
  const campaignLower = (campaignName || "").toLowerCase();
  const bodyLower = (content.primaryText || "").toLowerCase();
  const allText = `${nameLower} ${campaignLower} ${bodyLower}`;

  // Creative type from media + name keywords
  let creativeType: string | null = content.mediaType;
  if (nameLower.includes("ugc") || nameLower.includes("@"))
    creativeType = "ugc";
  else if (nameLower.includes("lifestyle")) creativeType = "lifestyle";
  else if (
    nameLower.includes("testimonio") ||
    nameLower.includes("testimonial")
  )
    creativeType = "testimonial";
  else if (
    nameLower.includes("educativo") ||
    nameLower.includes("educational")
  )
    creativeType = "educational";
  else if (nameLower.includes("unboxing")) creativeType = "unboxing";
  else if (nameLower.includes("static") || nameLower.includes("estático"))
    creativeType = "static";

  // Funnel stage from campaign name
  let funnelStage: string | null = null;
  const tofuKw = ["tofu", "top", "awareness", "prospecting", "cold", "reach"];
  const mofuKw = [
    "mofu",
    "middle",
    "consideration",
    "engagement",
    "warm",
    "traffic",
  ];
  const bofuKw = [
    "bofu",
    "bottom",
    "conversion",
    "retarget",
    "remarketing",
    "hot",
    "purchase",
    "dpa",
  ];

  if (tofuKw.some((kw) => campaignLower.includes(kw))) funnelStage = "tofu";
  else if (mofuKw.some((kw) => campaignLower.includes(kw)))
    funnelStage = "mofu";
  else if (bofuKw.some((kw) => campaignLower.includes(kw)))
    funnelStage = "bofu";

  // Product from destination URL
  const dest = parseDestinationUrl(content.destinationUrl);
  const product = dest.productSlug || dest.collectionSlug || null;
  const productName = product
    ? product.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
  const landingPageType = dest.type;

  // Offer detection from body
  let offerType: string | null = null;
  let offerValue: string | null = null;

  const discountMatch = bodyLower.match(/(\d{1,3})%\s*(off|desc|dcto)/);
  if (discountMatch) {
    offerType = "discount";
    offerValue = `${discountMatch[1]}%`;
  } else if (
    bodyLower.includes("envío gratis") ||
    bodyLower.includes("free shipping")
  ) {
    offerType = "free_shipping";
    offerValue = "Envío gratis";
  } else if (bodyLower.includes("2x1") || bodyLower.includes("bogo")) {
    offerType = "bogo";
    offerValue = "2x1";
  } else if (
    bodyLower.includes("bundle") ||
    bodyLower.includes("combo") ||
    bodyLower.includes("kit")
  ) {
    offerType = "bundle";
    offerValue = "Bundle/Kit";
  }

  // Target country from audience
  let targetCountry: string | null = null;
  let targetCities: string | null = null;
  if (audience) {
    const countries = audience.countries?.countries || audience.countries || [];
    if (Array.isArray(countries) && countries.length > 0) {
      targetCountry = countries.join(", ");
    }
    const cities = audience.cities || [];
    if (Array.isArray(cities) && cities.length > 0) {
      targetCities = cities.map((c: any) => c.name || c).join(", ");
    }
  }
  // Fallback: detect from URL
  if (!targetCountry && content.destinationUrl) {
    if (content.destinationUrl.includes(".co/")) targetCountry = "CO";
    else if (content.destinationUrl.includes(".com/")) targetCountry = "US";
  }

  return {
    creativeType,
    funnelStage,
    product,
    productName,
    landingPageType,
    offerType,
    offerValue,
    targetCountry,
    targetCities,
  };
}

// ─── AI Tagging with Claude ─────────────────────────────────────

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
    const text =
      data.content?.[0]?.text || "";

    // Extract JSON array from response
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

    // Get active Meta ad account
    const { data: adAccount, error: accountError } = await supabase
      .from("ad_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("platform", "meta")
      .eq("is_active", true)
      .single();

    if (accountError || !adAccount) {
      return new Response(
        JSON.stringify({
          error: "No hay cuenta de Meta Ads conectada",
          needsReconnect: true,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (
      adAccount.token_expires_at &&
      new Date(adAccount.token_expires_at) < new Date()
    ) {
      await supabase
        .from("ad_accounts")
        .update({ is_active: false })
        .eq("id", adAccount.id);

      return new Response(
        JSON.stringify({
          error: "El token de Meta Ads ha expirado. Reconecta tu cuenta.",
          needsReconnect: true,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const accessToken = adAccount.access_token;
    const accountId = adAccount.account_id;

    const stats = {
      creativesSync: { synced: 0, total: 0, errors: [] as string[] },
      audienceSync: { synced: 0, total: 0, errors: [] as string[] },
      tagging: {
        ruleBased: 0,
        aiTagged: 0,
        aiSkipped: 0,
        errors: [] as string[],
      },
    };

    // ═══════════════════════════════════════════════════════════
    // STEP A: Fetch ads with creative content
    // ═══════════════════════════════════════════════════════════

    console.log(`[A] Fetching ads for account ${accountId}...`);

    const filtering = encodeURIComponent(
      JSON.stringify([
        {
          field: "effective_status",
          operator: "IN",
          value: ["ACTIVE"],
        },
      ])
    );

    const adsUrl =
      `${GRAPH_API}/act_${accountId}/ads` +
      `?fields=${AD_CREATIVE_FIELDS}` +
      `&filtering=${filtering}` +
      `&limit=500` +
      `&access_token=${accessToken}`;

    const adsRes = await fetchWithRetry(adsUrl);
    const adsData = await adsRes.json();

    if (adsData.error) {
      console.error("Meta API error (ads):", adsData.error);
      if (
        adsData.error.code === 190 ||
        adsData.error.type === "OAuthException"
      ) {
        await supabase
          .from("ad_accounts")
          .update({ is_active: false })
          .eq("id", adAccount.id);
        return new Response(
          JSON.stringify({
            error: "Token de Meta inválido. Reconecta tu cuenta.",
            needsReconnect: true,
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({
          error: "Error de la API de Meta (ads)",
          details: adsData.error.message,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Paginate all ads
    let allAds = [...(adsData.data || [])];
    let nextPage = adsData.paging?.next;
    while (nextPage) {
      const nextRes = await fetchWithRetry(nextPage);
      const nextData = await nextRes.json();
      if (nextData.data) allAds = [...allAds, ...nextData.data];
      nextPage = nextData.paging?.next;
    }

    console.log(`[A] Got ${allAds.length} active ads`);
    stats.creativesSync.total = allAds.length;

    // Parse and upsert creative content
    const adCreatives: Array<{
      adId: string;
      adName: string | null;
      adsetId: string | null;
      campaignId: string | null;
      content: CreativeContent;
      ugcHandle: string | null;
    }> = [];

    for (const ad of allAds) {
      try {
        const content = parseCreative(ad);
        const ugcHandle = extractUGCHandle(ad.name);
        const dest = parseDestinationUrl(content.destinationUrl);

        const { error: upsertError } = await supabase
          .from("ad_creative_content")
          .upsert(
            {
              organization_id: organizationId,
              ad_id: ad.id,
              ad_name: ad.name,
              primary_text: content.primaryText,
              headline: content.headline,
              description: content.description,
              destination_url: content.destinationUrl,
              call_to_action: content.callToAction,
              media_type: content.mediaType,
              video_id: content.videoId,
              thumbnail_url: content.thumbnailUrl,
              ugc_creator_handle: ugcHandle,
              destination_type: dest.type,
              destination_product_slug: dest.productSlug,
              destination_collection_slug: dest.collectionSlug,
              campaign_name: ad.campaign_name || null,
              adset_id: ad.adset_id || null,
              adset_name: null, // filled in step B
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,ad_id" }
          );

        if (upsertError) {
          stats.creativesSync.errors.push(
            `${ad.name}: ${upsertError.message}`
          );
        } else {
          stats.creativesSync.synced++;
          adCreatives.push({
            adId: ad.id,
            adName: ad.name,
            adsetId: ad.adset_id || null,
            campaignId: ad.campaign_id || null,
            content,
            ugcHandle,
          });
        }
      } catch (err) {
        stats.creativesSync.errors.push(
          `${ad.name}: ${err instanceof Error ? err.message : "Error"}`
        );
      }
    }

    console.log(
      `[A] Synced ${stats.creativesSync.synced}/${stats.creativesSync.total} creatives`
    );

    // ═══════════════════════════════════════════════════════════
    // STEP B: Fetch adset targeting data
    // ═══════════════════════════════════════════════════════════

    const uniqueAdsetIds = [
      ...new Set(adCreatives.map((a) => a.adsetId).filter(Boolean)),
    ] as string[];

    console.log(`[B] Fetching targeting for ${uniqueAdsetIds.length} adsets`);
    stats.audienceSync.total = uniqueAdsetIds.length;

    const audienceMap = new Map<string, AudienceData>();
    const BATCH_SIZE = 50;

    for (let i = 0; i < uniqueAdsetIds.length; i += BATCH_SIZE) {
      const batch = uniqueAdsetIds.slice(i, i + BATCH_SIZE);

      // Use batch endpoint for efficiency
      const ids = batch.join(",");
      const batchUrl =
        `${GRAPH_API}/?ids=${ids}` +
        `&fields=${ADSET_FIELDS}` +
        `&access_token=${accessToken}`;

      try {
        const batchRes = await fetchWithRetry(batchUrl);
        const batchData = await batchRes.json();

        for (const adsetId of batch) {
          const adset = batchData[adsetId];
          if (!adset || adset.error) {
            stats.audienceSync.errors.push(
              `Adset ${adsetId}: ${adset?.error?.message || "Not found"}`
            );
            continue;
          }

          const targeting = adset.targeting || {};
          const customAudiences = targeting.custom_audiences || null;
          const excludedAudiences =
            targeting.excluded_custom_audiences || null;

          const { type: audType, detail: audDetail } = detectAudienceType(
            targeting,
            customAudiences
          );

          const geo = targeting.geo_locations || {};
          const ageMin = targeting.age_min || null;
          const ageMax = targeting.age_max || null;
          const ageRange =
            ageMin && ageMax ? `${ageMin}-${ageMax}` : null;

          const audienceData: AudienceData = {
            audienceType: audType,
            audienceTypeDetail: audDetail,
            ageMin,
            ageMax,
            ageRange,
            gender: parseGender(targeting.genders),
            countries: geo.countries || null,
            cities: geo.cities || null,
            regions: geo.regions || null,
            locationSummary: buildLocationSummary(targeting),
            interests: targeting.flexible_spec || null,
            behaviors: null,
            interestsSummary: buildInterestsSummary(targeting),
            customAudiencesIncluded: customAudiences,
            customAudiencesExcluded: excludedAudiences,
            audiencesSummary: buildAudiencesSummary(
              customAudiences,
              excludedAudiences
            ),
            isAdvantagePlus:
              targeting.targeting_automation?.advantage_audience === 1 ||
              targeting.targeting_optimization === "expansion_all",
            platforms: targeting.publisher_platforms || null,
            positions:
              targeting.facebook_positions ||
              targeting.instagram_positions ||
              null,
            placementsSummary: buildPlacementsSummary(targeting),
            rawTargeting: targeting,
          };

          audienceMap.set(adsetId, audienceData);

          const { error: upsertError } = await supabase
            .from("adset_audience_data")
            .upsert(
              {
                organization_id: organizationId,
                adset_id: adsetId,
                adset_name: adset.name,
                campaign_id: adset.campaign_id || null,
                campaign_name: null,
                age_min: audienceData.ageMin,
                age_max: audienceData.ageMax,
                age_range: audienceData.ageRange,
                gender: audienceData.gender,
                countries: audienceData.countries,
                cities: audienceData.cities,
                regions: audienceData.regions,
                location_summary: audienceData.locationSummary,
                audience_type: audienceData.audienceType,
                audience_type_detail: audienceData.audienceTypeDetail,
                interests: audienceData.interests,
                behaviors: audienceData.behaviors,
                interests_summary: audienceData.interestsSummary,
                custom_audiences_included:
                  audienceData.customAudiencesIncluded,
                custom_audiences_excluded:
                  audienceData.customAudiencesExcluded,
                audiences_summary: audienceData.audiencesSummary,
                is_advantage_plus: audienceData.isAdvantagePlus,
                platforms: audienceData.platforms,
                positions: audienceData.positions,
                placements_summary: audienceData.placementsSummary,
                daily_budget: adset.daily_budget
                  ? parseFloat(adset.daily_budget) / 100
                  : null,
                lifetime_budget: adset.lifetime_budget
                  ? parseFloat(adset.lifetime_budget) / 100
                  : null,
                optimization_goal: adset.optimization_goal || null,
                bid_strategy: adset.bid_strategy || null,
                raw_targeting: audienceData.rawTargeting,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "organization_id,adset_id" }
            );

          if (upsertError) {
            stats.audienceSync.errors.push(
              `${adset.name}: ${upsertError.message}`
            );
          } else {
            stats.audienceSync.synced++;
          }
        }
      } catch (err) {
        stats.audienceSync.errors.push(
          `Batch error: ${err instanceof Error ? err.message : "Error"}`
        );
      }

      // Pause between batches to respect rate limits
      if (i + BATCH_SIZE < uniqueAdsetIds.length) {
        await sleep(1000);
      }
    }

    console.log(
      `[B] Synced ${stats.audienceSync.synced}/${stats.audienceSync.total} adsets`
    );

    // ═══════════════════════════════════════════════════════════
    // STEP C + D: Pre-classify with rules + AI tagging
    // ═══════════════════════════════════════════════════════════

    console.log(`[C] Pre-classifying ${adCreatives.length} ads with rules...`);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
    const aiAvailable = anthropicKey.length > 0;

    if (!aiAvailable) {
      console.log("[D] ANTHROPIC_API_KEY not set — AI tagging skipped");
    }

    // Build tags for all ads
    const tagRecords: Array<{
      adId: string;
      adName: string | null;
      rules: PreClassifyResult;
      audience: AudienceData | null;
      ugcHandle: string | null;
      content: CreativeContent;
    }> = [];

    for (const ad of adCreatives) {
      const audience = ad.adsetId
        ? audienceMap.get(ad.adsetId) || null
        : null;

      const rules = preClassify(
        ad.content,
        ad.adName,
        null, // campaign_name — not directly available on ad object
        audience
      );

      tagRecords.push({
        adId: ad.adId,
        adName: ad.adName,
        rules,
        audience,
        ugcHandle: ad.ugcHandle,
        content: ad.content,
      });
    }

    // AI tagging in batches of 10
    const aiTagsMap = new Map<string, AITags>();

    if (aiAvailable) {
      console.log(
        `[D] AI tagging ${tagRecords.length} ads in batches of 10...`
      );
      const AI_BATCH = 10;

      for (let i = 0; i < tagRecords.length; i += AI_BATCH) {
        const batch = tagRecords.slice(i, i + AI_BATCH);
        const batchInput = batch.map((t) => ({
          adId: t.adId,
          adName: t.adName,
          primaryText: t.content.primaryText,
          headline: t.content.headline,
          creativeType: t.rules.creativeType,
          product: t.rules.product,
        }));

        try {
          const batchResults = await aiTagBatch(batchInput, anthropicKey);
          for (const [adId, tags] of batchResults) {
            aiTagsMap.set(adId, tags);
            stats.tagging.aiTagged++;
          }
        } catch (err) {
          console.error(`AI batch error:`, err);
          stats.tagging.errors.push(
            `AI batch ${Math.floor(i / AI_BATCH)}: ${
              err instanceof Error ? err.message : "Error"
            }`
          );
          stats.tagging.aiSkipped += batch.length;
        }

        // Small pause between AI batches
        if (i + AI_BATCH < tagRecords.length) {
          await sleep(500);
        }
      }
    } else {
      stats.tagging.aiSkipped = tagRecords.length;
    }

    // Upsert all tags
    for (const tag of tagRecords) {
      const aiTags = aiTagsMap.get(tag.adId);

      try {
        const { error: upsertError } = await supabase
          .from("ad_tags")
          .upsert(
            {
              organization_id: organizationId,
              ad_id: tag.adId,
              ad_name: tag.adName,
              // Creative tags (rules + AI)
              creative_type: tag.rules.creativeType,
              sales_angle: aiTags?.salesAngle || null,
              copy_type: aiTags?.copyType || null,
              hook_description: aiTags?.hookDescription || null,
              // Product tags (rules only)
              product: tag.rules.product,
              product_name: tag.rules.productName,
              landing_page_type: tag.rules.landingPageType,
              // Offer tags (rules only)
              offer_type: tag.rules.offerType,
              offer_value: tag.rules.offerValue,
              // Funnel (rules only)
              funnel_stage: tag.rules.funnelStage,
              // Audience tags (from adset data, never AI)
              audience_type: tag.audience?.audienceType || null,
              audience_type_detail: tag.audience?.audienceTypeDetail || null,
              audience_gender: tag.audience?.gender || null,
              audience_age_range: tag.audience?.ageRange || null,
              audience_location: tag.audience?.locationSummary || null,
              audience_interests: tag.audience?.interestsSummary || null,
              audience_custom_audiences:
                tag.audience?.audiencesSummary || null,
              audience_exclusions: tag.audience?.customAudiencesExcluded
                ? "Yes"
                : null,
              is_advantage_plus: tag.audience?.isAdvantagePlus || false,
              audience_platforms: tag.audience?.placementsSummary || null,
              audience_placements: tag.audience?.placementsSummary || null,
              // Country
              target_country: tag.rules.targetCountry,
              target_cities: tag.rules.targetCities,
              // UGC
              ugc_creator_handle: tag.ugcHandle,
              // Metadata
              confidence: aiTags ? "alto" : "medio",
              tagged_by: aiTags ? "ai_auto" : "rules_only",
              ai_model: aiTags ? "claude-sonnet-4" : null,
              human_reviewed: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,ad_id" }
          );

        if (upsertError) {
          stats.tagging.errors.push(
            `${tag.adName}: ${upsertError.message}`
          );
        } else {
          stats.tagging.ruleBased++;
        }
      } catch (err) {
        stats.tagging.errors.push(
          `${tag.adName}: ${err instanceof Error ? err.message : "Error"}`
        );
      }
    }

    console.log(
      `[C+D] Tagged ${stats.tagging.ruleBased} ads (${stats.tagging.aiTagged} AI, ${stats.tagging.aiSkipped} AI skipped)`
    );

    // Update account last sync
    await supabase
      .from("ad_accounts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", adAccount.id);

    return new Response(
      JSON.stringify({
        success: true,
        creativesSync: {
          synced: stats.creativesSync.synced,
          total: stats.creativesSync.total,
          errors:
            stats.creativesSync.errors.length > 0
              ? stats.creativesSync.errors
              : undefined,
        },
        audienceSync: {
          synced: stats.audienceSync.synced,
          total: stats.audienceSync.total,
          errors:
            stats.audienceSync.errors.length > 0
              ? stats.audienceSync.errors
              : undefined,
        },
        tagging: {
          ruleBased: stats.tagging.ruleBased,
          aiTagged: stats.tagging.aiTagged,
          aiSkipped: stats.tagging.aiSkipped,
          aiAvailable,
          errors:
            stats.tagging.errors.length > 0
              ? stats.tagging.errors
              : undefined,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-meta-ad-creative error:", error);
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
