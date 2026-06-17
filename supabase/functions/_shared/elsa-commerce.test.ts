function assertEquals(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}

function assertObjectMatch(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
) {
  for (const [key, value] of Object.entries(expected)) {
    assertEquals(actual[key], value);
  }
}

import {
  buildAddiPaymentRequest,
  buildBoldPaymentLinkRequest,
  buildManualTransferDraftOrderRequest,
  buildShopifyCodOrderRequest,
  calculateOrderTotals,
  formatShopifyOrderCreatedReply,
  resolveCommerceLineItems,
  summarizeCommerceCatalogForPrompt,
} from "./elsa-commerce.ts";

const catalog = [
  {
    id: 101,
    title: "Ruana Pollito",
    variants: [
      {
        id: 1002,
        title: "2",
        sku: "POLLITO-2",
        price: "94900",
        inventory_quantity: 4,
      },
      {
        id: 1004,
        title: "4",
        sku: "POLLITO-4",
        price: "94900",
        inventory_quantity: 3,
      },
    ],
  },
  {
    id: 202,
    title: "Ruana Mapache Adulto",
    variants: [
      {
        id: 2008,
        title: "8",
        sku: "MAPACHE-8",
        price: "109900",
        inventory_quantity: 0,
      },
      {
        id: 2010,
        title: "10",
        sku: "MAPACHE-10",
        price: "109900",
        inventory_quantity: 2,
      },
    ],
  },
];

Deno.test("resolveCommerceLineItems resolves product and size from Elsa payload", () => {
  const result = resolveCommerceLineItems(catalog, [
    { productName: "pollito", size: 4, quantity: 2 },
  ]);

  assertEquals(result.errors, []);
  assertEquals(result.lineItems, [{
    productId: 101,
    productName: "Ruana Pollito",
    variantId: 1004,
    variantName: "4",
    sku: "POLLITO-4",
    quantity: 2,
  }]);
});

Deno.test("resolveCommerceLineItems rejects unavailable variants", () => {
  const result = resolveCommerceLineItems(catalog, [
    { productName: "mapache adulto", size: 8, quantity: 1 },
  ]);

  assertEquals(result.lineItems, []);
  assertEquals(result.errors.length, 1);
  assertEquals(result.errors[0].includes("sin stock"), true);
});

Deno.test("resolveCommerceLineItems requires confirmation when the product match is ambiguous", () => {
  const ambiguousCatalog = [
    {
      id: 301,
      title: "Chaqueta Impermeable Roja",
      variants: [{
        id: 3001,
        title: "Única",
        sku: "CHAQ-RED",
        price: "129900",
        inventory_quantity: 2,
      }],
    },
    {
      id: 302,
      title: "Chaqueta Impermeable Azul",
      variants: [{
        id: 3002,
        title: "Única",
        sku: "CHAQ-BLU",
        price: "129900",
        inventory_quantity: 2,
      }],
    },
  ];

  const result = resolveCommerceLineItems(ambiguousCatalog, [
    { productName: "chaqueta", quantity: 1 },
  ]);

  assertEquals(result.lineItems, []);
  assertEquals(
    result.errors.some((error) => error.includes("Confirma el producto exacto")),
    true,
  );
});

Deno.test("calculateOrderTotals applies Bogotá standard shipping and free shipping", () => {
  assertEquals(
    calculateOrderTotals({
      productTotal: 94900,
      city: "Bogota",
      department: "Bogotá",
    }).shippingCost,
    3000,
  );
  assertEquals(
    calculateOrderTotals({
      productTotal: 189800,
      city: "Bogotá",
      department: "Bogotá D.C.",
    }).shippingCost,
    0,
  );
});

Deno.test("calculateOrderTotals preserves Bogotá express shipping from method or notes", () => {
  assertEquals(
    calculateOrderTotals({
      productTotal: 139900,
      city: "Bogotá",
      department: "Bogotá D.C.",
      requestedShippingMethod: "express",
    }).shippingCost,
    15000,
  );
  assertEquals(
    calculateOrderTotals({
      productTotal: 139900,
      city: "Bogotá",
      department: "Bogotá D.C.",
      requestedShippingCost: 3000,
      notes: "Cliente pidió envío express a Bogotá con pago anticipado",
    }).shippingCost,
    15000,
  );
  assertEquals(
    calculateOrderTotals({
      productTotal: 139900,
      city: "Bogotá",
      department: "Bogotá D.C.",
      requestedShippingCost: 15000,
    }).shippingCost,
    15000,
  );
});

