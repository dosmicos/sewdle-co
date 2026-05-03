export interface ElsaSupervisedSuggestion {
  text: string;
  provider?: string | null;
  confidence?: number | null;
  handoff_required?: boolean;
  handoff_reason?: string | null;
  actions?: unknown[];
  learning_notes?: unknown[];
  elapsed_ms?: number | null;
  function_name?: string | null;
  supervision_source?: string | null;
  sent_to_customer?: boolean;
  generated_at?: string | null;
}

export type ConversationMetadata = Record<string, unknown> | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function parseString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return undefined;
}

export function getElsaSupervisedSuggestion(
  metadata: ConversationMetadata,
): ElsaSupervisedSuggestion | null {
  if (!isRecord(metadata)) return null;

  const rawSuggestion = metadata.elsa_supervised_suggestion;
  if (!isRecord(rawSuggestion)) return null;

  const text = rawSuggestion.text;
  if (typeof text !== 'string' || !text.trim()) return null;

  return {
    text: text.trim(),
    provider: parseString(rawSuggestion.provider),
    confidence: parseNumber(rawSuggestion.confidence),
    handoff_required: rawSuggestion.handoff_required === true,
    handoff_reason: parseString(rawSuggestion.handoff_reason),
    actions: Array.isArray(rawSuggestion.actions) ? rawSuggestion.actions : [],
    learning_notes: Array.isArray(rawSuggestion.learning_notes) ? rawSuggestion.learning_notes : [],
    elapsed_ms: parseNumber(rawSuggestion.elapsed_ms),
    function_name: parseString(rawSuggestion.function_name),
    supervision_source: parseString(rawSuggestion.supervision_source),
    sent_to_customer: rawSuggestion.sent_to_customer === true,
    generated_at: parseString(rawSuggestion.generated_at),
  };
}

export function getPendingElsaSupervisedSuggestion(
  metadata: ConversationMetadata,
): ElsaSupervisedSuggestion | null {
  const suggestion = getElsaSupervisedSuggestion(metadata);
  if (!suggestion || suggestion.sent_to_customer) return null;
  return suggestion;
}

export function formatSuggestionConfidence(confidence: unknown): string | null {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return null;

  const percentage = confidence >= 0 && confidence <= 1
    ? Math.round(confidence * 100)
    : Math.round(confidence);

  if (percentage < 0 || percentage > 100) return null;
  return `${percentage}%`;
}
