import {
  buildSupervisedSuggestionMetadata,
  resolveAiDeliveryPlan,
  resolveAiRuntime,
} from "./elsa-supervision.ts";

function assertEquals(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}

function env(values: Record<string, string | undefined>) {
  return (key: string) => values[key];
}

Deno.test("resolveAiRuntime routes Elsa providers to the Hermes bridge without supervision by default", () => {
  const runtime = resolveAiRuntime({ aiProvider: "elsa" }, {
    defaultProvider: "openai",
    env: env({}),
  });

  assertEquals(runtime.provider, "elsa");
  assertEquals(runtime.isElsaProvider, true);
  assertEquals(runtime.functionName, "elsa-hermes-agent");
  assertEquals(runtime.supervised, false);
});

Deno.test("resolveAiRuntime enables supervised mode from channel feature flag", () => {
  const runtime = resolveAiRuntime(
    { aiProvider: "hermes", elsaMode: "supervised" },
    { defaultProvider: "openai", env: env({}) },
  );

  assertEquals(runtime.functionName, "elsa-hermes-agent");
  assertEquals(runtime.supervised, true);
  assertEquals(runtime.supervisionSource, "channel.ai_config.elsaMode");
});

Deno.test("resolveAiRuntime enables supervised mode from environment feature flag only for Elsa", () => {
  const elsaRuntime = resolveAiRuntime(
    { aiProvider: "elsa-hermes" },
    { defaultProvider: "openai", env: env({ ELSA_SUPERVISED_MODE: "true" }) },
  );
  const openAiRuntime = resolveAiRuntime(
    { aiProvider: "openai" },
    { defaultProvider: "openai", env: env({ ELSA_SUPERVISED_MODE: "true" }) },
  );

  assertEquals(elsaRuntime.supervised, true);
  assertEquals(elsaRuntime.supervisionSource, "env.ELSA_SUPERVISED_MODE");
  assertEquals(openAiRuntime.functionName, "messaging-ai-openai");
  assertEquals(openAiRuntime.supervised, false);
});

Deno.test("resolveAiDeliveryPlan stores Elsa suggestions but suppresses outbound sends in supervised mode", () => {
  const runtime = resolveAiRuntime(
    { aiProvider: "elsa", elsaMode: "supervised" },
    { defaultProvider: "openai", env: env({}) },
  );

  assertEquals(resolveAiDeliveryPlan(runtime, "Hola"), {
    shouldSendToCustomer: false,
    shouldPersistSuggestion: true,
  });
});

Deno.test("buildSupervisedSuggestionMetadata keeps reviewable Elsa output without customer send state", () => {
  const metadata = buildSupervisedSuggestionMetadata({
    aiText: "Claro, sí tenemos ruanas talla 4.",
    aiData: {
      provider: "hermes",
      confidence: 0.82,
      handoff_required: false,
      actions: [{ type: "none" }],
      elapsed_ms: 1200,
    },
    runtime: resolveAiRuntime(
      { aiProvider: "elsa", elsaMode: "supervised" },
      { defaultProvider: "openai", env: env({}) },
    ),
  });

  assertEquals(
    metadata.elsa_supervised_suggestion.text,
    "Claro, sí tenemos ruanas talla 4.",
  );
  assertEquals(metadata.elsa_supervised_suggestion.sent_to_customer, false);
  assertEquals(metadata.elsa_supervised_suggestion.provider, "hermes");
  assertEquals(metadata.elsa_supervised_suggestion.confidence, 0.82);
  assertEquals(metadata.elsa_supervised_suggestion.actions, [{ type: "none" }]);
});
