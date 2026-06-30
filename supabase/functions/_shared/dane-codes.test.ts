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

// Regression: "Arauca, Caldas" (corregimiento de Palestina, sin código DANE propio)
// se resolvía al ÚNICO "Arauca" del mapa, que es la capital de Arauca (81001) → la guía
// salía a Arauca, Arauca. Ahora un override consciente del departamento lo lleva a
// Palestina, Caldas (17524), y el "Arauca" real (depto. Arauca) sigue intacto.
Deno.test("lookupDaneCode maps 'Arauca, Caldas' to Palestina, not Arauca capital", () => {
  const araucaCaldas = lookupDaneCode("Arauca", "Caldas");
  assertEquals(araucaCaldas?.daneCode, "17524000"); // Palestina, Caldas
  assertEquals(araucaCaldas?.source, "override");

  // El Arauca real (capital del depto. Arauca) no debe verse afectado.
  const araucaArauca = lookupDaneCode("Arauca", "Arauca");
  assertEquals(araucaArauca?.daneCode, "81001000");
});

// Un único match por nombre cuyo departamento NO coincide con el provisto no debe
// devolverse a ciegas (esa era la causa raíz). Sin override conocido → null (la guía
// se rechaza arriba con DANE_DEPARTMENT_MISMATCH para que el operario corrija).
Deno.test("lookupDaneCode does not return a single match from the wrong department", () => {
  // 'Leticia' solo existe en Amazonas; pedirla en 'Caldas' no debe devolver Amazonas.
  assertEquals(lookupDaneCode("Leticia", "Caldas"), null);
  // Sin departamento, el match único sí es válido.
  assertEquals(lookupDaneCode("Leticia")?.daneCode, "91001000");
});
