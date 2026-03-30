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

  // Fetch insights for each post (reach, impressions, saved, shares)
  const postsWithInsights = [];
  for (const post of allPosts) {
    try {
      const insightsUrl = `${GRAPH_API}/${post.id}/insights?metric=reach,impressions,saved,shares&access_token=${accessToken}`;
      const insRes = await fetch(insightsUrl);
      let insights: Record<string, number> = {};
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
  const isReel = post.media_type === "VIDEO" && !post.media_url;

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
    const { organizationId, platform, sinceDays } = await req.json();

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

    for (const p of platforms) {
      let posts: any[] = [];

      if (p === "instagram") {
        // Get IG user ID from the connected page
        const pageRes = await fetch(
          `${GRAPH_API}/me/accounts?access_token=${accessToken}`
        );
        if (!pageRes.ok) {
          const errText = await pageRes.text();
          console.error("Failed to fetch pages:", errText);
          diagnostics.steps.push({ step: "ig_fetch_pages", status: "error", detail: errText });
          continue;
        }
        const pagesJson = await pageRes.json();
        const page = pagesJson.data?.[0];
        diagnostics.steps.push({
          step: "ig_fetch_pages",
          status: "ok",
          pagesCount: pagesJson.data?.length || 0,
          firstPageId: page?.id || null,
          firstPageName: page?.name || null,
        });
        if (!page) {
          diagnostics.steps.push({ step: "ig_no_page", status: "skipped", detail: "No Facebook page found" });
          continue;
        }

        // Get IG business account linked to the page
        const igRes = await fetch(
          `${GRAPH_API}/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
        );
        if (!igRes.ok) {
          const errText = await igRes.text();
          console.error("Failed to fetch IG account:", errText);
          diagnostics.steps.push({ step: "ig_business_account", status: "error", detail: errText });
          continue;
        }
        const igJson = await igRes.json();
        const igUserId = igJson.instagram_business_account?.id;
        diagnostics.steps.push({
          step: "ig_business_account",
          status: igUserId ? "ok" : "not_linked",
          igUserId: igUserId || null,
        });
        if (!igUserId) {
          continue;
        }

        const rawPosts = await fetchInstagramPosts(accessToken, igUserId, since);
        diagnostics.steps.push({ step: "ig_fetch_posts", status: "ok", rawPostsCount: rawPosts.length });
        posts = rawPosts.map((p) => transformInstagramPost(p, organizationId));
      } else if (p === "facebook") {
        const pageRes = await fetch(
          `${GRAPH_API}/me/accounts?access_token=${accessToken}`
        );
        if (!pageRes.ok) {
          const errText = await pageRes.text();
          console.error("Failed to fetch pages:", errText);
          diagnostics.steps.push({ step: "fb_fetch_pages", status: "error", detail: errText });
          continue;
        }
        const pagesJson = await pageRes.json();
        const page = pagesJson.data?.[0];
        diagnostics.steps.push({
          step: "fb_fetch_pages",
          status: "ok",
          pagesCount: pagesJson.data?.length || 0,
          firstPageId: page?.id || null,
          firstPageName: page?.name || null,
        });
        if (!page) {
          diagnostics.steps.push({ step: "fb_no_page", status: "skipped", detail: "No Facebook page found" });
          continue;
        }

        // Use page access token for page-level insights
        const pageToken = page.access_token || accessToken;
        const rawPosts = await fetchFacebookPosts(pageToken, page.id, since);
        diagnostics.steps.push({ step: "fb_fetch_posts", status: "ok", rawPostsCount: rawPosts.length });
        posts = rawPosts.map((p) => transformFacebookPost(p, organizationId));
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
          console.error(`Upsert error for ${p}:`, upsertError);
          diagnostics.steps.push({ step: `${p}_upsert`, status: "error", detail: upsertError.message });
        } else {
          totalSynced += batch.length;
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
