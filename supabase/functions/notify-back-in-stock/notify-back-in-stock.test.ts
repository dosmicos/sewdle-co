// Source-level guards for the back-in-stock notifier (index.ts imports serve()
// at module load, so we assert behavior via the source text — repo convention).
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("notify-back-in-stock wires the required behavior", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  // Must send via an approved Meta template (outside the 24h window).
  assert(src.includes("sendWhatsAppTemplate("), "must send via WhatsApp template");
  assert(
    src.includes("WHATSAPP_BACK_IN_STOCK_TEMPLATE"),
    "must read the back-in-stock template env",
  );
  // Must not run without an approved template / token.
  assert(
    src.includes("template_or_token_not_configured"),
    "must bail when template or token is missing",
  );

  // Must check current inventory.
  assert(
    src.includes("product_variants") && src.includes("stock_quantity"),
    "must check product_variants.stock_quantity",
  );
  // Must mark notified (and not re-notify) + expire stale subs.
  assert(src.includes('status: "notified"'), "must mark subscriptions notified");
  assert(src.includes('status: "expired"'), "must expire stale subscriptions");
  assert(src.includes('.eq("status", "pending")'), "must only process pending subs");

  // Must respect opt-out and log the outbound to messaging_messages.
  assert(src.includes("opted_out"), "must respect opt-out");
  assert(src.includes("messaging_messages"), "must log the outbound message");
});
