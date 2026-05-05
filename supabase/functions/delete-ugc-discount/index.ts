import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Auth + admin check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, role')
      .eq('id', userData.user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'Administrador')) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { discount_link_id } = await req.json();
    if (!discount_link_id) throw new Error("discount_link_id is required");

    // Fetch the link to get Shopify IDs
    const { data: link, error: linkError } = await supabaseAdmin
      .from('ugc_discount_links' as any)
      .select('id, organization_id, shopify_price_rule_id, shopify_discount_code, is_active')
      .eq('id', discount_link_id)
      .eq('organization_id', profile.organization_id)
      .single() as any;

    if (linkError || !link) throw new Error("Link not found or access denied");

    // Delete price rule from Shopify (this also deletes the discount code)
    const shopifyDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
    const shopifyToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");

    let shopifyDeleted = false;
    if (shopifyDomain && shopifyToken && link.shopify_price_rule_id) {
      const shopifyRes = await fetch(
        `https://${shopifyDomain}/admin/api/2024-01/price_rules/${link.shopify_price_rule_id}.json`,
        {
          method: 'DELETE',
          headers: { 'X-Shopify-Access-Token': shopifyToken },
        }
      );
      shopifyDeleted = shopifyRes.ok || shopifyRes.status === 404;
      if (!shopifyRes.ok && shopifyRes.status !== 404) {
        console.error(`Shopify delete failed: ${shopifyRes.status}`);
      }
    }

    // Mark link as inactive in DB
    const { error: updateError } = await supabaseAdmin
      .from('ugc_discount_links' as any)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', discount_link_id);

    if (updateError) throw new Error(`DB error: ${updateError.message}`);

    return new Response(JSON.stringify({
      success: true,
      shopify_deleted: shopifyDeleted,
      message: shopifyDeleted
        ? 'Link y descuento de Shopify eliminados'
        : 'Link desactivado (descuento de Shopify no encontrado)',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
