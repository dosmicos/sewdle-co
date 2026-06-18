function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("WhatsApp AI routing honors Elsa supervised runtime instead of hardcoded OpenAI send", async () => {
  const source = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );
  const start = source.indexOf("// Generate and send AI response if enabled");
  const end = source.indexOf(
    "// NOTE: Order creation is handled by messaging-ai-openai",
    start,
  );

  assert(start !== -1, "WhatsApp AI response block was not found");
  assert(end !== -1, "WhatsApp AI response block end marker was not found");

  const block = source.slice(start, end);

  assert(
    !block.includes("const functionName = 'messaging-ai-openai'"),
    "WhatsApp AI block must not hardcode messaging-ai-openai; it must honor channel.ai_config.aiProvider",
  );
  assert(
    block.includes("resolveAiRuntime"),
    "WhatsApp AI block must resolve aiProvider/elsaMode from channel.ai_config",
  );
  assert(
    block.includes("resolveAiDeliveryPlan"),
    "WhatsApp AI block must use delivery plan to suppress outbound sends in supervised mode",
  );
  assert(
    block.includes("buildSupervisedSuggestionMetadata"),
    "WhatsApp AI block must persist Elsa supervised suggestions to conversation metadata",
  );
  assert(
    block.includes("shouldPersistSuggestion"),
    "WhatsApp AI block must branch on supervised suggestion persistence before sending",
  );
});


Deno.test("WhatsApp image replies are rewritten when the model falls back to generic handoff text", async () => {
  const source = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );

  assert(
    source.includes("buildImageScreenshotFallbackReply") &&
      source.includes("shouldReplaceGenericImageReply") &&
      source.includes("messagesForAI"),
    "whatsapp-webhook must replace generic image handoffs with a screenshot-aware fallback from OCR-enriched messages",
  );
  assert(
    source.includes("Generic image reply detected; replacing with screenshot-aware fallback"),
    "whatsapp-webhook must log when it rewrites a generic image reply",
  );

  const directRewriteCalls = source.match(/shouldReplaceGenericImageReply\(aiText/g) || [];
  assert(
    directRewriteCalls.length >= 2,
    "all WhatsApp AI send paths must run the generic-image rewrite guard before delivery",
  );
});

Deno.test("WhatsApp AI routing blocks payment-link confirmations without a URL", async () => {
  const source = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );

  assert(
    source.includes("../_shared/payment-link-reply-guard.ts") &&
      source.includes("shouldReplacePaymentLinkReplyWithoutUrl") &&
      source.includes("buildPaymentLinkMissingUrlFallbackReply"),
    "whatsapp-webhook must not send generated/resend payment-link wording unless the URL is present",
  );

  const guardCalls = source.match(/shouldReplacePaymentLinkReplyWithoutUrl\(aiText/g) || [];
  assert(
    guardCalls.length >= 2,
    "all WhatsApp AI send paths must run the missing-payment-link URL guard before delivery",
  );
});

Deno.test("WhatsApp replaces availability deferrals when product variant stock is known", async () => {
  const source = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );

  assert(
    source.includes("shouldReplaceAvailabilityDeferralReply"),
    "whatsapp-webhook should detect deferral replies like te reviso/te confirmamos",
  );
  assert(
    source.includes("buildKnownVariantAvailabilityReply"),
    "whatsapp-webhook should build a deterministic availability reply from known catalog stock",
  );
  assert(
    source.includes("finalAiResponse = availabilityReply"),
    "known stock reply should replace the model deferral before sending",
  );
});

Deno.test("WhatsApp pending address verification does not swallow unrelated new product messages", async () => {
  const source = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );

  assert(
    source.includes("../_shared/address-verification-routing.ts") &&
      source.includes("classifyPendingAddressVerificationReply"),
    "whatsapp-webhook must classify pending address replies before intercepting customer messages",
  );
  assert(
    source.includes("addressDecision === 'not_address'") &&
      source.includes("Pending address verification ignored for unrelated/new-purchase message"),
    "unrelated messages like greetings or new product requests must continue to normal Elsa handling",
  );
  assert(
    source.includes("addressDecision === 'address_correction'") &&
      !source.includes("} else {\n                  // Customer wrote something else (new address or question)"),
    "the address acknowledgment must only run for likely address corrections, not every text message",
  );
});

Deno.test("WhatsApp visual-photo OCR clues search catalog candidates instead of only asking for a name", async () => {
  const source = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );

  assert(
    source.includes("buildVisualCandidateInstruction") &&
      source.includes("extractVisualCandidateSearchTerms") &&
      source.includes("hasVisualCandidateSearchSignal"),
    "whatsapp-webhook must turn visual OCR clues into catalog candidate context",
  );
  assert(
    source.includes("visualSearchTerms.length ? 3 : 10") &&
      source.includes("relevantProducts.length === 0 && visualSearchTerms.length === 0"),
    "visual-photo searches must use top 3 real candidates and avoid unrelated popular-product fallback",
  );
});

Deno.test("WhatsApp audio messages are transcribed before invoking Elsa", async () => {
  const source = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );
  const start = source.indexOf(
    "// If message includes media_id, download and cache it now",
  );
  const end = source.indexOf(
    "// Resolve reply_to_message_id from WAMID to internal UUID",
    start,
  );

  assert(start !== -1, "media download block was not found");
  assert(end !== -1, "media download block end marker was not found");

  const block = source.slice(start, end);

  assert(
    source.includes("../_shared/audio-transcription.ts"),
    "whatsapp-webhook must import the shared audio transcription helper",
  );
  assert(
    block.includes("messageType === 'audio'") &&
      block.includes("transcribeAudioFromUrl"),
    "audio media must be sent to transcription after being downloaded",
  );
  assert(
    block.includes("buildAudioTranscriptionContent") &&
      block.includes("content ="),
    "the inbound message content must be replaced with the transcript before Elsa sees it",
  );
  assert(
    source.includes("audio_transcription"),
    "the saved messaging message must include transcription metadata for review/debugging",
  );
  assert(
    source.includes("const aiRespondableTypes = ['text', 'audio', 'image', 'button', 'interactive'];"),
    "audio messages must be included in the AI respondable types after transcription",
  );
});
