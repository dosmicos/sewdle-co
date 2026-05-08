/// <reference lib="deno.ns" />

import { detectEffectivePaymentMethod, isContraEntregaPayment } from "./paymentMethod.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test("detectEffectivePaymentMethod falls back to Contraentrega tag when Shopify gateway names are missing", () => {
  const method = detectEffectivePaymentMethod({
    paymentGatewayNames: [],
    tags: "Contraentrega, messaging, whatsapp",
    financialStatus: "pending",
  });

  assertEquals(method, "Contraentrega");
  assertEquals(isContraEntregaPayment({
    paymentGatewayNames: [],
    tags: "Contraentrega",
    financialStatus: "pending",
  }), true);
});

Deno.test("detectEffectivePaymentMethod maps Cash on Delivery gateway to Contraentrega", () => {
  assertEquals(detectEffectivePaymentMethod({
    paymentGatewayNames: ["bogus", "Cash on Delivery (COD)"],
    tags: "",
    financialStatus: "pending",
  }), "Contraentrega");
});
