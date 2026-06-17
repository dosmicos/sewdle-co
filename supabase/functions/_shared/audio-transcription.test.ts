import {
  buildAudioTranscriptionContent,
  buildAudioTranscriptionMetadata,
  getAudioFilename,
  normalizeAudioTranscript,
  transcribeAudioFromBytes,
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
    model: "whisper-1",
    durationMs: 1234,
  });

  assertEquals(metadata.status, "completed");
  assertEquals(metadata.provider, "openai");
  assertEquals(metadata.model, "whisper-1");
  assertEquals(metadata.text, "Hola");
  assertEquals(metadata.duration_ms, 1234);
});

Deno.test("transcribeAudioFromBytes sends audio bytes directly to OpenAI transcription", async () => {
  const result = await transcribeAudioFromBytes({
    audioBytes: new Uint8Array([1, 2, 3, 4]),
    mimeType: "audio/ogg",
    apiKey: "test-key",
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (!url.includes("/v1/audio/transcriptions")) {
        throw new Error(`Unexpected URL: ${url}`);
      }
      if (!(init as any)?.body) {
        throw new Error("Expected multipart body");
      }
      return new Response(JSON.stringify({ text: "Hola, quiero una ruana" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assertEquals(result.ok, true);
  assertEquals(result.text, "Hola, quiero una ruana");
  assertEquals(result.metadata.status, "completed");
});

Deno.test("getAudioFilename maps WhatsApp audio mime types to supported extensions", () => {
  assertEquals(getAudioFilename("audio/ogg"), "whatsapp-audio.ogg");
  assertEquals(getAudioFilename("audio/mpeg"), "whatsapp-audio.mp3");
  assertEquals(getAudioFilename("audio/mp4"), "whatsapp-audio.mp4");
  assertEquals(getAudioFilename("audio/amr"), "whatsapp-audio.amr");
});
