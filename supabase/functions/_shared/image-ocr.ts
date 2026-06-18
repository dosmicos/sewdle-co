export type VisionImageMessageLike = {
  role?: string;
  direction?: string;
  content?: unknown;
  media_url?: string | null;
  message_type?: string | null;
};

type OcrCache = Map<string, Promise<string | null>>;

type OpenAiOcrPayload = {
  visible_text?: string;
  title_line?: string;
  product_name?: string;
  product_title_candidates?: unknown;
  price?: string;
  options?: unknown;
  buttons?: unknown;
  visual_description?: string;
  visual_product_family?: string;
  visual_design_terms?: unknown;
  unreadable?: boolean;
};

function parseJsonCandidate(text: string): any | null {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // keep trying
    }
  }

  return null;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 10);
}

function inferProductTitleFromVisibleText(value: string): string {
  const lines = String(value || '')
    .split(/\r?\n|\s{2,}/)
    .map((line) => normalizeImageHintLine(line.trim()))
    .filter(Boolean);

  let bestCandidate = '';
  let bestScore = 0;
  for (const line of lines) {
    if (isTooGenericImageHint(line)) continue;
    if (isNonProductScreenshotLine(line)) continue;
    const score = scoreReadableProductHint(line);
    if (score > bestScore) {
      bestCandidate = line;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestCandidate : '';
}

function normalizeOcrSummary(parsed: OpenAiOcrPayload | null): string | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const visibleText = typeof parsed.visible_text === 'string' ? parsed.visible_text.trim() : '';
  const titleLine = typeof parsed.title_line === 'string' ? parsed.title_line.trim() : '';
  const productName = typeof parsed.product_name === 'string' ? parsed.product_name.trim() : '';
  const productTitleCandidates = normalizeList(parsed.product_title_candidates);
  const price = typeof parsed.price === 'string' ? parsed.price.trim() : '';
  const options = normalizeList(parsed.options);
  const buttons = normalizeList(parsed.buttons);
  const visualDescription = typeof parsed.visual_description === 'string' ? parsed.visual_description.trim() : '';
  const visualProductFamily = typeof parsed.visual_product_family === 'string' ? parsed.visual_product_family.trim() : '';
  const visualDesignTerms = normalizeList(parsed.visual_design_terms);

  const visibleTextTitleCandidate = inferProductTitleFromVisibleText(visibleText);
  const titleCandidate = [titleLine, productName, ...productTitleCandidates, visibleTextTitleCandidate].find((value) => value && !isTooGenericImageHint(value)) || '';
  const fragments = [
    titleCandidate ? `Nombre visible: ${titleCandidate}` : '',
    visibleText && visibleText !== titleCandidate ? visibleText : '',
    price ? `Precio visible: ${price}` : '',
    options.length ? `Opciones: ${options.join(' | ')}` : '',
    buttons.length ? `Botones: ${buttons.join(' | ')}` : '',
    visualProductFamily ? `Familia visual probable: ${visualProductFamily}` : '',
    visualDesignTerms.length ? `Pistas visuales: ${visualDesignTerms.join(' | ')}` : '',
    visualDescription ? `Descripción visual: ${visualDescription}` : '',
    parsed.unreadable ? 'Texto no legible' : '',
  ].filter(Boolean);

  if (!fragments.length) return null;
  return fragments.join('\n');
}

function extractTextFromMessageContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        const typed = part as Record<string, any>;
        if (typed.type === 'text') return typed.text || typed.input_text || typed.output_text || '';
      }
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function extractNonOcrTextFromMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
      .split(/\r?\n/)
      .filter((line) => !/^ocr del texto visible:/i.test(line.trim()))
      .join('\n')
      .trim();
  }
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        const typed = part as Record<string, any>;
        if (typed.type === 'text') return typed.text || typed.input_text || typed.output_text || '';
      }
      return '';
    })
    .filter((text) => text && !/^ocr del texto visible:/i.test(String(text).trim()))
    .join('\n')
    .trim();
}

function extractRequestedSize(content: unknown): string | null {
  const text = extractNonOcrTextFromMessageContent(content);
  if (!text) return null;

  const match = text.match(/\btalla\s*(?:es|:|=)?\s*([0-9]{1,2}(?:\s*-\s*[0-9]{1,2}\s*m)?|[xsml]{1,3})\b/i);
  if (!match?.[1]) return null;
  return `talla ${match[1].replace(/\s+/g, '').toUpperCase()}`;
}

