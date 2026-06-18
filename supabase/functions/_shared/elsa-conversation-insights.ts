export type ConversationInsightType =
  | "product_request"
  | "catalog_gap"
  | "answer_improvement"
  | "quality_feedback"
  | "customer_objection"
  | "operations_friction"
  | "positive_signal"
  | "general";

export type ConversationInsightSentiment = "opportunity" | "improvement" | "positive" | "risk" | "neutral";
export type ConversationInsightPriority = "low" | "medium" | "high";
export type ConversationInsightStatus = "new" | "reviewing" | "approved" | "archived" | "done";

export type ConversationInsightInput = {
  organizationId: string;
  conversationId?: string | null;
  messageIds?: string[];
  text: string;
  source: "customer_message" | "human_feedback" | "human_reply" | "elsa_review" | "manual_note";
};

export type ConversationInsightCandidate = {
  organization_id: string;
  type: ConversationInsightType;
  sentiment: ConversationInsightSentiment;
  priority: ConversationInsightPriority;
  status: ConversationInsightStatus;
  summary: string;
  evidence: string;
  tags: string[];
  source: ConversationInsightInput["source"];
  source_conversation_ids: string[];
  source_message_ids: string[];
  metadata: Record<string, unknown>;
};

const PRODUCT_REQUEST_PATTERNS = [
  /\b(quiero|busco|tienen|tendrán|hacen|podrían hacer|me gustaría)\b/i,
  /\b(adulto|adulta|mam[áa]|pap[áa]|familiar|familia|combo|igual para mí|para mi)\b/i,
  /\b(diseño|cerdito|princesa|dinosaurio|patr[oó]n|estampado|talla|color)\b/i,
];

const IMPROVEMENT_PATTERNS = [
  /\b(no deber[íi]a|deber[íi]a|lo l[oó]gico|hay que|mejor|error|mal|fall[oó]|corregir|cosas a mejorar)\b/i,
  /\b(Elsa|respuesta|responder|cat[aá]logo|pedido|checkout|link)\b/i,
];

const QUALITY_PATTERNS = [
  /\b(calidad|stain|mancha|manchado|dañad[oa]|roto|defecto|decolor|mot[ai]s?|costura)\b/i,
];

const OBJECTION_PATTERNS = [
  /\b(caro|costoso|env[ií]o|demora|precio|descuento|rebaja|muy alto|no me alcanza)\b/i,
];

const POSITIVE_PATTERNS = [
  /\b(me encanta|me encant[oó]|hermos[oa]|divin[oa]|excelente|perfecto|gracias|comprar otra vez|repetir)\b/i,
];

const ROUTINE_CHECKOUT_PATTERNS = [
  /\bnombre\s*:/i,
  /\bdirecci[oó]n\s*:/i,
  /\b(ciudad|departamento)\s*:/i,
  /\b(c[eé]dula|documento)\s*:/i,
  /\b(celular|tel[eé]fono)\s*:/i,
  /\b(pago|m[eé]todo de pago)\s*:/i,
];

