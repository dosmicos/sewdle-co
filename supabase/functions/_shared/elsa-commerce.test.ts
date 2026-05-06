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
  buildBoldPaymentLinkRequest,
  calculateOrderTotals,
  resolveCommerceLineItems,
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
