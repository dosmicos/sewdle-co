type ProductVariantLike = {
  title?: string | null;
  sku?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  inventory_quantity?: number | null;
  price?: string | number | null;
};

type ConversationLike = {
  direction?: string;
  role?: string;
  content?: unknown;
};

type ProductLike = {
  id?: number | string;
  title?: string | null;
  handle?: string | null;
  body_html?: string | null;
  tags?: string | null;
  product_type?: string | null;
  options?: Array<{ name?: string | null; values?: string[] | null }>;
  variants?: ProductVariantLike[];
};

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'con', 'por', 'para',
  'que', 'qué', 'cual', 'cuál', 'como', 'cómo', 'cuanto', 'cuánto', 'tienen', 'tienes',
  'hay', 'está', 'estan', 'son', 'es', 'quiero', 'busco', 'necesito', 'me', 'mi', 'te', 'tu',
  'hola', 'buenos', 'dias', 'tardes', 'noches', 'gracias', 'favor', 'ayuda', 'info',
  'información', 'precio', 'precios', 'cuesta', 'cuestan', 'disponible', 'disponibles', 'stock',
  'envío', 'envio', 'enviar', 'comprar', 'pedir', 'ver', 'mostrar', 'enseñar', 'foto', 'fotos',
  'imagen', 'imágenes', 'imagenes', 'más', 'mas', 'colores', 'color', 'colór',
]);

function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const candidate = part as Record<string, unknown>;
      if (typeof candidate.text === 'string') return candidate.text.trim();
      if (typeof candidate.content === 'string') return candidate.content.trim();
      return '';
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

function extractDosmicosProductHandle(text: string): string | null {
  const match = String(text || '').match(/https?:\/\/(?:www\.)?dosmicos\.co\/products\/([a-z0-9-]+)/i);
  return match?.[1]?.trim().toLowerCase() || null;
}

function extractDosmicosCollectionPath(text: string): string | null {
  const match = String(text || '').match(/https?:\/\/(?:www\.)?dosmicos\.co\/collections\/([a-z0-9-]+)/i);
  return match?.[1]?.trim().toLowerCase() || null;
}

