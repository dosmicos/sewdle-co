// elsa-voice-knowledge — server tool called by the ElevenLabs voice agent when a
// customer asks something off-script during an order-confirmation call (sizes,
// material, shipping, etc.). It wraps elsa-hermes-agent (ELSA's real brain: catalog +
// knowledge base + product descriptions) so the voice agent answers with the SAME
// knowledge as WhatsApp ELSA — no duplicated/synced knowledge base.
//
// Public (verify_jwt=false): ElevenLabs calls it directly. Returns a SHORT spoken-style
// answer. Falls back to a courtesy line if the brain is slow/unavailable so the call
// never breaks.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DOSMICOS_ORG = "cb497af2-3f29-4bb4-be53-91b7f19e5ffb";
const COURTESY = "Déjame confirmar ese detalle y te lo escribimos por WhatsApp enseguida 😊";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Keep voice answers short and natural — no markdown, no lists, no long links.
const VOICE_SYSTEM_PROMPT =
  "Estás respondiendo a un cliente por TELÉFONO (voz), no por chat. Responde MUY corto y natural: 1 o 2 frases, en español colombiano, sin listas, sin markdown y sin links largos. Si no sabes algo con certeza, dilo en una frase y ofrece confirmarlo por WhatsApp. No inventes precios, tallas ni disponibilidad.";

function reply(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const question = String(body.question ?? body.query ?? body.text ?? "").trim();
  const organizationId = String(body.organizationId ?? body.organization_id ?? DOSMICOS_ORG);
  const conversationId = body.conversationId ?? body.conversation_id ?? undefined;

  if (!question) {
    return reply({ response: "¿Me repites la pregunta, por favor?" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // Race the brain against a hard timeout so a slow Hermes never hangs the call.
    const brain = supabase.functions.invoke("elsa-hermes-agent", {
      body: {
        messages: [{ role: "user", content: question }],
        organizationId,
        conversationId,
        systemPrompt: VOICE_SYSTEM_PROMPT,
      },
    });
    const timeout = new Promise<{ timedOut: true }>((resolve) =>
      setTimeout(() => resolve({ timedOut: true }), 9000)
    );
    const result: any = await Promise.race([brain, timeout]);

    if (result?.timedOut) return reply({ response: COURTESY });
    const answer = String(result?.data?.response ?? "").trim();
    if (!answer || result?.error) return reply({ response: COURTESY });

    return reply({ response: answer });
  } catch (_) {
    return reply({ response: COURTESY });
  }
});
