export type CommerceVariant = {
  id: number;
  title?: string;
  sku?: string;
  price?: string | number;
  inventory_quantity?: number;
};

export type CommerceProduct = {
  id: number;
  title: string;
  variants?: CommerceVariant[];
};

export type ElsaOrderLineItemPayload = {
  productName?: string;
  productId?: number;
  size?: string | number;
  variantName?: string;
  variantId?: number;
  sku?: string;
  quantity?: number;
};

export type ResolvedLineItem = {
  productId: number;
  productName: string;
  variantId: number;
  variantName: string;
  sku?: string;
  quantity: number;
};

export type BoldPaymentLinkRequest = {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  organizationId: string;
  conversationId?: string;
  orderData: {
    cedula?: string;
    address: string;
    city: string;
    department: string;
    neighborhood?: string;
    lineItems: ResolvedLineItem[];
    notes?: string;
    shippingCost: number;
  };
};

export function normalizeCommerceText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreProductMatch(
  catalogTitle: string,
  requestedName: string,
): number {
  const catalog = normalizeCommerceText(catalogTitle);
  const requested = normalizeCommerceText(requestedName);
  if (!catalog || !requested) return 0;
  if (catalog === requested) return 100;
  if (catalog.includes(requested) || requested.includes(catalog)) return 85;

  const catalogWords = catalog.split(/\s+/).filter((w) => w.length > 2);
  const requestedWords = requested.split(/\s+/).filter((w) => w.length > 2);
  if (!requestedWords.length) return 0;
  const matches = requestedWords.filter((word) =>
    catalogWords.some((candidate) =>
      candidate.includes(word) || word.includes(candidate)
    )
  );
  return Math.round((matches.length / requestedWords.length) * 75);
}

function findBestProduct(
  catalog: CommerceProduct[],
  item: ElsaOrderLineItemPayload,
): CommerceProduct | null {
  if (item.productId) {
    const byId = catalog.find((product) =>
      String(product.id) === String(item.productId)
    );
    if (byId) return byId;
  }

  const requestedName = item.productName || "";
  let best: CommerceProduct | null = null;
  let bestScore = 0;
  for (const product of catalog) {
    const score = scoreProductMatch(product.title, requestedName);
    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  }

  return best && bestScore >= 50 ? best : null;
}

function extractSize(value: unknown): string {
  const text = String(value ?? "").trim();
  const match = text.match(/\d+/);
  return match?.[0] || text;
}

function findVariant(
  product: CommerceProduct,
  item: ElsaOrderLineItemPayload,
): CommerceVariant | null {
  const variants = product.variants || [];
  if (!variants.length) return null;

  if (item.variantId) {
    const byId = variants.find((variant) =>
      String(variant.id) === String(item.variantId)
    );
    if (byId) return byId;
  }

  if (item.sku) {
    const requestedSku = normalizeCommerceText(
      String(item.sku).replace(/^SKU:/i, ""),
    );
    const bySku = variants.find((variant) =>
      normalizeCommerceText(String(variant.sku || "").replace(/^SKU:/i, "")) ===
        requestedSku
    );
    if (bySku) return bySku;
  }

  const requestedSize = extractSize(item.size ?? item.variantName);
  if (requestedSize) {
    const bySize = variants.find((variant) => {
      const titleSize = extractSize(variant.title || "");
      return titleSize && titleSize === requestedSize;
    });
    if (bySize) return bySize;
  }

  if (item.variantName) {
    const requestedVariant = normalizeCommerceText(item.variantName);
    const byName = variants.find((variant) => {
      const title = normalizeCommerceText(variant.title || "");
      return title === requestedVariant || title.includes(requestedVariant) ||
        requestedVariant.includes(title);
    });
    if (byName) return byName;
  }

  return variants.length === 1 ? variants[0] : null;
}

export function resolveCommerceLineItems(
  catalog: CommerceProduct[],
  payloadItems: ElsaOrderLineItemPayload[] = [],
): { lineItems: ResolvedLineItem[]; errors: string[] } {
  const lineItems: ResolvedLineItem[] = [];
  const errors: string[] = [];

  if (!Array.isArray(payloadItems) || payloadItems.length === 0) {
    return { lineItems, errors: ["lineItems"] };
  }

  for (const item of payloadItems) {
    const product = findBestProduct(catalog, item);
    const label = item.productName || String(item.productId || "producto");
    if (!product) {
      errors.push(`No se encontró el producto: ${label}`);
      continue;
    }

    const variant = findVariant(product, item);
    if (!variant) {
      errors.push(`No se encontró la talla/variante para ${product.title}`);
      continue;
    }

    const stock = Number(variant.inventory_quantity ?? 0);
    if (stock <= 0) {
      errors.push(`${product.title} ${variant.title || ""} sin stock`);
      continue;
    }

    const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)) || 1);
    if (stock < quantity) {
      errors.push(
        `${product.title} ${
          variant.title || ""
        } solo tiene ${stock} unidades disponibles`,
      );
      continue;
    }

    lineItems.push({
      productId: product.id,
      productName: product.title,
      variantId: variant.id,
      variantName: variant.title || String(item.variantName || item.size || ""),
      sku: variant.sku || item.sku,
      quantity,
    });
  }

  return { lineItems, errors };
}

