export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: unknown;
};

export type ElsaAction = {
  type:
    | "none"
    | "handoff"
    | "collect_order_data"
    | "create_order_draft"
    | "create_shopify_order"
    | "update_existing_order"
    | "send_payment_link"
    | "send_addi_payment_request";
  reason?: string;
  payload?: Record<string, unknown>;
};

export type ElsaStructuredResponse = {
  reply: string;
  confidence?: number;
  handoff_required?: boolean;
  handoff_reason?: string;
  actions?: ElsaAction[];
  learning_notes?: string[];
};

const COLOMBIA_WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
const COLOMBIA_MONTHS = [
  "",
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function textFromMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const typed = part as Record<string, any>;
          if (typed.type === "image_url" || typed.type === "input_image") {
            return "[imagen adjunta]";
          }
          return typed.text || typed.input_text || typed.output_text || "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(content ?? "");
}

export function safeSnippet(value: unknown, max = 700): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const PAYMENT_KNOWLEDGE_TERMS = [
  "cuenta",
  "transferencia",
  "transferir",
  "transferirle",
  "bancolombia",
  "nequi",
  "daviplata",
  "consignacion",
  "consignación",
  "pago",
  "pagos",
  "saldo",
  "comprobante",
  "banco",
  "titular",
  "numero de cuenta",
  "número de cuenta",
];

function normalizeTextForMatch(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasPaymentKnowledgeSignal(value: unknown): boolean {
  const normalized = normalizeTextForMatch(value);
  return PAYMENT_KNOWLEDGE_TERMS.some((term) =>
    normalized.includes(normalizeTextForMatch(term))
  );
}

export function normalizeChannelKnowledge(aiConfig: Record<string, any> = {}) {
  const rules = Array.isArray(aiConfig.rules)
    ? aiConfig.rules
      .map((rule) => ({
        condition: safeSnippet(rule?.condition, 180),
        response: safeSnippet(rule?.response, 700),
      }))
      .filter((rule) => rule.condition && rule.response)
      .slice(0, 20)
    : [];

  const knowledge_base = Array.isArray(aiConfig.knowledgeBase)
    ? aiConfig.knowledgeBase
      .map((item) => ({
        category: safeSnippet(item?.category || "general", 80),
        question: safeSnippet(item?.question || item?.title || item?.name, 240),
        answer: safeSnippet(item?.answer || item?.content || item?.text, 1800),
      }))
      .filter((item) => item.question && item.answer)
      .slice(0, 30)
    : [];

  const payment_knowledge = [
    ...rules
      .filter((rule) => hasPaymentKnowledgeSignal(`${rule.condition} ${rule.response}`))
      .map((rule) => ({
        category: "payments",
        question: rule.condition,
        answer: rule.response,
      })),
    ...knowledge_base.filter((item) =>
      hasPaymentKnowledgeSignal(`${item.category} ${item.question} ${item.answer}`)
    ),
  ].slice(0, 12);

  const normalized: Record<string, unknown> = {};
  if (rules.length) normalized.rules = rules;
  if (knowledge_base.length) normalized.knowledge_base = knowledge_base;
  if (payment_knowledge.length) normalized.payment_knowledge = payment_knowledge;
  return normalized;
}

export function buildConversationTranscript(messages: ChatMessage[]): string {
  const transcript = messages
    .filter((m) => m.role !== "system")
    .map((m) =>
      `${m.role === "user" ? "Cliente" : "Dosmicos"}: ${
        textFromMessageContent(m.content)
      }`
    )
    .filter((line) => line.replace(/^(Cliente|Dosmicos):\s*/, "").trim())
    .join("\n");

  return transcript || "Sin historial reciente.";
}

export type OrderIntakeSnapshot = {
  customerName?: string;
  email?: string;
  cedula?: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  department?: string;
  product?: string;
  quantity?: string;
  shippingMethod?: string;
};

function normalizeCapturedValue(value: string): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "")
    .trim();
}

function normalizePhoneNumber(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length > 10) return digits.slice(-10);
  return digits;
}

