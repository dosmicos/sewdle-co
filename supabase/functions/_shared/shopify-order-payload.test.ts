/// <reference lib="deno.ns" />

import { buildShopifyOrderPayload } from "./shopify-order-payload.ts";

function assertEquals(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}

Deno.test("buildShopifyOrderPayload marks contra entrega with pending COD transaction gateway", () => {
  const payload = buildShopifyOrderPayload({
    orderData: {
      customerName: "Cliente Prueba",
      cedula: "123",
      email: "cliente@example.com",
      phone: "3001234567",
      address: "Calle 1 # 2-3",
      city: "Roldanillo",
      department: "Valle del Cauca",
      neighborhood: "Centro",
      notes: "Pedido desde WhatsApp",
      shippingCost: 5000,
      paymentMethod: "contra_entrega",
    },
    validatedLineItems: [{ variant_id: 46581502771435, quantity: 1 }],
    totalAmount: 101900,
  });

  assertEquals(payload.order.financial_status, "pending");
  assertEquals(payload.order.gateway, "Cash on Delivery (COD)");
  assertEquals(payload.order.transactions, [{
    kind: "sale",
    status: "pending",
    amount: "101900.00",
    gateway: "Cash on Delivery (COD)",
  }]);
  assertEquals(payload.order.tags, "whatsapp, messaging, Contraentrega");
});
