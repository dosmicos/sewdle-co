// voice-confirm-tool — server tool called by the ElevenLabs voice agent DURING the call
// to record the confirmation outcome for a COD order. Writes the same canonical
// order_confirmations.status the WhatsApp flow writes, so the existing panel/logic keep
// working. Idempotent: if already confirmed (race with WhatsApp), tells the agent to
// close cordially without re-asking.
//
// Public (verify_jwt=false): ElevenLabs calls it directly.
// Body: { shopify_order_id, outcome: "confirmed"|"rejected"|"reschedule", reschedule_at?, organizationId? }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DOSMICOS_ORG = "cb497af2-3f29-4bb4-be53-91b7f19e5ffb";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function reply(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const shopifyOrderId = String(body.shopify_order_id ?? body.shopifyOrderId ?? "").trim();
  const outcome = String(body.outcome ?? "").toLowerCase().trim();
  const organizationId = String(body.organizationId ?? body.organization_id ?? DOSMICOS_ORG);
  const rescheduleAt = body.reschedule_at ?? body.rescheduleAt ?? null;

  if (!shopifyOrderId || !["confirmed", "rejected", "reschedule"].includes(outcome)) {
    return reply({ ok: false, message: "Faltan datos del pedido o el resultado no es válido." }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: oc } = await supabase
    .from("order_confirmations")
    .select("id, status, conversation_id")
    .eq("organization_id", organizationId)
    .eq("shopify_order_id", shopifyOrderId)
    .maybeSingle();

  if (!oc) {
    return reply({ ok: false, message: "No encontré ese pedido para confirmar." });
  }

  // Idempotency / race with WhatsApp: already confirmed → tell the agent to close nicely.
  if (oc.status === "confirmed") {
    return reply({ ok: true, already_confirmed: true, message: "Tu pedido ya estaba confirmado. ¡Gracias!" });
  }

  // Map voice outcome → canonical status. A rejection/reschedule goes to needs_attention
  // for a human to act (we don't auto-cancel the Shopify order from a call).
  const nowIso = new Date().toISOString();
  const newStatus = outcome === "confirmed" ? "confirmed" : "needs_attention";

  const update: Record<string, unknown> = {
    status: newStatus,
    voice_outcome: outcome,
    confirmation_channel: "voice",
    call_status: "completed",
    updated_at: nowIso,
  };
  if (outcome === "confirmed") update.confirmed_at = nowIso;
  if (outcome === "reschedule" && rescheduleAt) update.last_attempt_at = nowIso;

  await supabase.from("order_confirmations").update(update).eq("id", oc.id);

  // Reflect the outcome on the open call log (most recent in-flight attempt).
  await supabase
    .from("voice_call_logs")
    .update({
      outcome,
      reschedule_at: outcome === "reschedule" ? rescheduleAt : null,
      updated_at: nowIso,
    })
    .eq("organization_id", organizationId)
    .eq("shopify_order_id", shopifyOrderId)
    .in("status", ["initiated", "ringing", "in_progress"]);

  const message = outcome === "confirmed"
    ? "¡Listo! Tu pedido quedó confirmado."
    : outcome === "reschedule"
    ? "Perfecto, lo dejamos anotado para reagendar."
    : "Entendido, lo dejamos en revisión con el equipo.";

  return reply({ ok: true, status: newStatus, message });
});
