import {
  buildConversationTranscript,
  buildElsaPrompt,
  extractHermesOutputText,
  extractJsonObject,
  normalizeChannelKnowledge,
  textFromMessageContent,
} from "./elsa-hermes-core.ts";

function assertEquals(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}

function assertIncludes(actual: string, expected: string) {
  if (!actual.includes(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(actual)} to include ${
        JSON.stringify(expected)
      }`,
    );
  }
}

Deno.test("extractHermesOutputText reads Hermes/OpenAI Responses output_text content", () => {
  const text = extractHermesOutputText({
    output: [
      {
        type: "message",
        content: [
          { type: "output_text", text: '{"reply":"ok"}' },
        ],
      },
    ],
  });

  assertEquals(text, '{"reply":"ok"}');
});

Deno.test("extractHermesOutputText reads chat-completions fallback shape", () => {
  const text = extractHermesOutputText({
    choices: [{ message: { content: "hola" } }],
  });

  assertEquals(text, "hola");
});

Deno.test("extractJsonObject accepts fenced JSON and normalizes response alias to reply", () => {
  const parsed = extractJsonObject(
    '```json\n{"response":"hola","confidence":0.7}\n```',
  );

  assertEquals(parsed?.reply, "hola");
  assertEquals(parsed?.confidence, 0.7);
});

Deno.test("textFromMessageContent converts image parts to safe transcript marker", () => {
  const text = textFromMessageContent([
    { type: "text", text: "Mira" },
    { type: "image_url", image_url: { url: "https://example.com/a.jpg" } },
  ]);

  assertEquals(text, "Mira\n[imagen adjunta]");
});

Deno.test("textFromMessageContent accepts Responses API text part variants", () => {
  const text = textFromMessageContent([
    { type: "input_text", input_text: "Hola" },
    { type: "output_text", output_text: "¿Tienen talla 38?" },
  ]);

  assertEquals(text, "Hola\n¿Tienen talla 38?");
});

Deno.test("extractHermesOutputText accepts input_text/output_text properties", () => {
  const text = extractHermesOutputText({
    output: [
      {
        content: [
          { type: "input_text", input_text: "hola" },
          { type: "output_text", output_text: '{"reply":"listo"}' },
        ],
      },
    ],
  });

  assertEquals(text, 'hola\n{"reply":"listo"}');
});

Deno.test("buildConversationTranscript has safe fallback without customer history", () => {
  const transcript = buildConversationTranscript([
    { role: "system", content: "interno" },
  ]);

  assertEquals(transcript, "Sin historial reciente.");
});

Deno.test("buildConversationTranscript labels customer and Dosmicos messages", () => {
  const transcript = buildConversationTranscript([
    { role: "user", content: "Hola" },
    { role: "assistant", content: "Hola, ¿qué talla buscas?" },
  ]);

  assertEquals(transcript, "Cliente: Hola\nDosmicos: Hola, ¿qué talla buscas?");
});

Deno.test("buildElsaPrompt includes deterministic Colombia date context", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "¿Envían hoy?" }],
    systemPrompt: "Responder como Dosmicos",
    sewdleContext: { conversation: { channel_type: "whatsapp" } },
    now: new Date("2026-05-02T20:30:00.000Z"),
  });

  assertIncludes(
    prompt,
    "FECHA Y HORA ACTUAL (Colombia): sábado 2 de mayo de 2026, 15:30",
  );
  assertIncludes(prompt, "CONVERSACIÓN RECIENTE:\nCliente: ¿Envían hoy?");
  assertIncludes(prompt, "Devuelve SOLO JSON válido");
});

Deno.test("normalizeChannelKnowledge keeps Sewdle knowledge base and rules compact", () => {
  const knowledge = normalizeChannelKnowledge({
    rules: [
      { condition: "envío express", response: "No aplica para Soacha" },
    ],
    knowledgeBase: [
      {
        category: "general",
        question: "## POLÍTICA DE ENVÍOS DOSMICOS",
        answer:
          "Bogotá estándar $3.000, express $14.000. No hay express a Soacha.",
      },
      { question: "Incompleto" },
    ],
  });

  assertEquals(knowledge, {
    rules: [
      { condition: "envío express", response: "No aplica para Soacha" },
    ],
    knowledge_base: [
      {
        category: "general",
        question: "## POLÍTICA DE ENVÍOS DOSMICOS",
        answer:
          "Bogotá estándar $3.000, express $14.000. No hay express a Soacha.",
      },
    ],
  });
});

Deno.test("buildElsaPrompt explicitly prioritizes Sewdle knowledge base when present", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "¿Cuánto cuesta envío a Bogotá?" }],
    sewdleContext: {
      channel_knowledge: {
        knowledge_base: [
          {
            question: "## POLÍTICA DE ENVÍOS DOSMICOS",
            answer: "Bogotá estándar $3.000, express $14.000.",
          },
        ],
      },
    },
    now: new Date("2026-05-02T20:30:00.000Z"),
  });

  assertIncludes(prompt, "BASE DE CONOCIMIENTO DE SEWDLE");
  assertIncludes(prompt, "Bogotá estándar $3.000, express $14.000");
  assertIncludes(
    prompt,
    "No inventes disponibilidad, precios ni estado de pedidos",
  );
});

Deno.test("buildElsaPrompt teaches Bold PSE payment-link action schema", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "PSE" }],
    sewdleContext: {
      commerce: {
        capabilities: ["send_payment_link_bold_pse"],
        products: [
          {
            id: 1,
            title: "Ruana Pollito",
            variants: [{ id: 2, title: "4", price: 94900, stock: 3 }],
          },
        ],
      },
    },
    now: new Date("2026-05-02T20:30:00.000Z"),
  });

  assertIncludes(prompt, "send_payment_link");
  assertIncludes(prompt, "Bold");
  assertIncludes(prompt, "PSE");
  assertIncludes(prompt, "lineItems");
  assertIncludes(prompt, "Shopify se crea automáticamente");
});

Deno.test("buildElsaPrompt requires collecting order data in one message instead of one by one", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "Lo compro" }],
    sewdleContext: { conversation: { channel_type: "whatsapp" } },
    now: new Date("2026-05-02T20:30:00.000Z"),
  });

  assertIncludes(
    prompt,
    "no pidas cédula, dirección, ciudad, teléfono o email uno por uno",
  );
  assertIncludes(prompt, "Me das porfa los siguientes datos para tu compra 🛍️");
  assertIncludes(prompt, "Correo electrónico:");
  assertIncludes(prompt, "Nombre y apellido:");
  assertIncludes(prompt, "Cédula:");
  assertIncludes(
    prompt,
    "Dirección con barrio (especificar si es casa, conjunto, local, etc):",
  );
  assertIncludes(prompt, "Ciudad/Departamento:");
  assertIncludes(prompt, "Número de celular:");
});
