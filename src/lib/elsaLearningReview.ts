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

export type ElsaLearningCurationSummary = {
  headline: string;
  details: string;
  tone: "success" | "warning" | "muted";
  badges: string[];
};

function formatCurationDuplicateCount(count: number): string {
  if (count <= 1) return "1 vez";
  return `${count} veces`;
}

function formatRiskFlags(flags: string[]): string {
  const friendly = flags
    .map((flag) => {
      switch (flag) {
        case "possible_pii":
          return "PII posible";
        case "sensitive_policy_or_order":
          return "tema sensible/pedido";
        default:
          return flag.replace(/_/g, " ");
      }
    })
    .filter(Boolean);

  return friendly.join(" · ");
}

export function getLearningCurationSummary(
  learning: Pick<ElsaResponseLearning, "confidence" | "metadata" | "status">,
): ElsaLearningCurationSummary | null {
  const curation = (learning.metadata as Record<string, unknown> | null | undefined)?.curation as
    | {
      auto_apply?: boolean;
      recommended_status?: string;
      reason?: string;
      risk_flags?: string[];
      duplicate_count?: number;
    }
    | undefined;

  if (!curation) return null;

  const duplicateCount = Math.max(1, Number(curation.duplicate_count || 1));
  const confidence = formatLearningConfidence(learning.confidence);
  const riskFlags = Array.isArray(curation.risk_flags) ? curation.risk_flags.filter(Boolean) : [];
  const hasRisk = riskFlags.length > 0;
  const recommendedStatus = normalizeLearningStatus(curation.recommended_status || learning.status);

  if (curation.auto_apply && recommendedStatus === "active") {
    return {
      headline: "Autoaprobado por patrón repetido",
      details: `Se repitió ${formatCurationDuplicateCount(duplicateCount)}, quedó en una categoría segura y la confianza quedó en ${confidence}.`,
      tone: "success",
      badges: ["auto_apply", `x${duplicateCount}`],
    };
  }

  if (curation.auto_apply && recommendedStatus === "archived") {
    return {
      headline: "Archivado automáticamente",
      details: `Se detectó como captura genérica o de poco valor. Elsa lo mandó a archivo con confianza ${confidence}.`,
      tone: "muted",
      badges: ["auto_apply", `x${duplicateCount}`],
    };
  }

  return {
    headline: hasRisk ? "Sigue en revisión con alertas" : "Sigue en revisión",
    details: hasRisk
      ? `No alcanzó el umbral automático y además se marcó con ${formatRiskFlags(riskFlags)}. Se vio ${formatCurationDuplicateCount(duplicateCount)} y quedó con confianza ${confidence}.`
      : `No alcanzó el umbral para autoaprobarse. Se vio ${formatCurationDuplicateCount(duplicateCount)} y quedó con confianza ${confidence}.`,
    tone: "warning",
    badges: riskFlags.length ? riskFlags : ["needs_review"],
  };
}

export function normalizeLearningConfidence(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.55;
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
  return Math.max(0, Math.min(1, numeric));
}
