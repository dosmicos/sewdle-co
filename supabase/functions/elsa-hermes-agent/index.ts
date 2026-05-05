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
  safeSnippet,
} from "../_shared/elsa-hermes-core.ts";

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

async function fetchSewdleContext(
  supabase: any,
  organizationId?: string,
  conversationId?: string,
) {
  const context: Record<string, unknown> = {};

  if (conversationId) {
    const { data: conversation } = await supabase
      .from("messaging_conversations")
      .select(
        "id, customer_name, customer_phone, channel_type, ai_managed, metadata, last_message_at",
      )
      .eq("id", conversationId)
      .maybeSingle();

    if (conversation) {
      context.conversation = {
        id: conversation.id,
        customer_name_present: Boolean(conversation.customer_name),
        customer_phone_present: Boolean(conversation.customer_phone),
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

    const sewdleContext = await fetchSewdleContext(
      supabase,
      organizationId,
      conversationId,
    );
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

    const responsePayload = {
      response: result.reply,
      provider: result.provider,
      confidence: result.confidence ?? null,
      handoff_required: Boolean(result.handoff_required),
      handoff_reason: result.handoff_reason || null,
      actions: result.actions || [{ type: "none" }],
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
