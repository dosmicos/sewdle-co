// Reconcile Bold payments → Shopify orders (pull-based safety net).
//
// Root-cause fix for "paid Bold orders never created in Shopify": instead of
// depending solely on Bold's push webhook (bold-payment-webhook), this polls the
// Bold API for every pending_payment order with a Bold link and, if Bold says the
// link is PAID, runs the same create-order flow the webhook does. Immune to the
// webhook not firing / not matching for any reason.
//
// Modes:
//   { "mode": "dry_run" }  → report each pending Bold order's real Bold status +
//                            whether it would be created (and whether a matching
//                            Shopify order already exists). Creates NOTHING. (default)
//   { "mode": "apply" }    → create the Shopify order for PAID-but-not-created ones,
//                            OR link to an existing manual order if one already exists.
//
// Optional body params:
//   sinceDays (default 30)      → how far back to scan pending_orders.
//   minAgeMinutes (default 0)   → skip orders newer than this (let the real-time
//                                 webhook win first; the reconciler is the net).
//   organizationId (uuid)       → scope the scan to one org.
//
// Dup guards (two layers):
//   1) Self: only processes status='pending_payment'; the mark-paid/link updates are
//      gated on status still being 'pending_payment' (concurrent runs can't double-create).
//   2) Human: before creating, looks for an existing Shopify order for the same
//      customer (email OR phone) with a matching amount in the recent window. If found,
//      LINKS the pending_order to it instead of creating a duplicate. This makes apply
//      safe to run on a schedule even when a human rescued an order by hand.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify a Bold payment by reading the payment link status (source of truth).
// Mirrors bold-payment-webhook's verifyPaymentWithBoldAPI.
async function verifyPaymentWithBoldAPI(
  paymentLinkId: string | null,
  reference: string,
  expectedAmount: number,
  boldApiKey: string,
): Promise<{ verified: boolean; reason: string; status?: string }> {
  if (!paymentLinkId) {
    return { verified: false, reason: "Missing Bold payment link id" };
  }
  try {
    const resp = await fetch(
      `https://integrations.api.bold.co/online/link/v1/${paymentLinkId}`,
      { method: "GET", headers: { "Authorization": `x-api-key ${boldApiKey}`, "Content-Type": "application/json" } },
    );
    if (!resp.ok) {
      return { verified: false, reason: `Bold link API returned HTTP ${resp.status}` };
    }
    const linkData = await resp.json();
    const linkStatus = linkData.payload?.status || linkData.status;
    const linkReference = linkData.payload?.reference || linkData.reference;
    const linkAmount = linkData.payload?.total || linkData.total || linkData.amount?.total_amount;

    if (linkStatus !== "PAID") {
      return { verified: false, reason: `status='${linkStatus}'`, status: linkStatus };
    }
    if (linkReference && linkReference !== reference) {
      return { verified: false, reason: `reference mismatch (got '${linkReference}')`, status: linkStatus };
    }
    if (linkAmount && expectedAmount && Math.abs(Number(linkAmount) - Number(expectedAmount)) > 1) {
      return { verified: false, reason: `amount mismatch (got ${linkAmount}, expected ${expectedAmount})`, status: linkStatus };
    }
    return { verified: true, reason: "PAID and matched", status: linkStatus };
  } catch (e) {
    return { verified: false, reason: `Bold API error: ${(e as Error).message}` };
  }
}

// Human dup-guard: find an already-existing Shopify order for this customer with a
// matching amount in the recent window. Matches on email OR phone (last 10 digits)
// AND amount (±1 peso), restricted to recent orders so we don't confuse a current
// purchase with an old order from the same returning customer.
async function findExistingShopifyOrder(
  supabase: any,
  po: any,
): Promise<{ order_number: string; shopify_order_id: string | number } | null> {
  const email = (po.customer_email || "").toLowerCase().trim();
  const phoneDigits = (po.customer_phone || "").replace(/\D/g, "");
  const last10 = phoneDigits.slice(-10);
  const amount = Number(po.total_amount);
  const cutoff = new Date(Date.now() - 21 * 86400000).toISOString();

  const candidates: any[] = [];
  if (email) {
    const { data } = await supabase
      .from("shopify_orders")
      .select("order_number, shopify_order_id, total_price, shopify_created_at")
      .gte("shopify_created_at", cutoff)
      .ilike("customer_email", email);
    if (data) candidates.push(...data);
  }
  if (last10) {
    const { data } = await supabase
      .from("shopify_orders")
      .select("order_number, shopify_order_id, total_price, shopify_created_at")
      .gte("shopify_created_at", cutoff)
      .ilike("customer_phone", `%${last10}`);
    if (data) candidates.push(...data);
  }
  const hit = candidates.find((o) => Math.abs(Number(o.total_price) - amount) <= 1);
  return hit ? { order_number: String(hit.order_number), shopify_order_id: hit.shopify_order_id } : null;
}

