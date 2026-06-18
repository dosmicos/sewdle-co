export type ElsaLearningStatus = "needs_review" | "active" | "archived";

export type ElsaLearningForCuration = {
  category?: string | null;
  situation?: string | null;
  recommended_response?: string | null;
  avoid_response?: string | null;
  confidence?: number | string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ElsaLearningCurationDecision = {
  recommendedStatus: ElsaLearningStatus;
  autoApply: boolean;
  reason:
    | "safe_repeated_pattern"
    | "low_value_or_generic_capture"
    | "needs_human_review";
  riskFlags: string[];
  confidence: number;
};

const SAFE_AUTO_ACTIVE_CATEGORIES = new Set([
  "general",
  "sizes",
  "shipping",
  "pricing",
]);

const SENSITIVE_CATEGORIES = new Set([
  "payments",
  "order_creation",
  "changes",
  "returns",
  "refunds",
]);

const SENSITIVE_TERMS = [
  "pedido",
  "orden",
  "guia",
  "guía",
  "transportadora",
  "coordinadora",
  "reclamo",
  "queja",
  "devolucion",
  "devolución",
  "cambio",
  "garantia",
  "garantía",
  "direccion",
  "dirección",
  "cedula",
  "cédula",
  "transferencia",
  "bancolombia",
  "nequi",
  "daviplata",
  "cuenta",
  "comprobante",
  "saldo",
  "factura",
  "mayorista",
  "descuento",
];

const GENERIC_LOW_VALUE_PHRASES = [
  "no tengo esa informacion",
  "no tengo esa información",
  "te conecto con el equipo",
  "conecto con el equipo",
  "cuentame en que te puedo ayudar",
  "cuéntame en qué te puedo ayudar",
  "hola soy alejandra",
  "hola, soy alejandra",
];

const CURATION_STOP_WORDS = new Set([
  "a",
  "al",
  "ante",
  "antes",
  "con",
  "contra",
  "de",
  "del",
  "desde",
  "despues",
  "después",
  "e",
  "el",
  "ella",
  "ellas",
  "ellos",
  "en",
  "entre",
  "es",
  "esa",
  "ese",
  "eso",
  "esta",
  "está",
  "este",
  "esto",
  "la",
  "las",
  "le",
  "les",
  "lo",
  "los",
  "me",
  "mi",
  "mis",
  "muy",
  "ni",
  "o",
  "os",
  "para",
  "pero",
  "por",
  "porque",
  "que",
  "se",
  "sin",
  "sobre",
  "su",
  "sus",
  "te",
  "tu",
  "tus",
  "un",
  "una",
  "uno",
  "unos",
  "unas",
  "ya",
  "yo",
  "porfa",
  "favor",
  "hola",
  "buenos",
  "buenas",
  "dias",
  "día",
  "dia",
  "cliente",
  "clienta",
  "pregunta",
  "preguntar",
  "quisiera",
  "quiero",
  "necesito",
  "me",
  "gustaria",
  "gustaría",
  "puede",
  "podria",
  "podría",
  "sirve",
  "sirven",
  "servir",
  "recomienda",
  "recomiendas",
  "recomendar",
  "escoger",
  "escoge",
  "elegir",
  "edad",
  "altura",
  "alto",
  "medida",
  "medidas",
  "medir",
  "segun",
  "según",
  "segun",
]);

const CURATION_SYNONYMS: Record<string, string> = {
  altura: "estatura",
  alto: "estatura",
  estatura: "estatura",
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ$%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedCategory(value: unknown): string {
  return normalize(value || "general") || "general";
}

function normalizeConfidence(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.55;
  const ratio = numeric > 1 ? numeric / 100 : numeric;
  return Math.max(0, Math.min(1, ratio));
}

function canonicalizeToken(token: string): string {
  return CURATION_SYNONYMS[token] || token;
}

function meaningfulTokens(value: unknown): string[] {
  const normalized = normalize(value).replace(/\b\d+\b/g, " 0 ");
  const tokens = normalized
    .split(" ")
    .map(canonicalizeToken)
    .filter((token) => token && !CURATION_STOP_WORDS.has(token))
    .filter((token) => token.length > 2 || token === "0");

  return Array.from(new Set(tokens)).sort((a, b) => a.localeCompare(b, "es"));
}

function canonicalText(value: unknown): string {
  return meaningfulTokens(value).join(" ");
}

function textBundle(learning: ElsaLearningForCuration): string {
  return [
    learning.category,
    learning.situation,
    learning.recommended_response,
    learning.avoid_response,
  ].map(normalize).join(" ");
}

function hasPossiblePii(text: string): boolean {
  const raw = String(text || "");
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(raw)) return true;

  const digitGroups = raw.match(/\d[\d\s.-]{6,}\d/g) || [];
  return digitGroups.some((group) => {
    const digits = group.replace(/\D/g, "");
    return /^3\d{9}$/.test(digits) || /^\d{8,12}$/.test(digits);
  });
}

function isLowValueCapture(learning: ElsaLearningForCuration): boolean {
  const situation = normalize(learning.situation);
  const response = normalize(learning.recommended_response);
  const avoid = normalize(learning.avoid_response);
  if (response.length < 25) return true;
  if (situation.length < 18 && response.length < 80) return true;
  if (
    !avoid &&
    GENERIC_LOW_VALUE_PHRASES.some((phrase) =>
      response.includes(normalize(phrase))
    )
  ) {
    return true;
  }
  return false;
}

export function learningCurationSignature(
  learning: ElsaLearningForCuration,
): string {
  return [
    normalizedCategory(learning.category),
    canonicalText(learning.situation).slice(0, 160),
    canonicalText(learning.recommended_response).slice(0, 220),
  ].join("|");
}

export function classifyLearningForCuration(params: {
  learning: ElsaLearningForCuration;
  duplicateCount?: number;
}): ElsaLearningCurationDecision {
  const learning = params.learning;
  const duplicateCount = Math.max(1, Number(params.duplicateCount || 1));
  const category = normalizedCategory(learning.category);
  const confidence = normalizeConfidence(learning.confidence);
  const bundle = textBundle(learning);
  const rawBundle = [
    learning.situation,
    learning.recommended_response,
    learning.avoid_response,
  ].join(" ");
  const riskFlags: string[] = [];

  if (hasPossiblePii(rawBundle)) riskFlags.push("possible_pii");

  const hasSensitiveCategory = SENSITIVE_CATEGORIES.has(category);
  const hasSensitiveTerms = SENSITIVE_TERMS.some((term) =>
    bundle.includes(normalize(term))
  );
  if (hasSensitiveCategory || hasSensitiveTerms) {
    riskFlags.push("sensitive_policy_or_order");
  }

  if (isLowValueCapture(learning)) {
    return {
      recommendedStatus: "archived",
      autoApply: true,
      reason: "low_value_or_generic_capture",
      riskFlags,
      confidence,
    };
  }

  const safeCategory = SAFE_AUTO_ACTIVE_CATEGORIES.has(category);
  const safeRepeated = safeCategory && duplicateCount >= 3 &&
    confidence >= 0.85 && riskFlags.length === 0;

  if (safeRepeated) {
    return {
      recommendedStatus: "active",
      autoApply: true,
      reason: "safe_repeated_pattern",
      riskFlags,
      confidence: Math.max(confidence, 0.82),
    };
  }

  return {
    recommendedStatus: "needs_review",
    autoApply: false,
    reason: "needs_human_review",
    riskFlags,
    confidence,
  };
}

export function buildCurationMetadata(params: {
  decision: ElsaLearningCurationDecision;
  duplicateCount: number;
  runId: string;
  now?: Date;
}) {
  return {
    curation: {
      run_id: params.runId,
      reviewed_at: (params.now || new Date()).toISOString(),
      recommended_status: params.decision.recommendedStatus,
      auto_apply: params.decision.autoApply,
      reason: params.decision.reason,
      risk_flags: params.decision.riskFlags,
      duplicate_count: params.duplicateCount,
    },
  };
}
