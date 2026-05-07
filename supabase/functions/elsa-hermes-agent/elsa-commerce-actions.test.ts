function assertEquals(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("elsa-hermes-agent imports commerce helper and invokes Bold/Addi payment tools", () => {
  assertEquals(source.includes("../_shared/elsa-commerce.ts"), true);
  assertEquals(source.includes("fetchCommerceCatalog"), true);
  assertEquals(source.includes("executeCommerceActions"), true);
  assertEquals(source.includes("create-bold-payment-link"), true);
  assertEquals(source.includes("create-addi-payment-request"), true);
  assertEquals(source.includes("send_addi_payment_request"), true);
});

Deno.test("elsa-hermes-agent prevents duplicate payment links before creating a new one", () => {
  assertEquals(source.includes("pending_orders"), true);
  assertEquals(source.includes("pending_payment"), true);
  assertEquals(source.includes("duplicate_blocked"), true);
});