function extractRequestedShippingMethod(content: unknown): string | null {
  const text = extractNonOcrTextFromMessageContent(content);
  if (!text) return null;

  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/\bexpress\b/.test(normalized)) return 'envío express';
  if (/\b(?:estandar|standard)\b/.test(normalized)) return 'envío estándar';
  return null;
}

function buildCheckoutDataRequestAfterImage(hint: string, requestedSize: string, requestedShipping: string): string {
  return [
    `Perfecto 😊 queda ${hint} en ${requestedSize} con ${requestedShipping}.`,
    'Me das porfa los datos de compra para crear tu pedido:',
    'Correo electrónico:',
    'Nombre y apellido:',
    'Cédula:',
    'Dirección con barrio (especificar si es casa, conjunto, local, etc):',
    'Ciudad/Departamento:',
    'Número de celular:',
    'Método de pago:',
  ].join('\n');
}

function extractImageUrlFromContent(content: unknown): string | null {
  if (!Array.isArray(content)) return null;

  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    const typed = part as Record<string, any>;
    if (typed.type === 'image_url') {
      const url = typed.image_url?.url;
      if (typeof url === 'string' && url.trim()) return url.trim();
    }
    if (typed.type === 'input_image') {
      const url = typed.image_url?.url || typed.url;
      if (typeof url === 'string' && url.trim()) return url.trim();
    }
  }

  return null;
}

export function mergeImageContextWithLatestUserText(imageContent: unknown, latestUserContent: unknown): unknown {
  return mergeImageContextWithRecentUserTexts(imageContent, [latestUserContent]);
}

export function mergeImageContextWithRecentUserTexts(imageContent: unknown, recentUserContents: unknown[]): unknown {
  const imageText = extractTextFromMessageContent(imageContent);
  const imageParts = Array.isArray(imageContent)
    ? [...imageContent]
    : (imageText ? [{ type: 'text', text: imageText }] : []);

  for (const userContent of recentUserContents || []) {
    const latestText = extractTextFromMessageContent(userContent);
    if (latestText && latestText !== imageText && !imageText.includes(latestText)) {
      const alreadyAdded = imageParts.some((part) => {
        if (!part || typeof part !== 'object') return false;
        const typed = part as Record<string, any>;
        return String(typed.text || typed.input_text || typed.output_text || '').trim() === latestText;
      });
      if (!alreadyAdded) imageParts.push({ type: 'text', text: latestText });
    }
  }

  return imageParts.length ? imageParts : imageContent;
}

function inferImageMimeType(imageUrl: string, response: Response | null = null): string {
  const headerType = response?.headers.get('content-type')?.split(';')[0]?.trim();
  if (headerType && headerType.startsWith('image/')) return headerType;
  const lower = String(imageUrl || '').toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  if (lower.includes('.jpeg') || lower.includes('.jpg')) return 'image/jpeg';
  return 'image/png';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function resolveVisionImageSource(imageUrl: string): Promise<string> {
  const trimmedUrl = String(imageUrl || '').trim();
  if (!trimmedUrl || trimmedUrl.startsWith('data:')) return trimmedUrl;

  try {
    const response = await fetch(trimmedUrl);
    if (!response.ok) return trimmedUrl;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 12_000_000) return trimmedUrl;

    const mimeType = inferImageMimeType(trimmedUrl, response);
    return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
  } catch {
    return trimmedUrl;
  }
}

