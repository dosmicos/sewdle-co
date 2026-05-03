/// <reference lib="deno.ns" />

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("messaging realtime schedules follow-up refreshes after message inserts for supervised suggestions", async () => {
  const source = await Deno.readTextFile(new URL("./useMessagingRealtime.ts", import.meta.url));

  assert(
    source.includes("SUPERVISED_SUGGESTION_REFRESH_DELAYS_MS"),
    "Realtime hook should define follow-up refresh delays for Elsa supervised suggestions",
  );
  assert(
    source.includes("scheduleSupervisedSuggestionRefreshes"),
    "Realtime hook should schedule delayed refreshes after inbound messages",
  );
  assert(
    source.includes("scheduleSupervisedSuggestionRefreshes();"),
    "Message INSERT handler should trigger delayed refreshes so metadata-only Elsa updates appear promptly",
  );
});