function trimAddressCapture(value: string): string {
  return normalizeCapturedValue(value)
    .replace(
      /\b(?:ciudad|departamento|depto|dpto|celular|telefono|tel|correo|email|c[eé]dula|cc)\b.*$/i,
      "",
    )
    .replace(/[.,;:]+$/, "")
    .trim();
}

export function extractOrderIntakeFromMessages(
  messages: ChatMessage[],
): OrderIntakeSnapshot {
  const intake: OrderIntakeSnapshot = {};

  for (const message of messages) {
    if (message.role !== "user") continue;

    const text = textFromMessageContent(message.content).trim();
    if (!text) continue;

    const email = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,})/)?.[1];
    if (email) intake.email = email.toLowerCase();

    const explicitName = text.match(
      /(?:nombre(?: y apellido| completo)?|me llamo|soy)\s*(?:es|:)?\s*([^\n,.;]+(?:\s+[^\n,.;]+){0,2})/i,
    )?.[1];
    if (explicitName) intake.customerName = normalizeCapturedValue(explicitName);

    const cedula = text.match(
      /(?:c[eé]dula|cedula|c\.c\.|cc)\s*[:#\-]?\s*([0-9][0-9.\s-]{4,18}[0-9])/i,
    )?.[1];
    if (cedula) intake.cedula = normalizePhoneNumber(cedula);

    const phone = text.match(
      /(?:celular|cel|tel[eé]fono|telefono|whatsapp)\s*[:#\-]?\s*((?:\+?57\s*)?3\d{9})/i,
    )?.[1] || text.match(/\b(?:\+?57\s*)?(3\d{9})\b/)?.[1];
    if (phone) intake.phone = normalizePhoneNumber(phone);

    const address = text.match(
      /(?:direcci[oó]n(?: con barrio)?|direccion(?: con barrio)?|address|dir)\s*[:#\-]?\s*([^\n]+)/i,
    )?.[1];
    if (address) intake.address = trimAddressCapture(address);

    const neighborhood = text.match(
      /(?:barrio|conjunto|urbanizaci[oó]n|unidad|sector)\s*[:#\-]?\s*([^\n,]+)/i,
    )?.[1];
    if (neighborhood) intake.neighborhood = normalizeCapturedValue(neighborhood);

    const cityDept = text.match(
      /(?:ciudad\/departamento|ciudad y departamento|ciudad y depto)\s*[:#\-]?\s*([^\n]+)/i,
    )?.[1];
    if (cityDept) {
      const [city, department] = cityDept
        .split(/\s*[/,\-|]\s*/)
        .map((part) => normalizeCapturedValue(part))
        .filter(Boolean);
      if (city) intake.city = city;
      if (department) intake.department = department;
    }

    const city = text.match(/(?:ciudad)\s*[:#\-]?\s*([^\n,]+)/i)?.[1];
    if (city && !intake.city) intake.city = normalizeCapturedValue(city);

    const department = text.match(
      /(?:departamento|depto|dpto)\s*[:#\-]?\s*([^\n,]+)/i,
    )?.[1];
    if (department && !intake.department) {
      intake.department = normalizeCapturedValue(department);
    }

    const product = text.match(
      /(?:producto|art[ií]culo|referencia)\s*[:#\-]?\s*([^\n,]+)/i,
    )?.[1];
    if (product) intake.product = normalizeCapturedValue(product);

    const quantity = text.match(/(?:cantidad|cant)\s*[:#\-]?\s*(\d{1,3})/i)?.[1];
    if (quantity) intake.quantity = quantity;

    const shippingMethod = text.match(
      /(?:env[ií]o|entrega)\s*[:#\-]?\s*(express|est[aá]ndar|standard|normal)/i,
    )?.[1];
    if (shippingMethod) intake.shippingMethod = normalizeCapturedValue(
      shippingMethod,
    ).toLowerCase();
  }

  return intake;
}

function normalizeStructuredResponse(
  parsed: any,
): ElsaStructuredResponse | null {
  if (!parsed || typeof parsed !== "object") return null;
  const reply = typeof parsed.reply === "string"
    ? parsed.reply
    : typeof parsed.response === "string"
    ? parsed.response
    : "";
  if (!reply) return null;
  return { ...parsed, reply };
}

export function extractJsonObject(text: string): ElsaStructuredResponse | null {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const normalized = normalizeStructuredResponse(JSON.parse(candidate));
      if (normalized) return normalized;
    } catch (_) {
      // try next candidate
    }
  }
  return null;
}

export function extractHermesOutputText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;

  const responseOutput = (data?.output || [])
    .flatMap((item: any) => item?.content || [])
    .map((content: any) => {
      if (typeof content === "string") return content;
      return content?.text || content?.input_text || content?.output_text || "";
    })
    .filter(Boolean)
    .join("\n");
  if (responseOutput) return responseOutput;

  return data?.choices?.[0]?.message?.content || "";
}

export function colombiaDateContext(now = new Date()): string {
  const colombiaTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const year = colombiaTime.getUTCFullYear();
  const month = colombiaTime.getUTCMonth() + 1;
  const day = colombiaTime.getUTCDate();
  const hour = String(colombiaTime.getUTCHours()).padStart(2, "0");
  const minute = String(colombiaTime.getUTCMinutes()).padStart(2, "0");
  const weekday = COLOMBIA_WEEKDAYS[colombiaTime.getUTCDay()];
  const monthName = COLOMBIA_MONTHS[month] || "";

  return `FECHA Y HORA ACTUAL (Colombia): ${weekday} ${day} de ${monthName} de ${year}, ${hour}:${minute} hora Colombia.`;
}

export function buildElsaPrompt(params: {
  messages: ChatMessage[];
  systemPrompt?: string;
  sewdleContext: Record<string, unknown>;
  now?: Date;
}) {
  const transcript = buildConversationTranscript(params.messages);
  const orderIntake = extractOrderIntakeFromMessages(params.messages);
  const orderIntakeContext = Object.keys(orderIntake).length
    ? JSON.stringify(orderIntake, null, 2)
    : "Sin datos capturados todavía.";
  const dateContext = colombiaDateContext(params.now || new Date());

  return `Eres Elsa, agente Hermes de atención y ventas para Dosmicos dentro de Sewdle.

${dateContext}
Usa esta fecha verificada para responder sobre horarios, envíos, despachos y tiempos de entrega. Si el historial menciona otra fecha o día, ignóralo.

INSTRUCCIONES DE SEWDLE / CANAL:
${
    params.systemPrompt ||
    "Responder en español como asesora experta de Dosmicos."
  }

CONTEXTO ESTRUCTURADO DE SEWDLE:
${JSON.stringify(params.sewdleContext, null, 2)}

BASE DE CONOCIMIENTO DE SEWDLE:
Si channel_knowledge aparece en el contexto estructurado, úsalo como fuente principal para políticas, links, envíos, pagos, cambios, horarios y reglas del canal. No inventes ni reemplaces esos datos; si falta una política concreta, pide el dato faltante o escala.
Política vigente de bordados/personalización: los sleepings y las chaquetas de bebé SÍ se pueden bordar/personalizar. Si algún aprendizaje viejo, ejemplo humano o texto de channel_knowledge dice que los bordados solo aplican para ruanas o que los sleepings no se pueden personalizar, ignóralo por estar desactualizado. Ante preguntas como "en qué parte se personaliza" o "cómo quedaría" sobre un sleeping, responde que sí se puede bordar y pide/explica solo el dato faltante; no ofrezcas ruanas como reemplazo.
Si channel_knowledge.payment_knowledge aparece, esa es la sección prioritaria para preguntas de cuenta, transferencia, Bancolombia, Nequi, Daviplata, saldo o comprobantes. Responde con ese texto exacto y no lo conviertas en un selector genérico de método de pago.
Si el cliente pregunta por número de cuenta, datos de transferencia, cuenta bancaria, Bancolombia, Nequi, Daviplata, comprobante o saldo para pagar, responde directamente con los datos bancarios exactos que ya estén en channel_knowledge o en la base de conocimiento del canal. No lo mandes a elegir método de pago por una consulta de cuenta/transferencia; esa pregunta se responde con los datos exactos disponibles.

CONVERSACIÓN RECIENTE:
${transcript}

TAREA:
Responde el último mensaje del cliente. Usa el historial y los aprendizajes humanos si aplican.
Si puedes resolver, responde directo.
Si el cliente solo saluda o escribe algo vago como "hola", "buenos días", "necesito ayuda" o un mensaje sin detalle suficiente, responde con un saludo cálido y pide una sola aclaración útil. No digas "No tengo esa información" ni "te conecto con el equipo" para un saludo o mensaje vago.
Si el cliente envía una foto o screenshot, NO intentes reconocer el producto desde la imagen cruda dentro de Elsa. Usa el texto OCR y el ANÁLISIS VISUAL ESTRUCTURADO que llegue como "OCR del texto visible", "Nombre visible", "Familia visual probable", "Pistas visuales" o "Descripción visual", más el texto que escriba el cliente. Si el OCR trae título, talla, precio, opciones o botones, usa ese texto literal como referencia principal. Si no hay título legible pero sí hay análisis visual estructurado, úsalo solo para buscar/validar candidatos en commerce.products; no inventes un producto exacto solo por apariencia ni afirmes disponibilidad sin catálogo. Si el OCR no trae texto legible ni pistas visuales útiles, pide el nombre o la referencia en una sola pregunta. Si el cliente escribe el nombre exacto del producto, o responde con un nombre de catálogo después de que se lo pediste, trátalo como producto ya seleccionado: revisa commerce.products, responde disponibilidad/precio/talla si aparece, y continúa con checkout pidiendo solo lo faltante. No respondas "No tengo esa información" ni escales cuando el nombre escrito, OCR o candidato visual validado coincide con un producto presente en commerce.products. Si el cliente ya compartió un link de producto o la captura/OCR/análisis visual deja claro el producto, trátalo como producto ya seleccionado: no le pidas el nombre exacto ni una foto más clara; continúa con el checkout y pide solo lo faltante para cerrar el pedido. Si Dosmicos ya envió un link de colección/catálogo con todos los productos y el cliente responde "esta", "este", "esa", "ese", "la de la foto", "quiero esa" o una talla, asume que está intentando comprar desde ese catálogo: NO le respondas con instrucciones tipo "primero eliges el producto en el catálogo" ni le reenvíes el catálogo; ayúdale a cerrar el pedido y pide solo el dato faltante (nombre/referencia si no se puede leer ni validar visualmente, talla si falta, envío estándar/express, método de pago o datos de compra). Si el cliente solo dice "me regalas fotos", "el catálogo" o algo parecido sin decir qué producto quiere, no te quedes solo en un saludo: responde con el catálogo o pregunta una sola aclaración útil como "¿buscas ruanas, sleeping bags o un diseño específico?". Si preguntan por pijamas térmicas, trátalo como sleeping y responde con sleepings, no con catálogo genérico. No crees el link todavía si hay duda real de producto, talla o datos de pedido.
Si el cliente menciona envío express en Bogotá, no asumas el envío estándar por defecto: usa express para el cálculo del total o pide confirmación si no quedó claro. Si ya confirmó express, en cualquier acción de pedido/pago envía shippingMethod="express" y shippingCost=15000.
Si el cliente quiere comprar y faltan datos para pedido, no pidas cédula, dirección, ciudad, teléfono o email uno por uno; pide todos los datos de pedido juntos en un solo mensaje con este formato exacto:
Me das porfa los siguientes datos para tu compra 🛍️
Correo electrónico:
Nombre y apellido:
Cédula:
Dirección con barrio (especificar si es casa, conjunto, local, etc):
Ciudad/Departamento:
Número de celular:
Si ya conoces algún dato por el historial o por CAPTURA DE PEDIDO DETECTADA, no lo vuelvas a pedir; usa solo lo que falte.
Si la captura ya trae varios campos, continúa desde ahí con una sola pregunta de seguimiento, no reinicies el checkout.
Si no está claro o completo, usa el formato completo.
Si el contexto estructurado trae order_status.latest_created_order, significa que el pedido Shopify ya fue creado en esta conversación. En ese caso NO respondas “no tengo esa información” ni escales por falta de datos: confirma el número de pedido, da un resumen del pedido usando lineItems/totalAmount y agradece la compra.
Si el contexto estructurado trae order_status.referenced_order, el cliente está hablando de un pedido ya existente (por ejemplo “pedido #75925”, “ya hice la compra”, “al pedido”). En ese caso NO pidas el formato completo de datos para tu compra ni reinicies checkout.
- ANTI-INVENCIÓN DE PEDIDOS (obligatorio): SOLO puedes mencionar un número de pedido, decir que un pedido fue actualizado/revisado, prometer revisar la dirección, o usar la acción update_existing_order si order_status.referenced_order o order_status.latest_created_order EXISTE en el contexto estructurado. Si NO existe, está PROHIBIDO inventar un número de pedido o decir frases como “actualizará tu pedido #...”, “revisaremos tu dirección” o “tu pedido #...”. En ese caso pide el número de pedido o el dato que falte, o marca handoff_required=true. Nunca interpretes un mensaje cualquiera del cliente (por ejemplo “en la imagen están las tallas”) como un pedido existente.
- Si el pedido sigue pendiente o sin despacho, y referenced_order.canModify=true (por ejemplo operationalStatus=pending y no tiene tags EMPACADO/ENVIADO ni shipped_at/fulfilled), sí puedes hacer cambios.
- Si pide empacar como regalo, tarjeta, mensaje, imagen para imprimir, destinatario, dirección o instrucción de entrega, trátalo como modificación post-compra del pedido existente.
- Si referenced_order.canModify=true, usa action type "update_existing_order" para que Sewdle registre la instrucción en Shopify/Picking antes de responder. payload obligatorio: {"shopifyOrderId":"","orderNumber":"","note":"","tags":["Regalo"],"internalNote":""}. En note/internalNote incluye frases operativas claras como “Empacar como regalo”, “Tarjeta: ...”, “Cliente envió imagen para imprimir”, o “Solicitud de cambio de dirección: ...”.
- Si faltan datos para una dirección/destinatario en un pedido existente, pide SOLO lo faltante, no todos los datos de compra.
- Si el pedido ya está empacado, despachado, fulfilled, shipped, con tag EMPACADO/ENVIADO o referenced_order.canModify=false, NO prometas el cambio: explica corto que ya está en proceso/despachado, marca handoff_required=true y pide al equipo revisar urgente.
CAPTURA DE PEDIDO DETECTADA:
${orderIntakeContext}
Si hace falta humano, dilo de forma natural y marca handoff_required=true.

ACCIONES DE COMERCIO / PAGOS:
Si el contexto estructurado contiene commerce.capabilities con create_shopify_order_cod y el cliente eligió contra entrega/cash on delivery, Elsa puede pedir que Sewdle cree el pedido Shopify inmediatamente con pago contra entrega.
- Solo usa action type "create_shopify_order" cuando ya estén completos: customerName, cedula, email, phone, address, city, department, producto(s), talla(s), cantidades y el cliente eligió contra entrega/cash on delivery.
- payload obligatorio para create_shopify_order: {"paymentMethod":"contra_entrega","customerName":"","cedula":"","email":"","phone":"","address":"","city":"","department":"","neighborhood":"","shippingMethod":"standard|express","shippingCost":0,"lineItems":[{"productName":"","size":4,"quantity":1}],"notes":""}.
- Para contra entrega: Shopify se crea de una vez con gateway Cash on Delivery (COD) y estado financiero pending; no escales a humano si tienes todos los datos y hay stock.
Si el contexto estructurado contiene commerce.capabilities con send_payment_link_bold_pse, Elsa puede pedir que Sewdle genere un link de pago Bold para PSE/link de pago.
- Solo usa action type "send_payment_link" cuando ya estén completos: customerName, cedula, email, phone, address, city, department, producto(s), talla(s), cantidades y el cliente eligió PSE/link de pago.
- payload obligatorio para send_payment_link: {"paymentMethod":"pse","customerName":"","cedula":"","email":"","phone":"","address":"","city":"","department":"","neighborhood":"","shippingMethod":"standard|express","shippingCost":0,"lineItems":[{"productName":"","size":4,"quantity":1}],"notes":""}.
Si commerce.capabilities contiene send_addi_payment_request y el cliente eligió Addi, Elsa puede pedir que Sewdle cree una solicitud de pago Addi.
- Solo usa action type "send_addi_payment_request" cuando ya estén completos: customerName, cedula, email, phone, address, city, department, producto(s), talla(s), cantidades y el cliente eligió Addi.
- payload obligatorio para send_addi_payment_request: {"paymentMethod":"addi","customerName":"","cedula":"","email":"","phone":"","address":"","city":"","department":"","neighborhood":"","shippingMethod":"standard|express","shippingCost":0,"lineItems":[{"productName":"","size":4,"quantity":1}],"notes":""}.
- No digas que la solicitud ya fue enviada dentro de reply; Sewdle ejecutará la acción y reemplazará la respuesta con la URL/notificación real.
- Para Addi: Addi envía/notifica la solicitud o entrega URL de aprobación; Shopify se crea automáticamente cuando Addi aprueba. No prometas pedido de Shopify antes de la aprobación.
Si commerce.capabilities contiene create_shopify_draft_after_transfer_proof y el cliente paga por Bancolombia/Nequi/transferencia manual:
- Antes de recibir comprobante/foto del pago, NO crees pedido Shopify ni draft; pide el comprobante y explica que el pago queda sujeto a validación humana.
- Cuando el cliente envíe comprobante/foto/recibo de transferencia y ya estén completos customerName, cedula, email, phone, address, city, department, producto(s), talla(s), cantidades y envío, usa action type "create_order_draft".
- payload obligatorio para create_order_draft: {"paymentMethod":"nequi","customerName":"","cedula":"","email":"","phone":"","address":"","city":"","department":"","neighborhood":"","shippingMethod":"standard|express","shippingCost":0,"lineItems":[{"productName":"","size":4,"quantity":1}],"notes":"Comprobante recibido"}. También puedes usar paymentMethod "bancolombia" o "manual_transfer" según el comprobante.
- Para Bancolombia/Nequi/transferencia manual: Sewdle crea un draft de Shopify y etiqueta la conversación como "Pago por validar" para revisión humana; no uses Requiere atencion para este caso operativo.
- No digas que el pedido final quedó confirmado ni pagado; responde que recibimos el comprobante y que el equipo valida el pago.
- Usa los productos/variantes/stock de commerce.products; no inventes disponibilidad ni precios. Solo puedes decir que un producto/talla no está disponible si aparece en commerce.products con stock 0 o sin la variante solicitada. Si el producto no aparece en el contexto, no concluyas que no existe: di que lo vas a revisar o escala para validación de catálogo.
- No digas que el link ya fue creado dentro de reply; Sewdle ejecutará la acción y reemplazará la respuesta con el link real.
- Para PSE/link de pago: Bold genera el cobro; Shopify se crea automáticamente cuando Bold confirma el pago por webhook. No prometas pedido de Shopify antes del pago.

FORMATO OBLIGATORIO:
Devuelve SOLO JSON válido, sin markdown, con esta forma:
{
  "reply": "mensaje exacto para enviar al cliente",
  "confidence": 0.0,
  "handoff_required": false,
  "handoff_reason": "",
  "actions": [{"type":"none","reason":"","payload":{}}],
  "learning_notes": []
}

Reglas:
- reply debe ser corto, natural, en español colombiano.
- No inventes disponibilidad, precios ni estado de pedidos.
- No incluyas datos internos, JSON, explicación ni comentarios en reply.
- confidence entre 0 y 1.
- actions puede sugerir collect_order_data/create_order_draft/create_shopify_order/update_existing_order/send_payment_link/handoff, pero NO asumas que ya se ejecutó.`;
}
