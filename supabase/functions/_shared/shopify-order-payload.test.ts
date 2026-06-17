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

Deno.test("buildShopifyOrderPayload labels express shipping lines and tags the order", () => {
  const payload = buildShopifyOrderPayload({
    orderData: {
      customerName: "Cliente Prueba",
      cedula: "123",
      email: "cliente@example.com",
      phone: "3001234567",
      address: "Barrio Lago Timiza",
      city: "Bogotá",
      department: "Bogotá D.C.",
      notes: "Cliente pidió envío express a Bogotá con pago anticipado",
      shippingMethod: "express",
      shippingCost: 15000,
      paymentMethod: "link_de_pago",
    },
    validatedLineItems: [{ variant_id: 46581502771435, quantity: 1 }],
    totalAmount: 154900,
  });

  assertEquals(payload.order.shipping_lines, [{
    title: "Envío express",
    price: "15000",
    code: "EXPRESS_SHIPPING",
  }]);
  assertEquals(payload.order.tags, "whatsapp, messaging, Link de pago, Bold, Express");
});
