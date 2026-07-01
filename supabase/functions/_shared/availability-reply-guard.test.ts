import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildKnownVariantAvailabilityReply,
  extractRequestedSize,
  isAvailabilityDeferralReply,
  shouldReplaceAvailabilityDeferralReply,
} from "./availability-reply-guard.ts";

const rinoceronte = {
  title: "Ruana Rinoceronte",
  variants: [
    { title: "2 (3 - 12 meses)", option1: "2 (3 - 12 meses)", inventory_quantity: 10 },
    { title: "8 (4 - 5 años)", option1: "8 (4 - 5 años)", inventory_quantity: 10 },
    { title: "12 (8 - 9 años)", option1: "12 (8 - 9 años)", inventory_quantity: 0 },
  ],
};

Deno.test("extractRequestedSize reads explicit talla without confusing age ranges", () => {
  assertEquals(extractRequestedSize("Y está en talla 12?"), "12");
});

Deno.test("availability deferral detector catches te reviso replies", () => {
  assertEquals(
    isAvailabilityDeferralReply("Te reviso si la Ruana Rinoceronte está disponible en esa talla y te confirmamos por aquí."),
    true,
  );
});

Deno.test("known variant guard replies agotada for Ruana Rinoceronte talla 12", () => {
  const reply = buildKnownVariantAvailabilityReply(
    "Ruana Rinoceronte\nY está en talla 12?",
    [rinoceronte],
  );

  assertEquals(
    reply,
    "En talla 12 la Ruana Rinoceronte está agotada por ahora 😕 Tenemos disponible: 2 (3 - 12 meses) (10 disponibles), 8 (4 - 5 años) (10 disponibles). ¿Quieres que te ayude con otra talla o revisamos otro diseño?",
  );
});

Deno.test("known variant guard replaces deferral only when stock is known", () => {
  assertEquals(
    shouldReplaceAvailabilityDeferralReply(
      "La talla 12 en ruanas es para 8 a 10 años 😊 Te reviso si la Ruana Rinoceronte está disponible en esa talla y te confirmamos por aquí.",
      "Ruana Rinoceronte\nY está en talla 12?",
      [rinoceronte],
    ),
    true,
  );

  assertEquals(
    shouldReplaceAvailabilityDeferralReply(
      "Te reviso y te confirmamos por aquí.",
      "¿Está disponible?",
      [rinoceronte],
    ),
    false,
  );
});
