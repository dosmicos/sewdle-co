export type EnvReader = (key: string) => string | undefined;

export type AiRuntime = {
  provider: string;
  functionName:
    | "elsa-hermes-agent"
    | "messaging-ai-openai"
    | "messaging-ai-minimax";
  isElsaProvider: boolean;
  supervised: boolean;
  supervisionSource: string | null;
};

type ResolveOptions = {
  defaultProvider?: string;
  env?: EnvReader;
};

type DeliveryPlan = {
  shouldSendToCustomer: boolean;
  shouldPersistSuggestion: boolean;
};

const ELSA_PROVIDERS = new Set(["hermes", "elsa", "elsa-hermes"]);

function defaultEnv(key: string): string | undefined {
  return Deno.env.get(key) || undefined;
}

function normalizeProvider(value: unknown, fallback: string): string {
  const raw = String(value ?? fallback ?? "").trim().toLowerCase();
  return raw || String(fallback || "openai").toLowerCase();
}

function truthyFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "y", "on", "enabled", "supervised"].includes(
    value.trim().toLowerCase(),
  );
}

function channelSupervisionSource(
  aiConfig: Record<string, unknown>,
): string | null {
  if (String(aiConfig.elsaMode || "").toLowerCase() === "supervised") {
    return "channel.ai_config.elsaMode";
  }
  if (String(aiConfig.hermesMode || "").toLowerCase() === "supervised") {
    return "channel.ai_config.hermesMode";
  }
  if (truthyFlag(aiConfig.elsaSupervised)) {
    return "channel.ai_config.elsaSupervised";
  }
  if (truthyFlag(aiConfig.supervised)) return "channel.ai_config.supervised";
  return null;
}

function envSupervisionSource(env: EnvReader): string | null {
  if (truthyFlag(env("ELSA_SUPERVISED_MODE"))) {
    return "env.ELSA_SUPERVISED_MODE";
  }
  if (truthyFlag(env("HERMES_SUPERVISED_MODE"))) {
    return "env.HERMES_SUPERVISED_MODE";
  }
  return null;
}

export function resolveAiRuntime(
  aiConfig: Record<string, unknown> = {},
  options: ResolveOptions = {},
): AiRuntime {
  const env = options.env || defaultEnv;
  const provider = normalizeProvider(
    aiConfig.aiProvider,
    options.defaultProvider || "openai",
  );
  const isElsaProvider = ELSA_PROVIDERS.has(provider);
  const functionName = isElsaProvider
    ? "elsa-hermes-agent"
    : provider === "minimax"
    ? "messaging-ai-minimax"
    : "messaging-ai-openai";

  const supervisionSource = isElsaProvider
    ? channelSupervisionSource(aiConfig) || envSupervisionSource(env)
    : null;

  return {
    provider,
    functionName,
    isElsaProvider,
    supervised: Boolean(supervisionSource),
    supervisionSource,
  };
}

export function resolveAiDeliveryPlan(
  runtime: AiRuntime,
  aiText: string,
): DeliveryPlan {
  const hasText = Boolean((aiText || "").trim());
  return {
    shouldSendToCustomer: hasText && !runtime.supervised,
    shouldPersistSuggestion: hasText && runtime.supervised,
  };
}

export function buildSupervisedSuggestionMetadata(params: {
  aiText: string;
  aiData?: Record<string, unknown> | null;
  runtime: AiRuntime;
}) {
  const aiData = params.aiData || {};
  return {
    elsa_supervised_suggestion: {
      text: params.aiText,
      provider: aiData.provider ||
        (params.runtime.isElsaProvider ? "hermes" : params.runtime.provider),
      confidence: aiData.confidence ?? null,
      handoff_required: Boolean(aiData.handoff_required),
      handoff_reason: aiData.handoff_reason || null,
      actions: Array.isArray(aiData.actions) ? aiData.actions : [],
      learning_notes: Array.isArray(aiData.learning_notes)
        ? aiData.learning_notes
        : [],
      elapsed_ms: aiData.elapsed_ms ?? null,
      function_name: params.runtime.functionName,
      supervision_source: params.runtime.supervisionSource,
      sent_to_customer: false,
      generated_at: new Date().toISOString(),
    },
  };
}
