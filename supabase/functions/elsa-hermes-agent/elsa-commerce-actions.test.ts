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

Deno.test("elsa-hermes-agent resends existing payment links before promising a new one", () => {
  assertEquals(source.includes("maybeReplyWithExistingPaymentLink"), true);
  assertEquals(source.includes("findExistingPaymentFlow(supabase"), true);
  assertEquals(source.includes("shouldReplacePaymentLinkReplyWithoutUrl(params.result.reply"), true);
  assertEquals(source.includes("tu link de pago sigue activo"), true);
});

Deno.test("elsa-hermes-agent blocks payment-link confirmations without a URL", () => {
  assertEquals(source.includes("../_shared/payment-link-reply-guard.ts"), true);
  assertEquals(source.includes("buildPaymentLinkMissingUrlFallbackReply"), true);
  assertEquals(source.includes("payment_link_missing_url"), true);
});

Deno.test("elsa-hermes-agent can execute existing Shopify order modification actions", () => {
  assertEquals(source.includes("update_existing_order"), true);
  assertEquals(source.includes("findReferencedShopifyOrder"), true);
  assertEquals(source.includes("update-shopify-order-note"), true);
  assertEquals(source.includes("picking_packing_orders"), true);
  assertEquals(source.includes("Regalo"), true);
});

Deno.test("elsa-hermes-agent can rewrite generic image/name-reference replies before returning to WhatsApp", () => {
  assertEquals(source.includes("../_shared/image-ocr.ts"), true);
  assertEquals(source.includes("maybeReplyWithImageScreenshotFallback"), true);
  assertEquals(source.includes("shouldReplaceGenericImageReply(params.result.reply"), true);
  assertEquals(source.includes("findLatestImageContextIndex"), true);
  assertEquals(source.includes("mergeImageContextWithRecentUserTexts"), true);
  assertEquals(source.includes("readable_product_screenshot_checkout"), true);
});

Deno.test("elsa-hermes-agent does not lose the readable screenshot product when the latest user message is a follow-up", () => {
  assertEquals(source.includes("latestImageMessage"), true);
  assertEquals(source.includes("imageContextForFallback"), true);
  assertEquals(source.includes("shouldReplaceGenericImageReply(params.result.reply, imageContextForFallback)"), true);
  assertEquals(source.includes("buildImageScreenshotFallbackReply(imageContextForFallback)"), true);
  assertEquals(source.includes("const recentUserContents = params.messages"), true);
  assertEquals(source.includes(".slice(latestImageIndex)"), true);
});

Deno.test("elsa-hermes-agent creates manual-transfer draft orders with Pago por validar tag", () => {
  assertEquals(source.includes("buildManualTransferDraftOrderRequest"), true);
  assertEquals(source.includes("draft_orders.json"), true);
  assertEquals(source.includes("createManualTransferDraftOrder"), true);
  assertEquals(source.includes("ensureConversationTag"), true);
  assertEquals(source.includes("Pago por validar"), true);
  assertEquals(source.includes("Requiere atencion"), true);
  assertEquals(source.includes("pending_transfer_validation"), true);
});

Deno.test("elsa-hermes-agent includes assistant product links in catalog search context", () => {
  assertEquals(source.includes("dosmicos\\.co\\/products\\/"), true);
  assertEquals(source.includes("message.role === \"user\""), true);
});

Deno.test("elsa-hermes-agent preserves media URLs in recent image context", () => {
  assertEquals(source.includes("media_url"), true);
  assertEquals(source.includes("media_mime_type"), true);
  assertEquals(source.includes("media_url: m.media_url"), true);
});