async function getVisibleTextSummary(
  imageUrl: string,
  openaiApiKey: string,
  cache: OcrCache,
  visionImageSource?: string,
): Promise<string | null> {
  const trimmedUrl = String(imageUrl || '').trim();
  // Prefer OpenRouter (Gemini 2.5 Flash Lite — strong OCR, cheap, and off the
  // flaky OpenAI account that was returning null for every image). Fall back to
  // OpenAI gpt-4o-mini only if no OPENROUTER_API_KEY secret is configured.
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY') || '';
  const useOpenRouter = Boolean(openRouterKey);
  const apiKey = useOpenRouter ? openRouterKey : (openaiApiKey || '');
  const endpoint = useOpenRouter
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const ocrModel = useOpenRouter ? 'google/gemini-2.5-flash-lite' : 'gpt-4o-mini';
  if (!trimmedUrl || !apiKey) return null;

  const cached = cache.get(trimmedUrl);
  if (cached) return await cached;

  const promptImageSource = visionImageSource || trimmedUrl;

  const promise = (async () => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(useOpenRouter ? { 'X-Title': 'Sewdle Elsa OCR' } : {}),
        },
        body: JSON.stringify({
          // OCR model: OpenRouter→Gemini 2.5 Flash Lite (vision, cheap, reliable),
          // else OpenAI gpt-4o-mini. gpt-4o (the prior model) was failing in prod.
          model: ocrModel,
          temperature: 0,
          max_tokens: 300,
          messages: [
            {
              role: 'system',
              content: [
                'Eres un OCR de precisión para screenshots y fotos de productos.',
                'Devuelve SOLO JSON válido con estas llaves:',
                '{"visible_text":"","title_line":"","product_title_candidates":[],"price":"","options":[],"buttons":[],"visual_product_family":"","visual_design_terms":[],"visual_description":"","unreadable":false}',
                'Reglas:',
                '- Transcribe literalmente el texto visible, sin resumir ni inferir.',
                '- Copia en title_line el título visible del producto, no el nombre del chat, la hora ni mensajes de WhatsApp. Si solo se ve un fragmento, devuelve ese fragmento.',
                '- Si ves varias líneas de texto, product_title_candidates debe listar solo líneas que parezcan nombre de producto.',
                '- No inventes nombre comercial que no esté escrito.',
                '- Para fotos sin texto legible, sí puedes describir visualmente el tipo de producto, color, estampado/animal y familia probable en visual_* sin afirmar que es un producto exacto.',
                '- Si no hay texto legible, visible_text y title_line deben ir vacíos y unreadable=true.',
                '- No describas la imagen ni agregues explicación.',
              ].join(' '),
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Transcribe el texto visible de esta imagen. Solo JSON, sin markdown.',
                },
                {
                  type: 'image_url',
                  image_url: { url: promptImageSource, detail: 'high' },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        // Surface the real OpenAI error (429/quota, 401/auth, 404/model) instead
        // of silently returning null — this is what hid the OCR failure before.
        const errBody = await response.text().catch(() => '');
        console.error(`OCR API non-ok: ${response.status} ${errBody.slice(0, 300)}`);
        return null;
      }
      const data = await response.json();
      const raw = String(data?.choices?.[0]?.message?.content ?? '').trim();
      if (!raw) return null;

      const parsed = parseJsonCandidate(raw) as OpenAiOcrPayload | null;
      const summary = normalizeOcrSummary(parsed);
      if (summary) return summary;

      return raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim() || null;
    } catch (error) {
      console.warn('OCR extraction failed:', error);
      return null;
    }
  })();

  cache.set(trimmedUrl, promise);
  return await promise;
}

function isImagePart(part: unknown): boolean {
  if (!part || typeof part !== 'object') return false;
  const typed = part as Record<string, any>;
  return typed.type === 'image_url' || typed.type === 'input_image';
}

function isGenericImagePlaceholder(value: string): boolean {
  const normalized = String(value || '').toLowerCase().trim();
  if (!normalized) return true;
  if (normalized === '[imagen adjunta]' || normalized === '[image attached]' || normalized === '[imagen recibido]' || normalized === '[image received]') {
    return true;
  }
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return normalized.includes('imagen') || normalized.includes('image') || normalized.includes('foto') || normalized.includes('photo');
  }
  return false;
}

function normalizeImageHintLine(line: string): string {
  return String(line || '')
    .replace(/^ocr del texto visible:\s*/i, '')
    .replace(/^nombre visible:\s*/i, '')
    .replace(/^producto ya compartido:\s*/i, '')
    .replace(/^precio visible:\s*/i, '')
    .replace(/^opciones?:\s*/i, '')
    .replace(/^botones?:\s*/i, '')
    .replace(/^texto no legible\s*$/i, '')
    .replace(/^el cliente envió esta imagen\.?\s*$/i, '')
    .replace(/^mira quiero esto\.?\s*$/i, '')
    .replace(/^(?:quiero|quiero comprar|me interesa|quisiera|comprar)\s+(?:este|esta|ese|esa|el|la|lo|los|las)\s*/i, '')
    .replace(/^recib[íi] tu imagen.*$/i, '')
    .trim();
}

function isTooGenericImageHint(value: string): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  if (['sleeping', 'sleeping bag', 'sleeping walker', 'ruana', 'cobija', 'pijama', 'producto'].includes(normalized)) {
    return true;
  }

  const words = normalized.split(/\s+/).filter((word) => word.length > 1);
  return words.length < 2;
}

