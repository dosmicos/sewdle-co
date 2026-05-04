import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_STATUSES = new Set(["needs_review", "active", "archived"]);
const REVIEW_ACTION_TO_STATUS: Record<string, "needs_review" | "active" | "archived"> = {
  approve: "active",
  archive: "archived",
  reopen: "needs_review",
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

function cleanMultiline(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function normalizeConfidence(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const ratio = numeric > 1 ? numeric / 100 : numeric;
  return Math.max(0, Math.min(1, ratio));
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
    const learningId = cleanText(body.learningId, 80);
    const organizationId = cleanText(body.organizationId, 80);
    const action = cleanText(body.action || "update", 40) || "update";

    if (!learningId || !organizationId) {
      return jsonResponse({ error: "learningId and organizationId are required" }, 400);
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

    const { data: existing, error: existingError } = await supabase
      .from("elsa_response_learnings")
      .select("id, organization_id, confidence, metadata")
      .eq("id", learningId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) return jsonResponse({ error: "learning_not_found" }, 404);

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      metadata: {
        ...(existing.metadata || {}),
        last_reviewed_by: userData.user.id,
        last_reviewed_at: new Date().toISOString(),
        last_review_action: action,
      },
    };

    if (REVIEW_ACTION_TO_STATUS[action]) {
      updates.status = REVIEW_ACTION_TO_STATUS[action];
      if (action === "approve") {
        updates.confidence = Math.max(Number(existing.confidence || 0.55), 0.8);
      }
    }

    if (body.status !== undefined) {
      const status = cleanText(body.status, 40);
      if (!status || !VALID_STATUSES.has(status)) {
        return jsonResponse({ error: "invalid_status" }, 400);
      }
      updates.status = status;
    }

    if (body.category !== undefined) {
      updates.category = cleanText(body.category, 80) || "general";
    }
    if (body.situation !== undefined) {
      const situation = cleanMultiline(body.situation, 1000);
      if (!situation) return jsonResponse({ error: "situation_required" }, 400);
      updates.situation = situation;
    }
    if (body.recommendedResponse !== undefined) {
      const recommendedResponse = cleanMultiline(body.recommendedResponse, 2000);
      if (!recommendedResponse) return jsonResponse({ error: "recommended_response_required" }, 400);
      updates.recommended_response = recommendedResponse;
    }
    if (body.avoidResponse !== undefined) {
      updates.avoid_response = cleanMultiline(body.avoidResponse, 1000);
    }
    if (body.confidence !== undefined) {
      const confidence = normalizeConfidence(body.confidence);
      if (confidence === undefined) return jsonResponse({ error: "invalid_confidence" }, 400);
      updates.confidence = confidence;
    }

    const { data: updated, error: updateError } = await supabase
      .from("elsa_response_learnings")
      .update(updates)
      .eq("id", learningId)
      .eq("organization_id", organizationId)
      .select("id, category, situation, recommended_response, avoid_response, confidence, status, metadata, updated_at")
      .single();

    if (updateError) throw updateError;

    return jsonResponse({ ok: true, learning: updated });
  } catch (error: any) {
    console.error("Elsa review learning error:", error);
    return jsonResponse({ error: error?.message || String(error) }, 500);
  }
});
