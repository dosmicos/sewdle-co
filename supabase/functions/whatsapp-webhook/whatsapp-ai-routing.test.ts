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
});

Deno.test("WhatsApp AI auto-replies persist Meta WAMID for delivery tracking", async () => {
  const source = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );
  const start = source.indexOf("// Send the text response via WhatsApp");
  const end = source.indexOf(
    "// Update conversation last message",
    start,
  );

  assert(start !== -1, "WhatsApp AI send block was not found");
  assert(end !== -1, "WhatsApp AI send block end marker was not found");

  const block = source.slice(start, end);

  assert(
    source.includes("sendWhatsAppMessageWithResult") &&
      source.includes("messageId: string | null"),
    "WhatsApp text helper must expose the Meta message id, not only a boolean",
  );
  assert(
    block.includes("const sendResult = await sendWhatsAppMessageWithResult"),
    "AI WhatsApp path must call the helper that returns Meta's WAMID",
  );
  assert(
    block.includes("external_message_id: sendResult.messageId"),
    "AI WhatsApp DB row must save Meta's WAMID so webhook delivery/read callbacks can update it",
  );
});
