const source = await Deno.readTextFile(
  new URL("./index.ts", import.meta.url),
);

function assertIncludes(actual: string, expected: string) {
  if (!actual.includes(expected)) {
    throw new Error(`Expected source to include ${expected}`);
  }
}

function assertNotIncludes(actual: string, expected: string) {
  if (actual.includes(expected)) {
    throw new Error(`Expected source not to include ${expected}`);
  }
}

Deno.test("Elsa context fetches channel knowledge base from the active messaging channel", () => {
  assertIncludes(source, '.from("messaging_channels")');
  assertIncludes(source, '.select("id, channel_name, ai_enabled, ai_config")');
  assertIncludes(source, "normalizeChannelKnowledge(channel?.ai_config || {})");
  assertIncludes(source, "context.channel_knowledge = channelKnowledge");
});

Deno.test("Elsa conversation context uses current messaging_conversations schema", () => {
  assertIncludes(source, "user_name");
  assertIncludes(source, "user_identifier");
  assertIncludes(source, "external_user_id");
  assertIncludes(source, "channel_id");
  assertNotIncludes(source, "customer_name, customer_phone");
});
