import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function cleanMultiline(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function anonymize(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\+?57\s?)?(?:3\d{2}|60\d|1)\s?\d{3}\s?\d{4}\b/g, "[teléfono]")
    .replace(/\b(?:cc|c\.c\.|cédula|cedula|nit)\s*[:#-]?\s*\d{5,12}\b/gi, "[documento]")
    .replace(/\b\d{6,12}\b/g, "[número]")
    .replace(/\b(?:calle|cra|carrera|cl|kr|av|avenida|diagonal|transversal)\s+[^\n,;]{3,80}/gi, "[dirección]")
    .trim();
}

function getSuggestionText(suggestion: Record<string, unknown>): string | null {
  const text = suggestion.text;
  if (typeof text !== "string" || !text.trim()) return null;
  return anonymize(text.trim()).slice(0, 2000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "missing_supabase_env" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token || token === serviceRoleKey) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const body = await req.json();
    const conversationId = cleanText(body.conversationId, 80);
    const organizationId = cleanText(body.organizationId, 80);
    const rejectionReason = anonymize(cleanMultiline(body.rejectionReason, 1000) || "Sugerencia rechazada por asesora humana");
    const correctedResponse = anonymize(cleanMultiline(body.correctedResponse, 2000) || "");

    if (!conversationId || !organizationId) {
      return jsonResponse({ error: "conversationId and organizationId are required" }, 400);
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_users")
      .select("id, role, status")
      .eq("organization_id", organizationId)
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) return jsonResponse({ error: "forbidden" }, 403);

    const { data: conversation, error: conversationError } = await supabase
      .from("messaging_conversations")
      .select("id, organization_id, metadata")
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (conversationError) throw conversationError;
    if (!conversation) return jsonResponse({ error: "conversation_not_found" }, 404);

    const metadata = isRecord(conversation.metadata) ? conversation.metadata : {};
    const rawSuggestion = metadata.elsa_supervised_suggestion;
    if (!isRecord(rawSuggestion)) {
      return jsonResponse({ error: "suggestion_not_found" }, 404);
    }

    const rejectedSuggestion = getSuggestionText(rawSuggestion);
    if (!rejectedSuggestion) {
      return jsonResponse({ error: "suggestion_text_required" }, 400);
    }

    const { data: recentMessages, error: messagesError } = await supabase
      .from("messaging_messages")
      .select("id, content, direction, sender_type, sent_at")
      .eq("conversation_id", conversationId)
      .eq("direction", "inbound")
      .order("sent_at", { ascending: false })
      .limit(4);

    if (messagesError) throw messagesError;

    const orderedMessages = [...(recentMessages || [])].reverse();
    const sourceMessageIds = orderedMessages
      .map((message: any) => message.id)
      .filter((id: unknown) => typeof id === "string");
    const customerContext = orderedMessages
      .map((message: any) => anonymize(cleanMultiline(message.content, 500) || ""))
      .filter(Boolean)
      .join("\n");

    const situation = anonymize(cleanMultiline(body.situation, 1000) || customerContext || "Sugerencia de Elsa rechazada por asesora humana");
    const recommendedResponse = correctedResponse || "La asesora debe corregir esta respuesta antes de convertirla en aprendizaje activo.";
    const now = new Date().toISOString();

    const { data: learning, error: learningError } = await supabase
      .from("elsa_response_learnings")
      .insert({
        organization_id: organizationId,
        category: "correction",
        situation,
        recommended_response: recommendedResponse,
        avoid_response: rejectedSuggestion,
        source_conversation_ids: [conversationId],
        source_message_ids: sourceMessageIds,
        confidence: correctedResponse ? 0.65 : 0.4,
        status: "needs_review",
        metadata: {
          source: "supervised_suggestion_rejection",
          rejection_reason: rejectionReason,
          rejected_suggestion: rejectedSuggestion,
          has_corrected_response: Boolean(correctedResponse),
          suggestion_provider: rawSuggestion.provider || null,
          suggestion_confidence: rawSuggestion.confidence || null,
          suggestion_generated_at: rawSuggestion.generated_at || null,
          reviewed_by: userData.user.id,
          reviewed_at: now,
        },
      })
      .select("id, status")
      .single();

    if (learningError) throw learningError;

    const updatedSuggestion = {
      ...rawSuggestion,
      review_status: "rejected",
      reviewed_at: now,
      reviewed_by: userData.user.id,
      rejection_reason: rejectionReason,
      correction_learning_id: learning.id,
    };

    const { error: updateConversationError } = await supabase
      .from("messaging_conversations")
      .update({
        metadata: {
          ...metadata,
          elsa_supervised_suggestion: updatedSuggestion,
        },
        updated_at: now,
      })
      .eq("id", conversationId)
      .eq("organization_id", organizationId);

    if (updateConversationError) throw updateConversationError;

    return jsonResponse({ ok: true, review_status: "rejected", learning });
  } catch (error: any) {
    console.error("Elsa suggestion review error:", error);
    return jsonResponse({ error: error?.message || String(error) }, 500);
  }
});
