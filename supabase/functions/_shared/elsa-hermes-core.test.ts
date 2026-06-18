import {
  buildConversationTranscript,
  buildElsaPrompt,
  extractHermesOutputText,
  extractJsonObject,
  extractOrderIntakeFromMessages,
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

Deno.test("extractOrderIntakeFromMessages keeps already shared checkout data out of the retry prompt", () => {
  const intake = extractOrderIntakeFromMessages([
    {
      role: "user",
      content:
        "Mi nombre y apellido es Laura Gómez, mi correo es laura@example.com y mi celular 3001234567.",
    },
    {
      role: "assistant",
      content: "Perfecto, gracias",
    },
    {
      role: "user",
      content:
        "La cédula: 1020304050. Dirección con barrio: Cra 27 #63b-61, Barrio Quinta de Mutis. Ciudad/Departamento: Bogotá / Cundinamarca.",
    },
  ]);

  assertEquals(intake.customerName, "Laura Gómez");
  assertEquals(intake.email, "laura@example.com");
  assertEquals(intake.phone, "3001234567");
  assertEquals(intake.cedula, "1020304050");
  assertIncludes(intake.address || "", "Cra 27 #63b-61, Barrio Quinta de Mutis");
  assertEquals(intake.city, "Bogotá");
  assertEquals(intake.department, "Cundinamarca");
});

Deno.test("buildElsaPrompt includes already captured order intake so Elsa does not restart checkout", () => {
  const prompt = buildElsaPrompt({
    messages: [
      {
        role: "user",
        content:
          "Mi nombre y apellido es Laura Gómez, mi correo es laura@example.com y mi celular 3001234567.",
      },
      {
        role: "user",
        content:
          "La cédula: 1020304050. Dirección con barrio: Cra 27 #63b-61, Barrio Quinta de Mutis. Ciudad/Departamento: Bogotá / Cundinamarca.",
      },
    ],
    sewdleContext: { conversation: { channel_type: "whatsapp" } },
    now: new Date("2026-05-02T20:30:00.000Z"),
  });

  assertIncludes(prompt, "CAPTURA DE PEDIDO DETECTADA");
  assertIncludes(prompt, "laura@example.com");
  assertIncludes(prompt, "Laura Gómez");
  assertIncludes(prompt, "no lo vuelvas a pedir");
  assertIncludes(prompt, "una sola pregunta de seguimiento");
});

Deno.test("buildElsaPrompt tells Elsa how to answer a vague greeting without generic handoff", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "Hola, necesito ayuda" }],
    systemPrompt: "Responder como Dosmicos",
    sewdleContext: { conversation: { channel_type: "whatsapp" } },
    now: new Date("2026-05-02T20:30:00.000Z"),
  });

  assertIncludes(prompt, "Si el cliente solo saluda o escribe algo vago");
  assertIncludes(prompt, "No digas \"No tengo esa información\"");
  assertIncludes(prompt, "pide una sola aclaración útil");
});

Deno.test("buildElsaPrompt tells Elsa to answer catalog/photo requests even without a specific product name", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "Me regalas fotos o el catálogo" }],
    systemPrompt: "Responder como Dosmicos",
    sewdleContext: { conversation: { channel_type: "whatsapp" } },
    now: new Date("2026-05-02T20:30:00.000Z"),
  });

  assertIncludes(prompt, "me regalas fotos");
  assertIncludes(prompt, "no te quedes solo en un saludo");
  assertIncludes(prompt, "¿buscas ruanas, sleeping bags o un diseño específico?");
});

Deno.test("buildElsaPrompt uses OCR and structured visual analysis for product images", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "Te mando una foto del producto" }],
    systemPrompt: "Responder como Dosmicos",
    sewdleContext: { conversation: { channel_type: "whatsapp" } },
    now: new Date("2026-05-02T20:30:00.000Z"),
  });

  assertIncludes(prompt, "NO intentes reconocer el producto desde la imagen cruda");
  assertIncludes(prompt, "Usa el texto OCR y el ANÁLISIS VISUAL ESTRUCTURADO");
  assertIncludes(prompt, "no inventes un producto exacto solo por apariencia");
  assertIncludes(prompt, "trátalo como producto ya seleccionado");
  assertIncludes(prompt, "no le pidas el nombre exacto ni una foto más clara");
  assertIncludes(prompt, "número de cuenta");
  assertIncludes(prompt, "No crees el link todavía si hay duda real de producto, talla o datos de pedido");
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

