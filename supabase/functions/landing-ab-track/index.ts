// landing-ab-track — public beacon hit once per new visitor by the in-page A/B split.
// Records the bucket assignment so the dashboard has the CVR denominator (visits per variant).
// Public (verify_jwt=false in config.toml); validates the experiment + lp_version before inserting.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DOSMICOS_ORG = "cb497af2-3f29-4bb4-be53-91b7f19e5ffb";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false }, 405);

  try {
    // Bots/crawlers must not pollute the denominator.
    const ua = req.headers.get("user-agent") || "";
    if (/bot|crawl|spider|slurp|facebookexternalhit|whatsapp|lighthouse|headless|preview/i.test(ua)) {
      return json({ ok: true, skipped: "bot" });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const experiment_slug = String(body?.experiment_slug ?? "").trim().slice(0, 80);
    const lp_version = String(body?.lp_version ?? "").trim().slice(0, 80);
    const lp_bucket = body?.lp_bucket ? String(body.lp_bucket).trim().slice(0, 8) : null;
    const anon_id = body?.anon_id ? String(body.anon_id).trim().slice(0, 64) : null;
    const organizationId = String(body?.organizationId ?? DOSMICOS_ORG);

    if (!experiment_slug || !lp_version) return json({ ok: false, error: "missing experiment_slug or lp_version" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Anti-abuse / anti-typo: the experiment must exist and the lp_version must belong to it.
    const { data: exp } = await supabase
      .from("landing_ab_experiments")
      .select("control_lp_version, challenger_lp_version")
      .eq("organization_id", organizationId)
      .eq("slug", experiment_slug)
      .maybeSingle();

    if (!exp) return json({ ok: false, error: "unknown experiment" }, 404);
    if (lp_version !== exp.control_lp_version && lp_version !== exp.challenger_lp_version) {
      return json({ ok: false, error: "lp_version not in experiment" }, 400);
    }

    // Unique partial index on (org, slug, anon_id) de-dups repeat visitors → ignore that conflict.
    const { error } = await supabase
      .from("landing_ab_visits")
      .insert({ organization_id: organizationId, experiment_slug, lp_version, lp_bucket, anon_id });

    if (error && !/duplicate|unique/i.test(error.message ?? "")) {
      console.error("landing-ab-track insert error:", error.message);
      return json({ ok: false }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("landing-ab-track error:", (e as Error).message);
    return json({ ok: false }, 500);
  }
});
