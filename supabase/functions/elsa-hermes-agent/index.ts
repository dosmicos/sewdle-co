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
  normalizeChannelKnowledge,
  safeSnippet,
} from "../_shared/elsa-hermes-core.ts";
import {
  buildBoldPaymentLinkRequest,
  type CommerceProduct,
  summarizeCommerceCatalogForPrompt,
} from "../_shared/elsa-commerce.ts";

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
};

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
    "id, status, bold_payment_url, total_amount, shopify_order_number, created_at";

  if (params.conversationId) {
    const { data } = await supabase
      .from("pending_orders")
      .select(columns)
      .eq("conversation_id", params.conversationId)
      .in("status", ["pending_payment", "paid", "order_created"])
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
      .in("status", ["pending_payment", "paid", "order_created"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (data?.[0]) return data[0];
  }

  return null;
}

async function executeCommerceActions(
  supabase: any,
  params: {
    result: ElsaStructuredResponse & { provider: string; raw?: string };
    catalog: CommerceProduct[];
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
  const paymentAction = actions.find((action: any) =>
    action?.type === "send_payment_link" ||
    (action?.type === "create_order_draft" &&
      ["link_de_pago", "pse", "PSE"].includes(
        String(action?.payload?.paymentMethod || ""),
      ))
  );
  if (!paymentAction?.payload) return { result: params.result, actionResults };

  const payload = paymentAction.payload as Record<string, any>;
  const existing = await findExistingPaymentFlow(supabase, {
    conversationId: params.conversationId,
    customerPhone: payload.phone || payload.customerPhone,
  });

  if (existing?.status === "pending_payment" && existing.bold_payment_url) {
    params.result.reply =
      `Listo 😊 tu link de pago sigue activo:\n${existing.bold_payment_url}\n\nTotal: $${
        Number(existing.total_amount || 0).toLocaleString("es-CO")
      } COP. Apenas Bold confirme el pago, creamos tu pedido automáticamente 🙌`;
    actionResults.push({
      type: String(paymentAction.type),
      success: true,
      duplicate_blocked: true,
      paymentUrl: existing.bold_payment_url,
      reason: "pending_payment",
    });
    return { result: params.result, actionResults };
  }

  if (existing?.status === "order_created") {
    params.result.reply =
      `Ese pedido ya quedó creado 😊 Número de pedido: #${existing.shopify_order_number}. Te enviaremos la guía cuando sea despachado 🙌`;
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
    params.result.reply =
      "Ya tengo el método de pago por PSE 😊 Te conecto con el equipo para validar disponibilidad y enviarte el link de pago.";
    params.result.handoff_required = true;
    params.result.handoff_reason =
      "No hay catálogo Shopify disponible para crear link Bold automáticamente.";
    return { result: params.result, actionResults };
  }

  const built = buildBoldPaymentLinkRequest({
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

  const { data, error } = await supabase.functions.invoke(
    "create-bold-payment-link",
    {
      body: built.request,
    },
  );

  if (error || !data?.paymentUrl) {
    console.error(
      "Elsa commerce payment link failed:",
      error?.message || "no paymentUrl",
    );
    actionResults.push({
      type: String(paymentAction.type),
      success: false,
      reason: error?.message || "no_payment_url",
    });
    params.result.reply =
      "Ya tengo el método de pago por PSE 😊 Te conecto con el equipo para enviarte el link de pago.";
    params.result.handoff_required = true;
    params.result.handoff_reason =
      "Falló la creación automática del link Bold.";
    return { result: params.result, actionResults };
  }

  params.result.reply =
    `¡Listo! Te dejo el link de pago por PSE 😊\n${data.paymentUrl}\n\nTotal: $${
      Number(built.request.amount).toLocaleString("es-CO")
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
      .select("direction, sender_type, content, message_type, sent_at")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .limit(20);

    if (recentMessages) {
      context.recent_messages = recentMessages.reverse().map((m: any) => ({
        direction: m.direction,
        sender_type: m.sender_type,
        message_type: m.message_type,
        sent_at: m.sent_at,
        content: safeSnippet(m.content, 500),
      }));
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
      sewdleContext.commerce = {
        capabilities: [
          "send_payment_link_bold_pse",
          "create_shopify_order_after_bold_payment",
        ],
        payment_flow:
          "Para PSE/link de pago: generar link Bold y guardar pending_order; Shopify se crea automáticamente solo cuando Bold confirma el pago por webhook.",
        products: summarizeCommerceCatalogForPrompt(commerceCatalog),
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
      organizationId,
      conversationId,
    });
    result = commerceExecution.result;
    const actionResults = commerceExecution.actionResults;

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
