import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

serve(async (req) => {
  const shopifyDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN") ?? "";
  const shopifyToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN") ?? "";
  const storedSecret = Deno.env.get("SHOPIFY_WEBHOOK_SECRET") ?? "";
  const action = new URL(req.url).searchParams.get("action");
  const webhookId = new URL(req.url).searchParams.get("id") ?? "1719290101995";

  const headers = { 'X-Shopify-Access-Token': shopifyToken, 'Content-Type': 'application/json' };

  // Get webhook detail (to check address, api_version etc)
  if (action === "detail") {
    const res = await fetch(`https://${shopifyDomain}/admin/api/2024-01/webhooks/${webhookId}.json`, { headers });
    const data = await res.json();
    return new Response(JSON.stringify({ status: res.status, webhook: data.webhook }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Get recent deliveries for a webhook
  if (action === "deliveries") {
    const res = await fetch(`https://${shopifyDomain}/admin/api/2024-01/webhooks/${webhookId}/deliveries.json`, { headers });
    const data = await res.json();
    return new Response(JSON.stringify({ status: res.status, data }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Recreate webhook with token-based auth URL (delete + create)
  if (action === "recreate") {
    // Delete existing
    await fetch(`https://${shopifyDomain}/admin/api/2024-01/webhooks/${webhookId}.json`, { method: 'DELETE', headers });

    // Create new one — token embedded in URL for verification
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const webhookToken = Deno.env.get("SHOPIFY_WEBHOOK_TOKEN") ?? "";
    const webhookAddress = webhookToken
      ? `${supabaseUrl}/functions/v1/shopify-ugc-webhook?token=${webhookToken}`
      : `${supabaseUrl}/functions/v1/shopify-ugc-webhook`;

    const createRes = await fetch(`https://${shopifyDomain}/admin/api/2024-01/webhooks.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        webhook: {
          topic: "orders/create",
          address: webhookAddress,
          format: "json",
        }
      })
    });
    const createData = await createRes.json();
    return new Response(JSON.stringify({ status: createRes.status, created: createData.webhook, webhookAddress, hasToken: !!webhookToken }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Test: simulate processing a manual order payload
  if (action === "test-hmac") {
    // We'll compute what Shopify would send and verify with stored secret
    const testBody = '{"id":999999,"order_number":"TEST","discount_codes":[{"code":"D-WUXLB9HK","amount":"4845.00","type":"percentage"}],"subtotal_price":"96900.00","total_price":"95055.00","created_at":"2026-04-15T10:00:00-05:00"}';
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(storedSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(testBody));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return new Response(JSON.stringify({
      testBody,
      hmacHeader: computed,
      secretLength: storedSecret.length,
      secretFirst4: storedSecret.substring(0, 4),
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Search orders by discount code
  if (action === "find-order") {
    const discountCode = new URL(req.url).searchParams.get("code") ?? "D-WUXLB9HK";
    // Use Shopify's discount_code filter (searches across all orders)
    const res = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/orders.json?status=any&limit=50&discount_code=${encodeURIComponent(discountCode)}`,
      { headers }
    );
    const data = await res.json();
    const orders = (data.orders || []);
    const simplified = orders.map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      name: o.name,
      created_at: o.created_at,
      subtotal_price: o.subtotal_price,
      total_price: o.total_price,
      discount_codes: o.discount_codes,
      financial_status: o.financial_status,
    }));
    // Also return raw count for debugging
    return new Response(JSON.stringify({ status: res.status, searching_for: discountCode, total_returned: orders.length, matched: simplified }), { headers: { 'Content-Type': 'application/json' } });
  }

  // List all webhooks
  const res = await fetch(`https://${shopifyDomain}/admin/api/2024-01/webhooks.json?limit=50`, { headers });
  const data = await res.json();
  return new Response(JSON.stringify({ domain: shopifyDomain, webhooks: data.webhooks?.map((w: any) => ({ id: w.id, topic: w.topic, address: w.address, api_version: w.api_version })) }), { headers: { 'Content-Type': 'application/json' } });
});
