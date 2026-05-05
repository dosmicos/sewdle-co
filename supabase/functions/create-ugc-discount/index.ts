import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const log = (step: string, details?: any) => {
  const str = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-UGC-DISCOUNT] ${step}${str}`);
};

function generateRandomCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let result = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    result += chars[b % chars.length];
  }
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    log("Started");

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
    const user = userData.user;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'Administrador')) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const orgId = profile.organization_id;
    log("Admin verified", { orgId });

    // Parse request
    const { creator_id, discount_value = 10, commission_rate = 10 } = await req.json();
    if (!creator_id) throw new Error("creator_id is required");

    // Get creator name for logging
    const { data: creator } = await supabaseAdmin
      .from('ugc_creators')
      .select('name, organization_id')
      .eq('id', creator_id)
      .single();

    if (!creator || creator.organization_id !== orgId) {
      throw new Error("Creator not found or does not belong to your organization");
    }

    // Check if creator already has an active link
    const { data: existing } = await supabaseAdmin
      .from('ugc_discount_links')
      .select('id, redirect_token, is_active')
      .eq('creator_id', creator_id)
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        already_exists: true,
        redirect_url: `https://ads.dosmicos.com/ugc/${existing.redirect_token}`,
        discount_link_id: existing.id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Shopify credentials
    const shopifyDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
    const shopifyToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");
    if (!shopifyDomain || !shopifyToken) throw new Error("Shopify credentials not configured");

    // Generate opaque discount code
    const discountCode = `D-${generateRandomCode(8)}`;
    log("Generated code", { discountCode });

    // Create Price Rule in Shopify
    const priceRuleRes = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/price_rules.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_rule: {
            title: `UGC Creator - ${creator.name} (${discountCode})`,
            target_type: 'line_item',
            target_selection: 'all',
            allocation_method: 'across',
            value_type: 'percentage',
            value: `-${discount_value}`,
            customer_selection: 'all',
            once_per_customer: true,
            starts_at: new Date().toISOString(),
          }
        })
      }
    );

    if (!priceRuleRes.ok) {
      const errText = await priceRuleRes.text();
      log("Shopify price rule error", { status: priceRuleRes.status, body: errText });
      throw new Error(`Failed to create Shopify price rule: ${priceRuleRes.status}`);
    }

    const { price_rule } = await priceRuleRes.json();
    log("Price rule created", { id: price_rule.id });

    // Create Discount Code
    const codeRes = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/price_rules/${price_rule.id}/discount_codes.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ discount_code: { code: discountCode } })
      }
    );

    if (!codeRes.ok) {
      const errText = await codeRes.text();
      log("Shopify discount code error", { status: codeRes.status, body: errText });
      throw new Error(`Failed to create Shopify discount code: ${codeRes.status}`);
    }

    log("Discount code created in Shopify");

    // Save to DB — redirect_token is auto-generated by DEFAULT
    const { data: link, error: insertError } = await supabaseAdmin
      .from('ugc_discount_links')
      .insert({
        organization_id: orgId,
        creator_id,
        shopify_price_rule_id: String(price_rule.id),
        shopify_discount_code: discountCode,
        discount_value,
        commission_rate,
      })
      .select('id, redirect_token')
      .single();

    if (insertError) throw new Error(`DB insert error: ${insertError.message}`);

    const redirectUrl = `https://ads.dosmicos.com/ugc/${link.redirect_token}`;
    log("Done", { redirectUrl, linkId: link.id });

    return new Response(JSON.stringify({
      discount_link_id: link.id,
      redirect_url: redirectUrl,
      discount_value,
      commission_rate,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    log("ERROR", { message: (error as Error).message });
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