function normalizeScreenshotLineForSkip(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isNonProductScreenshotLine(value: string): boolean {
  const normalized = normalizeScreenshotLineForSkip(value);
  if (!normalized) return true;
  if (/^\d{1,2}:\d{2}(?:\s*[ap]\.?\s*m\.?)?$/.test(normalized)) return true;
  if (/^\d+\s+mensajes?\s+no\s+leidos?$/.test(normalized)) return true;
  if (normalized === 'dosmicos' || normalized === 'dosmicos atencion al cliente') return true;
  if (normalized.includes('atencion al cliente')) return true;
  if (normalized.includes('recibi tu imagen')) return true;
  if (normalized.includes('dejame revisarla')) return true;
  if (normalized.includes('ya vi tu imagen')) return true;
  if (normalized.includes('me pasas el nombre') || normalized.includes('nombre o la referencia')) return true;
  if (normalized.includes('que te puedo ayudar')) return true;
  if (normalized.includes('soy alejandra') || normalized.includes('soy luisa')) return true;
  if (/^quiero\s+(?:este|esta|ese|esa)\s+producto$/.test(normalized)) return true;
  if (/^el cliente envio (?:esta )?imagen/.test(normalized)) return true;
  return false;
}

function scoreReadableProductHint(value: string): number {
  const normalized = normalizeScreenshotLineForSkip(value);
  if (!normalized || isNonProductScreenshotLine(normalized) || isTooGenericImageHint(normalized)) return 0;

  let score = 1;
  const productTerms = [
    'sleeping',
    'bag',
    'walker',
    'ruana',
    'cobija',
    'dosmi',
    'zapatos',
    'tog',
    'manta',
    'chaqueta',
  ];
  for (const term of productTerms) {
    if (normalized.includes(term)) score += 3;
  }
  if (/^(nombre visible|titulo visible|producto visible):/i.test(value)) score += 5;
  if (/\b(talla|tog|bag|walker|ruana|dosmi)\b/i.test(value)) score += 2;
  if (normalized.includes('$') || normalized.includes('precio')) score -= 2;
  if (normalized.includes('whatsapp') || normalized.includes('boton')) score -= 2;
  return Math.max(0, score);
}

export function extractReadableImageHint(content: unknown): string | null {
  const rawText = extractTextFromMessageContent(content);
  if (!rawText) return null;

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const ocrIndex = lines.findIndex((line) => /^ocr del texto visible:/i.test(line));
  const searchLines = ocrIndex >= 0 ? lines.slice(ocrIndex + 1) : lines;
  let bestCandidate = '';
  let bestScore = 0;

  for (const line of searchLines) {
    if (isGenericImagePlaceholder(line)) continue;
    const normalized = line.toLowerCase();
    if (!normalized) continue;
    if (normalized.includes('el cliente envió esta imagen')) continue;
    if (normalized.includes('mira quiero esto')) continue;
    if (normalized.includes('recibí tu imagen')) continue;
    if (normalized.includes('texto no legible')) continue;

    const cleaned = normalizeImageHintLine(line);
    if (cleaned) {
      if (isTooGenericImageHint(cleaned)) continue;
      if (isNonProductScreenshotLine(cleaned)) continue;
      const score = scoreReadableProductHint(cleaned);
      if (score > bestScore) {
        bestCandidate = cleaned;
        bestScore = score;
      }
    }
  }

  return bestScore > 0 ? bestCandidate.slice(0, 120) : null;
}

export function buildImageScreenshotFallbackReply(content: unknown): string {
  const hint = extractReadableImageHint(content);
  if (hint) {
    const requestedSize = extractRequestedSize(content);
    const requestedShipping = extractRequestedShippingMethod(content);
    if (requestedSize && requestedShipping) {
      return buildCheckoutDataRequestAfterImage(hint, requestedSize, requestedShipping);
    }
    if (requestedShipping) {
      return `Ya vi la imagen 😊 en la captura se lee: ${hint}. Ya tengo ${requestedShipping}; me confirmas porfa la talla.`;
    }
    if (requestedSize) {
      return `Ya vi la imagen 😊 es ${hint} en ${requestedSize}. Para avanzar con el pedido, ¿prefieres envío estándar o express?`;
    }
    return `Ya vi la imagen 😊 en la captura se lee: ${hint}. Para avanzar con el pedido, me confirmas porfa la talla y si prefieres envío estándar o express.`;
  }

  return 'Ya vi tu imagen 😊 si ya es el producto que quieres, me pasas el nombre o la referencia y te ayudo a cerrarlo.';
}

export function shouldReplaceGenericImageReply(reply: string, content: unknown): boolean {
  const normalizedReply = String(reply || '').toLowerCase();
  const normalizedReplyAscii = normalizedReply.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!normalizedReply) return false;

  if (!contentHasImageSignal(content)) return false;

  const asksForNameOrClearerPhoto =
    normalizedReply.includes('confirma el nombre') ||
    normalizedReply.includes('confirmas el nombre') ||
    normalizedReply.includes('nombre exacto') ||
    normalizedReply.includes('me pasas el nombre') ||
    normalizedReply.includes('pásame el nombre') ||
    normalizedReply.includes('pasame el nombre') ||
    normalizedReply.includes('me pasas la referencia') ||
    normalizedReply.includes('pásame la referencia') ||
    normalizedReply.includes('pasame la referencia') ||
    normalizedReply.includes('nombre o la referencia') ||
    normalizedReply.includes('nombre o referencia') ||
    normalizedReply.includes('primero eliges el producto') ||
    normalizedReplyAscii.includes('que diseno') ||
    normalizedReplyAscii.includes('diseno de ruana') ||
    normalizedReplyAscii.includes('no se alcanza a leer') ||
    normalizedReply.includes('elige el producto en el catalogo') ||
    normalizedReply.includes('elige el producto en el catálogo') ||
    normalizedReply.includes('vuelves al catalogo') ||
    normalizedReply.includes('vuelves al catálogo') ||
    normalizedReply.includes('te paso el catalogo') ||
    normalizedReply.includes('te paso el catálogo') ||
    normalizedReply.includes('modelo exacto') ||
    normalizedReply.includes('no alcanzo a ver el modelo') ||
    normalizedReply.includes('no alcanzo a ver el producto') ||
    normalizedReply.includes('reenvia una foto') ||
    normalizedReply.includes('reenvías una foto') ||
    normalizedReply.includes('foto mas clara') ||
    normalizedReply.includes('foto más clara') ||
    normalizedReply.includes('parece un sleeping') ||
    normalizedReply.includes('sleeping bag o walker') ||
    normalizedReply.includes('identificar bien') ||
    normalizedReply.includes('no me deja identificar') ||
    normalizedReply.includes('no logro identificar') ||
    normalizedReply.includes('no alcanzo a identificar') ||
    normalizedReply.includes('ya vi tu imagen');

  return normalizedReply.includes('no tengo esa información') ||
    normalizedReply.includes('no tengo esa informacion') ||
    normalizedReply.includes('te conecto con el equipo') ||
    normalizedReply.includes('no tengo esa respuesta') ||
    normalizedReply.includes('no alcanzo') ||
    normalizedReply.includes('no pude identificar') ||
    normalizedReply.includes('no puedo identificar') ||
    asksForNameOrClearerPhoto;
}

