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
  handle?: string;
  body_html?: string;
  tags?: string;
  product_type?: string;
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

export type PendingPaymentOrderData = {
  cedula?: string;
  address: string;
  city: string;
  department: string;
  neighborhood?: string;
  lineItems: ResolvedLineItem[];
  notes?: string;
  shippingMethod?: string;
  shippingCost: number;
};

export type BoldPaymentLinkRequest = {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  organizationId: string;
  conversationId?: string;
  orderData: PendingPaymentOrderData;
};

export type AddiPaymentRequest = {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  customerCedula: string;
  organizationId: string;
  conversationId?: string;
  orderData: PendingPaymentOrderData;
};

export type ShopifyCodOrderRequest = {
  organizationId: string;
  conversationId?: string;
  orderData: {
    customerName: string;
    cedula?: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    department: string;
    neighborhood?: string;
    lineItems: ResolvedLineItem[];
    notes?: string;
    shippingCost: number;
    paymentMethod: "contra_entrega";
  };
  totalAmount: number;
};

export type ManualTransferPaymentMethod = "bancolombia" | "nequi" | "bank_transfer" | "manual_transfer";

export type ManualTransferDraftOrderRequest = {
  organizationId: string;
  conversationId?: string;
  orderData: {
    customerName: string;
    cedula?: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    department: string;
    neighborhood?: string;
    lineItems: ResolvedLineItem[];
    notes?: string;
    shippingCost: number;
    paymentMethod: ManualTransferPaymentMethod;
  };
  totalAmount: number;
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

export const BOGOTA_EXPRESS_SHIPPING_COST = 15000;

function hasExpressShippingSignal(...values: unknown[]): boolean {
  return values.some((value) => normalizeCommerceText(value).includes("express"));
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

type ProductMatch = {
  product: CommerceProduct;
  score: number;
  secondBestScore: number;
};

function findBestProduct(
  catalog: CommerceProduct[],
  item: ElsaOrderLineItemPayload,
): ProductMatch | null {
  if (item.productId) {
    const byId = catalog.find((product) =>
      String(product.id) === String(item.productId)
    );
    if (byId) {
      return { product: byId, score: 100, secondBestScore: 0 };
    }
  }

  const requestedName = item.productName || "";
  let best: CommerceProduct | null = null;
  let bestScore = 0;
  let secondBestScore = 0;

  for (const product of catalog) {
    const score = scoreProductMatch(product.title, requestedName);
    if (score > bestScore) {
      secondBestScore = bestScore;
      best = product;
      bestScore = score;
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  return best && bestScore >= 50
    ? { product: best, score: bestScore, secondBestScore }
    : null;
}

function requiresProductConfirmation(match: ProductMatch): boolean {
  return match.score < 85 || (
    match.score < 100 &&
    match.secondBestScore > 0 &&
    match.score - match.secondBestScore <= 5
  );
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

export type BackInStockTarget = {
  productId: number;
  productTitle: string;
  variantId?: number;
  sku?: string;
  variantTitle?: string;
};

// Resolve a product + (best-effort) variant for a back-in-stock subscription,
// WITHOUT requiring stock (the customer subscribes precisely because it is out of
// stock). Prefers a variant whose title matches BOTH the requested size and color.
export function resolveBackInStockTarget(
  catalog: CommerceProduct[],
  item: {
    productName?: string;
    productId?: number;
    size?: string | number;
    color?: string;
    sku?: string;
    variantId?: number;
  },
): BackInStockTarget | null {
  const match = findBestProduct(catalog, {
    productName: item.productName,
    productId: item.productId,
  });
  if (!match) return null;

  const variants = match.product.variants || [];
  const sizeTok = item.size != null ? normalizeCommerceText(String(item.size)) : "";
  const sizeNum = extractSize(item.size);
  const colorTok = item.color ? normalizeCommerceText(item.color) : "";

  let variant: CommerceVariant | undefined;
  if (sizeTok || colorTok) {
    variant = variants.find((v) => {
      const title = normalizeCommerceText(v.title || "");
      const okSize = !sizeTok ||
        title.includes(sizeTok) ||
        (Boolean(sizeNum) && extractSize(v.title || "") === sizeNum);
      const okColor = !colorTok || title.includes(colorTok);
      return okSize && okColor;
    });
  }
  if (!variant) {
    variant = findVariant(match.product, {
      productName: item.productName,
      size: item.size,
      variantName: item.color,
      sku: item.sku,
      variantId: item.variantId,
    }) || undefined;
  }

  return {
    productId: match.product.id,
    productTitle: match.product.title,
    variantId: variant?.id,
    sku: variant?.sku,
    variantTitle: variant?.title,
  };
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
    const productMatch = findBestProduct(catalog, item);
    const label = item.productName || String(item.productId || "producto");
    if (!productMatch) {
      errors.push(`No se encontró el producto: ${label}`);
      continue;
    }

    if (requiresProductConfirmation(productMatch)) {
      errors.push(`Confirma el producto exacto antes de crear el link: ${label}`);
      continue;
    }

    const product = productMatch.product;
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
  requestedShippingMethod?: string;
  notes?: string;
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
  const customerRequestedExpress = hasExpressShippingSignal(
    params.requestedShippingMethod,
    params.notes,
  );
  const isExpressRequest = isBogota &&
    (customerRequestedExpress || rawRequestedShipping === BOGOTA_EXPRESS_SHIPPING_COST ||
      rawRequestedShipping === 14000);

  let shippingCost = 5000;
  if (isExpressRequest) {
    shippingCost = rawRequestedShipping >= BOGOTA_EXPRESS_SHIPPING_COST && rawRequestedShipping <= 30000
      ? rawRequestedShipping
      : BOGOTA_EXPRESS_SHIPPING_COST;
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

// "Bordado Personalizado": existing Shopify charge product ($15.000 per garment). It
// has no real stock (a charge SKU with negative inventory), so it must NOT go through
// the stock-validating catalog resolver — it is appended as a direct line item and its
// price is summed explicitly (the charge product can be filtered out of the in-context
// catalog, which would price it at 0).
const EMBROIDERY_PRODUCT_ID = 9170402738411;
const EMBROIDERY_VARIANT_ID = 47129543049451;
const EMBROIDERY_SKU = "47129543049451";
const EMBROIDERY_UNIT_PRICE = 15000;
const EMBROIDERY_SIGNAL =
  /personaliz|bordad|nombre\s*(a|para)\s*(personalizar|bordar)|nombre a personalizar/;

// How many garments carry embroidery. Prefer an explicit count from the model
// (embroideryQuantity), capped at the number of garments; otherwise infer from a
// personalization signal in the notes/name fields and default to 1 (one name, one
// garment — the common case). $15.000 is billed per unit.
function resolveEmbroideryQuantity(
  payload: Record<string, any>,
  garmentLineItems: ResolvedLineItem[],
): number {
  const totalGarments = garmentLineItems.reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity || 0)),
    0,
  );
  const explicit = Math.floor(
    Number(payload.embroideryQuantity ?? payload.personalizedQuantity ?? 0),
  );
  if (explicit > 0) return Math.min(explicit, Math.max(1, totalGarments));

  const text = normalizeCommerceText(
    [
      payload.notes,
      payload.personalizationName,
      payload.embroideryName,
      payload.nombrePersonalizar,
    ].filter(Boolean).join(" "),
  );
  return EMBROIDERY_SIGNAL.test(text) ? 1 : 0;
}

function buildPendingPaymentRequestBase(params: {
  payload: Record<string, any>;
  catalog: CommerceProduct[];
  organizationId: string;
  conversationId?: string;
  requireCedula?: boolean;
}): {
  ok: true;
  base: Omit<BoldPaymentLinkRequest, "orderData"> & {
    orderData: PendingPaymentOrderData;
  };
} | {
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
    ...(params.requireCedula ? ["cedula"] : []),
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

  // Personalization/embroidery: $15.000 per personalized garment, billed via the
  // existing "Bordado Personalizado" Shopify product. Added as a direct line item
  // (charge product, no real stock) and summed explicitly, so the payment link total
  // and the Shopify order both include the embroidery charge.
  const embroideryQuantity = resolveEmbroideryQuantity(payload, resolved.lineItems);
  if (embroideryQuantity > 0) {
    resolved.lineItems.push({
      productId: EMBROIDERY_PRODUCT_ID,
      productName: "Bordado Personalizado",
      variantId: EMBROIDERY_VARIANT_ID,
      variantName: "Default Title",
      sku: EMBROIDERY_SKU,
      quantity: embroideryQuantity,
    });
    productTotal += embroideryQuantity * EMBROIDERY_UNIT_PRICE;
  }

  const totals = calculateOrderTotals({
    productTotal,
    city: payload.city,
    department: payload.department,
    requestedShippingCost: payload.shippingCost,
    requestedShippingMethod: payload.shippingMethod,
    notes: payload.notes,
  });

  const productDescription = resolved.lineItems.map((item) => item.productName)
    .join(", ");

  return {
    ok: true,
    base: {
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
        shippingMethod: payload.shippingMethod
          ? String(payload.shippingMethod).trim()
          : undefined,
        shippingCost: totals.shippingCost,
      },
    },
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
  const built = buildPendingPaymentRequestBase(params);
  if (built.ok === false) return built;
  return { ok: true, request: built.base };
}

export function buildAddiPaymentRequest(params: {
  payload: Record<string, any>;
  catalog: CommerceProduct[];
  organizationId: string;
  conversationId?: string;
}): { ok: true; request: AddiPaymentRequest } | {
  ok: false;
  errors: string[];
} {
  const built = buildPendingPaymentRequestBase({
    ...params,
    requireCedula: true,
  });
  if (built.ok === false) return built;
  return {
    ok: true,
    request: {
      ...built.base,
      customerCedula: String(params.payload?.cedula || "").trim(),
    },
  };
}

export function buildShopifyCodOrderRequest(params: {
  payload: Record<string, any>;
  catalog: CommerceProduct[];
  organizationId: string;
  conversationId?: string;
}): { ok: true; request: ShopifyCodOrderRequest } | {
  ok: false;
  errors: string[];
} {
  const built = buildPendingPaymentRequestBase(params);
  if (built.ok === false) return built;
  const payload = params.payload || {};
  return {
    ok: true,
    request: {
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      totalAmount: built.base.amount,
      orderData: {
        customerName: built.base.customerName,
        cedula: built.base.orderData.cedula,
        email: built.base.customerEmail,
        phone: built.base.customerPhone,
        address: built.base.orderData.address,
        city: built.base.orderData.city,
        department: built.base.orderData.department,
        neighborhood: built.base.orderData.neighborhood,
        lineItems: built.base.orderData.lineItems,
        notes: payload.notes ? String(payload.notes).trim() : undefined,
        shippingCost: built.base.orderData.shippingCost,
        paymentMethod: "contra_entrega",
      },
    },
  };
}

function normalizeManualTransferPaymentMethod(value: unknown): ManualTransferPaymentMethod {
  const normalized = normalizeCommerceText(value || "manual_transfer");
  if (normalized.includes("nequi")) return "nequi";
  if (normalized.includes("bancolombia")) return "bancolombia";
  if (normalized.includes("bank")) return "bank_transfer";
  return "manual_transfer";
}

export function buildManualTransferDraftOrderRequest(params: {
  payload: Record<string, any>;
  catalog: CommerceProduct[];
  organizationId: string;
  conversationId?: string;
}): { ok: true; request: ManualTransferDraftOrderRequest } | {
  ok: false;
  errors: string[];
} {
  const built = buildPendingPaymentRequestBase(params);
  if (built.ok === false) return built;
  const payload = params.payload || {};
  const paymentMethod = normalizeManualTransferPaymentMethod(payload.paymentMethod);
  const proofNote = "Comprobante recibido; pago pendiente por validar por humano";
  const notes = [payload.notes ? String(payload.notes).trim() : "", proofNote]
    .filter(Boolean)
    .join(" | ");

  return {
    ok: true,
    request: {
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      totalAmount: built.base.amount,
      orderData: {
        customerName: built.base.customerName,
        cedula: built.base.orderData.cedula,
        email: built.base.customerEmail,
        phone: built.base.customerPhone,
        address: built.base.orderData.address,
        city: built.base.orderData.city,
        department: built.base.orderData.department,
        neighborhood: built.base.orderData.neighborhood,
        lineItems: built.base.orderData.lineItems,
        notes,
        shippingCost: built.base.orderData.shippingCost,
        paymentMethod,
      },
    },
  };
}

export function formatShopifyOrderLineItemsForCustomer(
  lineItems: unknown,
): string[] {
  if (!Array.isArray(lineItems)) return [];

  return lineItems
    .map((item) => {
      const typed = item && typeof item === "object"
        ? item as Record<string, unknown>
        : {};
      const quantity = Math.max(
        1,
        Math.floor(Number(typed.quantity || 1)) || 1,
      );
      const productName = String(
        typed.productName || typed.title || typed.name || "producto",
      ).trim();
      const variantName = String(
        typed.variantName || typed.size || typed.variantTitle || "",
      ).trim();
      const sizeSuffix = variantName ? ` talla ${variantName}` : "";
      return `${quantity} x ${productName}${sizeSuffix}`;
    })
    .filter((line) => line.trim() !== "1 x producto");
}

export function formatShopifyOrderCreatedReply(params: {
  orderNumber: string | number;
  totalAmount?: string | number | null;
  lineItems?: unknown;
  paymentLabel?: string;
}) {
  const orderNumber = String(params.orderNumber || "").replace(/^#/, "");
  const paymentLabel = params.paymentLabel || "contra entrega";
  const itemLines = formatShopifyOrderLineItemsForCustomer(params.lineItems);
  const summary = itemLines.length
    ? `\nResumen:\n${itemLines.map((line) => `- ${line}`).join("\n")}`
    : "";
  const total = Number(params.totalAmount || 0);
  const totalLine = total > 0
    ? `\nTotal: $${total.toLocaleString("es-CO")} COP`
    : "";

  return `¡Listo! Tu pedido #${orderNumber} quedó creado ${paymentLabel} 😊${summary}${totalLine}\n\nGracias por tu compra 🧡 Te enviaremos la guía cuando sea despachado 🙌`;
}

function normalizeCatalogSearchText(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function catalogQueryTokens(query?: string): string[] {
  const stopWords = new Set([
    "para",
    "pedir",
    "quiero",
    "necesito",
    "una",
    "uno",
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "por",
    "favor",
    "ruana",
    "ruanas",
  ]);
  return normalizeCatalogSearchText(query)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function productSearchText(product: CommerceProduct): string {
  const variantText = (product.variants || [])
    .map((variant) => `${variant.title || ""} ${variant.sku || ""}`)
    .join(" ");
  return normalizeCatalogSearchText(
    `${product.title || ""} ${product.handle || ""} ${product.product_type || ""} ${product.tags || ""} ${variantText}`,
  );
}

function prioritizeCatalogForQuery(
  catalog: CommerceProduct[],
  query?: string,
): CommerceProduct[] {
  const tokens = catalogQueryTokens(query);
  if (!tokens.length) return catalog;

  return catalog
    .map((product, index) => {
      const text = productSearchText(product);
      const score = tokens.reduce((total, token) =>
        total + (text.includes(token) ? 1 : 0), 0);
      return { product, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.product);
}

// Strip HTML + collapse whitespace from a Shopify body_html into plain text Elsa can
// read (material, TOG, temperature, care instructions live here).
export function plainTextFromHtml(html: string, max = 600): string {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function summarizeCommerceCatalogForPrompt(
  catalog: CommerceProduct[],
  maxProducts = 80,
  query?: string,
) {
  return prioritizeCatalogForQuery(catalog, query).slice(0, maxProducts).map((product, index) => ({
    id: product.id,
    title: product.title,
    product_type: product.product_type || "",
    tags: product.tags || "",
    // Include the product description (material, TOG, temperature, care) for the most
    // relevant products so Elsa can answer "what material / for what climate" from the
    // product itself instead of escalating. Limited to the top matches to keep the
    // prompt compact; the catalog is already sorted by relevance to the query.
    ...(index < 14 && product.body_html
      ? { description: plainTextFromHtml(product.body_html, 600) }
      : {}),
    variants: (product.variants || []).map((variant) => ({
      id: variant.id,
      title: variant.title || "",
      sku: variant.sku || "",
      price: Number(variant.price || 0),
      stock: Number(variant.inventory_quantity || 0),
    })),
  }));
}