// Direct WhatsApp text send (fallback when send-order-confirmation can't find the
// just-created order in the local table yet). Mirrors bold-payment-webhook.
async function sendWhatsAppText(
  phoneNumberId: string,
  token: string,
  to: string,
  message: string,
): Promise<boolean> {
  try {
    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: String(to).replace(/[\s+]/g, ""),
        type: "text",
        text: { preview_url: false, body: message },
      }),
    });
    return resp.ok;
  } catch (_) {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const mode: string = body.mode === "apply" ? "apply" : "dry_run";
  const sinceDays: number = Number(body.sinceDays) > 0 ? Number(body.sinceDays) : 30;
  const minAgeMinutes: number = Number(body.minAgeMinutes) > 0 ? Number(body.minAgeMinutes) : 0;
  const organizationId: string | undefined = body.organizationId;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const cutoff = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const newestAllowed = new Date(Date.now() - minAgeMinutes * 60000).toISOString();
  let query = supabase
    .from("pending_orders")
    .select("*")
    .eq("status", "pending_payment")
    .not("bold_reference", "is", null)
    .not("bold_payment_link_id", "is", null)
    .gte("created_at", cutoff)
    .lte("created_at", newestAllowed)
    .order("created_at", { ascending: false });
  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data: orders, error: qErr } = await query;
  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const boldKeyCache = new Map<string, string | null>();
  async function getBoldKey(orgId: string): Promise<string | null> {
    if (boldKeyCache.has(orgId)) return boldKeyCache.get(orgId)!;
    let key: string | null = null;
    const { data: org } = await supabase.from("organizations").select("bold_credentials").eq("id", orgId).single();
    const creds = (org?.bold_credentials as any) || null;
    key = creds?.api_key || creds?.apiKey || Deno.env.get("BOLD_API_KEY") || null;
    boldKeyCache.set(orgId, key);
    return key;
  }

  const counters = { checked: 0, paid: 0, not_paid: 0, created: 0, linked_existing: 0, create_failed: 0, no_key: 0 };
  const report: any[] = [];

  for (const po of orders ?? []) {
    counters.checked++;
    const summary: any = {
      customer: po.customer_name, reference: po.bold_reference, amount: po.total_amount,
      conversation_id: po.conversation_id, created_at: po.created_at,
    };

    const boldKey = await getBoldKey(po.organization_id);
    if (!boldKey) { counters.no_key++; report.push({ ...summary, result: "no_bold_key" }); continue; }

    const v = await verifyPaymentWithBoldAPI(po.bold_payment_link_id, po.bold_reference, Number(po.total_amount), boldKey);
    if (!v.verified) {
      counters.not_paid++;
      report.push({ ...summary, result: "not_paid_or_unverified", bold: v.reason, bold_status: v.status });
      continue;
    }
    counters.paid++;

    // Human dup-guard: does a matching Shopify order already exist?
    const existing = await findExistingShopifyOrder(supabase, po);

    if (mode !== "apply") {
      report.push({
        ...summary,
        result: existing ? "PAID_duplicate_exists" : "PAID_would_create",
        bold_status: v.status,
        existing_order: existing?.order_number,
      });
      continue;
    }

    // ── apply: if a matching order already exists, LINK instead of creating ──
    if (existing) {
      const { data: linked } = await supabase
        .from("pending_orders")
        .update({
          status: "order_created",
          shopify_order_id: String(existing.shopify_order_id),
          shopify_order_number: String(existing.order_number),
          notes: (po.notes || "") + ` | Reconciliador: pedido ya existía en Shopify (#${existing.order_number}); vinculado para evitar duplicado.`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", po.id)
        .eq("status", "pending_payment")
        .select("id");
      if (!linked || linked.length === 0) {
        report.push({ ...summary, result: "skipped_already_processed" });
        continue;
      }
      counters.linked_existing++;
      report.push({ ...summary, result: "linked_existing_order", shopify_order_number: existing.order_number });
      continue;
    }

    // ── apply: mark paid (gated on status) then create the Shopify order ──
    const { data: claimed } = await supabase
      .from("pending_orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", po.id)
      .eq("status", "pending_payment")
      .select("id");
    if (!claimed || claimed.length === 0) {
      report.push({ ...summary, result: "skipped_already_processed" });
      continue;
    }

    const { data: orderResult, error: orderError } = await supabase.functions.invoke("create-shopify-order", {
      body: {
        orderData: {
          customerName: po.customer_name,
          cedula: po.cedula || "",
          email: po.customer_email,
          phone: po.customer_phone,
          address: po.address,
          city: po.city,
          department: po.department,
          neighborhood: po.neighborhood || "",
          lineItems: po.line_items,
          notes: (po.notes || "") + ` | Pago confirmado via Bold (ref: ${po.bold_reference}) [reconciliador]`,
          shippingCost: po.shipping_cost || 0,
          paymentMethod: "link_de_pago",
        },
        organizationId: po.organization_id,
      },
    });

    if (orderError || !orderResult?.orderId) {
      counters.create_failed++;
      await supabase.from("pending_orders").update({
        status: "creation_failed",
        notes: (po.notes || "") + ` | Reconciliador: fallo creando Shopify: ${orderError?.message || "sin orderId"}`,
        updated_at: new Date().toISOString(),
      }).eq("id", po.id);
      report.push({ ...summary, result: "create_failed", error: orderError?.message || "no orderId" });
      continue;
    }

    await supabase.from("pending_orders").update({
      status: "order_created",
      shopify_order_id: String(orderResult.orderId),
      shopify_order_number: String(orderResult.orderNumber),
      updated_at: new Date().toISOString(),
    }).eq("id", po.id);

    // Send the customer confirmation. Try the shared flow first (it reads the local
    // shopify_orders table), but that table may not have synced the just-created order
    // yet — so fall back to a direct WhatsApp message built from the pending order,
    // mirroring bold-payment-webhook, so the customer is always confirmed.
    let confirmationSent = false;
    try {
      const { data: confResult, error: confError } = await supabase.functions.invoke(
        "send-order-confirmation",
        { body: { action: "send_single", organizationId: po.organization_id, shopifyOrderId: Number(orderResult.orderId) } },
      );
      confirmationSent = Boolean(confResult?.success) && !confError;
    } catch (_) { /* fall through to direct fallback */ }

    if (!confirmationSent && po.customer_phone) {
      const token = Deno.env.get("META_WHATSAPP_TOKEN");
      let phoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID");
      const { data: channels } = await supabase
        .from("messaging_channels")
        .select("meta_phone_number_id")
        .eq("organization_id", po.organization_id)
        .eq("channel_type", "whatsapp")
        .eq("is_active", true)
        .limit(1);
      if (channels?.[0]?.meta_phone_number_id) phoneNumberId = channels[0].meta_phone_number_id;

      if (token && phoneNumberId) {
        const productsList = ((po.line_items as any[]) || [])
          .map((item: any) => `• ${item.productName} (${item.variantName}) x${item.quantity || 1}`)
          .join("\n");
        const msg = `¡Tu pago ha sido confirmado! 🎉✅\n\n` +
          `📋 Número de pedido: #${orderResult.orderNumber}\n` +
          (orderResult.totalPrice ? `💰 Total pagado: $${Number(orderResult.totalPrice).toLocaleString("es-CO")} COP\n` : "") +
          `\n📦 Productos:\n${productsList}\n\n` +
          `Tu pedido ha sido creado exitosamente. Te enviaremos la información de seguimiento cuando sea despachado.\n\n` +
          `¡Gracias por tu compra! 😊`;
        confirmationSent = await sendWhatsAppText(phoneNumberId, token, po.customer_phone, msg);
        if (confirmationSent && po.conversation_id) {
          await supabase.from("messaging_messages").insert({
            conversation_id: po.conversation_id,
            content: msg,
            direction: "outbound",
            message_type: "text",
            sent_at: new Date().toISOString(),
          });
        }
      }
    }

    counters.created++;
    report.push({ ...summary, result: "order_created", shopify_order_number: orderResult.orderNumber, confirmation_sent: confirmationSent });
  }

  return new Response(JSON.stringify({ mode, sinceDays, minAgeMinutes, ...counters, report }, null, 2), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
