import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// This function is public (no auth) — it redirects opaque tokens to Shopify discount URLs.
// The Shopify discount code appears only during the browser redirect, then Shopify
// applies the discount and redirects to ?return_to= destination (clean URL).

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
      .select('shopify_discount_code, is_active')
      .eq('redirect_token', token)
      .maybeSingle();

    if (!link || !link.is_active) {
      return Response.redirect(fallbackUrl, 302);
    }

    const shopifyDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN") ?? "dosmicos.com";
    // Apply discount and redirect to collections page (code never visible in final URL)
    const destination = `https://${shopifyDomain}/discount/${link.shopify_discount_code}?return_to=/collections/all`;
    return Response.redirect(destination, 302);

  } catch (_e) {
    return Response.redirect(fallbackUrl, 302);
  }
});
