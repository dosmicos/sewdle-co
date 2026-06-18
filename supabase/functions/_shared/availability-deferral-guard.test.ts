import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildAvailabilityCorrection,
  isAvailabilityDeferral,
} from "./availability-deferral-guard.ts";

// Real catalog shape (subset), with the real stock from production 2026-06-18.
const catalog: any[] = [
  {
    id: 1,
    title: "Ruana Hipopótamo",
    variants: [
      { id: 11, title: "2 (3 - 12 meses)", inventory_quantity: 5 },
      { id: 12, title: "4 (1 - 2 años)", inventory_quantity: 8 },
      { id: 13, title: "6 (3 - 4 años)", inventory_quantity: 4 },
      { id: 14, title: "8 (4 - 5 años)", inventory_quantity: 20 },
      { id: 15, title: "10 (6 - 7 años)", inventory_quantity: 0 },
      { id: 16, title: "12 (8 - 9 años)", inventory_quantity: 0 },
    ],
  },
  {
    id: 2,
    title: "Ruana de Hipopotamo Adulto",
    variants: [{ id: 21, title: "Adulto", inventory_quantity: 5 }],
  },
  {
    id: 3,
    title: "Ruana Rinoceronte",
    variants: [
      { id: 31, title: "2 (3 - 12 meses)", inventory_quantity: 9 },
      { id: 32, title: "4 (1 - 2 años)", inventory_quantity: 46 },
      { id: 33, title: "6 (3 - 4 años)", inventory_quantity: 1 },
      { id: 34, title: "8 (4 - 5 años)", inventory_quantity: 10 },
      { id: 35, title: "10 (6 - 7 años)", inventory_quantity: 4 },
      { id: 36, title: "12 (8 - 9 años)", inventory_quantity: 0 },
    ],
  },
];

// --- Detection ---
Deno.test("detects the real evasive replies", () => {
  assert(isAvailabilityDeferral("Te revisamos disponibilidad y te confirmamos por aquí."));
  assert(isAvailabilityDeferral("Te reviso si la Ruana Rinoceronte está disponible en esa talla y te confirmamos por aquí."));
  assert(isAvailabilityDeferral("Estamos validando esa talla con bodega 😊"));
  assert(isAvailabilityDeferral("La debo validar en inventario antes de confirmarte 😊"));
});

Deno.test("does NOT flag correct or back-in-stock replies", () => {
  assertEquals(isAvailabilityDeferral("La Ruana Siberiano talla 8 está agotada por ahora 😔"), false);
  assertEquals(isAvailabilityDeferral("Listo 😊 te aviso por aquí apenas vuelva la Ruana Hipopótamo talla 10."), false);
  assertEquals(isAvailabilityDeferral("¡Sí! Está disponible 😊 ¿Te ayudo con el pedido?"), false);
});

// --- The exact production failures ---
Deno.test("REAL CASE Hipopótamo talla 10 (agotada) -> direct availability", () => {
  const out = buildAvailabilityCorrection(
    catalog,
    "Claro 😊 sería la Ruana Hipopótamo talla 10, que es para 6 a 7 años. Te revisamos disponibilidad y te confirmamos por aquí.",
    "También quiero está en talla 10, tall tienes?",
  );
  assert(out, "guard should produce a reply");
  assert(out!.includes("agotada"), `expected agotada, got: ${out}`);
  assert(out!.includes("2, 4, 6 y 8"), `expected available sizes 2,4,6,8, got: ${out}`);
  assert(!/te reviso|confirmamos|validando/i.test(out!), "must not be evasive");
});

Deno.test("REAL CASE Rinoceronte talla 12 (agotada) -> direct availability", () => {
  const out = buildAvailabilityCorrection(
    catalog,
    "La talla 12 en ruanas es para 8 a 10 años 😊 Te reviso si la Ruana Rinoceronte está disponible en esa talla y te confirmamos por aquí.",
    "Y está en talla 12?",
  );
  assert(out);
  assert(out!.includes("agotada"), out!);
  assert(out!.includes("2, 4, 6, 8 y 10"), `got: ${out}`);
});

Deno.test("in-stock size -> confirms available", () => {
  const out = buildAvailabilityCorrection(
    catalog,
    "Sería la Ruana Hipopótamo talla 8. Te reviso si está disponible y te confirmamos por aquí.",
    "quiero talla 8",
  );
  assert(out);
  assert(out!.toLowerCase().includes("disponible"), out!);
  assert(!out!.includes("agotada"), out!);
});

Deno.test("does not confuse Hipopótamo with Hipopotamo Adulto", () => {
  const out = buildAvailabilityCorrection(
    catalog,
    "Sería la Ruana Hipopótamo talla 10. Te reviso disponibilidad y te confirmamos por aquí.",
    "talla 10",
  );
  assert(out);
  // Must reference the kids product (has talla sizes), not the Adulto one.
  assert(out!.includes("Ruana Hipopótamo"), out!);
});

Deno.test("returns null when product cannot be resolved", () => {
  const out = buildAvailabilityCorrection(
    catalog,
    "Te reviso disponibilidad y te confirmamos por aquí.",
    "¿y en talla 10?",
  );
  assertEquals(out, null);
});

Deno.test("returns null when reply is not a deferral", () => {
  const out = buildAvailabilityCorrection(
    catalog,
    "La Ruana Hipopótamo talla 10 está agotada por ahora 😕",
    "talla 10",
  );
  assertEquals(out, null);
});
