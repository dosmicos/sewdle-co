function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("WhatsApp AI routing honors Elsa supervised runtime instead of hardcoded OpenAI send", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const start = source.indexOf("// Generate and send AI response if enabled");
  const end = source.indexOf("// NOTE: Order creation is handled by messaging-ai-openai", start);

  assert(start !== -1, "WhatsApp AI response block was not found");
  assert(end !== -1, "WhatsApp AI response block end marker was not found");

  const block = source.slice(start, end);

  assert(
    !block.includes("const functionName = 'messaging-ai-openai'"),
    "WhatsApp AI block must not hardcode messaging-ai-openai; it must honor channel.ai_config.aiProvider",
  );
  assert(
    block.includes("resolveAiRuntime"),
    "WhatsApp AI block must resolve aiProvider/elsaMode from channel.ai_config",
  );
  assert(
    block.includes("resolveAiDeliveryPlan"),
    "WhatsApp AI block must use delivery plan to suppress outbound sends in supervised mode",
  );
  assert(
    block.includes("buildSupervisedSuggestionMetadata"),
    "WhatsApp AI block must persist Elsa supervised suggestions to conversation metadata",
  );
  assert(
    block.includes("shouldPersistSuggestion"),
    "WhatsApp AI block must branch on supervised suggestion persistence before sending",
  );
});
