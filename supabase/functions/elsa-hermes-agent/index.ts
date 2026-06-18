// Elsa-Hermes bridge for Sewdle Messaging AI
//
// Purpose:
// - Keep Sewdle as inbox/system of record.
// - Use Elsa (isolated Hermes Agent profile) as the reasoning + memory layer.
// - Preserve a safe fallback to OpenAI if Hermes is unreachable.
//
// Required env for Hermes mode:
//   HERMES_API_URL=https://<reachable-elsa-host>/v1  OR http://127.0.0.1:8644/v1 for local tests
//   HERMES_API_KEY=<Elsa API_SERVER_KEY>
// Optional:
//   HERMES_MODEL=elsa
//   OPENAI_API_KEY=<fallback>

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import {
  buildElsaPrompt,
  type ChatMessage,
  type ElsaStructuredResponse,
  extractHermesOutputText,
  extractJsonObject,
  looksLikeProviderError,
  normalizeChannelKnowledge,
  safeSnippet,
  textFromMessageContent,
} from "../_shared/elsa-hermes-core.ts";
import {
  buildImageScreenshotFallbackReply,
  buildVisionImageContent,
  contentHasImageSignal,
  mergeImageContextWithRecentUserTexts,
  shouldReplaceGenericImageReply,
} from "../_shared/image-ocr.ts";
import {
  buildPaymentLinkMissingUrlFallbackReply,
  shouldReplacePaymentLinkReplyWithoutUrl,
} from "../_shared/payment-link-reply-guard.ts";
import {
  buildAddiPaymentRequest,
  buildBoldPaymentLinkRequest,
  buildManualTransferDraftOrderRequest,
  buildShopifyCodOrderRequest,
  type CommerceProduct,
  formatShopifyOrderCreatedReply,
  type ManualTransferDraftOrderRequest,
  resolveBackInStockTarget,
  summarizeCommerceCatalogForPrompt,
} from "../_shared/elsa-commerce.ts";
import {
  buildProductSearchContext,
  buildVisualCandidateInstruction,
  extractVisualCandidateSearchTerms,
  hasVisualCandidateSearchSignal,
  searchRelevantProducts,
} from "../_shared/product-matching.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type CommerceActionResult = {
  type: string;
  success: boolean;
  reason?: string;
  duplicate_blocked?: boolean;
  paymentUrl?: string;
  paymentLinkId?: string;
  orderNumber?: string;
  orderId?: string | number;
};

type ReferencedShopifyOrder = {
  shopify_order_id: string | number;
  order_number: string;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  tags?: string | null;
  note?: string | null;
  shipping_address?: Record<string, unknown> | null;
  total_price?: string | number | null;
  created_at_shopify?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  picking?: {
    operational_status?: string | null;
    internal_notes?: string | null;
    packed_at?: string | null;
    shipped_at?: string | null;
  } | null;
  canModify: boolean;
  lockedReason?: string;
};

function normalizeOrderNumber(value: unknown): string | null {
  const digits = String(value ?? "").match(/\d{4,10}/)?.[0] || "";
  return digits || null;
}

