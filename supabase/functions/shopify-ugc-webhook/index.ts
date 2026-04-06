import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const log = (step: string, details?: any) => {
  const str = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SHOPIFY-UGC-WEBHOOK] ${step}${str}`);
};

async function verifyHmac(body: string, hmacHeader: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return computed === hmacHeader;
  } catch {
    return false;
  }
}

serve(async (req) => {
  // Shopify requires a fast 200 response — respond immediately, then process
  const body = await req.text();

  // Verify HMAC signature
  const hmacHeader = req.headers.get('X-Shopify-Hmac-Sha256') ?? '';
  const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');

  if (webhookSecret) {
    const valid = await verifyHmac(body, hmacHeader, webhookSecret);
    if (!valid) {
      log("HMAC verification failed");
      return new Response('Unauthorized', { status: 401 });
    }
  } else {
    log("WARNING: SHOPIFY_WEBHOOK_SECRET not set, skipping HMAC check");
  }

  // Respond 200 immediately (Shopify needs < 5s response)
  const processingPromise = processOrder(body);

  // Fire-and-forget — don't await
  processingPromise.catch(err => log("Processing error", { error: err.message }));

  return new Response('OK', { status: 200 });
});

async function processOrder(body: string) {
  let order: any;
  try {
    order = JSON.parse(body);
  } catch {
    log("Invalid JSON payload");
    return;
  }

  log("Processing order", { id: order.id, number: order.order_number });

  const discountCodes: string[] = (order.discount_codes || []).map((d: any) => d.code?.trim().toUpperCase());
  if (discountCodes.length === 0) {
    log("No discount codes in order — skipping");
    return;
  }

  log("Discount codes found", { codes: discountCodes });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Find matching discount link
  const { data: links } = await supabaseAdmin
    .from('ugc_discount_links')
    .select('id, organization_id, creator_id, commission_rate, shopify_discount_code')
    .in('shopify_discount_code', discountCodes)
    .eq('is_active', true);

  if (!links || links.length === 0) {
    log("No matching UGC discount links found");
    return;
  }

  const link = links[0];
  log("Matched link", { linkId: link.id, creatorId: link.creator_id });

  // Check if already processed (idempotency)
  const shopifyOrderId = String(order.id);
  const { data: existing } = await supabaseAdmin
    .from('ugc_attributed_orders')
    .select('id')
    .eq('shopify_order_id', shopifyOrderId)
    .maybeSingle();

  if (existing) {
    log("Order already attributed — skipping");
    return;
  }

  // Calculate amounts
  // Use subtotal_price (products after discount, before tax & shipping) as commission base.
  // This ensures the creator is commissioned only on the actual product revenue they drove,
  // not on taxes or shipping fees.
  const subtotalPrice = parseFloat(order.subtotal_price || order.total_price || '0');
  const discountAmount = (order.discount_codes || []).reduce((sum: number, d: any) => {
    return sum + parseFloat(d.amount || '0');
  }, 0);
  // Revenue stored is what the customer paid for products (after discount, before tax/shipping)
  const orderRevenue = subtotalPrice;
  const commissionAmount = Math.round((orderRevenue * link.commission_rate) / 100 * 100) / 100;

  log("Amounts calculated", {
    subtotalPrice,
    discountAmount,
    commissionRate: link.commission_rate,
    commissionAmount,
  });

  // Insert attributed order
  const { error: insertError } = await supabaseAdmin
    .from('ugc_attributed_orders')
    .insert({
      organization_id: link.organization_id,
      discount_link_id: link.id,
      creator_id: link.creator_id,
      shopify_order_id: shopifyOrderId,
      shopify_order_number: String(order.order_number || ''),
      order_total: orderRevenue,
      discount_amount: discountAmount,
      commission_amount: commissionAmount,
      order_date: order.created_at || new Date().toISOString(),
    });

  if (insertError) {
    log("Insert error", { error: insertError.message });
    return;
  }

  // Update cumulative totals atomically via RPC
  const { error: updateError } = await supabaseAdmin.rpc('increment_ugc_link_totals', {
    p_link_id: link.id,
    p_revenue: orderRevenue,
    p_commission: commissionAmount,
  });

  if (updateError) {
    log("RPC increment failed", { error: updateError.message });
    // Fallback: read-modify-write (non-atomic but better than nothing)
    const { data: current } = await supabaseAdmin
      .from('ugc_discount_links')
      .select('total_orders, total_revenue, total_commission')
      .eq('id', link.id)
      .single();

    if (current) {
      await supabaseAdmin
        .from('ugc_discount_links')
        .update({
          total_orders: (current.total_orders || 0) + 1,
          total_revenue: (current.total_revenue || 0) + orderRevenue,
          total_commission: (current.total_commission || 0) + commissionAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', link.id);
    }
  }

  log("Attribution complete", {
    orderId: shopifyOrderId,
    orderRevenue,
    commission: commissionAmount,
    commissionRate: link.commission_rate,
    creatorId: link.creator_id,
  });
}