export function contentHasImageSignal(content: unknown): boolean {
  const rawText = extractTextFromMessageContent(content).toLowerCase();
  return Boolean(
    Array.isArray(content) && content.some(isImagePart) ||
      rawText.includes('[imagen adjunta]') ||
      rawText.includes('ocr del texto visible:') ||
      rawText.includes('texto no legible'),
  );
}

export async function buildVisionImageContent(
  message: VisionImageMessageLike,
  openaiApiKey: string,
  cache: OcrCache = new Map<string, Promise<string | null>>(),
): Promise<unknown> {
  const role = message.role || message.direction || '';
  if (role !== 'user') return message.content;

  const content = message.content;
  const imageUrl = message.media_url?.trim() || extractImageUrlFromContent(content);
  if (!imageUrl) return content;

  const caption = extractTextFromMessageContent(content) || 'El cliente envió esta imagen.';
  const existingText = extractTextFromMessageContent(content);
  if (existingText.includes('OCR del texto visible:')) return content;

  const visionImageSource = await resolveVisionImageSource(imageUrl);
  const ocrText = await getVisibleTextSummary(imageUrl, openaiApiKey, cache, visionImageSource);
  const parts: Array<Record<string, unknown>> = [];

  if (ocrText) {
    parts.push({ type: 'text', text: `OCR del texto visible:\n${ocrText}` });
  } else {
    // Preserve the image/OCR signal even when extraction fails. Downstream guards
    // must know this was an image reply so generic "send me the name/reference"
    // responses can be caught instead of escaping as plain text replies.
    parts.push({ type: 'text', text: 'OCR del texto visible:\nTexto no legible o no disponible' });
  }

  if (caption) {
    parts.push({ type: 'text', text: caption });
  }

  // Do not pass the raw image to the customer-reply model. The reply model should
  // only receive OCR text/caption, so it cannot guess products from visuals.
  return parts;
}