function extractMentionedOrderNumberFromText(text: string): string | null {
  const direct = text.match(/#\s*(\d{4,10})/);
  if (direct?.[1]) return direct[1];
  const contextual = text.match(
    /(?:pedido|orden|order|compra)\s*(?:n[uú]mero|nro|no\.?|#)?\s*(\d{4,10})/i,
  );
  return contextual?.[1] || null;
}

function mergeCommaTags(existing: unknown, toAdd: unknown): string {
  const existingTags = String(existing || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const addTags = (Array.isArray(toAdd) ? toAdd : [toAdd])
    .map((tag) => String(tag || "").trim())
    .filter(Boolean);
  const seen = new Set(existingTags.map((tag) => tag.toLowerCase()));
  for (const tag of addTags) {
    if (!seen.has(tag.toLowerCase())) {
      existingTags.push(tag);
      seen.add(tag.toLowerCase());
    }
  }
  return existingTags.join(", ");
}

function appendOperationalNote(existing: unknown, note: unknown): string {
  const cleanNote = safeSnippet(note, 1200);
  if (!cleanNote) return String(existing || "").trim();
  const prefix = new Date().toISOString().slice(0, 10);
  const appended = `[WhatsApp Elsa ${prefix}] ${cleanNote}`;
  const current = String(existing || "").trim();
  if (!current) return appended;
  if (current.includes(cleanNote)) return current;
  return `${current}\n${appended}`;
}

function isReferencedOrderLocked(order: any, picking?: any) {
  const tags = String(order?.tags || "").toLowerCase();
  const fulfillment = String(order?.fulfillment_status || "").toLowerCase();
  const status = String(picking?.operational_status || "").toLowerCase();
  if (order?.cancelled_at) return { locked: true, reason: "cancelled" };
  if (fulfillment === "fulfilled") return { locked: true, reason: "fulfilled" };
  if (["ready_to_ship", "awaiting_pickup", "shipped"].includes(status)) {
    return { locked: true, reason: status };
  }
  if (picking?.shipped_at) return { locked: true, reason: "shipped_at" };
  if (tags.includes("empacado") || tags.includes("enviado")) {
    return { locked: true, reason: "tag_locked" };
  }
  return { locked: false, reason: "" };
}

async function fetchCommerceCatalog(
  supabase: any,
  organizationId?: string,
): Promise<CommerceProduct[]> {
  if (!organizationId) return [];

  try {
    const { data: connections } = await supabase
      .from("ai_catalog_connections")
      .select("shopify_product_id")
      .eq("organization_id", organizationId)
      .eq("connected", true);
    const connectedProductIds = new Set(
      (connections || []).map((connection: any) =>
        String(connection.shopify_product_id)
      ),
    );

    const { data: org } = await supabase
      .from("organizations")
      .select("shopify_credentials")
      .eq("id", organizationId)
      .maybeSingle();
    const creds = org?.shopify_credentials || {};
    const shopifyDomain = creds.store_domain || creds.shopDomain;
    const accessToken = creds.access_token || creds.accessToken;
    if (!shopifyDomain || !accessToken) return [];

    const response = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/products.json?status=active&limit=250`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) {
      console.warn(
        "Could not fetch Shopify catalog for Elsa commerce:",
        response.status,
      );
      return [];
    }

    const data = await response.json();
    const products = (data.products || []) as CommerceProduct[];
    return products.filter((product) =>
      connectedProductIds.size === 0 ||
      connectedProductIds.has(String(product.id))
    );
  } catch (error: any) {
    console.warn("Commerce catalog fetch failed:", error?.message || error);
    return [];
  }
}

async function findExistingPaymentFlow(
  supabase: any,
  params: { conversationId?: string; customerPhone?: string },
) {
  const columns =
    "id, status, payment_provider, bold_payment_url, bold_payment_link_id, addi_payment_url, addi_application_id, total_amount, line_items, shipping_cost, shopify_order_id, shopify_order_number, created_at";
  const activeStatuses = ["pending_payment", "paid", "order_created", "pending_transfer_validation"];

  if (params.conversationId) {
    const { data } = await supabase
      .from("pending_orders")
      .select(columns)
      .eq("conversation_id", params.conversationId)
      .in("status", activeStatuses)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data?.[0]) return data[0];
  }

  if (params.customerPhone) {
    const cleanPhone = String(params.customerPhone).replace(/[\s+]/g, "");
    const { data } = await supabase
      .from("pending_orders")
      .select(columns)
      .eq("customer_phone", cleanPhone)
      .in("status", activeStatuses)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data?.[0]) return data[0];
  }

  return null;
}

function splitCustomerNameForShopify(customerName: string) {
  const parts = String(customerName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Cliente",
    lastName: parts.slice(1).join(" "),
  };
}

function transferPaymentLabel(paymentMethod: unknown): string {
  const method = String(paymentMethod || "").toLowerCase();
  if (method.includes("nequi")) return "Nequi";
  if (method.includes("bancolombia")) return "Bancolombia";
  return "transferencia";
}

async function ensureConversationTag(
  supabase: any,
  params: { organizationId?: string; conversationId?: string; name: string; color: string },
) {
  if (!params.organizationId || !params.conversationId) return null;
  const { data: existing } = await supabase
    .from("messaging_conversation_tags")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("name", params.name)
    .maybeSingle();

  let tagId = existing?.id || null;
  if (!tagId) {
    const { data: inserted, error } = await supabase
      .from("messaging_conversation_tags")
      .insert({
        organization_id: params.organizationId,
        name: params.name,
        color: params.color,
      })
      .select("id")
      .single();
    if (error) {
      console.warn(`Could not create conversation tag ${params.name}:`, error.message || error);
    }
    tagId = inserted?.id || null;
  }

  if (tagId) {
    await supabase
      .from("messaging_conversation_tag_assignments")
      .upsert(
        { conversation_id: params.conversationId, tag_id: tagId },
        { onConflict: "conversation_id,tag_id" },
      );
  }
  return tagId;
}

async function removeConversationTag(
  supabase: any,
  params: { organizationId?: string; conversationId?: string; name: string },
) {
  if (!params.organizationId || !params.conversationId) return;
  const { data: tag } = await supabase
    .from("messaging_conversation_tags")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("name", params.name)
    .maybeSingle();
  if (!tag?.id) return;
  await supabase
    .from("messaging_conversation_tag_assignments")
    .delete()
    .eq("conversation_id", params.conversationId)
    .eq("tag_id", tag.id);
}

async function createManualTransferDraftOrder(
  supabase: any,
  request: ManualTransferDraftOrderRequest,
) {
  const { data: org } = await supabase
    .from("organizations")
    .select("shopify_credentials")
    .eq("id", request.organizationId)
    .maybeSingle();
  const creds = org?.shopify_credentials || {};
  const shopifyDomain = creds.store_domain || creds.shopDomain;
  const accessToken = creds.access_token || creds.accessToken;
  if (!shopifyDomain || !accessToken) {
    throw new Error("No hay credenciales de Shopify configuradas");
  }

  const { firstName, lastName } = splitCustomerNameForShopify(request.orderData.customerName);
  const transferLabel = transferPaymentLabel(request.orderData.paymentMethod);
  const draftPayload: any = {
    draft_order: {
      line_items: request.orderData.lineItems.map((item: any) => ({
        variant_id: item.variantId,
        quantity: item.quantity || 1,
      })),
      email: request.orderData.email,
      note: [
        request.orderData.notes || "",
        `Pago por ${transferLabel} pendiente por validar con comprobante`,
      ].filter(Boolean).join(" | "),
      tags: "whatsapp, messaging, Transferencia, Pago por validar, Comprobante recibido",
      shipping_address: {
        first_name: firstName,
        last_name: lastName,
        company: request.orderData.cedula || "",
        address1: request.orderData.address,
        city: request.orderData.city,
        province: request.orderData.department,
        country: "CO",
        phone: request.orderData.phone,
      },
      billing_address: {
        first_name: firstName,
        last_name: lastName,
        company: request.orderData.cedula || "",
        address1: request.orderData.address,
        city: request.orderData.city,
        province: request.orderData.department,
        country: "CO",
        phone: request.orderData.phone,
      },
      note_attributes: [
        { name: "payment_method", value: transferLabel },
        { name: "payment_status", value: "Pago por validar" },
        ...(request.conversationId ? [{ name: "sewdle_conversation_id", value: request.conversationId }] : []),
      ],
    },
  };

  if (Number(request.orderData.shippingCost || 0) > 0) {
    draftPayload.draft_order.shipping_line = {
      title: "Envío",
      price: String(request.orderData.shippingCost),
    };
  }

  const response = await fetch(`https://${shopifyDomain}/admin/api/2024-01/draft_orders.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(draftPayload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Shopify draft order error ${response.status}: ${details.slice(0, 500)}`);
  }

  const json = await response.json();
  const draftOrder = json.draft_order || {};
  return {
    draftOrderId: draftOrder.id,
    draftOrderName: draftOrder.name || draftOrder.id,
    totalPrice: draftOrder.total_price || request.totalAmount,
    invoiceUrl: draftOrder.invoice_url || null,
  };
}

function latestUserThreadText(messages: ChatMessage[], limit = 4): string {
  return [...messages]
    .filter((message) => message.role === "user")
    .slice(-limit)
    .map((message) => textFromMessageContent(message.content))
    .filter(Boolean)
    .join("\n");
}

async function maybeReplyWithExistingPaymentLink(
  supabase: any,
  params: {
    messages: ChatMessage[];
    result: ElsaStructuredResponse & { provider: string; raw?: string };
    conversationId?: string;
  },
) {
  const paymentThreadText = latestUserThreadText(params.messages);
  if (!shouldReplacePaymentLinkReplyWithoutUrl(params.result.reply, [], paymentThreadText)) {
    return null;
  }

  const existing = await findExistingPaymentFlow(supabase, {
    conversationId: params.conversationId,
  });

  if (existing?.status === "pending_payment" && existing.bold_payment_url) {
    params.result.reply = `Claro 😊 tu link de pago sigue activo:
${existing.bold_payment_url}

Total: $${Number(existing.total_amount || 0).toLocaleString("es-CO")} COP. Apenas Bold confirme el pago, creamos tu pedido automáticamente 🙌`;
    params.result.handoff_required = false;
    params.result.handoff_reason = "";
    return {
      type: "send_payment_link",
      success: true,
      duplicate_blocked: true,
      paymentUrl: existing.bold_payment_url,
      reason: "pending_payment_resend",
    } as CommerceActionResult;
  }

  params.result.reply = buildPaymentLinkMissingUrlFallbackReply();
  params.result.handoff_required = true;
  params.result.handoff_reason = "payment_link_missing_url";
  return {
    type: "send_payment_link",
    success: false,
    reason: "payment_link_missing_url",
  } as CommerceActionResult;
}

function shouldReplaceGenericOrderHandoff(
  result: ElsaStructuredResponse,
): boolean {
  const reply = String(result.reply || "").toLowerCase();
  if (!reply) return false;
  return reply.includes("no tengo esa información") ||
    reply.includes("no tengo esa informacion") ||
    reply.includes("te conecto con el equipo") ||
    reply.includes("crear el pedido");
}

function normalizeGreetingText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isVagueGreetingText(text: string): boolean {
  const normalized = normalizeGreetingText(text);
  if (!normalized) return false;

  const commonOpeners = [
    "hola",
    "hola necesito ayuda",
    "buenos dias",
    "buenas tardes",
    "buenas noches",
    "buenas",
    "necesito ayuda",
    "ayuda",
    "hello",
    "hi",
  ];

  if (commonOpeners.includes(normalized)) return true;

  const words = normalized.split(" ").filter(Boolean);
  return words.length <= 3 && (
    normalized.includes("hola") ||
    normalized.includes("buen") ||
    normalized.includes("ayuda")
  );
}

function shouldReplaceGenericGreetingReply(
  result: ElsaStructuredResponse,
  latestUserText: string,
): boolean {
  const reply = String(result.reply || "").toLowerCase();
  if (!reply) return false;
  if (!isVagueGreetingText(latestUserText)) return false;

  return reply.includes("no tengo esa información") ||
    reply.includes("no tengo esa informacion") ||
    reply.includes("te conecto con el equipo") ||
    reply.includes("te conecto") ||
    reply.includes("no tengo esa respuesta");
}

async function findLatestCreatedOrderForConversation(
  supabase: any,
  conversationId?: string,
) {
  if (!conversationId) return null;
  const { data } = await supabase
    .from("pending_orders")
    .select(
      "id, status, total_amount, line_items, shipping_cost, shopify_order_number, created_at",
    )
    .eq("conversation_id", conversationId)
    .eq("status", "order_created")
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

async function attachPickingState(
  supabase: any,
  organizationId: string | undefined,
  order: any,
): Promise<ReferencedShopifyOrder | null> {
  if (!order) return null;
  let picking: any = null;
  if (organizationId && order.shopify_order_id) {
    const { data } = await supabase
      .from("picking_packing_orders")
      .select("operational_status, internal_notes, packed_at, shipped_at")
      .eq("organization_id", organizationId)
      .eq("shopify_order_id", order.shopify_order_id)
      .maybeSingle();
    picking = data || null;
  }

  const lock = isReferencedOrderLocked(order, picking);
  return {
    ...order,
    picking,
    canModify: !lock.locked,
    lockedReason: lock.reason,
  };
}

async function findReferencedShopifyOrder(
  supabase: any,
  params: {
    organizationId?: string;
    orderNumber?: unknown;
    shopifyOrderId?: unknown;
  },
): Promise<ReferencedShopifyOrder | null> {
  if (!params.organizationId) return null;

  const columns =
    "shopify_order_id, order_number, financial_status, fulfillment_status, tags, note, shipping_address, total_price, created_at_shopify, customer_phone, customer_email, cancelled_at";
  let order: any = null;
  const shopifyOrderId = String(params.shopifyOrderId || "").trim();
  if (shopifyOrderId) {
    const { data } = await supabase
      .from("shopify_orders")
      .select(columns)
      .eq("organization_id", params.organizationId)
      .eq("shopify_order_id", shopifyOrderId)
      .maybeSingle();
    order = data || null;
  }

  const orderNumber = normalizeOrderNumber(params.orderNumber);
  if (!order && orderNumber) {
    const { data } = await supabase
      .from("shopify_orders")
      .select(columns)
      .eq("organization_id", params.organizationId)
      .in("order_number", [orderNumber, `#${orderNumber}`])
      .order("created_at_shopify", { ascending: false })
      .limit(1);
    order = data?.[0] || null;
  }

  return attachPickingState(supabase, params.organizationId, order);
}

function summarizeReferencedOrderForPrompt(order: ReferencedShopifyOrder) {
  return {
    orderNumber: order.order_number,
    shopifyOrderId: String(order.shopify_order_id),
    financialStatus: order.financial_status || null,
    fulfillmentStatus: order.fulfillment_status || null,
    operationalStatus: order.picking?.operational_status || null,
    canModify: order.canModify,
    lockedReason: order.lockedReason || null,
    notePresent: Boolean(order.note),
    tags: order.tags || null,
    totalPrice: order.total_price || null,
    shippingAddressPresent: Boolean(order.shipping_address),
  };
}

async function maybeReplyWithExistingCreatedOrder(
  supabase: any,
  params: {
    result: ElsaStructuredResponse & { provider: string; raw?: string };
    conversationId?: string;
  },
) {
  if (!shouldReplaceGenericOrderHandoff(params.result)) return null;
  const existing = await findLatestCreatedOrderForConversation(
    supabase,
    params.conversationId,
  );
  if (!existing?.shopify_order_number) return null;

  params.result.reply = formatShopifyOrderCreatedReply({
    orderNumber: existing.shopify_order_number,
    totalAmount: existing.total_amount,
    lineItems: existing.line_items,
  });
  params.result.handoff_required = false;
  params.result.handoff_reason = "";
  return existing;
}

async function maybeReplyWithWarmGreeting(
  params: {
    messages: ChatMessage[];
    result: ElsaStructuredResponse & { provider: string; raw?: string };
  },
) {
  const latestUserMessage = [...params.messages]
    .reverse()
    .find((message) => message.role === "user");
  const latestUserText = textFromMessageContent(latestUserMessage?.content);

  if (!shouldReplaceGenericGreetingReply(params.result, latestUserText)) {
    return false;
  }

  params.result.reply = "Hola 😊 claro, ¿en qué te ayudo?";
  params.result.handoff_required = false;
  params.result.handoff_reason = "";
  params.result.confidence = Math.max(Number(params.result.confidence || 0), 0.75);
  return true;
}

function findLatestImageContextMessage(messages: ChatMessage[]): ChatMessage | undefined {
  return [...messages]
    .reverse()
    .find((message) => message.role === "user" && contentHasImageSignal(message.content));
}

function findLatestImageContextIndex(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && contentHasImageSignal(message.content)) return index;
  }
  return -1;
}

async function maybeReplyWithImageScreenshotFallback(
  params: {
    messages: ChatMessage[];
    result: ElsaStructuredResponse & { provider: string; raw?: string };
  },
) {
  const latestUserMessage = [...params.messages]
    .reverse()
    .find((message) => message.role === "user");
  const latestImageIndex = findLatestImageContextIndex(params.messages);
  if (!latestUserMessage || latestImageIndex < 0) return false;
  const latestImageMessage = params.messages[latestImageIndex];
  const recentUserContents = params.messages
    .slice(latestImageIndex)
    .filter((message) => message.role === "user")
    .map((message) => message.content);

  const imageContextForFallback = mergeImageContextWithRecentUserTexts(
    latestImageMessage.content,
    recentUserContents,
  );

  if (!shouldReplaceGenericImageReply(params.result.reply, imageContextForFallback)) {
    return false;
  }

  params.result.reply = buildImageScreenshotFallbackReply(imageContextForFallback);
  params.result.handoff_required = false;
  params.result.handoff_reason = "";
  params.result.confidence = Math.max(Number(params.result.confidence || 0), 0.82);
  if (!params.result.actions?.length || params.result.actions?.some((action) => action.type === "handoff")) {
    params.result.actions = [{ type: "collect_order_data", reason: "readable_product_screenshot_checkout" }];
  }
  return true;
}

async function executeExistingOrderModificationAction(
  supabase: any,
  params: {
    action: any;
    result: ElsaStructuredResponse & { provider: string; raw?: string };
    organizationId?: string;
  },
): Promise<CommerceActionResult> {
  const payload = params.action?.payload || {};
  const order = await findReferencedShopifyOrder(supabase, {
    organizationId: params.organizationId,
    orderNumber: payload.orderNumber,
    shopifyOrderId: payload.shopifyOrderId,
  });

  if (!order) {
    params.result.handoff_required = true;
    params.result.handoff_reason =
      "Elsa no encontró el pedido existente para registrar la instrucción.";
    params.result.reply =
      "Te ayudo con eso 😊 Me confirmas porfa el número del pedido para dejar la nota correcta.";
    return {
      type: "update_existing_order",
      success: false,
      reason: "order_not_found",
    };
  }

  if (!order.canModify) {
    params.result.handoff_required = true;
    params.result.handoff_reason =
      `Pedido existente no modificable automáticamente: ${
        order.lockedReason || "locked"
      }.`;
    params.result.reply =
      `Ya revisé el pedido #${order.order_number} y está en proceso avanzado de empaque/despacho. Te conecto con el equipo para revisar si todavía alcanzamos a hacer el ajuste 🙏`;
    return {
      type: "update_existing_order",
      success: false,
      reason: `order_locked:${order.lockedReason || "locked"}`,
      orderNumber: order.order_number,
      orderId: order.shopify_order_id,
    };
  }

  const noteText = safeSnippet(
    payload.note || payload.internalNote || payload.instructions ||
      params.action.reason,
    1200,
  );
  const tags = payload.tags || ["Regalo"];
  const updatedNote = appendOperationalNote(order.note, noteText);
  const updatedInternalNote = appendOperationalNote(
    order.picking?.internal_notes,
    payload.internalNote || noteText,
  );
  const updatedTags = mergeCommaTags(order.tags, tags);

  const noteInvoke = await supabase.functions.invoke(
    "update-shopify-order-note",
    {
      body: {
        shopifyOrderId: String(order.shopify_order_id),
        note: updatedNote,
      },
    },
  );

  if (noteInvoke.error || noteInvoke.data?.error) {
    params.result.handoff_required = true;
    params.result.handoff_reason =
      "Falló el registro automático de la nota en el pedido existente.";
    params.result.reply =
      `Te conecto con el equipo para dejar esa nota en el pedido #${order.order_number} y evitar que se empaque sin la instrucción 🙏`;
    return {
      type: "update_existing_order",
      success: false,
      reason: noteInvoke.error?.message || noteInvoke.data?.error ||
        "note_update_failed",
      orderNumber: order.order_number,
      orderId: order.shopify_order_id,
    };
  }

  const tagInvoke = await supabase.functions.invoke("update-shopify-order", {
    body: {
      orderId: String(order.shopify_order_id),
      action: "add_tags",
      data: { tags },
    },
  });

  await supabase
    .from("shopify_orders")
    .update({
      note: updatedNote || null,
      tags: tagInvoke.data?.finalTags?.join?.(", ") || updatedTags || null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", params.organizationId)
    .eq("shopify_order_id", order.shopify_order_id);

  if (order.picking) {
    await supabase
      .from("picking_packing_orders")
      .update({
        internal_notes: updatedInternalNote || null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", params.organizationId)
      .eq("shopify_order_id", order.shopify_order_id);
  }

  params.result.handoff_required = false;
  params.result.handoff_reason = "";
  params.result.reply =
    `Listo 😊 dejé la nota en el pedido #${order.order_number} para que el equipo lo tenga presente antes de empacar.`;

  return {
    type: "update_existing_order",
    success: true,
    reason: tagInvoke.error || tagInvoke.data?.success === false
      ? "note_saved_tag_sync_failed"
      : "note_and_tags_saved",
    orderNumber: order.order_number,
    orderId: order.shopify_order_id,
  };
}

// "Avísame cuando vuelva": resolve the product/variant the customer wants, then
// store a pending subscription. The daily notify-back-in-stock cron will message
// them when the variant is back in stock. Notification is by WhatsApp (this chat),
// so we capture the conversation's phone + channel — no email needed.
async function executeBackInStockSubscriptionAction(
  supabase: any,
  params: {
    action: any;
    result: ElsaStructuredResponse & { provider: string; raw?: string };
    catalog: CommerceProduct[];
    organizationId?: string;
    conversationId?: string;
  },
): Promise<CommerceActionResult> {
  const payload = params.action?.payload || {};
  const productName = String(payload.productName || "").trim();
  const size = payload.size != null ? String(payload.size).trim() : "";
  const color = payload.color != null ? String(payload.color).trim() : "";

  if (!productName) {
    return { type: "subscribe_back_in_stock", success: false, reason: "missing_product" };
  }

  const target = resolveBackInStockTarget(params.catalog, { productName, size, color });
  if (!target) {
    // Could not match a real product — let Elsa ask instead of storing a vague row.
    return {
      type: "subscribe_back_in_stock",
      success: false,
      reason: "product_not_resolved",
    };
  }

  // Need the customer's WhatsApp identity + channel to notify later.
  let customerPhone = "";
  let channelId: string | null = null;
  let customerName: string | null = null;
  if (params.conversationId) {
    const { data: conv } = await supabase
      .from("messaging_conversations")
      .select("external_user_id, user_name, channel_id")
      .eq("id", params.conversationId)
      .maybeSingle();
    customerPhone = String(conv?.external_user_id || "").trim();
    channelId = conv?.channel_id || null;
    customerName = conv?.user_name || null;
  }
  if (!customerPhone) {
    return { type: "subscribe_back_in_stock", success: false, reason: "no_customer_phone" };
  }

  const productLabel = [
    target.productTitle || productName,
    size ? `talla ${size}` : "",
    color || "",
  ].filter(Boolean).join(" ");

  try {
    const { error } = await supabase
      .from("back_in_stock_subscriptions")
      .insert({
        organization_id: params.organizationId,
        conversation_id: params.conversationId || null,
        channel_id: channelId,
        customer_phone: customerPhone,
        customer_name: customerName,
        product_id: target.productId != null ? String(target.productId) : null,
        variant_sku: target.sku || null,
        product_name: target.productTitle || productName,
        size: size || null,
        color: color || null,
        status: "pending",
      });
    // 23505 = unique violation → already subscribed; treat as success (idempotent).
    if (error && error.code !== "23505") throw error;

    params.result.reply =
      `Listo 😊 te aviso por aquí apenas vuelva ${productLabel}. ¡Gracias por la paciencia! 🙌`;
    params.result.handoff_required = false;
    params.result.handoff_reason = "";
    return { type: "subscribe_back_in_stock", success: true, reason: "subscribed" };
  } catch (error: any) {
    console.error("back_in_stock subscription insert failed:", error?.message || error);
    return {
      type: "subscribe_back_in_stock",
      success: false,
      reason: error?.message || "insert_failed",
    };
  }
}

async function executeCommerceActions(
  supabase: any,
  params: {
    result: ElsaStructuredResponse & { provider: string; raw?: string };
    catalog: CommerceProduct[];
    messages: ChatMessage[];
    organizationId?: string;
    conversationId?: string;
  },
): Promise<{
  result: ElsaStructuredResponse & { provider: string; raw?: string };
  actionResults: CommerceActionResult[];
}> {
  const actionResults: CommerceActionResult[] = [];
  if (!params.organizationId) return { result: params.result, actionResults };

  const actions = params.result.actions || [];
  const existingOrderAction = actions.find((action: any) =>
    action?.type === "update_existing_order"
  );
  if (existingOrderAction) {
    const actionResult = await executeExistingOrderModificationAction(
      supabase,
      {
        action: existingOrderAction,
        result: params.result,
        organizationId: params.organizationId,
      },
    );
    actionResults.push(actionResult);
    return { result: params.result, actionResults };
  }

  const backInStockAction = actions.find((action: any) =>
    action?.type === "subscribe_back_in_stock"
  );
  if (backInStockAction) {
    const actionResult = await executeBackInStockSubscriptionAction(supabase, {
      action: backInStockAction,
      result: params.result,
      catalog: params.catalog,
      organizationId: params.organizationId,
      conversationId: params.conversationId,
    });
    actionResults.push(actionResult);
    return { result: params.result, actionResults };
  }

  const paymentAction = actions.find((action: any) => {
    const method = String(action?.payload?.paymentMethod || "").toLowerCase();
    return action?.type === "send_addi_payment_request" ||
      action?.type === "send_payment_link" ||
      action?.type === "create_shopify_order" ||
      (action?.type === "create_order_draft" &&
        [
          "link_de_pago",
          "pse",
          "addi",
          "contra_entrega",
          "contra entrega",
          "cod",
          "cash_on_delivery",
          "bancolombia",
          "nequi",
          "bank_transfer",
          "manual_transfer",
          "transferencia",
        ].includes(method));
  });
  if (!paymentAction?.payload) {
    const existingPaymentLink = await maybeReplyWithExistingPaymentLink(supabase, {
      result: params.result,
      messages: params.messages,
      conversationId: params.conversationId,
    });
    if (existingPaymentLink) {
      actionResults.push(existingPaymentLink);
      return { result: params.result, actionResults };
    }

    const existing = await maybeReplyWithExistingCreatedOrder(supabase, {
      result: params.result,
      conversationId: params.conversationId,
    });
    if (existing) {
      actionResults.push({
        type: "existing_shopify_order_reply",
        success: true,
        duplicate_blocked: true,
        orderNumber: String(existing.shopify_order_number),
      });
    }
    return { result: params.result, actionResults };
  }

  const payload = paymentAction.payload as Record<string, any>;
  const paymentMethod = String(payload.paymentMethod || "").toLowerCase();
  const isAddiAction = paymentAction.type === "send_addi_payment_request" ||
    paymentMethod === "addi";
  const isCodAction = paymentAction.type === "create_shopify_order" ||
    ["contra_entrega", "contra entrega", "cod", "cash_on_delivery"].includes(
      paymentMethod,
    );
  const isManualTransferAction = paymentAction.type === "create_order_draft" &&
    ["bancolombia", "nequi", "bank_transfer", "manual_transfer", "transferencia"].includes(
      paymentMethod,
    );
  const existing = await findExistingPaymentFlow(supabase, {
    conversationId: params.conversationId,
    customerPhone: payload.phone || payload.customerPhone,
  });

  if (existing?.status === "pending_transfer_validation" && isManualTransferAction) {
    params.result.reply =
      "Gracias 😊 ya recibimos tu comprobante y el pedido quedó listo para validación de pago. Apenas el equipo confirme la transferencia, continuamos 🙌";
    params.result.handoff_required = false;
    params.result.handoff_reason = "";
    actionResults.push({
      type: String(paymentAction.type),
      success: true,
      duplicate_blocked: true,
      reason: "pending_transfer_validation",
      orderId: existing.shopify_order_id,
      orderNumber: existing.shopify_order_number,
    });
    return { result: params.result, actionResults };
  }

  if (existing?.status === "pending_payment") {
    const existingUrl = isAddiAction
      ? existing.addi_payment_url || existing.bold_payment_url
      : existing.bold_payment_url;
    if (existingUrl) {
      params.result.reply = isAddiAction
        ? `Listo 😊 tu solicitud de pago con Addi sigue activa:
${existingUrl}

Total: $${
          Number(existing.total_amount || 0).toLocaleString("es-CO")
        } COP. Cuando Addi apruebe la compra, creamos tu pedido automáticamente 🙌`
        : `Listo 😊 tu link de pago sigue activo:
${existingUrl}

Total: $${
          Number(existing.total_amount || 0).toLocaleString("es-CO")
        } COP. Apenas Bold confirme el pago, creamos tu pedido automáticamente 🙌`;
      actionResults.push({
        type: String(paymentAction.type),
        success: true,
        duplicate_blocked: true,
        paymentUrl: existingUrl,
        reason: "pending_payment",
      });
      return { result: params.result, actionResults };
    }
    const existingAddiApplicationId = existing.addi_application_id ||
      (isAddiAction ? existing.bold_payment_link_id : null);
    if (isAddiAction && existingAddiApplicationId) {
      params.result.reply =
        `Listo 😊 la solicitud con Addi sigue activa. Revisa la notificación de Addi para aprobar la compra. Total: $${
          Number(existing.total_amount || 0).toLocaleString("es-CO")
        } COP.`;
      actionResults.push({
        type: String(paymentAction.type),
        success: true,
        duplicate_blocked: true,
        reason: "pending_payment",
      });
      return { result: params.result, actionResults };
    }
  }

  if (existing?.status === "order_created") {
    params.result.reply = formatShopifyOrderCreatedReply({
      orderNumber: existing.shopify_order_number,
      totalAmount: existing.total_amount,
      lineItems: existing.line_items,
    });
    actionResults.push({
      type: String(paymentAction.type),
      success: true,
      duplicate_blocked: true,
      reason: "order_created",
    });
    return { result: params.result, actionResults };
  }

  if (!params.catalog.length) {
    actionResults.push({
      type: String(paymentAction.type),
      success: false,
      reason: "catalog_unavailable",
    });
    params.result.reply = isCodAction
      ? "Ya tengo tus datos para pago contra entrega 😊 Te conecto con el equipo para validar disponibilidad y crear el pedido."
      : isAddiAction
      ? "Ya tengo el método de pago por Addi 😊 Te conecto con el equipo para validar disponibilidad y enviarte la solicitud."
      : "Ya tengo el método de pago por PSE 😊 Te conecto con el equipo para validar disponibilidad y enviarte el link de pago.";
    params.result.handoff_required = true;
    params.result.handoff_reason = isCodAction
      ? "No hay catálogo Shopify disponible para crear pedido contra entrega automáticamente."
      : isAddiAction
      ? "No hay catálogo Shopify disponible para crear solicitud Addi automáticamente."
      : "No hay catálogo Shopify disponible para crear link Bold automáticamente.";
    return { result: params.result, actionResults };
  }

  const built = isCodAction
    ? buildShopifyCodOrderRequest({
      payload,
      catalog: params.catalog,
      organizationId: params.organizationId,
      conversationId: params.conversationId,
    })
    : isManualTransferAction
    ? buildManualTransferDraftOrderRequest({
      payload,
      catalog: params.catalog,
      organizationId: params.organizationId,
      conversationId: params.conversationId,
    })
    : isAddiAction
    ? buildAddiPaymentRequest({
      payload,
      catalog: params.catalog,
      organizationId: params.organizationId,
      conversationId: params.conversationId,
    })
    : buildBoldPaymentLinkRequest({
      payload,
      catalog: params.catalog,
      organizationId: params.organizationId,
      conversationId: params.conversationId,
    });

  if (built.ok === false) {
    actionResults.push({
      type: String(paymentAction.type),
      success: false,
      reason: `missing_or_invalid:${built.errors.join(",")}`,
    });
    return { result: params.result, actionResults };
  }

  if (isCodAction) {
    const codRequest = built.request as any;
    const { data, error } = await supabase.functions.invoke(
      "create-shopify-order",
      { body: codRequest },
    );

    if (error || !data?.orderNumber) {
      console.error(
        "Elsa COD Shopify order action failed:",
        error?.message || "no_order_number",
      );
      actionResults.push({
        type: String(paymentAction.type),
        success: false,
        reason: error?.message || "no_order_number",
      });
      params.result.reply =
        "Ya tengo tus datos para pago contra entrega 😊 Te conecto con el equipo para crear el pedido.";
      params.result.handoff_required = true;
      params.result.handoff_reason =
        "Falló la creación automática del pedido contra entrega en Shopify.";
      return { result: params.result, actionResults };
    }

    await supabase.from("pending_orders").insert({
      organization_id: params.organizationId,
      conversation_id: params.conversationId,
      customer_phone: codRequest.orderData.phone,
      customer_name: codRequest.orderData.customerName,
      customer_email: codRequest.orderData.email,
      cedula: codRequest.orderData.cedula,
      address: codRequest.orderData.address,
      city: codRequest.orderData.city,
      department: codRequest.orderData.department,
      neighborhood: codRequest.orderData.neighborhood,
      line_items: codRequest.orderData.lineItems,
      notes: codRequest.orderData.notes,
      shipping_cost: codRequest.orderData.shippingCost,
      total_amount: codRequest.totalAmount,
      status: "order_created",
      shopify_order_id: String(data.orderId || ""),
      shopify_order_number: String(data.orderNumber || ""),
    });

    params.result.reply = formatShopifyOrderCreatedReply({
      orderNumber: data.orderNumber,
      totalAmount: data.totalPrice || codRequest.totalAmount,
      lineItems: codRequest.orderData.lineItems,
    });
    params.result.handoff_required = false;
    params.result.handoff_reason = "";
    actionResults.push({
      type: String(paymentAction.type),
      success: true,
      orderId: data.orderId,
      orderNumber: String(data.orderNumber),
    });
    return { result: params.result, actionResults };
  }

  if (isManualTransferAction) {
    const transferRequest = built.request as any;
    try {
      const draft = await createManualTransferDraftOrder(supabase, transferRequest);
      await ensureConversationTag(supabase, {
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        name: "Pago por validar",
        color: "#f59e0b",
      });
      await removeConversationTag(supabase, {
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        name: "Requiere atencion",
      });
      await removeConversationTag(supabase, {
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        name: "Requiere atención",
      });

      await supabase.from("pending_orders").insert({
        organization_id: params.organizationId,
        conversation_id: params.conversationId,
        customer_phone: transferRequest.orderData.phone,
        customer_name: transferRequest.orderData.customerName,
        customer_email: transferRequest.orderData.email,
        cedula: transferRequest.orderData.cedula,
        address: transferRequest.orderData.address,
        city: transferRequest.orderData.city,
        department: transferRequest.orderData.department,
        neighborhood: transferRequest.orderData.neighborhood,
        line_items: transferRequest.orderData.lineItems,
        notes: transferRequest.orderData.notes,
        shipping_cost: transferRequest.orderData.shippingCost,
        total_amount: transferRequest.totalAmount,
        payment_provider: "manual_transfer",
        status: "pending_transfer_validation",
        shopify_order_id: String(draft.draftOrderId || ""),
        shopify_order_number: String(draft.draftOrderName || ""),
      });

      params.result.reply =
        "Gracias 😊 Recibimos el comprobante y dejamos tu pedido listo para validación de pago. Apenas el equipo confirme la transferencia, continuamos 🙌";
      params.result.handoff_required = false;
      params.result.handoff_reason = "";
      actionResults.push({
        type: String(paymentAction.type),
        success: true,
        reason: "pending_transfer_validation",
        orderId: draft.draftOrderId,
        orderNumber: String(draft.draftOrderName || ""),
      });
      return { result: params.result, actionResults };
    } catch (error: any) {
      await ensureConversationTag(supabase, {
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        name: "Pago por validar",
        color: "#f59e0b",
      });
      await removeConversationTag(supabase, {
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        name: "Requiere atencion",
      });
      await removeConversationTag(supabase, {
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        name: "Requiere atención",
      });
      console.error("Elsa manual transfer draft order action failed:", error?.message || error);
      params.result.reply =
        "Gracias 😊 Recibimos el comprobante. Lo dejamos marcado como pago por validar para que el equipo confirme la transferencia.";
      params.result.handoff_required = false;
      params.result.handoff_reason = "";
      actionResults.push({
        type: String(paymentAction.type),
        success: false,
        reason: error?.message || "manual_transfer_draft_failed",
      });
      return { result: params.result, actionResults };
    }
  }

  const paymentRequest = built.request as any;
  const { data, error } = await supabase.functions.invoke(
    isAddiAction ? "create-addi-payment-request" : "create-bold-payment-link",
    {
      body: paymentRequest,
    },
  );

  const builtResult = built as { ok: boolean; errors?: string[] };
  if (builtResult.ok === false) {
    const errors = builtResult.errors || [];
    const needsProductConfirmation = errors.some((error: string) =>
      error.toLowerCase().includes("confirma el producto exacto")
    );

    actionResults.push({
      type: String(paymentAction.type),
      success: false,
      reason: `missing_or_invalid:${errors.join(",")}`,
    });

    if (needsProductConfirmation) {
      const requestedProduct = String(payload.lineItems?.[0]?.productName || "").trim();
      params.result.reply = requestedProduct
        ? `Veo la foto, pero no estoy segura del producto exacto (${requestedProduct}). ¿Me confirmas el nombre completo para enviarte el link correcto?`
        : "Veo la foto, pero no estoy segura del producto exacto. ¿Me confirmas el nombre completo para enviarte el link correcto?";
      params.result.handoff_required = false;
      params.result.handoff_reason = "";
      return { result: params.result, actionResults };
    }

    console.error(
      "Elsa commerce payment action failed:",
      errors.join(" | ") || (isAddiAction ? "no applicationId" : "no paymentUrl"),
    );
    params.result.reply = isAddiAction
      ? "Ya tengo el método de pago por Addi 😊 Te conecto con el equipo para enviarte la solicitud."
      : "Ya tengo el método de pago por PSE 😊 Te conecto con el equipo para enviarte el link de pago.";
    params.result.handoff_required = true;
    params.result.handoff_reason = isAddiAction
      ? "Falló la creación automática de la solicitud Addi."
      : "Falló la creación automática del link Bold.";
    return { result: params.result, actionResults };
  }

  if (isAddiAction) {
    params.result.reply = data.paymentUrl
      ? `¡Listo! Te dejo la solicitud de pago por Addi 😊
${data.paymentUrl}

Total: $${
        Number(paymentRequest.amount).toLocaleString("es-CO")
      } COP. Cuando Addi apruebe la compra, creamos tu pedido automáticamente 🙌`
      : `¡Listo! Ya enviamos la solicitud por Addi 😊 Revisa la notificación de Addi para aprobar la compra. Total: $${
        Number(paymentRequest.amount).toLocaleString("es-CO")
      } COP. Cuando Addi apruebe, creamos tu pedido automáticamente 🙌`;
    params.result.handoff_required = false;
    params.result.handoff_reason = "";
    actionResults.push({
      type: String(paymentAction.type),
      success: true,
      paymentUrl: data.paymentUrl,
      paymentLinkId: data.applicationId,
    });
    return { result: params.result, actionResults };
  }

  params.result.reply = `¡Listo! Te dejo el link de pago por PSE 😊
${data.paymentUrl}

Total: $${
    Number(paymentRequest.amount).toLocaleString("es-CO")
  } COP. Apenas Bold confirme el pago, creamos tu pedido automáticamente 🙌`;
  params.result.handoff_required = false;
  params.result.handoff_reason = "";
  actionResults.push({
    type: String(paymentAction.type),
    success: true,
    paymentUrl: data.paymentUrl,
    paymentLinkId: data.paymentLinkId,
  });

  return { result: params.result, actionResults };
}

async function fetchSewdleContext(
  supabase: any,
  organizationId?: string,
  conversationId?: string,
) {
  const context: Record<string, unknown> = {};
  let channelId: string | undefined;

  if (conversationId) {
    const { data: conversation } = await supabase
      .from("messaging_conversations")
      .select(
        "id, channel_id, user_name, user_identifier, external_user_id, channel_type, ai_managed, metadata, last_message_at",
      )
      .eq("id", conversationId)
      .maybeSingle();

    if (conversation) {
      channelId = conversation.channel_id;
      context.conversation = {
        id: conversation.id,
        contact_name_present: Boolean(conversation.user_name),
        contact_identifier_present: Boolean(
          conversation.user_identifier || conversation.external_user_id,
        ),
        channel_type: conversation.channel_type,
        ai_managed: conversation.ai_managed,
        metadata: conversation.metadata || {},
        last_message_at: conversation.last_message_at,
      };
    }

    const { data: recentMessages } = await supabase
      .from("messaging_messages")
      .select("direction, sender_type, content, message_type, media_url, media_mime_type, sent_at")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .limit(20);

    if (recentMessages) {
      const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
      const imageOcrCache = new Map<string, Promise<string | null>>();
      context.recent_messages = await Promise.all(recentMessages.reverse().map(async (m: any) => {
        const role = m.direction === "inbound" ? "user" : "assistant";
        const enrichedContent = await buildVisionImageContent(
          {
            role,
            content: m.content || "",
            media_url: m.media_url,
            message_type: m.message_type,
          },
          openaiApiKey,
          imageOcrCache,
        );

        return {
          direction: m.direction,
          sender_type: m.sender_type,
          message_type: m.message_type,
          media_url: m.media_url || null,
          media_mime_type: m.media_mime_type || null,
          sent_at: m.sent_at,
          content: safeSnippet(textFromMessageContent(enrichedContent) || String(m.content || ""), 500),
        };
      }));

      const recentText = (context.recent_messages as any[])
        .map((message) => String(message.content || ""))
        .join("\n");
      const referencedOrderNumber = extractMentionedOrderNumberFromText(
        recentText,
      );
      if (referencedOrderNumber) {
        const referencedOrder = await findReferencedShopifyOrder(supabase, {
          organizationId,
          orderNumber: referencedOrderNumber,
        });
        if (referencedOrder) {
          context.order_status = {
            ...(context.order_status as Record<string, unknown> || {}),
            referenced_order: summarizeReferencedOrderForPrompt(
              referencedOrder,
            ),
          };
        }
      }
    }

    const latestCreatedOrder = await findLatestCreatedOrderForConversation(
      supabase,
      conversationId,
    );
    if (latestCreatedOrder?.shopify_order_number) {
      context.order_status = {
        ...(context.order_status as Record<string, unknown> || {}),
        latest_created_order: {
          orderNumber: latestCreatedOrder.shopify_order_number,
          totalAmount: latestCreatedOrder.total_amount,
          lineItems: latestCreatedOrder.line_items || [],
          createdAt: latestCreatedOrder.created_at,
        },
      };
    }
  }

  if (channelId) {
    const { data: channel } = await supabase
      .from("messaging_channels")
      .select("id, channel_name, ai_enabled, ai_config")
      .eq("id", channelId)
      .maybeSingle();

    const channelKnowledge = normalizeChannelKnowledge(
      channel?.ai_config || {},
    );
    if (Object.keys(channelKnowledge).length) {
      context.channel_knowledge = channelKnowledge;
    }
    if (channel) {
      context.channel = {
        id: channel.id,
        channel_name: channel.channel_name,
        ai_enabled: channel.ai_enabled,
      };
    }
  }

  if (organizationId) {
    const { data: learnings } = await supabase
      .from("elsa_response_learnings")
      .select(
        "category, situation, recommended_response, avoid_response, confidence, updated_at",
      )
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("confidence", { ascending: false })
      .limit(12);

    if (learnings?.length) context.learnings = learnings;
  }

  return context;
}

async function callHermesElsa(
  prompt: string,
  conversationId?: string,
): Promise<ElsaStructuredResponse & { provider: string; raw?: string }> {
  const hermesUrl = (Deno.env.get("HERMES_API_URL") || "").replace(/\/$/, "");
  const hermesKey = Deno.env.get("HERMES_API_KEY") || "";
  const hermesModel = Deno.env.get("HERMES_MODEL") || "elsa";

  if (!hermesUrl || !hermesKey) {
    throw new Error(
      "Hermes API not configured: set HERMES_API_URL and HERMES_API_KEY",
    );
  }

  const response = await fetch(`${hermesUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hermesKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: hermesModel,
      input: prompt,
      store: true,
      metadata: conversationId
        ? { conversation_id: conversationId, source: "sewdle" }
        : { source: "sewdle" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Hermes API error ${response.status}: ${errorText.slice(0, 500)}`,
    );
  }

  const data = await response.json();
  const outputText = extractHermesOutputText(data);

  const parsed = extractJsonObject(outputText);

  // Never forward an upstream error string to the customer. If Hermes returned an
  // error-shaped reply (429/quota/etc.), throw so the OpenAI fallback takes over.
  const candidateReply = (parsed?.reply ?? outputText) || "";
  if (looksLikeProviderError(candidateReply)) {
    throw new Error(
      `Hermes returned an error-shaped reply; falling back: ${
        String(candidateReply).slice(0, 160)
      }`,
    );
  }

  if (parsed?.reply) return { ...parsed, provider: "hermes", raw: outputText };

  return {
    reply: outputText.trim(),
    confidence: 0.5,
    handoff_required: false,
    actions: [{ type: "none" }],
    learning_notes: [],
    provider: "hermes",
    raw: outputText,
  };
}

async function callOpenAIFallback(
  prompt: string,
): Promise<ElsaStructuredResponse & { provider: string; raw?: string }> {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY not configured for fallback");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Eres Elsa, asesora experta de Dosmicos. Devuelve solo JSON válido.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI fallback error ${response.status}: ${errorText.slice(0, 500)}`,
    );
  }

  const data = await response.json();
  const outputText = data.choices?.[0]?.message?.content || "";
  const parsed = extractJsonObject(outputText);
  if (parsed?.reply) {
    return { ...parsed, provider: "openai-fallback", raw: outputText };
  }

  return {
    reply: outputText.trim(),
    confidence: 0.35,
    handoff_required: false,
    actions: [{ type: "none" }],
    learning_notes: [],
    provider: "openai-fallback",
    raw: outputText,
  };
}

async function persistRunLog(supabase: any, payload: Record<string, unknown>) {
  try {
    await supabase.from("elsa_agent_runs").insert(payload);
  } catch (error: any) {
    console.warn("Could not persist Elsa run log:", error?.message || error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];
    const organizationId = body.organizationId;
    const conversationId = body.conversationId;
    const systemPrompt = body.systemPrompt;

    if (!messages.length) {
      return jsonResponse({ error: "messages is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRole);

    const commerceCatalog = await fetchCommerceCatalog(
      supabase,
      organizationId,
    );
    const sewdleContext = await fetchSewdleContext(
      supabase,
      organizationId,
      conversationId,
    );
    if (commerceCatalog.length) {
      const searchHistory = [
        ...(Array.isArray((sewdleContext as any).recent_messages)
          ? ((sewdleContext as any).recent_messages as any[]).map((message) => ({
            direction: message.direction,
            content: message.content,
          }))
          : []),
        ...messages,
      ];
      const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
      const catalogSearchQuery = buildProductSearchContext(
        textFromMessageContent(latestUserMessage?.content || ""),
        searchHistory,
      );
      const visualSearchTerms = hasVisualCandidateSearchSignal(catalogSearchQuery)
        ? extractVisualCandidateSearchTerms(catalogSearchQuery)
        : [];
      const productsForPrompt = visualSearchTerms.length
        ? searchRelevantProducts(commerceCatalog, visualSearchTerms, 3) as CommerceProduct[]
        : commerceCatalog;
      sewdleContext.commerce = {
        capabilities: [
          "send_payment_link_bold_pse",
          "send_addi_payment_request",
          "create_shopify_order_cod",
          "create_shopify_draft_after_transfer_proof",
          "create_shopify_order_after_bold_payment",
          "create_shopify_order_after_addi_approval",
          "subscribe_back_in_stock",
        ],
        payment_flow:
          "Para contra entrega/COD: crear pedido Shopify inmediatamente con gateway Cash on Delivery (COD), estado financiero pending y responder con número de pedido, resumen y agradecimiento. Para PSE/link de pago: generar link Bold y guardar pending_order; Shopify se crea automáticamente solo cuando Bold confirma el pago por webhook. Para Addi: generar solicitud Addi y guardar pending_order; Shopify se crea automáticamente solo cuando Addi aprueba la compra por callback. Para Bancolombia/Nequi/transferencia manual: pedir comprobante; después de recibir la foto del comprobante, crear draft order de Shopify y etiquetar la conversación Pago por validar, sin usar Requiere atencion.",
        products: summarizeCommerceCatalogForPrompt(
          productsForPrompt,
          visualSearchTerms.length ? 3 : 80,
          catalogSearchQuery,
        ),
        visual_candidate_instruction: visualSearchTerms.length && productsForPrompt.length
          ? buildVisualCandidateInstruction(catalogSearchQuery, productsForPrompt)
          : undefined,
      };
    }
    const prompt = buildElsaPrompt({ messages, systemPrompt, sewdleContext });

    let result: ElsaStructuredResponse & { provider: string; raw?: string };
    let errorMessage = "";

    try {
      result = await callHermesElsa(prompt, conversationId);
    } catch (hermesError: any) {
      errorMessage = hermesError?.message || String(hermesError);
      console.error("Hermes Elsa failed, using fallback:", errorMessage);
      result = await callOpenAIFallback(prompt);
    }

    const commerceExecution = await executeCommerceActions(supabase, {
      result,
      catalog: commerceCatalog,
      messages,
      organizationId,
      conversationId,
    });
    result = commerceExecution.result;
    const actionResults = commerceExecution.actionResults;

    await maybeReplyWithImageScreenshotFallback({
      messages,
      result,
    });

    await maybeReplyWithWarmGreeting({
      messages,
      result,
    });

    if (shouldReplacePaymentLinkReplyWithoutUrl(result.reply, actionResults, latestUserThreadText(messages))) {
      result.reply = buildPaymentLinkMissingUrlFallbackReply();
      result.handoff_required = true;
      result.handoff_reason = "payment_link_missing_url";
      result.actions = [{ type: "handoff", reason: "payment_link_missing_url" }];
      actionResults.push({
        type: "send_payment_link",
        success: false,
        reason: "payment_link_missing_url",
      });
    }

    const responsePayload = {
      response: result.reply,
      provider: result.provider,
      confidence: result.confidence ?? null,
      handoff_required: Boolean(result.handoff_required),
      handoff_reason: result.handoff_reason || null,
      actions: result.actions || [{ type: "none" }],
      action_results: actionResults,
      learning_notes: result.learning_notes || [],
      product_images: [],
      elapsed_ms: Date.now() - startedAt,
      fallback_error: errorMessage || null,
    };

    await persistRunLog(supabase, {
      organization_id: organizationId || null,
      conversation_id: conversationId || null,
      provider: result.provider,
      confidence: result.confidence ?? null,
      handoff_required: Boolean(result.handoff_required),
      actions: result.actions || [],
      action_results: actionResults,
      response_preview: safeSnippet(result.reply, 400),
      error_message: errorMessage || null,
      latency_ms: Date.now() - startedAt,
    });

    return jsonResponse(responsePayload);
  } catch (error: any) {
    console.error("Elsa Hermes bridge error:", error);
    return jsonResponse({ error: error?.message || String(error) }, 500);
  }
});
