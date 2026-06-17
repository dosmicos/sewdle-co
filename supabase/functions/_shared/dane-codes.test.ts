/// <reference lib="deno.ns" />

import { lookupDaneCode } from "./dane-codes.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

// Regression: "Ubaté" used to fuzzy-match "Sibaté" (Levenshtein 2 within the
// threshold) because the official DANE name is "Villa de San Diego de Ubaté".
Deno.test("lookupDaneCode resolves Ubaté to its own DANE code, not Sibaté", () => {
  const ubate = lookupDaneCode("Ubaté", "Cundinamarca");
  assertEquals(ubate?.daneCode, "25843000");
  assertEquals(ubate?.source, "exact");

  const sibate = lookupDaneCode("Sibaté", "Cundinamarca");
  assertEquals(sibate?.daneCode, "25740000");
});

Deno.test("lookupDaneCode resolves the official Ubaté name too", () => {
  const result = lookupDaneCode("Villa de San Diego de Ubaté", "Cundinamarca");
  assertEquals(result?.daneCode, "25843000");
});

// The fuzzy matcher must only fix obvious typos, never swap a real city for
// another nearby real city, and must refuse to guess when there is no match.
Deno.test("lookupDaneCode does not confuse distinct nearby municipalities", () => {
  // Itagüí must not resolve to Ibagué (Levenshtein 2)
  assertEquals(lookupDaneCode("Itagui", "Antioquia")?.daneCode, "05360000");
  assertEquals(lookupDaneCode("Ibague", "Tolima")?.daneCode, "73001000");
  // Giraldo must not resolve to Girardot
  assertEquals(lookupDaneCode("Giraldo", "Antioquia")?.daneCode, "05306000");
});

Deno.test("lookupDaneCode still corrects single-character typos", () => {
  assertEquals(lookupDaneCode("Manizalez", "Caldas")?.daneCode, "17001000");
});

Deno.test("lookupDaneCode returns null instead of guessing a far match", () => {
  assertEquals(lookupDaneCode("xyzqw", "Cundinamarca"), null);
});
