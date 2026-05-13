import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// This function is public (no auth) — it redirects opaque tokens to Shopify discount URLs.
// The Shopify discount code appears only during the browser redirect, then Shopify
// applies the discount and redirects to ?return_to= destination (clean URL).

const hashIp = async (ip: string | null) => {
  if (!ip) return null;
  const salt = Deno.env.get("UGC_CLICK_HASH_SALT") ?? "dosmicos-ugc-clicks";
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const getClientIp = (req: Request) => {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
};

const isSafeShopifyPath = (path: string | null) => {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
};

const appendLandingMarker = (path: string, landingVariant: string | null) => {
  const landingUrl = new URL(path, 'https://dosmicos.local');
  landingUrl.searchParams.set('ugc_landing', '1');
  landingUrl.searchParams.set('utm_source', landingUrl.searchParams.get('utm_source') || 'ugc');
  landingUrl.searchParams.set('utm_medium', landingUrl.searchParams.get('utm_medium') || 'creator');
  if (landingVariant) landingUrl.searchParams.set('utm_content', landingVariant);
  return `${landingUrl.pathname}${landingUrl.search}${landingUrl.hash}`;
};

serve(async (req) => {
  const url = new URL(req.url);

  // Token can come from path (/ugc-redirect/TOKEN) or query param (?t=TOKEN)
  const pathParts = url.pathname.split('/').filter(Boolean);
  const token = pathParts[pathParts.length - 1] || url.searchParams.get('t') || '';

  const fallbackUrl = 'https://dosmicos.com';

  if (!token || token === 'ugc-redirect') {
    return Response.redirect(fallbackUrl, 302);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: link } = await supabaseAdmin
      .from('ugc_discount_links')
      .select('id, organization_id, creator_id, shopify_discount_code, is_active, landing_enabled, landing_path, landing_variant')
      .eq('redirect_token', token)
      .maybeSingle();

    if (!link || !link.is_active) {
      return Response.redirect(fallbackUrl, 302);
    }

    const explicitLandingPath = url.searchParams.get('return_to');
    const configuredLandingPath = link.landing_enabled ? link.landing_path : null;
    let safeLandingPath = '/collections/all';
    if (isSafeShopifyPath(explicitLandingPath)) {
      safeLandingPath = explicitLandingPath!;
    } else if (isSafeShopifyPath(configuredLandingPath)) {
      safeLandingPath = appendLandingMarker(configuredLandingPath!, link.landing_variant);
    }

    // Best-effort click tracking. Never block the shopper if analytics insert fails.
    try {
      await supabaseAdmin.from('ugc_link_clicks').insert({
        organization_id: link.organization_id,
        discount_link_id: link.id,
        creator_id: link.creator_id,
        user_agent: req.headers.get('user-agent'),
        referrer: req.headers.get('referer') || req.headers.get('referrer'),
        landing_path: safeLandingPath,
        ip_hash: await hashIp(getClientIp(req)),
        utm_source: url.searchParams.get('utm_source'),
        utm_medium: url.searchParams.get('utm_medium'),
        utm_campaign: url.searchParams.get('utm_campaign'),
        utm_content: url.searchParams.get('utm_content'),
        utm_term: url.searchParams.get('utm_term'),
        metadata: {
          token_source: pathParts[pathParts.length - 1] ? 'path' : 'query',
          landing_variant: link.landing_variant,
        },
      });
    } catch (clickError) {
      console.warn('[UGC_REDIRECT] click tracking failed', clickError);
    }

    const shopifyDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN") ?? "dosmicos.com";
    // Apply discount and redirect to destination (code never visible in final URL)
    const destination = `https://${shopifyDomain}/discount/${link.shopify_discount_code}?return_to=${encodeURIComponent(safeLandingPath)}`;
    return Response.redirect(destination, 302);

  } catch (_e) {
    return Response.redirect(fallbackUrl, 302);
  }
});
