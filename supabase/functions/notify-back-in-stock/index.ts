// notify-back-in-stock
// Daily cron target. Crosses pending back_in_stock_subscriptions against current
// inventory (product_variants.stock_quantity, synced from Shopify) and, when a
// variant is back in stock, sends the customer a WhatsApp TEMPLATE (required since
// the notification is outside the 24h window) and marks the subscription notified.
//
// Mirrors the cart-recovery-send pattern (channel resolution, template send, logging).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplate } from "../_shared/whatsapp-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TEMPLATE = Deno.env.get("WHATSAPP_BACK_IN_STOCK_TEMPLATE") || "";
const TEMPLATE_LANG = Deno.env.get("WHATSAPP_BACK_IN_STOCK_TEMPLATE_LANG") ||
  "es_CO";
const EXPIRE_DAYS = Number(Deno.env.get("BACK_IN_STOCK_EXPIRE_DAYS") || "60");
const MAX_PER_RUN = Number(Deno.env.get("BACK_IN_STOCK_MAX_PER_RUN") || "500");

type Subscription = {
  id: string;
  organization_id: string;
  conversation_id: string | null;
  channel_id: string | null;
  customer_phone: string;
  customer_name: string | null;
  product_id: string | null;
  variant_sku: string | null;
  product_name: string;
  size: string | null;
  color: string | null;
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function extractNum(value: unknown): string {
  return String(value ?? "").match(/\d+/)?.[0] || "";
}

// Human label for the message, e.g. "Sleeping Walker Poppy talla 2 rosado".
export function backInStockProductLabel(sub: Pick<Subscription, "product_name" | "size" | "color">): string {
  return [sub.product_name, sub.size ? `talla ${sub.size}` : "", sub.color || ""]
    .filter(Boolean).join(" ").trim();
}

// Template body params: {{1}} = customer name, {{2}} = product + size/color.
export function buildBackInStockBodyParams(
  sub: Pick<Subscription, "product_name" | "size" | "color" | "customer_name">,
): Array<{ type: "text"; text: string }> {
  const name = (sub.customer_name || "").trim() || "Hola";
  return [
    { type: "text", text: name },
    { type: "text", text: backInStockProductLabel(sub) },
  ];
}

// Is the subscribed variant available now? Prefer the SKU join (reliable);
// fall back to product name + size/color when no SKU was captured.
async function subscriptionIsAvailable(
  supabase: any,
  sub: Subscription,
): Promise<boolean> {
  if (sub.variant_sku) {
    const { data } = await supabase
      .from("product_variants")
      .select("stock_quantity")
      .ilike("sku_variant", sub.variant_sku)
      .limit(10);
    return (data || []).some((v: any) => Number(v.stock_quantity || 0) > 0);
  }

  // Fallback: match by product name + size/color.
  const { data: prods } = await supabase
    .from("products")
    .select("id")
    .eq("organization_id", sub.organization_id)
    .ilike("name", `%${sub.product_name}%`)
    .limit(10);
  const ids = (prods || []).map((p: any) => p.id);
  if (!ids.length) return false;

  const { data: variants } = await supabase
    .from("product_variants")
    .select("stock_quantity, size, color")
    .in("product_id", ids)
    .limit(200);

  const wantSize = sub.size ? normalizeText(sub.size) : "";
  const wantSizeNum = extractNum(sub.size);
  const wantColor = sub.color ? normalizeText(sub.color) : "";
  return (variants || []).some((v: any) => {
    if (Number(v.stock_quantity || 0) <= 0) return false;
    const vSize = normalizeText(v.size);
    const vColor = normalizeText(v.color);
    const okSize = !wantSize || vSize.includes(wantSize) ||
      (Boolean(wantSizeNum) && extractNum(v.size) === wantSizeNum);
    const okColor = !wantColor || vColor.includes(wantColor);
    return okSize && okColor;
  });
}

async function resolvePhoneNumberId(
  supabase: any,
  sub: Subscription,
  cache: Map<string, string | null>,
): Promise<string | null> {
  const key = sub.channel_id || `org:${sub.organization_id}`;
  if (cache.has(key)) return cache.get(key) || null;

  let phoneNumberId: string | null = null;
  if (sub.channel_id) {
    const { data: ch } = await supabase
      .from("messaging_channels")
      .select("meta_phone_number_id")
      .eq("id", sub.channel_id)
      .maybeSingle();
    phoneNumberId = ch?.meta_phone_number_id || null;
  }
  if (!phoneNumberId) {
    const { data: ch } = await supabase
      .from("messaging_channels")
      .select("meta_phone_number_id")
      .eq("organization_id", sub.organization_id)
      .eq("channel_type", "whatsapp")
      .eq("is_active", true)
      .maybeSingle();
    phoneNumberId = ch?.meta_phone_number_id || Deno.env.get("META_PHONE_NUMBER_ID") ||
      null;
  }
  cache.set(key, phoneNumberId);
  return phoneNumberId;
}

// Respect a prior STOP/opt-out (cart-recovery sets shopify_carts.opted_out).
async function isOptedOut(supabase: any, phone: string): Promise<boolean> {
  const { data } = await supabase
    .from("shopify_carts")
    .select("id")
    .eq("phone", phone)
    .eq("opted_out", true)
    .limit(1);
  return Boolean(data && data.length);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const META_WHATSAPP_TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Expire stale pending subscriptions.
    const expiryCutoff = new Date(Date.now() - EXPIRE_DAYS * 86400000)
      .toISOString();
    await supabase
      .from("back_in_stock_subscriptions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("status", "pending")
      .lt("created_at", expiryCutoff);

    if (!TEMPLATE || !META_WHATSAPP_TOKEN) {
      // Without an approved Meta template (or token) we cannot message outside 24h.
      console.error(
        "back-in-stock: missing WHATSAPP_BACK_IN_STOCK_TEMPLATE or META_WHATSAPP_TOKEN — cannot notify.",
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "template_or_token_not_configured",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: subs } = await supabase
      .from("back_in_stock_subscriptions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(MAX_PER_RUN);

    let checked = 0, notified = 0, skipped = 0, failed = 0;
    const phoneCache = new Map<string, string | null>();

    for (const sub of (subs || []) as Subscription[]) {
      checked++;
      try {
        if (!(await subscriptionIsAvailable(supabase, sub))) continue;
        if (await isOptedOut(supabase, sub.customer_phone)) {
          await supabase.from("back_in_stock_subscriptions")
            .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", sub.id);
          skipped++;
          continue;
        }

        const phoneNumberId = await resolvePhoneNumberId(supabase, sub, phoneCache);
        if (!phoneNumberId) {
          skipped++;
          continue;
        }

        const result = await sendWhatsAppTemplate(
          phoneNumberId,
          META_WHATSAPP_TOKEN,
          sub.customer_phone,
          TEMPLATE,
          TEMPLATE_LANG,
          buildBackInStockBodyParams(sub),
        );

        if (!result.ok) {
          failed++;
          console.error(
            `back-in-stock send failed for sub ${sub.id}:`,
            JSON.stringify(result.error)?.slice(0, 300),
          );
          continue;
        }

        const now = new Date().toISOString();
        await supabase.from("back_in_stock_subscriptions")
          .update({ status: "notified", notified_at: now, updated_at: now })
          .eq("id", sub.id);

        if (sub.conversation_id) {
          await supabase.from("messaging_messages").insert({
            conversation_id: sub.conversation_id,
            external_message_id: result.messageId || null,
            channel_type: "whatsapp",
            direction: "outbound",
            sender_type: "agent",
            content: `Notificación: ${backInStockProductLabel(sub)} ya está disponible.`,
            message_type: "template",
            metadata: {
              source: "back_in_stock",
              template_name: TEMPLATE,
              template_language: TEMPLATE_LANG,
              subscription_id: sub.id,
            },
            sent_at: now,
          });
        }
        notified++;
      } catch (err: any) {
        failed++;
        console.error(`back-in-stock error on sub ${sub.id}:`, err?.message || err);
      }
    }

    console.log(
      `back-in-stock: checked=${checked} notified=${notified} skipped=${skipped} failed=${failed}`,
    );
    return new Response(
      JSON.stringify({ success: true, checked, notified, skipped, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("notify-back-in-stock fatal:", error?.message || error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
