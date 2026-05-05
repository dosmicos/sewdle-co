import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizeColombianPhone } from "../_shared/phone-utils.ts";
import { sendWhatsAppTemplate } from "../_shared/whatsapp-template.ts";

/**
 * Shopify Customer Webhook — Auto-send WhatsApp template when customer gets a specific tag.
 *
 * Listens to `customers/update` and `customers/create` Shopify webhooks.
 * If the customer has the target tag (e.g. "hotdays2") and hasn't been sent to yet,
 * sends the WhatsApp template automatically.
 */

const WATCHED_TAGS = ["hotdays2"]; // Tags that trigger auto-send
const DEFAULT_TEMPLATE = "hotdays_acceso_anticipado_v2";
const DEFAULT_LANGUAGE = "es_CO";
const DEFAULT_HEADER_IMAGE = "https://cdn.shopify.com/s/files/1/0403/7309/2520/files/Diseno_sin_titulo_2.png?v=1773504829";
const ORG_ID = "cb497af2-3f29-4bb4-be53-91b7f19e5ffb";

// Shopify credentials for fetching customer tags
const SHOPIFY_STORE = "dosmicos";
const SHOPIFY_ACCESS_TOKEN_KEY = "SHOPIFY_ACCESS_TOKEN"; // env var name

async function fetchCustomerTags(customerId: number, storeDomain: string, accessToken: string): Promise<string[]> {
  try {
    const resp = await fetch(
      `https://${storeDomain}.myshopify.com/admin/api/2024-01/customers/${customerId}.json?fields=tags`,
      { headers: { "X-Shopify-Access-Token": accessToken } }
    );
    if (!resp.ok) {
      console.error(`  ❌ Failed to fetch customer ${customerId}: ${resp.status}`);
      return [];
    }
    const data = await resp.json();
    const tags = data.customer?.tags || "";
    return typeof tags === "string"
      ? tags.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean)
      : Array.isArray(tags) ? tags.map((t: string) => t.trim().toLowerCase()) : [];
  } catch (err: any) {
    console.error(`  ❌ Error fetching customer tags: ${err.message}`);
    return [];
  }
}

function extractPhoneFromNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const match = note.match(/(?:\+?\s*57\s*)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/);
  if (!match) return null;
  return match[0].replace(/\D/g, "");
}