export function variantPriceForLineItem(
  catalog: CommerceProduct[],
  item: ResolvedLineItem,
): number {
  const product = catalog.find((p) => String(p.id) === String(item.productId));
  const variant = product?.variants?.find((v) =>
    String(v.id) === String(item.variantId)
  );
  return Math.max(0, Number(variant?.price || 0));
}

export function calculateOrderTotals(params: {
  productTotal: number;
  city?: string;
  department?: string;
  requestedShippingCost?: number;
}) {
  const productTotal = Math.max(
    0,
    Math.round(Number(params.productTotal) || 0),
  );
  const rawRequestedShipping = Math.max(
    0,
    Math.round(Number(params.requestedShippingCost) || 0),
  );
  const city = normalizeCommerceText(params.city || "");
  const department = normalizeCommerceText(params.department || "");

  const shippingZones: Record<string, number> = {
    bogota: 3000,
    antioquia: 5000,
    atlantico: 5000,
    bolivar: 5000,
    boyaca: 5000,
    caldas: 5000,
    cauca: 5000,
    cesar: 5000,
    cordoba: 5000,
    cundinamarca: 5000,
    guaviare: 5000,
    huila: 5000,
    magdalena: 5000,
    meta: 5000,
    narino: 5000,
    "norte de santander": 5000,
    putumayo: 5000,
    quindio: 5000,
    risaralda: 5000,
    santander: 5000,
    sucre: 5000,
    tolima: 5000,
    "valle del cauca": 5000,
    arauca: 6000,
    caqueta: 6000,
    casanare: 6000,
    "la guajira": 10000,
    guajira: 10000,
    amazonas: 22000,
    vaupes: 22000,
    vichada: 22000,
    guainia: 30000,
    "san andres": 30000,
    "san andres y providencia": 30000,
    providencia: 30000,
  };
  const noFreeShippingZones = [
    "la guajira",
    "guajira",
    "amazonas",
    "vaupes",
    "vichada",
    "guainia",
    "san andres",
    "san andres y providencia",
    "providencia",
  ];

  const isBogota = city.includes("bogota") || department.includes("bogota");
  const matchedZone = isBogota
    ? "bogota"
    : Object.keys(shippingZones).find((zone) => department.includes(zone));
  const isExpressRequest = isBogota && rawRequestedShipping === 14000;

  let shippingCost = 5000;
  if (isExpressRequest) {
    shippingCost = 14000;
  } else if (matchedZone) {
    const noFreeShipping = noFreeShippingZones.some((zone) =>
      department.includes(zone)
    );
    shippingCost = productTotal >= 150000 && !noFreeShipping
      ? 0
      : shippingZones[matchedZone];
  }

  if (
    !isExpressRequest && rawRequestedShipping > shippingCost &&
    rawRequestedShipping <= 30000
  ) {
    shippingCost = rawRequestedShipping;
  }

  return {
    productTotal,
    shippingCost,
    totalAmount: productTotal + shippingCost,
  };
}

export function buildBoldPaymentLinkRequest(params: {
  payload: Record<string, any>;
  catalog: CommerceProduct[];
  organizationId: string;
  conversationId?: string;
}): { ok: true; request: BoldPaymentLinkRequest } | {
  ok: false;
  errors: string[];
} {
  const payload = params.payload || {};
  const required = [
    "customerName",
    "email",
    "phone",
    "address",
    "city",
    "department",
  ];
  const errors = required.filter((field) =>
    !String(payload[field] || "").trim()
  );

  const resolved = resolveCommerceLineItems(
    params.catalog,
    payload.lineItems || [],
  );
  errors.push(...resolved.errors);

  if (errors.length) return { ok: false, errors };

  let productTotal = 0;
  for (const item of resolved.lineItems) {
    productTotal += variantPriceForLineItem(params.catalog, item) *
      item.quantity;
  }
  if (productTotal <= 0) return { ok: false, errors: ["productTotal"] };

  const totals = calculateOrderTotals({
    productTotal,
    city: payload.city,
    department: payload.department,
    requestedShippingCost: payload.shippingCost,
  });

  const productDescription = resolved.lineItems.map((item) => item.productName)
    .join(", ");

  return {
    ok: true,
    request: {
      amount: Math.round(totals.totalAmount),
      description: `Pedido Dosmicos - ${productDescription}`.substring(0, 100),
      customerEmail: String(payload.email).trim().toLowerCase(),
      customerName: String(payload.customerName).trim(),
      customerPhone: String(payload.phone).replace(/[\s+]/g, ""),
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      orderData: {
        cedula: payload.cedula ? String(payload.cedula).trim() : undefined,
        address: String(payload.address).trim(),
        city: String(payload.city).trim(),
        department: String(payload.department).trim(),
        neighborhood: payload.neighborhood
          ? String(payload.neighborhood).trim()
          : undefined,
        lineItems: resolved.lineItems,
        notes: payload.notes ? String(payload.notes).trim() : undefined,
        shippingCost: totals.shippingCost,
      },
    },
  };
}

export function summarizeCommerceCatalogForPrompt(
  catalog: CommerceProduct[],
  maxProducts = 80,
) {
  return catalog.slice(0, maxProducts).map((product) => ({
    id: product.id,
    title: product.title,
    variants: (product.variants || []).map((variant) => ({
      id: variant.id,
      title: variant.title || "",
      sku: variant.sku || "",
      price: Number(variant.price || 0),
      stock: Number(variant.inventory_quantity || 0),
    })),
  }));
}
