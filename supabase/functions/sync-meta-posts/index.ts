import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

// Performance Score weights (Prophit System: saves > shares > comments > engagement > reach)
const WEIGHTS = {
  saves: 0.3,
  shares: 0.25,
  comments: 0.2,
  engagement_rate: 0.15,
  reach: 0.1,
};

function computePerformanceScore(post: {
  saves: number;
  shares: number;
  comments: number;
  engagement_rate: number;
  reach: number;
}): number {
  // Normalize each metric relative to itself (0-100 scale applied later during batch)
  // For now, use raw weighted sum — normalized at query time
  return (
    post.saves * WEIGHTS.saves +
    post.shares * WEIGHTS.shares +
    post.comments * WEIGHTS.comments +
    post.engagement_rate * 100 * WEIGHTS.engagement_rate +
    Math.log10(Math.max(post.reach, 1)) * WEIGHTS.reach
  );
}

function computeEngagementRate(post: {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
}): number {
  if (post.reach === 0) return 0;
  return (post.likes + post.comments + post.shares + post.saves) / post.reach;
}

function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? matches.map((h) => h.toLowerCase()) : [];
}

function mapMediaType(type: string): string {
  const mapping: Record<string, string> = {
    IMAGE: "image",
    VIDEO: "video",
    CAROUSEL_ALBUM: "carousel",
    REEL: "reel",
    STORY: "story",
  };
  return mapping[type] || "image";
}

function mapFbPostType(attachments: any): string {
  if (!attachments?.data?.[0]) return "text";
  const type = attachments.data[0].type;
  if (type === "photo" || type === "cover_photo") return "image";
  if (type === "video_inline" || type === "video") return "video";
  if (type === "album") return "carousel";
  if (type === "share") return "text";
  return "text";
}

async function fetchInstagramPosts(
  accessToken: string,
  igUserId: string,
  since?: string
): Promise<any[]> {
  const allPosts: any[] = [];
  const fields =
    "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count";

  let url = `${GRAPH_API}/${igUserId}/media?fields=${fields}&limit=50&access_token=${accessToken}`;
  if (since) {
    url += `&since=${since}`;
  }

  let pages = 0;
  const maxPages = 10;

  while (url && pages < maxPages) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      console.error("IG media fetch error:", err);
      break;
    }
    const json = await res.json();
    if (json.data) allPosts.push(...json.data);
    url = json.paging?.next || null;
    pages++;
  }

  // Fetch insights for each post — metrics differ by media type:
  // Reels: reach,saved,shares,plays (no impressions)
  // Other (IMAGE, VIDEO, CAROUSEL_ALBUM): reach,impressions,saved (no shares)
  const postsWithInsights = [];
  for (const post of allPosts) {
    try {
      const isReel = post.media_type === "VIDEO" || post.media_type === "REEL";
      const metrics = isReel
        ? "reach,saved,shares,plays"
        : "reach,impressions,saved";
      const insightsUrl = `${GRAPH_API}/${post.id}/insights?metric=${metrics}&access_token=${accessToken}`;
      const insRes = await fetch(insightsUrl);
      let insights: Record<string, number> = {};
      if (insRes.ok) {
        const insJson = await insRes.json();
        for (const metric of insJson.data || []) {
          insights[metric.name] = metric.values?.[0]?.value ?? 0;
        }
      } else {
        // Fallback: try minimal metrics if the first request fails
        const fallbackUrl = `${GRAPH_API}/${post.id}/insights?metric=reach,saved&access_token=${accessToken}`;
        const fallbackRes = await fetch(fallbackUrl);
        if (fallbackRes.ok) {
          const fallbackJson = await fallbackRes.json();
          for (const metric of fallbackJson.data || []) {
            insights[metric.name] = metric.values?.[0]?.value ?? 0;
          }
        }
      }
      postsWithInsights.push({ ...post, insights });
    } catch (e) {
      console.error(`Error fetching insights for ${post.id}:`, e);
      postsWithInsights.push({ ...post, insights: {} });
    }
  }

  return postsWithInsights;
}

