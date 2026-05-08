export type PaymentMethodDetectionInput = {
  paymentGatewayNames?: unknown;
  gateway?: unknown;
  tags?: unknown;
  financialStatus?: unknown;
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizePaymentGateways(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

export function formatPaymentGatewayLabel(gateway: unknown): string | null {
  const rawGateway = String(gateway ?? "").trim();
  if (!rawGateway) return null;

  const normalized = normalizeText(rawGateway);
  if (
    normalized.includes("cash on delivery") ||
    normalized.includes("cod") ||
    normalized.includes("contraentrega") ||
    normalized.includes("contra entrega")
  ) {
    return "Contraentrega";
  }

  return rawGateway;
}

export function detectEffectivePaymentMethod(input: PaymentMethodDetectionInput): string | null {
  const gateways = normalizePaymentGateways(input.paymentGatewayNames);
  if (gateways.length > 0) {
    const effectiveGateway = gateways[gateways.length - 1];
    const label = formatPaymentGatewayLabel(effectiveGateway);
    if (label) return label;
  }

  const gatewayLabel = formatPaymentGatewayLabel(input.gateway);
  if (gatewayLabel) return gatewayLabel;

  const tags = normalizeText(input.tags);
  const financialStatus = normalizeText(input.financialStatus);
  const hasContraentregaTag = tags.includes("contraentrega") || tags.includes("contra entrega");
  if (financialStatus === "pending" && hasContraentregaTag) {
    return "Contraentrega";
  }

  return null;
}

export function isContraEntregaPayment(input: PaymentMethodDetectionInput): boolean {
  return detectEffectivePaymentMethod(input) === "Contraentrega";
}