Deno.test("buildElsaPrompt prioritizes current embroidery policy over stale ruana-only knowledge", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "En qué parte se personaliza el sleeping?" }],
    sewdleContext: {
      channel_knowledge: {
        knowledge_base: [
          {
            question: "Bordados personalizados",
            answer: "Los bordados personalizados solo aplican para ruanas; los sleepings no se pueden personalizar.",
          },
        ],
      },
    },
    now: new Date("2026-06-05T20:30:00.000Z"),
  });

  assertIncludes(prompt, "los sleepings y las chaquetas de bebé SÍ se pueden bordar/personalizar");
  assertIncludes(prompt, "ignóralo por estar desactualizado");
  assertIncludes(prompt, "no ofrezcas ruanas como reemplazo");
});

Deno.test("buildElsaPrompt treats exact typed product names as selected products", () => {
  const prompt = buildElsaPrompt({
    messages: [
      { role: "assistant", content: "¿Me escribes porfa el nombre exacto como aparece en el catálogo para revisarte disponibilidad en talla 2?" },
      { role: "user", content: "RUANA VENADO DOSMICOS CAMEL" },
    ],
    sewdleContext: {
      commerce: {
        products: [
          {
            title: "Ruana Venado Dosmicos Camel",
            variants: [{ title: "Talla 2", inventory_quantity: 3, price: "96900" }],
          },
        ],
      },
    },
    now: new Date("2026-06-05T20:30:00.000Z"),
  });

  assertIncludes(prompt, "Si el cliente escribe el nombre exacto del producto");
  assertIncludes(prompt, "trátalo como producto ya seleccionado");
  assertIncludes(prompt, "No respondas \"No tengo esa información\"");
});

Deno.test("buildElsaPrompt prevents catalog-loop replies after a customer selected from a shared catalog link", () => {
  const prompt = buildElsaPrompt({
    messages: [
      { role: "assistant", content: "Te comparto el catálogo con todos los productos: https://dosmicos.co/collections/nuevos-productos" },
      { role: "user", content: "Estoy interesada en esta, talla 8" },
    ],
    sewdleContext: { conversation: { channel_type: "whatsapp" } },
    now: new Date("2026-06-08T20:30:00.000Z"),
  });

  assertIncludes(prompt, "link de colección/catálogo con todos los productos");
  assertIncludes(prompt, "primero eliges el producto en el catálogo");
  assertIncludes(prompt, "ayúdale a cerrar el pedido");
  assertIncludes(prompt, "pide solo el dato faltante");
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
          "Bogotá estándar $3.000, express $15.000. No hay express a Soacha.",
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
          "Bogotá estándar $3.000, express $15.000. No hay express a Soacha.",
      },
    ],
  });
});

Deno.test("normalizeChannelKnowledge promotes payment and transfer info into payment_knowledge", () => {
  const knowledge = normalizeChannelKnowledge({
    knowledgeBase: [
      {
        question: "¿Cuál es el número de cuenta Bancolombia?",
        answer: "Cuenta de ahorros 123-456-789 a nombre de Dosmicos.",
      },
      {
        question: "Horarios de atención",
        answer: "Lunes a viernes de 8 a 5.",
      },
    ],
    rules: [
      {
        condition: "si preguntan por transferencia",
        response: "Responde con los datos bancarios exactos.",
      },
    ],
  });

  assertEquals(knowledge.payment_knowledge, [
    {
      category: "payments",
      question: "si preguntan por transferencia",
      answer: "Responde con los datos bancarios exactos.",
    },
    {
      category: "general",
      question: "¿Cuál es el número de cuenta Bancolombia?",
      answer: "Cuenta de ahorros 123-456-789 a nombre de Dosmicos.",
    },
  ]);
});

Deno.test("buildElsaPrompt prioritizes payment_knowledge for account and transfer questions", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "¿Me das el número de cuenta?" }],
    sewdleContext: {
      channel_knowledge: {
        payment_knowledge: [
          {
            question: "¿Cuál es el número de cuenta Bancolombia?",
            answer: "Cuenta de ahorros 123-456-789 a nombre de Dosmicos.",
          },
        ],
      },
    },
    now: new Date("2026-05-02T20:30:00.000Z"),
  });

  assertIncludes(prompt, "payment_knowledge");
  assertIncludes(prompt, "Responde con ese texto exacto");
  assertIncludes(prompt, "número de cuenta");
  assertIncludes(prompt, "Cuenta de ahorros 123-456-789");
});

