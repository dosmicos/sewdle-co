export type AvailabilityProductVariant = {
  title?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  inventory_quantity?: number;
};

export type AvailabilityProduct = {
  title?: string;
  variants?: AvailabilityProductVariant[];
};

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAvailabilityDeferralReply(reply: string): boolean {
  const text = normalizeText(reply);
  if (!text) return false;
  return [
    "te reviso",
    "lo reviso",
    "dejame revisar",
    "dejame revisarla",
    "dejame revisarlo",
    "confirmamos por aqui",
    "te confirmamos",
    "confirmar disponibilidad",
    "validando inventario",
    "validando con bodega",
    "validar con bodega",
    "validar inventario",
  ].some((phrase) => text.includes(phrase));
}

export function extractRequestedSize(text: string): string | null {
  const normalized = normalizeText(text);
  const explicit = normalized.match(/(?:talla|size)\s*([0-9]{1,2}|[a-z]{1,4})\b/);
  if (explicit?.[1]) return explicit[1];
  return null;
}

function variantFirstSizeToken(variant: AvailabilityProductVariant): string | null {
  const candidates = [variant.option1, variant.option2, variant.option3, variant.title]
    .map((value) => normalizeText(String(value || "")))
    .filter(Boolean);

  for (const candidate of candidates) {
    const match = candidate.match(/^([0-9]{1,2}|[a-z]{1,4})\b/);
    if (match?.[1]) return match[1];
  }
  return null;
}

function findVariantBySize(product: AvailabilityProduct, size: string): AvailabilityProductVariant | null {
  const wanted = normalizeText(size);
  return (product.variants || []).find((variant) => variantFirstSizeToken(variant) === wanted) || null;
}

function availableVariantSummary(product: AvailabilityProduct): string {
  return (product.variants || [])
    .filter((variant) => Number(variant.inventory_quantity || 0) > 0)
    .slice(0, 4)
    .map((variant) => {
      const title = variant.title || variant.option1 || "otra talla";
      const stock = Number(variant.inventory_quantity || 0);
      return `${title}${stock > 0 ? ` (${stock} disponibles)` : ""}`;
    })
    .join(", ");
}

function productMatchesQuery(product: AvailabilityProduct, query: string): boolean {
  const title = normalizeText(product.title || "");
  const normalizedQuery = normalizeText(query);
  if (!title || !normalizedQuery) return false;
  const titleTokens = title.split(" ").filter((token) => token.length > 2);
  return titleTokens.length > 0 && titleTokens.every((token) => normalizedQuery.includes(token));
}

export function buildKnownVariantAvailabilityReply(
  queryText: string,
  products: AvailabilityProduct[],
): string | null {
  const requestedSize = extractRequestedSize(queryText);
  if (!requestedSize) return null;

  const product = products.find((candidate) => productMatchesQuery(candidate, queryText)) ||
    (products.length === 1 ? products[0] : null);
  if (!product) return null;

  const variant = findVariantBySize(product, requestedSize);
  if (!variant) return null;

  const stock = Number(variant.inventory_quantity || 0);
  const productName = product.title || "ese producto";

  if (stock > 0) {
    return `Sí, la ${productName} está disponible en talla ${requestedSize} 😊 Tenemos ${stock} disponible${stock === 1 ? "" : "s"}. ¿Quieres que te ayude a hacer el pedido?`;
  }

  const alternatives = availableVariantSummary(product);
  if (alternatives) {
    return `En talla ${requestedSize} la ${productName} está agotada por ahora 😕 Tenemos disponible: ${alternatives}. ¿Quieres que te ayude con otra talla o revisamos otro diseño?`;
  }

  return `En talla ${requestedSize} la ${productName} está agotada por ahora 😕 ¿Quieres que revisemos otro diseño?`;
}

export function shouldReplaceAvailabilityDeferralReply(
  reply: string,
  queryText: string,
  products: AvailabilityProduct[],
): boolean {
  return isAvailabilityDeferralReply(reply) && !!buildKnownVariantAvailabilityReply(queryText, products);
}