Deno.test("buildBoldPaymentLinkRequest charges express when customer requested express in notes", () => {
  const expressCatalog = [{
    id: 303,
    title: "Sleeping Walker Poppy con Mangas TOG 2.5",
    variants: [{
      id: 3004,
      title: "4",
      sku: "POPPY-4",
      price: "139900",
      inventory_quantity: 2,
    }],
  }];

  const built = buildBoldPaymentLinkRequest({
    payload: {
      customerName: "Cliente Dosmicos",
      cedula: "123456789",
      email: "cliente@example.com",
      phone: "573001112233",
      address: "Barrio Lago Timiza",
      city: "Bogotá",
      department: "Bogotá D.C.",
      lineItems: [{ productName: "Sleeping Walker Poppy", size: 4, quantity: 1 }],
      notes: "Cliente pidió envío express a Bogotá con pago anticipado",
    },
    catalog: expressCatalog,
    organizationId: "org-1",
    conversationId: "conv-1",
  });

  assertEquals(built.ok, true);
  if (built.ok === false) throw new Error("expected ok");
  assertEquals(built.request.orderData.shippingCost, 15000);
  assertEquals(built.request.amount, 154900);
});

Deno.test("buildBoldPaymentLinkRequest builds pending-order request only with complete data", () => {
  const built = buildBoldPaymentLinkRequest({
    payload: {
      customerName: "Cliente Dosmicos",
      cedula: "123456789",
      email: "cliente@example.com",
      phone: "573001112233",
      address: "Calle 1 #2-3",
      city: "Bogotá",
      department: "Bogotá D.C.",
      neighborhood: "Chapinero",
      lineItems: [{ productName: "pollito", size: 4, quantity: 2 }],
    },
    catalog,
    organizationId: "org-1",
    conversationId: "conv-1",
  });

  assertEquals(built.ok, true);
  if (built.ok === false) throw new Error("expected ok");
  assertObjectMatch(built.request, {
    amount: 189800,
    customerEmail: "cliente@example.com",
    customerName: "Cliente Dosmicos",
    customerPhone: "573001112233",
    organizationId: "org-1",
    conversationId: "conv-1",
  });
  assertEquals(built.request.orderData.lineItems[0].variantId, 1004);
  assertEquals(built.request.orderData.shippingCost, 0);
});

Deno.test("buildBoldPaymentLinkRequest reports missing required order fields", () => {
  const built = buildBoldPaymentLinkRequest({
    payload: {
      customerName: "Cliente Dosmicos",
      email: "cliente@example.com",
      lineItems: [{ productName: "pollito", size: 4 }],
    },
    catalog,
    organizationId: "org-1",
  });

  assertEquals(built.ok, false);
  if (built.ok === true) throw new Error("expected validation failure");
  assertEquals(built.errors.includes("phone"), true);
  assertEquals(built.errors.includes("address"), true);
  assertEquals(built.errors.includes("city"), true);
});

Deno.test("buildAddiPaymentRequest requires cedula and builds Addi request from catalog", () => {
  const built = buildAddiPaymentRequest({
    payload: {
      paymentMethod: "addi",
      customerName: "Cliente Dosmicos",
      cedula: "123456789",
      email: "cliente@example.com",
      phone: "+57 300 111 2233",
      address: "Calle 1 #2-3",
      city: "Bogotá",
      department: "Bogotá D.C.",
      neighborhood: "Chapinero",
      lineItems: [{ productName: "pollito", size: 4, quantity: 2 }],
    },
    catalog,
    organizationId: "org-1",
    conversationId: "conv-1",
  });

  assertEquals(built.ok, true);
  if (built.ok === false) throw new Error("expected ok");
  assertObjectMatch(built.request, {
    amount: 189800,
    customerEmail: "cliente@example.com",
    customerName: "Cliente Dosmicos",
    customerPhone: "573001112233",
    customerCedula: "123456789",
    organizationId: "org-1",
    conversationId: "conv-1",
  });
  assertEquals(built.request.orderData.lineItems[0].sku, "POLLITO-4");
  assertEquals(built.request.orderData.shippingCost, 0);
});

Deno.test("buildAddiPaymentRequest reports missing cedula for Addi", () => {
  const built = buildAddiPaymentRequest({
    payload: {
      customerName: "Cliente Dosmicos",
      email: "cliente@example.com",
      phone: "573001112233",
      address: "Calle 1 #2-3",
      city: "Bogotá",
      department: "Bogotá D.C.",
      lineItems: [{ productName: "pollito", size: 4 }],
    },
    catalog,
    organizationId: "org-1",
  });

  assertEquals(built.ok, false);
  if (built.ok === true) throw new Error("expected validation failure");
  assertEquals(built.errors.includes("cedula"), true);
});