async function verifyShopifyWebhook(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const hash = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hashArray = new Uint8Array(hash);
  const expectedSignature = btoa(String.fromCharCode(...hashArray));
  const receivedSignature = signature.replace("sha256=", "");
  return expectedSignature === receivedSignature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);
  const metaToken = Deno.env.get("META_WHATSAPP_TOKEN") ?? "";
  const webhookSecret = Deno.env.get("SHOPIFY_WEBHOOK_SECRET") ?? "";

  // GET = health check / debug
  if (req.method === "GET") {
    return json({ status: "ok", template: DEFAULT_TEMPLATE, tags: WATCHED_TAGS, timestamp: new Date().toISOString() });
  }

  try {
    const rawBody = await req.text();

    // Log raw webhook receipt for debugging
    console.log(`🔔 Webhook received at ${new Date().toISOString()}, body length: ${rawBody.length}`);

    // Verify webhook signature
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256") || "";
    if (webhookSecret && hmacHeader) {
      const valid = await verifyShopifyWebhook(rawBody, hmacHeader, webhookSecret);
      if (!valid) {
        console.error("Invalid webhook signature");
        return new Response("Unauthorized", { status: 401 });
      }
    } else if (!hmacHeader) {
      console.error("Missing x-shopify-hmac-sha256 header");
      return new Response("Unauthorized", { status: 401 });
    }

    const customer = JSON.parse(rawBody);

    // Log webhook to debug table (key-value store pattern)
    console.log(`📥 WEBHOOK RAW: id=${customer.id}, name=${customer.first_name} ${customer.last_name}, tags=${JSON.stringify(customer.tags)}, phone=${customer.phone}, note=${(customer.note || "").substring(0, 50)}`);

    // Handle tags as string (old API) or array (2026-01 API)
    let customerTags: string[] = [];
    if (Array.isArray(customer.tags)) {
      customerTags = customer.tags.map((t: string) => t.trim().toLowerCase());
    } else if (typeof customer.tags === "string" && customer.tags.length > 0) {
      customerTags = customer.tags.split(",").map((t: string) => t.trim().toLowerCase());
    }

    // If tags are empty/undefined (2026-01 API doesn't include them), fetch from Shopify API
    if (customerTags.length === 0 && customer.id) {
      // Get Shopify credentials from org
      const { data: org } = await supabase
        .from("organizations")
        .select("shopify_credentials, shopify_store_url")
        .eq("id", ORG_ID)
        .single();
      const creds = org?.shopify_credentials as any;
      const storeDomain = (creds?.store_domain || creds?.shopDomain || org?.shopify_store_url || SHOPIFY_STORE).replace(".myshopify.com", "");
      const accessToken = creds?.access_token || creds?.accessToken || Deno.env.get(SHOPIFY_ACCESS_TOKEN_KEY) || "";
      if (accessToken) {
        console.log(`  🔍 Tags missing from webhook, fetching from Shopify API for customer ${customer.id}...`);
        customerTags = await fetchCustomerTags(customer.id, storeDomain, accessToken);
      }
    }
    console.log(`  📋 Final tags: [${customerTags.join(", ")}]`);

    const customerName = [customer.first_name, customer.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || "Cliente";
    const email = customer.email || "";

    console.log(`📥 Customer webhook: ${customerName} (${email}), tags: [${customerTags.join(", ")}]`);

    // Check if customer has any watched tag
    const matchedTags = WATCHED_TAGS.filter((t) =>
      customerTags.includes(t.toLowerCase())
    );

    if (matchedTags.length === 0) {
      console.log("  ⏭️ No watched tags found, skipping");
      return json({ status: "skipped", reason: "no matching tags" });
    }

    // Extract phone number
    let rawPhone = customer.phone || "";
    if (!rawPhone && customer.note) {
      const notePhone = extractPhoneFromNote(customer.note);
      if (notePhone) rawPhone = notePhone;
    }

    if (!rawPhone) {
      console.log(`  ⏭️ No phone for ${customerName}`);
      return json({ status: "skipped", reason: "no phone" });
    }

    const phone = normalizeColombianPhone(rawPhone);
    if (!phone) {
      console.log(`  ⏭️ Invalid phone for ${customerName}: "${rawPhone}"`);
      return json({ status: "skipped", reason: "invalid phone" });
    }

    // Check if already sent (temporarily disabled for testing)
    const { data: conv } = await supabase
      .from("messaging_conversations")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("external_user_id", phone)
      .eq("channel_type", "whatsapp")
      .maybeSingle();

    if (conv) {
      const { data: sentMsg } = await supabase
        .from("messaging_messages")
        .select("id")
        .eq("conversation_id", conv.id)
        .eq("direction", "outbound")
        .contains("metadata", { campaign: "hotdays" })
        .limit(1);
      if (sentMsg && sentMsg.length > 0) {
        console.log(`  ⏭️ Already sent to ${phone}, skipping`);
        return json({ status: "already_sent", customer: customerName, phone });
      }
    }

    // Get WhatsApp channel
    const { data: channel } = await supabase
      .from("messaging_channels")
      .select("id, meta_phone_number_id")
      .eq("organization_id", ORG_ID)
      .eq("channel_type", "whatsapp")
      .eq("is_active", true)
      .single();

    const phoneNumberId =
      channel?.meta_phone_number_id || Deno.env.get("META_PHONE_NUMBER_ID");

    console.log(`  🔧 Config: hasChannel=${!!channel}, phoneNumberId=${phoneNumberId ? "yes" : "NO"}, metaToken=${metaToken ? "yes(" + metaToken.substring(0,10) + "...)" : "NO"}`);

    if (!phoneNumberId || !metaToken) {
      console.error("  ❌ Missing WhatsApp config");
      return json({ status: "error", reason: "missing WhatsApp config", hasPhoneNumberId: !!phoneNumberId, hasMetaToken: !!metaToken, hasChannel: !!channel }, 500);
    }

    const headerParams = [{ type: "image" as const, image: { link: DEFAULT_HEADER_IMAGE } }];

    // Send template
    console.log(`  🚀 Sending template to ${customerName} (${phone})`);
    const result = await sendWhatsAppTemplate(
      phoneNumberId,
      metaToken,
      phone,
      DEFAULT_TEMPLATE,
      DEFAULT_LANGUAGE,
      [],
      undefined,
      headerParams
    );

    console.log(`  📤 WhatsApp API result: ok=${result.ok}, messageId=${result.messageId || "none"}, error=${JSON.stringify(result.error || null)}`);

    if (result.ok) {
      console.log(`  ✅ Sent to ${phone}`);

      // Save to messaging DB
      let conversationId = conv?.id || null;
      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from("messaging_conversations")
          .insert({
            organization_id: ORG_ID,
            external_user_id: phone,
            channel_type: "whatsapp",
            channel_id: channel?.id || null,
            user_name: customerName,
            user_identifier: phone,
            ai_managed: true,
            status: "active",
            unread_count: 0,
          })
          .select("id")
          .single();
        if (convError) {
          console.error(`  ❌ Error creating conversation: ${JSON.stringify(convError)}`);
        }
        conversationId = newConv?.id || null;
      }

      if (conversationId) {
        const { error: msgError } = await supabase.from("messaging_messages").insert({
          conversation_id: conversationId,
          external_message_id: result.messageId,
          channel_type: "whatsapp",
          direction: "outbound",
          sender_type: "agent",
          content: "🔥 Campaña HotDays — Acceso anticipado con contraseña HOTMICOS",
          message_type: "template",
          metadata: { template_name: DEFAULT_TEMPLATE, campaign: "hotdays", tag: "hotdays2" },
          sent_at: new Date().toISOString(),
        });
        if (msgError) {
          console.error(`  ❌ Error saving message: ${JSON.stringify(msgError)}`);
        } else {
          console.log(`  💾 Message saved to conversation ${conversationId}`);
        }

        const { error: updateError } = await supabase
          .from("messaging_conversations")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: "🔥 Campaña HotDays — Acceso anticipado",
          })
          .eq("id", conversationId);
        if (updateError) {
          console.error(`  ❌ Error updating conversation: ${JSON.stringify(updateError)}`);
        }
      } else {
        console.error(`  ❌ No conversationId — message NOT saved to DB`);
      }

      return json({ status: "sent", customer: customerName, phone, messageId: result.messageId });
    } else {
      console.error(`  ❌ Failed to send to ${phone}:`, result.error);
      return json({ status: "send_failed", customer: customerName, phone, error: result.error });
    }
  } catch (err: any) {
    console.error("Webhook error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