async function fetchFacebookPosts(
  accessToken: string,
  pageId: string,
  since?: string
): Promise<any[]> {
  const allPosts: any[] = [];
  const fields =
    "id,message,created_time,permalink_url,type,attachments,full_picture";

  let url = `${GRAPH_API}/${pageId}/feed?fields=${fields}&limit=50&access_token=${accessToken}`;
  if (since) {
    url += `&since=${since}`;
  }

  let pages = 0;
  const maxPages = 10;

  while (url && pages < maxPages) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      console.error("FB feed fetch error:", err);
      break;
    }
    const json = await res.json();
    if (json.data) allPosts.push(...json.data);
    url = json.paging?.next || null;
    pages++;
  }

  // Fetch insights for each post
  const postsWithInsights = [];
  for (const post of allPosts) {
    try {
      const insightsUrl = `${GRAPH_API}/${post.id}/insights?metric=post_impressions,post_impressions_unique,post_engaged_users,post_reactions_by_type_total,post_clicks&access_token=${accessToken}`;
      const insRes = await fetch(insightsUrl);
      let insights: Record<string, any> = {};
      if (insRes.ok) {
        const insJson = await insRes.json();
        for (const metric of insJson.data || []) {
          insights[metric.name] = metric.values?.[0]?.value ?? 0;
        }
      }
      postsWithInsights.push({ ...post, insights });
    } catch (e) {
      console.error(`Error fetching insights for ${post.id}:`, e);
      postsWithInsights.push({ ...post, insights: {} });
    }
  }

  return postsWithInsights;
}

function transformInstagramPost(
  post: any,
  orgId: string
): Record<string, any> {
  const caption = post.caption || "";
  const likes = post.like_count || 0;
  const comments = post.comments_count || 0;
  const saves = post.insights?.saved || 0;
  const shares = post.insights?.shares || 0;
  const reach = post.insights?.reach || 0;
  const impressions = post.insights?.impressions || 0;
  const plays = post.insights?.plays || null;
  // Detect reels: REEL type, or VIDEO without media_url (IG API quirk)
  const isReel = post.media_type === "REEL" || (post.media_type === "VIDEO" && !post.media_url);

  const engagement_rate = computeEngagementRate({
    likes,
    comments,
    shares,
    saves,
    reach,
  });

  const transformed = {
    org_id: orgId,
    platform: "instagram",
    external_post_id: post.id,
    post_type: isReel ? "reel" : mapMediaType(post.media_type),
    caption,
    hashtags: extractHashtags(caption),
    published_at: post.timestamp,
    permalink: post.permalink || "",
    thumbnail_url: post.thumbnail_url || post.media_url || "",
    likes,
    comments,
    shares,
    saves,
    reach,
    impressions,
    engagement_rate,
    plays: plays,
    avg_watch_time: null as number | null,
    content_category: "uncategorized",
    performance_score: 0,
    synced_at: new Date().toISOString(),
  };

  transformed.performance_score = computePerformanceScore({
    saves,
    shares,
    comments,
    engagement_rate,
    reach,
  });

  return transformed;
}