function humanizeProductHandle(handle: string): string {
  return String(handle || '').replace(/-/g, ' ').trim();
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripVariantDetails(value: string): string {
  const normalized = normalizeForMatch(value);
  const variantKeywordMatch = normalized.match(/\b(talla|size|unidad|unidades|unid|cantidad|cant)\b/);
  const base = variantKeywordMatch?.index != null ? normalized.slice(0, variantKeywordMatch.index).trim() : normalized;
  return base.replace(/\b\d+(?:[.,]\d+)?\s*(cop|uds|unidades|unidad|años|anos|meses|m|cm)?\s*$/g, '').trim();
}

function tokenizeForMatch(value: string): string[] {
  return normalizeForMatch(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function levenshteinDistance(a: string, b: string, maxDistance = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let current = [i];
    let rowMin = current[0];

    for (let j = 1; j <= b.length; j += 1) {
      const insertCost = current[j - 1] + 1;
      const deleteCost = previous[j] + 1;
      const replaceCost = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      const next = Math.min(insertCost, deleteCost, replaceCost);
      current.push(next);
      rowMin = Math.min(rowMin, next);
    }

    if (rowMin > maxDistance) return maxDistance + 1;
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length] ?? maxDistance + 1;
}

function tokenMatches(term: string, candidate: string): boolean {
  if (!term || !candidate) return false;
  const normalizedTerm = normalizeForMatch(term);
  const normalizedCandidate = normalizeForMatch(candidate);
  if (!normalizedTerm || !normalizedCandidate) return false;
  if (normalizedCandidate.includes(normalizedTerm) || normalizedTerm.includes(normalizedCandidate)) return true;
  return levenshteinDistance(normalizedTerm, normalizedCandidate, normalizedTerm.length <= 4 ? 1 : 2) <= (normalizedTerm.length <= 4 ? 1 : 2);
}

function textMatchesTerm(term: string, haystack: string): boolean {
  const normalizedTerm = normalizeForMatch(term);
  const normalizedHaystack = normalizeForMatch(haystack);
  if (!normalizedTerm || !normalizedHaystack) return false;
  if (normalizedHaystack.includes(normalizedTerm)) return true;
  return tokenizeForMatch(haystack).some((token) => tokenMatches(normalizedTerm, token));
}

export function scoreProductNameMatch(catalogTitle: string, aiName: string): number {
  const a = normalizeForMatch(catalogTitle);
  const b = normalizeForMatch(aiName);
  if (!a || !b) return 0;
  if (a === b) return 100;

  const aBase = stripVariantDetails(a);
  const bBase = stripVariantDetails(b);
  if (aBase && bBase && aBase === bBase) return 98;
  if (aBase && bBase && (aBase.includes(bBase) || bBase.includes(aBase))) return 92;

  const aWords = aBase.split(/\s+/).filter((w) => w.length > 2);
  const bWords = bBase.split(/\s+/).filter((w) => w.length > 2);
  if (aWords.length === 0 || bWords.length === 0) return 0;
  const matches = bWords.filter((bw) => aWords.some((aw) => aw.includes(bw) || bw.includes(aw)));
  return Math.round((matches.length / bWords.length) * 70);
}

export function buildProductSearchContext(
  userMessage: string,
  conversationHistory: ConversationLike[] = [],
  maxRecentCustomerMessages: number = 4,
): string {
  const recentContextMessages = conversationHistory
    .filter((message) => {
      const isInbound = message.direction === 'inbound' || message.role === 'user';
      const text = extractTextFromContent(message.content);
      const isDosmicosLinkShared = /dosmicos\.co\/(?:products|collections)\//i.test(text);
      return text.length > 0 && (isInbound || isDosmicosLinkShared);
    })
    .slice(-maxRecentCustomerMessages)
    .map((message) => extractTextFromContent(message.content))
    .filter(Boolean);

  const selectedProductHints = recentContextMessages
    .map((message) => {
      const handle = extractDosmicosProductHandle(message);
      if (handle) return `Producto ya compartido: ${humanizeProductHandle(handle)}`;
      const collection = extractDosmicosCollectionPath(message);
      return collection
        ? `Catálogo ya compartido: ${humanizeProductHandle(collection)}. Si el cliente responde esta/este/esa/ese con talla, continúa checkout y no reenvíes catálogo.`
        : '';
    })
    .filter(Boolean);

  const parts = [...selectedProductHints, ...recentContextMessages, userMessage].filter((value) => String(value || '').trim().length > 0);
  return parts.join(' \n ');
}

export function extractSearchTerms(message: string): string[] {
  const normalized = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  const terms = Array.from(new Set(normalized));
  const normalizedMessage = normalizeForMatch(message);
  if (normalizedMessage.includes('pijama') || normalizedMessage.includes('termica') || normalizedMessage.includes('termico')) {
    if (!terms.includes('sleeping')) terms.push('sleeping');
    if (!terms.includes('walker')) terms.push('walker');
  }
  return terms;
}

export function isProductQuery(message: string): boolean {
  const lowerMsg = normalizeForMatch(message);
  const productIndicators = [
    'producto', 'precio', 'cuesta', 'cuestan', 'stock', 'disponible', 'talla', 'size',
    'color', 'colores', 'tienen', 'hay', 'busco', 'quiero', 'comprar', 'ver', 'mostrar', 'sleeping',
    'bag', 'ruana', 'cobija', 'bordado', 'walker', 'manta', 'pijama', 'termica', 'termico', 'sku', 'referencia',
    'catalogo', 'catálogo', 'foto', 'imagen', 'manga', 'mangas', 'modelo', 'referencia',
    'familia visual probable', 'pistas visuales', 'descripcion visual', 'descripción visual',
  ];

  return productIndicators.some((indicator) => lowerMsg.includes(normalizeForMatch(indicator)));
}

function extractVisualFieldValues(message: string): string[] {
  const values: string[] = [];
  const lines = String(message || '').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(familia visual probable|pistas visuales|descripci[oó]n visual)\s*:\s*(.+)$/i);
    if (!match?.[2]) continue;
    values.push(...match[2].split(/[|,;/]+/).map((value) => value.trim()).filter(Boolean));
  }

  return values;
}

export function extractVisualCandidateSearchTerms(message: string): string[] {
  const visualValues = extractVisualFieldValues(message);
  if (!visualValues.length) return [];

  const ignored = new Set([
    'producto', 'productos', 'visual', 'familia', 'probable', 'pistas', 'descripcion', 'descripción',
    'texto', 'legible', 'unreadable', 'imagen', 'foto', 'color', 'colores', 'cliente', 'envio', 'envió',
  ]);
  const terms = visualValues
    .flatMap((value) => extractSearchTerms(value))
    .filter((term) => !ignored.has(normalizeForMatch(term)));

  return Array.from(new Set(terms));
}

