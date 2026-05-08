export type AudioTranscriptionMetadata = {
  status: "completed" | "failed" | "skipped";
  provider: "openai";
  model: string;
  text?: string;
  error?: string;
  duration_ms?: number;
};

export type AudioTranscriptionResult = {
  ok: boolean;
  text: string | null;
  metadata: AudioTranscriptionMetadata;
};

type FetchLike = typeof fetch;

const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const TRANSCRIPTION_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

export function normalizeAudioTranscript(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildAudioTranscriptionContent(text: string): string {
  const normalized = normalizeAudioTranscript(text);
  return normalized ? `Nota de voz transcrita: "${normalized}"` : "[audio]";
}

export function buildAudioTranscriptionMetadata(params: {
  text?: string | null;
  error?: string | null;
  model?: string;
  durationMs?: number;
}): AudioTranscriptionMetadata {
  const text = normalizeAudioTranscript(params.text || "");
  const error = normalizeAudioTranscript(params.error || "");
  const status = text ? "completed" : error ? "failed" : "skipped";

  return {
    status,
    provider: "openai",
    model: params.model || DEFAULT_TRANSCRIPTION_MODEL,
    ...(text ? { text } : {}),
    ...(error ? { error } : {}),
    ...(typeof params.durationMs === "number"
      ? { duration_ms: params.durationMs }
      : {}),
  };
}

export function getAudioFilename(mimeType?: string | null): string {
  const normalized = String(mimeType || "").toLowerCase().split(";")[0].trim();
  const mimeToExt: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/amr": "amr",
    "audio/wav": "wav",
    "audio/webm": "webm",
  };
  return `whatsapp-audio.${mimeToExt[normalized] || "ogg"}`;
}

export async function transcribeAudioFromUrl(params: {
  mediaUrl: string;
  mimeType?: string | null;
  apiKey?: string | null;
  model?: string;
  fetchImpl?: FetchLike;
}): Promise<AudioTranscriptionResult> {
  const startedAt = Date.now();
  const model = params.model || Deno.env.get("OPENAI_TRANSCRIPTION_MODEL") ||
    DEFAULT_TRANSCRIPTION_MODEL;
  const apiKey = params.apiKey || Deno.env.get("OPENAI_API_KEY") || "";
  const fetcher = params.fetchImpl || fetch;

  if (!params.mediaUrl) {
    return {
      ok: false,
      text: null,
      metadata: buildAudioTranscriptionMetadata({
        model,
        error: "Missing media URL",
      }),
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      text: null,
      metadata: buildAudioTranscriptionMetadata({
        model,
        error: "OPENAI_API_KEY not configured",
      }),
    };
  }

  try {
    const audioResponse = await fetcher(params.mediaUrl);
    if (!audioResponse.ok) {
      return {
        ok: false,
        text: null,
        metadata: buildAudioTranscriptionMetadata({
          model,
          error: `Audio download failed: ${audioResponse.status}`,
          durationMs: Date.now() - startedAt,
        }),
      };
    }

    const audioBlob = await audioResponse.blob();
    const form = new FormData();
    form.append("model", model);
    form.append("language", "es");
    form.append("response_format", "json");
    form.append(
      "file",
      audioBlob,
      getAudioFilename(params.mimeType || audioBlob.type),
    );

    const transcriptionResponse = await fetcher(TRANSCRIPTION_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text().catch(() => "");
      return {
        ok: false,
        text: null,
        metadata: buildAudioTranscriptionMetadata({
          model,
          error: `OpenAI transcription failed: ${transcriptionResponse.status}${
            errorText ? ` ${errorText.slice(0, 200)}` : ""
          }`,
          durationMs: Date.now() - startedAt,
        }),
      };
    }

    const payload = await transcriptionResponse.json();
    const text = normalizeAudioTranscript(payload?.text || "");

    return {
      ok: Boolean(text),
      text: text || null,
      metadata: buildAudioTranscriptionMetadata({
        model,
        text,
        error: text ? null : "Empty transcription",
        durationMs: Date.now() - startedAt,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      text: null,
      metadata: buildAudioTranscriptionMetadata({
        model,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      }),
    };
  }
}
