import {
  buildAudioTranscriptionContent,
  buildAudioTranscriptionMetadata,
  getAudioFilename,
  normalizeAudioTranscript,
} from "./audio-transcription.ts";

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ||
        `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

Deno.test("normalizeAudioTranscript trims and collapses whitespace", () => {
  assertEquals(
    normalizeAudioTranscript("  Hola,\nquiero   una ruana   talla 6  "),
    "Hola, quiero una ruana talla 6",
  );
});

Deno.test("buildAudioTranscriptionContent gives Elsa a customer-readable transcript", () => {
  assertEquals(
    buildAudioTranscriptionContent(" Hola, quiero una ruana talla 6 "),
    'Nota de voz transcrita: "Hola, quiero una ruana talla 6"',
  );
});

Deno.test("buildAudioTranscriptionMetadata stores status and provider without raw secrets", () => {
  const metadata = buildAudioTranscriptionMetadata({
    text: "Hola",
    model: "gpt-4o-mini-transcribe",
    durationMs: 1234,
  });

  assertEquals(metadata.status, "completed");
  assertEquals(metadata.provider, "openai");
  assertEquals(metadata.model, "gpt-4o-mini-transcribe");
  assertEquals(metadata.text, "Hola");
  assertEquals(metadata.duration_ms, 1234);
});

Deno.test("getAudioFilename maps WhatsApp audio mime types to supported extensions", () => {
  assertEquals(getAudioFilename("audio/ogg"), "whatsapp-audio.ogg");
  assertEquals(getAudioFilename("audio/mpeg"), "whatsapp-audio.mp3");
  assertEquals(getAudioFilename("audio/mp4"), "whatsapp-audio.mp4");
  assertEquals(getAudioFilename("audio/amr"), "whatsapp-audio.amr");
});