Deno.test("buildShopifyCodOrderRequest builds Cash on Delivery Shopify order request", () => {
  const built = buildShopifyCodOrderRequest({
    payload: {
      paymentMethod: "contra_entrega",
      customerName: "Cliente Dosmicos",
      cedula: "123456789",
      email: "cliente@example.com",
      phone: "+57 300 111 2233",
      address: "Calle 1 #2-3",
      city: "Roldanillo",
      department: "Valle del Cauca",
      neighborhood: "Centro",
      lineItems: [{ productName: "pollito", size: 4, quantity: 1 }],
    },
    catalog,
    organizationId: "org-1",
    conversationId: "conv-1",
  });

  assertEquals(built.ok, true);
  if (built.ok === false) throw new Error("expected ok");
  assertEquals(built.request.organizationId, "org-1");
  assertEquals(built.request.conversationId, "conv-1");
  assertEquals(built.request.orderData.paymentMethod, "contra_entrega");
  assertEquals(built.request.orderData.lineItems[0].variantId, 1004);
  assertEquals(built.request.orderData.shippingCost, 5000);
  assertEquals(built.request.totalAmount, 99900);
});

Deno.test("buildManualTransferDraftOrderRequest builds a transfer draft request after proof", () => {
  const built = buildManualTransferDraftOrderRequest({
    payload: {
      paymentMethod: "nequi",
      customerName: "Cliente Dosmicos",
      cedula: "123456789",
      email: "cliente@example.com",
      phone: "+57 300 111 2233",
      address: "Calle 1 #2-3",
      city: "Bogotá",
      department: "Bogotá D.C.",
      neighborhood: "Chapinero",
      lineItems: [{ productName: "pollito", size: 4, quantity: 1 }],
      notes: "Comprobante recibido por imagen",
    },
    catalog,
    organizationId: "org-1",
    conversationId: "conv-1",
  });

  assertEquals(built.ok, true);
  if (built.ok === false) throw new Error("expected ok");
  assertEquals(built.request.organizationId, "org-1");
  assertEquals(built.request.conversationId, "conv-1");
  assertEquals(built.request.totalAmount, 97900);
  assertEquals(built.request.orderData.paymentMethod, "nequi");
  assertEquals(built.request.orderData.lineItems[0].variantId, 1004);
  assertEquals(built.request.orderData.notes?.includes("Comprobante recibido"), true);
});

Deno.test("summarizeCommerceCatalogForPrompt prioritizes products matching the customer query", () => {
  const largeCatalog = Array.from({ length: 90 }, (_, index) => ({
    id: index + 1,
    title: `Ruana Genérica ${index + 1}`,
    variants: [{
      id: index + 1000,
      title: "Adulto",
      sku: `GEN-${index + 1}`,
      price: "122900",
      inventory_quantity: 1,
    }],
  }));
  largeCatalog.push({
    id: 999,
    title: "Ruana de Capibara Adulto",
    variants: [{
      id: 1999,
      title: "Adulto",
      sku: "CAPIBARA-ADULTO",
      price: "110610",
      inventory_quantity: 5,
    }],
  });

  const summary = summarizeCommerceCatalogForPrompt(
    largeCatalog,
    80,
    "Para pedir una ruana de Capibara adulto",
  );

  assertEquals(summary[0].title, "Ruana de Capibara Adulto");
  assertEquals(summary[0].variants[0].stock, 5);
});

Deno.test("summarizeCommerceCatalogForPrompt includes product type and tags for visual candidate matching", () => {
  const summary = summarizeCommerceCatalogForPrompt([
    {
      id: 88,
      title: "Sleeping Walker Koala TOG 2.5",
      product_type: "Sleeping Walker",
      tags: "koala, amarillo, animal",
      variants: [{ id: 188, title: "Talla 2", sku: "KOALA-2", price: "149900", inventory_quantity: 3 }],
    },
  ]);

  assertEquals(summary[0].product_type, "Sleeping Walker");
  assertEquals(summary[0].tags, "koala, amarillo, animal");
});

Deno.test("formatShopifyOrderCreatedReply includes order number, summary and thanks", () => {
  const reply = formatShopifyOrderCreatedReply({
    orderNumber: "75966",
    totalAmount: 99900,
    lineItems: [{
      productId: 101,
      productName: "Ruana Pollito",
      variantId: 1004,
      variantName: "4",
      quantity: 1,
    }],
  });

  assertEquals(reply.includes("#75966"), true);
  assertEquals(reply.includes("Resumen:"), true);
  assertEquals(reply.includes("1 x Ruana Pollito talla 4"), true);
  assertEquals(reply.includes("Total: $99.900 COP"), true);
  assertEquals(reply.includes("Gracias por tu compra"), true);
});
