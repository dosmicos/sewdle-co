// Capture human Sewdle replies as compact learning candidates for Elsa.
//
// This function is safe to call from the inbox after a human sends a message.
// It does NOT send anything to customers. It only stores an anonymized/pattern-level
// learning row that Elsa can retrieve in future runs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

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

function anonymize(text = "") {
  return String(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/\+?57\s?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/g, "[PHONE]")
    .replace(/\b3\d{9}\b/g, "[PHONE]")
    .replace(/\b\d{7,10}\b/g, "[ID_OR_PHONE]")
    .replace(
      /\b(?:cc|c\.c\.|cedula|cédula|nit)\s*[:#-]?\s*\d[\d. -]{5,}\b/gi,
      "[DOCUMENT]",
    )
    .replace(
      /\b(?:calle|cll|carrera|cra|kr|avenida|av|diagonal|dg|transversal|tv)\s+[^\n,.;]{3,80}/gi,
      "[ADDRESS]",
    )
    .replace(/#[0-9]{4,}/g, "#[ORDER]")
    .replace(/\s+/g, " ")
    .trim();
}

function classify(text: string) {
  const lower = text.toLowerCase();
  if (/talla|tallas|meses|años|tog/.test(lower)) return "sizes";
  if (/env[ií]o|entrega|express|direcci[oó]n|ciudad/.test(lower)) {
    return "shipping";
  }
  if (/pago|nequi|daviplata|pse|addi|transferencia|link/.test(lower)) {
    return "payments";
  }
  if (/pedido|orden|comprar|datos|c[eé]dula/.test(lower)) {
    return "order_creation";
  }
  if (/cambio|devoluci[oó]n|garant[ií]a|reembolso/.test(lower)) {
    return "changes";
  }
  if (/precio|cu[aá]nto|vale|costo/.test(lower)) return "pricing";
  return "general";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const conversationId = body.conversationId;
    const humanMessageId = body.messageId;
    const organizationId = body.organizationId;

    if (!conversationId || !organizationId) {
      return jsonResponse({
        error: "conversationId and organizationId are required",
      }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { data: messages, error: messagesError } = await supabase
      .from("messaging_messages")
      .select("id, direction, sender_type, content, message_type, sent_at")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .limit(12);

    if (messagesError) throw messagesError;

    const chronological = (messages || []).reverse();
    const latestHuman = humanMessageId
      ? chronological.find((m: any) => m.id === humanMessageId)
      : [...chronological].reverse().find((m: any) =>
        m.direction === "outbound" &&
        !["ai", "bot", "system", "automation"].includes(
          String(m.sender_type || "").toLowerCase(),
        )
      );

    if (!latestHuman?.content) {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: "No human outbound message found",
      });
    }

    const previousCustomer = [...chronological]
      .reverse()
      .find((m: any) =>
        m.direction === "inbound" && m.sent_at <= latestHuman.sent_at
      );

    const customerSituation = anonymize(
      previousCustomer?.content || "Cliente escribió en WhatsApp de Dosmicos.",
    );
    const humanResponse = anonymize(latestHuman.content || "");

    if (humanResponse.length < 8) {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: "Human response too short",
      });
    }

    const category = classify(`${customerSituation} ${humanResponse}`);

    const { data, error } = await supabase
      .from("elsa_response_learnings")
      .insert({
        organization_id: organizationId,
        category,
        situation: customerSituation.slice(0, 1000),
        recommended_response: humanResponse.slice(0, 2000),
        source_conversation_ids: [conversationId],
        source_message_ids: [latestHuman.id],
        confidence: 0.55,
        status: "needs_review",
        metadata: {
          source: "elsa-capture-human-reply",
          message_type: latestHuman.message_type,
        },
      })
      .select("id")
      .single();

    if (error) throw error;

    return jsonResponse({ ok: true, learning_id: data?.id, category });
  } catch (error: any) {
    console.error("Elsa capture human reply error:", error);
    return jsonResponse({ error: error?.message || String(error) }, 500);
  }
});
