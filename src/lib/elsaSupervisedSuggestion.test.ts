/// <reference lib="deno.ns" />

import {
  formatSuggestionConfidence,
  getPendingElsaSupervisedSuggestion,
} from "./elsaSupervisedSuggestion.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test("getPendingElsaSupervisedSuggestion returns visible Elsa draft from conversation metadata", () => {
  const suggestion = getPendingElsaSupervisedSuggestion({
    elsa_supervised_suggestion: {
      text: "¡Claro! ¿Qué talla estás buscando?",
      provider: "hermes",
      confidence: 0.92,
      handoff_required: false,
      sent_to_customer: false,
      generated_at: "2026-05-03T17:00:00.000Z",
    },
  });

  assertEquals(suggestion?.text, "¡Claro! ¿Qué talla estás buscando?");
  assertEquals(suggestion?.provider, "hermes");
  assertEquals(suggestion?.sent_to_customer, false);
});

Deno.test("getPendingElsaSupervisedSuggestion hides suggestions already marked as sent", () => {
  const suggestion = getPendingElsaSupervisedSuggestion({
    elsa_supervised_suggestion: {
      text: "Respuesta anterior",
      sent_to_customer: true,
    },
  });

  assertEquals(suggestion, null);
});

Deno.test("formatSuggestionConfidence formats model confidence as a percentage", () => {
  assertEquals(formatSuggestionConfidence(0.923), "92%");
  assertEquals(formatSuggestionConfidence(87), "87%");
  assertEquals(formatSuggestionConfidence(null), null);
});