function transformFacebookPost(
  post: any,
  orgId: string
): Record<string, any> {
  const caption = post.message || "";
  const reactions = post.insights?.post_reactions_by_type_total || {};
  const likes = Object.values(reactions).reduce(
    (sum: number, v: any) => sum + (Number(v) || 0),
    0
  );
  const reach = post.insights?.post_impressions_unique || 0;
  const impressions = post.insights?.post_impressions || 0;
  const comments = 0; // FB page insights don't include comment count directly
  const shares = 0;
  const saves = 0;

  const engagement_rate = computeEngagementRate({
    likes,
    comments,
    shares,
    saves,
    reach,
  });

  const transformed = {
    org_id: orgId,
    platform: "facebook",
    external_post_id: post.id,
    post_type: mapFbPostType(post.attachments),
    caption,
    hashtags: extractHashtags(caption),
    published_at: post.created_time,
    permalink: post.permalink_url || "",
    thumbnail_url: post.full_picture || "",
    likes,
    comments,
    shares,
    saves,
    reach,
    impressions,
    engagement_rate,
    plays: null as number | null,
    avg_watch_time: null as number | null,
    content_category: "uncategorized",
    performance_score: 0,
    synced_at: new Date().toISOString(),
  };

  transformed.performance_score = computePerformanceScore({
    saves,
    shares,
    comments,
    engagement_rate,
    reach,
  });

  return transformed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organizationId, platform, sinceDays, action, pageId } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ success: false, error: "organizationId is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the Meta ad account for this org (has the access token)
    const { data: adAccount, error: accountError } = await supabase
      .from("ad_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("platform", "meta")
      .eq("is_active", true)
      .maybeSingle();

    if (accountError || !adAccount) {
      return new Response(
        JSON.stringify({
          success: false,
          needsReconnect: true,
          error: "No active Meta connection found. Please connect Meta Ads first.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = adAccount.access_token;
    if (!accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          needsReconnect: true,
          error: "Access token not found",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check token expiry
    if (
      adAccount.token_expires_at &&
      new Date(adAccount.token_expires_at) < new Date()
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          needsReconnect: true,
          error: "Meta token expired. Please reconnect.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Action: list_pages ──────────────────────────────────────────
    // Returns all Facebook pages + their linked Instagram accounts
    if (action === "list_pages") {
      const pageRes = await fetch(
        `${GRAPH_API}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100&access_token=${accessToken}`
      );
      if (!pageRes.ok) {
        const errText = await pageRes.text();
        return new Response(
          JSON.stringify({ success: false, error: "Failed to fetch pages", detail: errText }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const pagesJson = await pageRes.json();
      const pages = (pagesJson.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        hasIgAccount: !!p.instagram_business_account,
        igId: p.instagram_business_account?.id || null,
      }));
      return new Response(
        JSON.stringify({ success: true, pages }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Action: sync (default) ──────────────────────────────────────
    const since = sinceDays
      ? new Date(Date.now() - sinceDays * 86400000).toISOString().split("T")[0]
      : undefined;

    let totalSynced = 0;
    const platforms = platform
      ? [platform]
      : ["instagram", "facebook"];

    // Diagnostic info to return in response
    const diagnostics: Record<string, any> = {
      accountId: adAccount.account_id,
      accountName: adAccount.account_name,
      tokenPresent: !!accessToken,
      tokenLength: accessToken?.length || 0,
      since,
      platforms,
      steps: [],
    };

    // Fetch all pages once (shared between IG and FB)
    const pageRes = await fetch(
      `${GRAPH_API}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100&access_token=${accessToken}`
    );
    if (!pageRes.ok) {
      const errText = await pageRes.text();
      diagnostics.steps.push({ step: "fetch_pages", status: "error", detail: errText });
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch pages", diagnostics }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const pagesJson = await pageRes.json();
    let allPages = pagesJson.data || [];
    diagnostics.steps.push({
      step: "fetch_pages",
      status: "ok",
      pagesCount: allPages.length,
      pages: allPages.map((p: any) => ({
        id: p.id,
        name: p.name,
        hasIgAccount: !!p.instagram_business_account,
        igId: p.instagram_business_account?.id || null,
      })),
    });

    // Filter to selected page if specified
    if (pageId) {
      allPages = allPages.filter((p: any) => p.id === pageId);
      if (allPages.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: `Page ${pageId} not found in authorized pages`, diagnostics }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (allPages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No Facebook pages found", diagnostics }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process ALL pages (not just the first one)
    for (const page of allPages) {
      for (const p of platforms) {
        let posts: any[] = [];

        if (p === "instagram") {
          const igUserId = page.instagram_business_account?.id;
          if (!igUserId) {
            diagnostics.steps.push({
              step: `ig_${page.name}`,
              status: "skipped",
              detail: "No IG business account linked",
            });
            continue;
          }

          // Use page token for Instagram Business API (not user token)
          const pageToken = page.access_token || accessToken;
          const rawPosts = await fetchInstagramPosts(pageToken, igUserId, since);
          const postsWithInsights = rawPosts.filter((p) => Object.keys(p.insights || {}).length > 0).length;
          diagnostics.steps.push({
            step: `ig_${page.name}`,
            status: "ok",
            igUserId,
            rawPostsCount: rawPosts.length,
            postsWithInsights,
            tokenUsed: pageToken === accessToken ? "user_token" : "page_token",
          });
          posts = rawPosts.map((post) => transformInstagramPost(post, organizationId));
        } else if (p === "facebook") {
          const pageToken = page.access_token || accessToken;
          const rawPosts = await fetchFacebookPosts(pageToken, page.id, since);
          diagnostics.steps.push({
            step: `fb_${page.name}`,
            status: "ok",
            rawPostsCount: rawPosts.length,
          });
          posts = rawPosts.map((post) => transformFacebookPost(post, organizationId));
        }

        if (posts.length === 0) continue;

        // Batch upsert (50 at a time)
        const batchSize = 50;
        for (let i = 0; i < posts.length; i += batchSize) {
          const batch = posts.slice(i, i + batchSize);
          const { error: upsertError } = await supabase
            .from("social_posts")
            .upsert(batch, {
              onConflict: "org_id,platform,external_post_id",
            });

          if (upsertError) {
            console.error(`Upsert error for ${p} ${page.name}:`, JSON.stringify(upsertError));
            diagnostics.steps.push({ step: `${p}_${page.name}_upsert`, status: "error", detail: JSON.stringify(upsertError), code: upsertError.code, hint: upsertError.hint });
          } else {
            totalSynced += batch.length;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedPosts: totalSynced,
        platforms,
        diagnostics,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("sync-meta-posts error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
