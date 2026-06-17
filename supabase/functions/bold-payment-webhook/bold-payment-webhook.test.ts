/// <reference lib="deno.ns" />

import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

Deno.test("Bold payment webhook reuses the shared order confirmation flow after creating the Shopify order", async () => {
  const source = await Deno.readTextFile("supabase/functions/bold-payment-webhook/index.ts");

  assert(
    source.includes("send-order-confirmation"),
    "bold-payment-webhook must trigger the shared send-order-confirmation function so the customer gets the explicit success message",
  );

  assert(
    source.includes("action: 'send_single'"),
    "bold-payment-webhook must invoke send-order-confirmation in single-order mode after payment confirmation",
  );
});

Deno.test("Bold payment webhook blocks undercharged Bogotá express orders before Shopify creation", async () => {
  const source = await Deno.readTextFile("supabase/functions/bold-payment-webhook/index.ts");

  assert(
    source.includes("isBogotaExpressUnderchargedPendingOrder"),
    "bold-payment-webhook must detect express Bogotá orders with standard shipping cost",
  );
  assert(
    source.includes("express_shipping_undercharged"),
    "bold-payment-webhook must mark undercharged express orders for human review instead of creating Shopify automatically",
  );
  assert(
    source.includes("suppressing automatic Shopify order creation"),
    "bold-payment-webhook must suppress automatic Shopify creation for undercharged express orders",
  );
});

Deno.test("Bold payment webhook verifies paid links through the working Bold link endpoint", async () => {
  const source = await Deno.readTextFile("supabase/functions/bold-payment-webhook/index.ts");

  assert(
    source.includes("/online/link/v1/${paymentLinkId}"),
    "bold-payment-webhook must verify payment using the persisted Bold payment link id",
  );
  assert(
    source.includes("linkStatus !== 'PAID'"),
    "bold-payment-webhook must require Bold link status PAID before creating Shopify orders",
  );
  assert(
    source.includes("pendingOrder.bold_payment_link_id"),
    "bold-payment-webhook must pass the pending order's Bold link id into verification",
  );
  assert(
    !source.includes("/online/transaction/v1/"),
    "bold-payment-webhook must not depend on Bold's transaction endpoint because it rejects the current API-key auth format",
  );
});
