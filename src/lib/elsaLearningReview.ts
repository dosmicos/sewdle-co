export const ELSA_LEARNING_STATUSES = ["needs_review", "active", "archived"] as const;

export type ElsaLearningStatus = typeof ELSA_LEARNING_STATUSES[number];

export type ElsaResponseLearning = {
  id: string;
  organization_id: string;
  category: string;
  situation: string;
  recommended_response: string;
  avoid_response?: string | null;
  confidence: number | string | null;
  status: ElsaLearningStatus | string;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function normalizeLearningStatus(value: unknown): ElsaLearningStatus {
  const status = String(value || "").trim();
  return ELSA_LEARNING_STATUSES.includes(status as ElsaLearningStatus)
    ? status as ElsaLearningStatus
    : "needs_review";
}

export function getLearningStatusLabel(status: unknown): string {
  switch (normalizeLearningStatus(status)) {
    case "active":
      return "Activo";
    case "archived":
      return "Archivado";
    case "needs_review":
    default:
      return "Por revisar";
  }
}

export function formatLearningConfidence(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Sin confianza";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Sin confianza";
  const ratio = numeric > 1 ? numeric / 100 : numeric;
  return `${Math.round(ratio * 100)}%`;
}

export function getLearningStatusTone(status: unknown): "warning" | "success" | "muted" {
  switch (normalizeLearningStatus(status)) {
    case "active":
      return "success";
    case "archived":
      return "muted";
    default:
      return "warning";
  }
}

export function normalizeLearningConfidence(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.55;
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
  return Math.max(0, Math.min(1, numeric));
}