Deno.test("buildElsaPrompt explicitly prioritizes Sewdle knowledge base when present", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "¿Cuánto cuesta envío a Bogotá?" }],
    sewdleContext: {
      channel_knowledge: {
        knowledge_base: [
          {
            question: "## POLÍTICA DE ENVÍOS DOSMICOS",
            answer: "Bogotá estándar $3.000, express $15.000.",
          },
        ],
      },
    },
    now: new Date("2026-05-02T20:30:00.000Z"),
  });

  assertIncludes(prompt, "BASE DE CONOCIMIENTO DE SEWDLE");
  assertIncludes(prompt, "Bogotá estándar $3.000, express $15.000");
  assertIncludes(
    prompt,
    "Si el cliente menciona envío express en Bogotá, no asumas el envío estándar por defecto",
  );
  assertIncludes(
    prompt,
    "No inventes disponibilidad, precios ni estado de pedidos",
  );
  assertIncludes(
    prompt,
    "Si una variante/talla aparece con stock 0",
  );
  assertIncludes(
    prompt,
    "no respondas que lo vas a validar con bodega",
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

Deno.test("buildElsaPrompt teaches Addi payment request action schema", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "Quiero pagar por Addi" }],
    sewdleContext: {
      commerce: {
        capabilities: ["send_addi_payment_request"],
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

  assertIncludes(prompt, "send_addi_payment_request");
  assertIncludes(prompt, "Addi");
  assertIncludes(prompt, 'paymentMethod":"addi');
  assertIncludes(prompt, "solicitud");
  assertIncludes(prompt, "Shopify se crea automáticamente cuando Addi aprueba");
});

Deno.test("buildElsaPrompt teaches COD Shopify order action schema", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "Contra entrega" }],
    sewdleContext: {
      commerce: {
        capabilities: ["create_shopify_order_cod"],
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

  assertIncludes(prompt, "create_shopify_order");
  assertIncludes(prompt, "contra_entrega");
  assertIncludes(prompt, "Cash on Delivery (COD)");
  assertIncludes(prompt, "estado financiero pending");
  assertIncludes(prompt, "no escales a humano si tienes todos los datos");
  assertIncludes(prompt, "Solo puedes decir que un producto/talla no está disponible");
});

Deno.test("buildElsaPrompt teaches manual transfer proof creates draft order for validation", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "Listo mira ya envié el comprobante por Nequi" }],
    sewdleContext: {
      commerce: {
        capabilities: ["create_shopify_draft_after_transfer_proof"],
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

  assertIncludes(prompt, "Bancolombia/Nequi/transferencia manual");
  assertIncludes(prompt, "comprobante");
  assertIncludes(prompt, "create_order_draft");
  assertIncludes(prompt, 'paymentMethod":"nequi');
  assertIncludes(prompt, "draft");
  assertIncludes(prompt, "Pago por validar");
  assertIncludes(prompt, "no uses Requiere atencion");
});

Deno.test("buildElsaPrompt instructs post-created-order replies to include number summary and thanks", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "[imagen adjunta]" }],
    sewdleContext: {
      order_status: {
        latest_created_order: {
          orderNumber: "75966",
          totalAmount: 99900,
          lineItems: [{
            productName: "Ruana Pollito",
            variantName: "4",
            quantity: 1,
          }],
        },
      },
    },
    now: new Date("2026-05-02T20:30:00.000Z"),
  });

  assertIncludes(prompt, "pedido Shopify ya fue creado");
  assertIncludes(prompt, "número de pedido");
  assertIncludes(prompt, "resumen del pedido");
  assertIncludes(prompt, "agradece la compra");
  assertIncludes(prompt, "75966");
});

Deno.test("buildElsaPrompt handles existing web order gift/address modifications without checkout reset", () => {
  const prompt = buildElsaPrompt({
    messages: [{
      role: "user",
      content:
        "Hola, ya hice el pedido #75925. ¿Lo pueden empacar de regalo? la tarjeta dice bienvenida bebé",
    }],
    sewdleContext: {
      order_status: {
        referenced_order: {
          orderNumber: "75925",
          shopifyOrderId: "1234567890",
          financialStatus: "paid",
          fulfillmentStatus: null,
          operationalStatus: "pending",
          canModify: true,
          notePresent: false,
        },
      },
    },
    now: new Date("2026-05-02T20:30:00.000Z"),
  });

  assertIncludes(prompt, "pedido ya existente");
  assertIncludes(
    prompt,
    "NO pidas el formato completo de datos para tu compra",
  );
  assertIncludes(prompt, "empacar como regalo");
  assertIncludes(prompt, "update_existing_order");
  assertIncludes(prompt, "shopifyOrderId");
  assertIncludes(prompt, "Regalo");
  assertIncludes(prompt, "Si el pedido sigue pendiente o sin despacho");
  assertIncludes(prompt, "no tiene tags EMPACADO/ENVIADO ni shipped_at/fulfilled");
  assertIncludes(
    prompt,
    "Si el pedido ya está empacado, despachado, fulfilled",
  );
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

Deno.test("buildElsaPrompt forbids inventing order numbers without an order in context", () => {
  const prompt = buildElsaPrompt({
    messages: [{ role: "user", content: "En la imagen están las tallas" }],
    sewdleContext: {},
    now: new Date("2026-05-02T20:30:00.000Z"),
  });
  assertIncludes(prompt, "ANTI-INVENCIÓN DE PEDIDOS");
  assertIncludes(prompt, "PROHIBIDO inventar un número de pedido");
});
