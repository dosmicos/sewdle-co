import {
  buildAddiPayLinkPayload,
  getAddiCredentials,
  parseAddiCallbackAuthorization,
  parseAddiPayLinkResponse,
} from "./addi.ts";

function assertEquals(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}

Deno.test("getAddiCredentials prefers organization credentials and never requires raw secrets in code", () => {
  const credentials = getAddiCredentials({
    orgCredentials: {
      client_id: "org-client",
      client_secret: "org-secret",
      ally_slug: "dosmicos-ecommerce",
      store_id: "store-1",
      callback_username: "addi",
      callback_password: "secret",
    },
    env: {
      ADDI_CLIENT_ID: "env-client",
      ADDI_CLIENT_SECRET: "env-secret",
      ADDI_ALLY_SLUG: "env-ally",
    },
  });

  assertEquals(credentials.clientId, "org-client");
  assertEquals(credentials.clientSecret, "org-secret");
  assertEquals(credentials.allySlug, "dosmicos-ecommerce");
  assertEquals(credentials.storeId, "store-1");
  assertEquals(credentials.callbackUsername, "addi");
  assertEquals(credentials.callbackPassword, "secret");
  assertEquals(credentials.environment, "production");
});

Deno.test("buildAddiPayLinkPayload maps Sewdle pending-order data to Addi Paylink schema", () => {
  const payload = buildAddiPayLinkPayload({
    orderId: "addi_123",
    totalAmount: 189800,
    shippingAmount: 0,
    description: "Pedido Dosmicos - Ruana Pollito",
    client: {
      idNumber: "123456789",
      firstName: "Cliente",
      lastName: "Dosmicos",
      email: "cliente@example.com",
      cellphone: "3001112233",
      address: "Calle 1 #2-3",
      city: "Bogotá",
      state: "Bogotá D.C.",
    },
    lineItems: [{ sku: "POLLITO-4", name: "Ruana Pollito", amount: 94900 }],
    ally: {
      storeId: "store-1",
      callbackUrl: "https://sewdle.co/functions/v1/addi-payment-webhook",
      callbackRequired: true,
    },
  });

  assertEquals(payload.client.idType, "CC");
  assertEquals(payload.client.cellphoneCountryCode, "+57");
  assertEquals(payload.client.shippingAddress.country, "CO");
  assertEquals(payload.ally.storeId, "store-1");
  assertEquals(payload.order.orderId, "addi_123");
  assertEquals(payload.order.totalAmount, "189800");
  assertEquals(payload.order.shippingAmount, "0");
  assertEquals(payload.order.currency, "COP");
  assertEquals(payload.order.items?.[0].sku, "POLLITO-4");
});

Deno.test("parseAddiPayLinkResponse accepts Addi ApplicationID casing", () => {
  assertEquals(
    parseAddiPayLinkResponse({ orderId: "o1", ApplicationID: "app-1" }),
    {
      orderId: "o1",
      applicationId: "app-1",
    },
  );
  assertEquals(
    parseAddiPayLinkResponse({ orderId: "o2", applicationId: "app-2" }),
    {
      orderId: "o2",
      applicationId: "app-2",
    },
  );
});

Deno.test("parseAddiCallbackAuthorization validates Basic auth without exposing the secret", () => {
  const header = "Basic " + btoa("addi:secret");
  assertEquals(parseAddiCallbackAuthorization(header, "addi", "secret"), true);
  assertEquals(parseAddiCallbackAuthorization(header, "addi", "other"), false);
  assertEquals(
    parseAddiCallbackAuthorization("Bearer token", "addi", "secret"),
    false,
  );
});