export function redactInsightEvidence(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?57\s*)?(?:3\d{2}|60\d|\(?60\d\)?)[\s.-]*\d{3}[\s.-]*\d{4}\b/g, "[teléfono]")
    .replace(/(?:pedido|orden)\s*#?\s*\d{4,}/gi, "pedido [pedido]")
    .replace(/#\d{4,}/g, "[pedido]")
    .replace(/\b(?:c[eé]dula|cc|documento)\s*:?\s*\d{5,}\b/gi, "cédula [documento]")
    .replace(/\b(?:calle|cra\.?|carrera|cll\.?|avenida|av\.?|diagonal|transversal|tv\.?|kr\.?)\s+[^,\n]{4,80}/gi, "[dirección]")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function isRoutineCheckout(text: string) {
  return ROUTINE_CHECKOUT_PATTERNS.filter((pattern) => pattern.test(text)).length >= 4;
}

export function shouldCaptureConversationInsight(text: string): boolean {
  const normalized = text.trim();
  if (normalized.length < 12) return false;
  if (isRoutineCheckout(normalized) && !hasAny(normalized, IMPROVEMENT_PATTERNS)) return false;

  return hasAny(normalized, PRODUCT_REQUEST_PATTERNS) ||
    hasAny(normalized, IMPROVEMENT_PATTERNS) ||
    hasAny(normalized, QUALITY_PATTERNS) ||
    hasAny(normalized, OBJECTION_PATTERNS) ||
    hasAny(normalized, POSITIVE_PATTERNS);
}

function classifyInsight(text: string, source: ConversationInsightInput["source"]): {
  type: ConversationInsightType;
  sentiment: ConversationInsightSentiment;
  priority: ConversationInsightPriority;
} {
  if (hasAny(text, IMPROVEMENT_PATTERNS) || source === "human_feedback" || source === "elsa_review") {
    return { type: "answer_improvement", sentiment: "improvement", priority: "high" };
  }
  if (hasAny(text, QUALITY_PATTERNS)) {
    return { type: "quality_feedback", sentiment: "risk", priority: "high" };
  }
  if (hasAny(text, PRODUCT_REQUEST_PATTERNS)) {
    return { type: "product_request", sentiment: "opportunity", priority: "medium" };
  }
  if (hasAny(text, OBJECTION_PATTERNS)) {
    return { type: "customer_objection", sentiment: "risk", priority: "medium" };
  }
  if (hasAny(text, POSITIVE_PATTERNS)) {
    return { type: "positive_signal", sentiment: "positive", priority: "low" };
  }
  return { type: "general", sentiment: "neutral", priority: "low" };
}

function buildTags(text: string, type: ConversationInsightType): string[] {
  const tags = new Set<string>();
  if (type !== "general") tags.add(type.replace(/_/g, "-"));
  if (/\badult[oa]\b/i.test(text)) tags.add("version-adulto");
  if (/\b(combo|familia|familiar|igual para mí|para mi beb[eé])\b/i.test(text)) tags.add("combo-familiar");
  if (/\b(cat[aá]logo|link|producto ya elegido|ya eligi[oó]|ya escog)/i.test(text)) tags.add("no-reiniciar-catalogo");
  if (/\b(pedido|checkout|datos|pago|link de pago)\b/i.test(text)) tags.add("checkout-flow");
  if (/\b(talla|tallas|adult[oa]|niñ[oa])\b/i.test(text)) tags.add("tallas");
  if (/\b(calidad|mancha|defecto|dañad[oa]|roto|decolor)\b/i.test(text)) tags.add("calidad");
  if (/\b(caro|precio|descuento|rebaja|env[ií]o)\b/i.test(text)) tags.add("objecion");
  return Array.from(tags).slice(0, 12);
}

function summarizeInsight(text: string, type: ConversationInsightType): string {
  const evidence = redactInsightEvidence(text);
  const compact = evidence.length > 220 ? `${evidence.slice(0, 217).trim()}...` : evidence;

  if (type === "product_request") return `Solicitud de producto/catálogo: ${compact}`;
  if (type === "answer_improvement") return `Mejora para respuesta de Elsa: ${compact}`;
  if (type === "quality_feedback") return `Feedback de calidad: ${compact}`;
  if (type === "customer_objection") return `Objeción/fricción comercial: ${compact}`;
  if (type === "positive_signal") return `Señal positiva del cliente: ${compact}`;
  return compact;
}

export function buildConversationInsightCandidate(
  input: ConversationInsightInput,
): ConversationInsightCandidate | null {
  if (!shouldCaptureConversationInsight(input.text)) return null;

  const { type, sentiment, priority } = classifyInsight(input.text, input.source);
  const evidence = redactInsightEvidence(input.text);
  const tags = buildTags(input.text, type);

  return {
    organization_id: input.organizationId,
    type,
    sentiment,
    priority,
    status: "new",
    summary: summarizeInsight(input.text, type),
    evidence,
    tags,
    source: input.source,
    source_conversation_ids: input.conversationId ? [input.conversationId] : [],
    source_message_ids: input.messageIds || [],
    metadata: {
      generated_by: "elsa_conversation_insights_v1",
      pii_redacted: true,
      capture_reason: tags,
    },
  };
}
