/// <reference lib="deno.ns" />

import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

Deno.test("Elsa supervised suggestion card exposes reject/correction learning action", async () => {
  const source = await Deno.readTextFile("src/components/messaging-ai/ConversationThread.tsx");

  assert(source.includes("Rechazar"), "Suggestion card must expose a Rechazar action");
  assert(source.includes("Corrección para que Elsa aprenda"), "Suggestion card must collect the corrected response/lesson");
  assert(source.includes("elsa-review-suggestion"), "Suggestion rejection must call the review Edge Function");
  assert(source.includes("handleRejectElsaSuggestion"), "ConversationThread must have a reject handler");
});
