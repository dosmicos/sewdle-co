import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canonicalCarrier } from "./carrier.ts";

Deno.test("normaliza todas las variantes de Interrapidísimo a 'interrapidisimo'", () => {
  for (const v of ["interRapidisimo", "Interrapidísimo", "INTERRAPIDISIMO", " inter rapidisimo "]) {
    assertEquals(canonicalCarrier(v), "interrapidisimo");
  }
});

Deno.test("normaliza Coordinadora y Deprisa", () => {
  assertEquals(canonicalCarrier("Coordinadora"), "coordinadora");
  assertEquals(canonicalCarrier("COORDINADORA"), "coordinadora");
  assertEquals(canonicalCarrier("DEPRISA"), "deprisa");
});

Deno.test("nombre comercial con sufijo cae al canónico", () => {
  assertEquals(canonicalCarrier("Servientrega S.A."), "servientrega");
});

Deno.test("desconocido cae a slug minúsculo sin tildes; vacío es vacío", () => {
  assertEquals(canonicalCarrier("Otra Transportadora"), "otratransportadora");
  assertEquals(canonicalCarrier(""), "");
  assertEquals(canonicalCarrier(null), "");
});
