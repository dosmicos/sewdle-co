export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: unknown;
};

export type ElsaAction = {
  type:
    | "none"
    | "handoff"
    | "collect_order_data"
    | "create_order_draft"
    | "send_payment_link";
  reason?: string;
  payload?: Record<string, unknown>;
};

export type ElsaStructuredResponse = {
  reply: string;
  confidence?: number;
  handoff_required?: boolean;
  handoff_reason?: string;
  actions?: ElsaAction[];
  learning_notes?: string[];
};

const COLOMBIA_WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
const COLOMBIA_MONTHS = [
  "",
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function textFromMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const typed = part as Record<string, any>;
          if (typed.type === "image_url" || typed.type === "input_image") {
            return "[imagen adjunta]";
          }
          return typed.text || typed.input_text || typed.output_text || "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(content ?? "");
}

export function safeSnippet(value: unknown, max = 700): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function buildConversationTranscript(messages: ChatMessage[]): string {
  const transcript = messages
    .filter((m) => m.role !== "system")
    .map((m) =>
      `${m.role === "user" ? "Cliente" : "Dosmicos"}: ${
        textFromMessageContent(m.content)
      }`
    )
    .filter((line) => line.replace(/^(Cliente|Dosmicos):\s*/, "").trim())
    .join("\n");

  return transcript || "Sin historial reciente.";
}

function normalizeStructuredResponse(
  parsed: any,
): ElsaStructuredResponse | null {
  if (!parsed || typeof parsed !== "object") return null;
  const reply = typeof parsed.reply === "string"
    ? parsed.reply
    : typeof parsed.response === "string"
    ? parsed.response
    : "";
  if (!reply) return null;
  return { ...parsed, reply };
}

export function extractJsonObject(text: string): ElsaStructuredResponse | null {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const normalized = normalizeStructuredResponse(JSON.parse(candidate));
      if (normalized) return normalized;
    } catch (_) {
      // try next candidate
    }
  }
  return null;
}

export function extractHermesOutputText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;

  const responseOutput = (data?.output || [])
    .flatMap((item: any) => item?.content || [])
    .map((content: any) => {
      if (typeof content === "string") return content;
      return content?.text || content?.input_text || content?.output_text || "";
    })
    .filter(Boolean)
    .join("\n");
  if (responseOutput) return responseOutput;

  return data?.choices?.[0]?.message?.content || "";
}

export function colombiaDateContext(now = new Date()): string {
  const colombiaTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const year = colombiaTime.getUTCFullYear();
  const month = colombiaTime.getUTCMonth() + 1;
  const day = colombiaTime.getUTCDate();
  const hour = String(colombiaTime.getUTCHours()).padStart(2, "0");
  const minute = String(colombiaTime.getUTCMinutes()).padStart(2, "0");
  const weekday = COLOMBIA_WEEKDAYS[colombiaTime.getUTCDay()];
  const monthName = COLOMBIA_MONTHS[month] || "";

  return `FECHA Y HORA ACTUAL (Colombia): ${weekday} ${day} de ${monthName} de ${year}, ${hour}:${minute} hora Colombia.`;
}

export function buildElsaPrompt(params: {
  messages: ChatMessage[];
  systemPrompt?: string;
  sewdleContext: Record<string, unknown>;
  now?: Date;
}) {
  const transcript = buildConversationTranscript(params.messages);
  const dateContext = colombiaDateContext(params.now || new Date());

  return `Eres Elsa, agente Hermes de atención y ventas para Dosmicos dentro de Sewdle.

${dateContext}
Usa esta fecha verificada para responder sobre horarios, envíos, despachos y tiempos de entrega. Si el historial menciona otra fecha o día, ignóralo.

INSTRUCCIONES DE SEWDLE / CANAL:
${
    params.systemPrompt ||
    "Responder en español como asesora experta de Dosmicos."
  }

CONTEXTO ESTRUCTURADO DE SEWDLE:
${JSON.stringify(params.sewdleContext, null, 2)}

CONVERSACIÓN RECIENTE:
${transcript}

TAREA:
Responde el último mensaje del cliente. Usa el historial y los aprendizajes humanos si aplican.
Si puedes resolver, responde directo. Si faltan datos para pedido, pide solo el siguiente dato faltante.
Si hace falta humano, dilo de forma natural y marca handoff_required=true.

FORMATO OBLIGATORIO:
Devuelve SOLO JSON válido, sin markdown, con esta forma:
{
  "reply": "mensaje exacto para enviar al cliente",
  "confidence": 0.0,
  "handoff_required": false,
  "handoff_reason": "",
  "actions": [{"type":"none","reason":"","payload":{}}],
  "learning_notes": []
}

Reglas:
- reply debe ser corto, natural, en español colombiano.
- No inventes disponibilidad, precios ni estado de pedidos.
- No incluyas datos internos, JSON, explicación ni comentarios en reply.
- confidence entre 0 y 1.
- actions puede sugerir collect_order_data/create_order_draft/send_payment_link/handoff, pero NO asumas que ya se ejecutó.`;
}