export function hasVisualCandidateSearchSignal(message: string): boolean {
  return extractVisualCandidateSearchTerms(message).length > 0;
}

export function buildVisualCandidateInstruction(searchContext: string, candidateProducts: ProductLike[]): string {
  const terms = extractVisualCandidateSearchTerms(searchContext);
  if (!terms.length || !candidateProducts.length) return '';

  const names = candidateProducts
    .slice(0, 3)
    .map((product, index) => `${index + 1}) ${product.title || product.handle || `Producto ${product.id || index + 1}`}`)
    .join(' ');

  return [
    '\n\n🖼️ CANDIDATOS VISUALES DESDE FOTO SIN NOMBRE LEGIBLE:',
    `Pistas visuales usadas para buscar en catálogo: ${terms.join(', ')}.`,
    `Posibles productos del catálogo conectado: ${names}.`,
    'Instrucción: El cliente envió una foto sin nombre legible. No pidas el nombre en seco si hay candidatos. Si un candidato coincide claramente, confírmalo por nombre y avanza pidiendo talla/cantidad o el siguiente dato faltante. Si hay varias opciones, ofrece 2–3 y pregunta cuál es. No afirmes disponibilidad/precio sin validar variantes del catálogo.',
  ].join('\n');
}

export function searchRelevantProducts(
  allProducts: ProductLike[],
  searchTerms: string[],
  maxResults: number = 10,
): ProductLike[] {
  if (searchTerms.length === 0) {
    return allProducts
      .map((p) => ({
        product: p,
        totalStock: (p.variants || []).reduce((sum: number, v: ProductVariantLike) => sum + (v.inventory_quantity || 0), 0),
      }))
      .filter((p) => p.totalStock > 0)
      .sort((a, b) => b.totalStock - a.totalStock)
      .slice(0, maxResults)
      .map((p) => p.product);
  }

  const normalizedTerms = Array.from(new Set(searchTerms.map((term) => normalizeForMatch(term)).filter(Boolean)));

  const scored = allProducts.map((product) => {
    let score = 0;
    const title = normalizeForMatch(product.title || '');
    const handle = normalizeForMatch(product.handle || '');
    const description = normalizeForMatch((product.body_html || '').replace(/<[^>]*>/g, ''));
    const tags = normalizeForMatch(product.tags || '');
    const productType = normalizeForMatch(product.product_type || '');
    const variants = product.variants || [];
    const totalStock = variants.reduce((sum: number, v: ProductVariantLike) => sum + (v.inventory_quantity || 0), 0);

    if (totalStock === 0) return { product, score: -1, totalStock };

    const titleTokens = tokenizeForMatch(product.title || '');
    const handleTokens = tokenizeForMatch(product.handle || '');
    const descriptionTokens = tokenizeForMatch((product.body_html || '').replace(/<[^>]*>/g, ''));
    const tagTokens = tokenizeForMatch(product.tags || '');
    const typeTokens = tokenizeForMatch(product.product_type || '');
    const variantTokens = variants.flatMap((variant) =>
      [variant.title, variant.sku, variant.option1, variant.option2, variant.option3]
        .filter(Boolean)
        .flatMap((value) => tokenizeForMatch(String(value)))
    );

    let matchedTerms = 0;
    for (const term of normalizedTerms) {
      let termMatched = false;

      if (textMatchesTerm(term, product.title || '')) {
        score += 12;
        termMatched = true;
      }
      if (textMatchesTerm(term, product.handle || '')) {
        score += 10;
        termMatched = true;
      }
      if (textMatchesTerm(term, product.tags || '')) {
        score += 6;
        termMatched = true;
      }
      if (textMatchesTerm(term, product.product_type || '')) {
        score += 6;
        termMatched = true;
      }
      if (textMatchesTerm(term, (product.body_html || '').replace(/<[^>]*>/g, ''))) {
        score += 4;
        termMatched = true;
      }

      if (!termMatched && titleTokens.some((token) => tokenMatches(term, token))) {
        score += 9;
        termMatched = true;
      }
      if (!termMatched && handleTokens.some((token) => tokenMatches(term, token))) {
        score += 8;
        termMatched = true;
      }
      if (!termMatched && tagTokens.some((token) => tokenMatches(term, token))) {
        score += 5;
        termMatched = true;
      }
      if (!termMatched && typeTokens.some((token) => tokenMatches(term, token))) {
        score += 5;
        termMatched = true;
      }
      if (!termMatched && descriptionTokens.some((token) => tokenMatches(term, token))) {
        score += 3;
        termMatched = true;
      }
      if (!termMatched && variantTokens.some((token) => tokenMatches(term, token))) {
        score += 7;
        termMatched = true;
      }

      if (termMatched) matchedTerms += 1;
    }

    if (normalizedTerms.length > 1 && matchedTerms >= 2) {
      score += 4;
    }
    if (normalizedTerms.every((term) => title.includes(term) || handle.includes(term))) {
      score += 6;
    }

    return { product, score, totalStock };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.totalStock - a.totalStock)
    .slice(0, maxResults)
    .map((s) => s.product);
}

function summarizeOptions(product: ProductLike): string {
  const variants = product.variants || [];
  const optionSets = new Map<string, Set<string>>();

  (product.options || []).forEach((option, index) => {
    const optionName = option?.name?.trim() || `Opción ${index + 1}`;
    optionSets.set(optionName, new Set());
  });

  variants.forEach((variant) => {
    const values = [variant.option1, variant.option2, variant.option3];
    values.forEach((value, index) => {
      const cleanValue = String(value || '').trim();
      if (!cleanValue) return;
      const optionName = product.options?.[index]?.name?.trim() || `Opción ${index + 1}`;
      if (!optionSets.has(optionName)) optionSets.set(optionName, new Set());
      optionSets.get(optionName)!.add(cleanValue);
    });
  });

  return Array.from(optionSets.entries())
    .map(([name, values]) => `${name}: ${Array.from(values).slice(0, 8).join(', ')}`)
    .filter((line) => !line.endsWith(': '))
    .join(' | ');
}

export function formatProductsForContext(products: ProductLike[]): string {
  if (products.length === 0) return '';

  let context = '\n\n📦 PRODUCTOS RELEVANTES ENCONTRADOS:\n';
  context += '⚠️ IMPORTANTE: Usa SOLO estos productos para responder. NO inventes otros.\n';
  context += '⚠️ Si el cliente pidió una variante/talla marcada en Variantes agotadas, dilo directo como agotada. NO digas “validando inventario”, “validando con bodega” ni “te confirmamos disponibilidad” cuando el stock ya está en el contexto.\n';
  context += '🔔 RECUERDA: Si el cliente pregunta por una categoría/talla, envía el LINK de la colección. Solo incluye [PRODUCT_IMAGE_ID:ID] si el cliente pide ver fotos de un producto específico.\n\n';

  products.forEach((product, index) => {
    const variants = product.variants || [];
    const totalStock = variants.reduce((sum: number, v: ProductVariantLike) => sum + (v.inventory_quantity || 0), 0);
    const price = variants[0]?.price
      ? `$${Number(variants[0].price).toLocaleString('es-CO')} COP`
      : 'Consultar';
    const variantDetails = variants
      .filter((v) => (v.inventory_quantity || 0) > 0)
      .slice(0, 8)
      .map((v) => `${v.title || v.option1 || 'Variante'}: ${v.inventory_quantity} uds`)
      .join(' | ');
    const soldOutVariantDetails = variants
      .filter((v) => Number(v.inventory_quantity || 0) <= 0)
      .slice(0, 8)
      .map((v) => `${v.title || v.option1 || 'Variante'}`)
      .join(' | ');
    const optionSummary = summarizeOptions(product);
    const reference = product.handle ? `\n   🔗 Referencia: ${product.handle}` : '';
    const productType = product.product_type ? `\n   🧩 Tipo: ${product.product_type}` : '';
    const tags = product.tags ? `\n   🏷️ Tags: ${product.tags}` : '';

    context += `${index + 1}. ${product.title} [PRODUCT_IMAGE_ID:${product.id}]\n`;
    context += `   💰 Precio: ${price}\n`;
    context += `   📊 Stock total: ${totalStock} unidades\n`;
    if (optionSummary) {
      context += `   🎨 Opciones: ${optionSummary}\n`;
    }
    if (variantDetails) {
      context += `   📐 Variantes disponibles: ${variantDetails}\n`;
    }
    if (soldOutVariantDetails) {
      context += `   ❌ Variantes agotadas: ${soldOutVariantDetails}\n`;
    }
    context += `${productType}${tags}${reference}\n\n`;
  });

  return context;
}
