import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { buildConversationInsightCandidate, redactInsightEvidence } from "../_shared/elsa-conversation-insights.ts";

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

function cleanText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 80))
    .filter((item): item is string => Boolean(item));
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 40)?.toLowerCase().replace(/[^a-z0-9áéíóúñ-]+/gi, "-"))
    .filter((item): item is string => Boolean(item))
    .slice(0, 12);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "missing_supabase_env" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token || token === serviceRoleKey) return jsonResponse({ error: "unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);

    const body = await req.json();
    const organizationId = cleanText(body.organizationId, 80);
    const text = cleanText(body.text || body.summary || body.evidence, 3000);
    if (!organizationId || !text) return jsonResponse({ error: "organizationId and text are required" }, 400);

    const { data: membership, error: membershipError } = await supabase
      .from("organization_users")
      .select("id, role, status")
      .eq("organization_id", organizationId)
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) return jsonResponse({ error: "forbidden" }, 403);

    const source = cleanText(body.source || "manual_note", 40) as
      | "customer_message"
      | "human_feedback"
      | "human_reply"
      | "elsa_review"
      | "manual_note";

    const candidate = buildConversationInsightCandidate({
      organizationId,
      conversationId: cleanText(body.conversationId, 80),
      messageIds: cleanArray(body.messageIds),
      text,
      source,
    }) || {
      organization_id: organizationId,
      type: cleanText(body.type, 40) || "general",
      sentiment: cleanText(body.sentiment, 40) || "neutral",
      priority: cleanText(body.priority, 20) || "medium",
      status: "new",
      summary: cleanText(body.summary, 700) || redactInsightEvidence(text).slice(0, 700),
      evidence: redactInsightEvidence(text).slice(0, 3000),
      tags: cleanTags(body.tags),
      source,
      source_conversation_ids: cleanText(body.conversationId, 80) ? [cleanText(body.conversationId, 80) as string] : [],
      source_message_ids: cleanArray(body.messageIds),
      metadata: { generated_by: "elsa_capture_insight_manual", pii_redacted: true },
    };

    const { data: insight, error: insertError } = await supabase
      .from("elsa_conversation_insights")
      .insert({
        ...candidate,
        metadata: {
          ...(candidate.metadata || {}),
          captured_by: userData.user.id,
          captured_at: new Date().toISOString(),
        },
      })
      .select("id, type, sentiment, priority, status, summary, tags, created_at")
      .single();

    if (insertError) throw insertError;

    return jsonResponse({ ok: true, insight });
  } catch (error: any) {
    console.error("Elsa capture insight error:", error);
    return jsonResponse({ error: error?.message || String(error) }, 500);
  }
});
