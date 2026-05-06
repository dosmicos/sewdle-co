import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import {
  buildCurationMetadata,
  classifyLearningForCuration,
  type ElsaLearningForCuration,
  learningCurationSignature,
} from "../_shared/elsa-learning-curation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type LearningRow = ElsaLearningForCuration & {
  id: string;
  organization_id: string | null;
  metadata: Record<string, unknown> | null;
  updated_at?: string;
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

function parseLimit(value: unknown): number {
  const numeric = Number(value || 200);
  if (!Number.isFinite(numeric)) return 200;
  return Math.max(1, Math.min(500, Math.floor(numeric)));
}

function redactId(id: unknown) {
  const text = String(id || "");
  if (text.length <= 12) return "[id]";
  return `${text.slice(0, 8)}…${text.slice(-4)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const curationToken = Deno.env.get("ELSA_CURATION_TOKEN") || "";
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!curationToken) {
      return jsonResponse({ error: "missing_curation_token" }, 500);
    }
    if (!bearer || bearer !== curationToken) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "missing_supabase_env" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const apply = body.apply === true;
    const limit = parseLimit(body.limit);
    const organizationId = cleanText(body.organizationId, 80);
    const runId = `elsa-curation-${
      new Date().toISOString().replace(/[:.]/g, "-")
    }`;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let query = supabase
      .from("elsa_response_learnings")
      .select(
        "id, organization_id, category, situation, recommended_response, avoid_response, confidence, status, metadata, created_at",
      )
      .eq("status", "needs_review")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (organizationId) query = query.eq("organization_id", organizationId);

    const { data: rows, error: rowsError } = await query;
    if (rowsError) throw rowsError;

    const learnings = (rows || []) as LearningRow[];
    const signatureCounts = new Map<string, number>();
    for (const row of learnings) {
      const signature = learningCurationSignature(row);
      signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);
    }

    const summary = {
      ok: true,
      run_id: runId,
      mode: apply ? "apply" : "dry_run",
      scanned: learnings.length,
      activated: 0,
      archived: 0,
      kept_for_review: 0,
      metadata_marked: 0,
      errors: 0,
      decisions: [] as Array<{
        id: string;
        category: string | null | undefined;
        recommended_status: string;
        auto_apply: boolean;
        reason: string;
        risk_flags: string[];
        duplicate_count: number;
      }>,
    };

    for (const learning of learnings) {
      const signature = learningCurationSignature(learning);
      const duplicateCount = signatureCounts.get(signature) || 1;
      const decision = classifyLearningForCuration({
        learning,
        duplicateCount,
      });
      const metadataPatch = buildCurationMetadata({
        decision,
        duplicateCount,
        runId,
      });

      summary.decisions.push({
        id: redactId(learning.id),
        category: learning.category,
        recommended_status: decision.recommendedStatus,
        auto_apply: decision.autoApply,
        reason: decision.reason,
        risk_flags: decision.riskFlags,
        duplicate_count: duplicateCount,
      });

      if (!apply) {
        if (decision.autoApply && decision.recommendedStatus === "active") {
          summary.activated += 1;
        } else if (
          decision.autoApply && decision.recommendedStatus === "archived"
        ) summary.archived += 1;
        else summary.kept_for_review += 1;
        continue;
      }

      const metadata = {
        ...(learning.metadata || {}),
        ...metadataPatch,
      };

      try {
        if (decision.autoApply) {
          const updates: Record<string, unknown> = {
            status: decision.recommendedStatus,
            metadata,
            updated_at: new Date().toISOString(),
          };
          if (decision.recommendedStatus === "active") {
            updates.confidence = Math.max(
              Number(learning.confidence || 0.55),
              decision.confidence,
            );
          }

          const { error: updateError } = await supabase
            .from("elsa_response_learnings")
            .update(updates)
            .eq("id", learning.id)
            .eq("status", "needs_review");
          if (updateError) throw updateError;

          if (decision.recommendedStatus === "active") summary.activated += 1;
          if (decision.recommendedStatus === "archived") summary.archived += 1;
        } else {
          const { error: metadataError } = await supabase
            .from("elsa_response_learnings")
            .update({ metadata, updated_at: new Date().toISOString() })
            .eq("id", learning.id)
            .eq("status", "needs_review");
          if (metadataError) throw metadataError;

          summary.kept_for_review += 1;
          summary.metadata_marked += 1;
        }
      } catch (error) {
        summary.errors += 1;
        console.error(
          "Elsa curation update error:",
          redactId(learning.id),
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return jsonResponse(summary, summary.errors ? 207 : 200);
  } catch (error: any) {
    console.error("Elsa curate learnings error:", error);
    return jsonResponse({ error: error?.message || String(error) }, 500);
  }
});
