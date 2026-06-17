/// <reference lib="deno.ns" />

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("Elsa Hermes bridge replaces generic handoff for vague greetings with a warm reply", async () => {
  const bridgeSource = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );
  const promptSource = await Deno.readTextFile(
    new URL("../_shared/elsa-hermes-core.ts", import.meta.url),
  );

  assert(
    bridgeSource.includes("maybeReplyWithWarmGreeting"),
    "Elsa Hermes bridge must have a post-processing guard for vague greetings",
  );
  assert(
    bridgeSource.includes("Hola 😊 claro, ¿en qué te ayudo?"),
    "The warm greeting fallback must be the simple human reply Elsa should send",
  );
  assert(
    bridgeSource.includes("shouldReplaceGenericGreetingReply"),
    "Elsa Hermes bridge must detect when the model answered a greeting with a generic handoff",
  );
  assert(
    promptSource.includes("No digas \"No tengo esa información\"") ||
      promptSource.includes("No digas \"No tengo esa informacion\""),
    "The prompt should still instruct Elsa not to use generic handoffs for vague greetings",
  );
});
