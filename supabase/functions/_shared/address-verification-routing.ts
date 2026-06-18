export type PendingAddressVerificationDecision =
  | "confirm"
  | "request_correction"
  | "address_correction"
  | "not_address";

export function normalizeAddressVerificationText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function startsWithPhrase(normalized: string, phrase: string): boolean {
  return normalized === phrase ||
    normalized.startsWith(`${phrase} `) ||
    normalized.startsWith(`${phrase},`) ||
    normalized.startsWith(`${phrase}.`) ||
    normalized.startsWith(`${phrase}!`);
}

function isConfirmationText(normalized: string): boolean {
  const confirmWords = [
    "correcto",
    "correcta",
    "si",
    "ok",
    "bien",
    "esta bien",
    "esta correcta",
    "esta correcto",
    "dale",
    "listo",
    "perfecto",
    "claro",
    "la misma",
    "misma direccion",
    "esa es",
  ];
  return confirmWords.some((word) => startsWithPhrase(normalized, word));
}

function isWrongAddressText(normalized: string): boolean {
  const wrongWords = [
    "no",
    "no esta bien",
    "no es correcta",
    "no es correcto",
    "incorrecta",
    "incorrecto",
    "esta mal",
    "mal",
    "corregir",
    "quiero corregir",
  ];
  return wrongWords.some((word) => startsWithPhrase(normalized, word));
}

export function isLikelyNewPurchaseIntent(content: string): boolean {
  const normalized = normalizeAddressVerificationText(content);
  if (!normalized) return false;

  const productWords = [
    "sleeping",
    "sleeping bag",
    "walker",
    "poppy",
    "ruana",
    "ruanas",
    "cobija",
    "cobijas",
    "pijama",
    "pijamas",
    "chaqueta",
    "chaquetas",
    "zapato",
    "zapatos",
    "kit",
    "set",
    "body",
    "manta",
    "talla",
    "mangas",
    "tog",
  ];
  const purchaseWords = [
    "necesito",
    "quiero",
    "quisiera",
    "me interesa",
    "comprar",
    "pedido",
    "pedir",
    "me regalas",
    "me muestras",
    "tienes",
    "hay",
    "disponible",
  ];

  const hasProduct = productWords.some((word) => normalized.includes(word));
  const hasPurchase = purchaseWords.some((word) => normalized.includes(word));
  return hasProduct && hasPurchase;
}

export function isLikelyAddressCorrection(content: string): boolean {
  const normalized = normalizeAddressVerificationText(content);
  if (!normalized) return false;

  const streetPattern = /\b(?:calle|cl|cra|carrera|kr|av|avenida|diagonal|diag|transversal|transv)\s*\d+/i;
  if (streetPattern.test(normalized)) return true;

  const addressWords = [
    "direccion",
    "barrio",
    "apartamento",
    "apto",
    "casa",
    "conjunto",
    "torre",
    "interior",
    "manzana",
    "bloque",
    "vereda",
    "finca",
    "porteria",
    "local",
    "oficina",
    "ciudad",
    "departamento",
  ];
  const correctionWords = [
    "corrijo",
    "corregir",
    "cambiar",
    "actualizar",
    "la direccion es",
    "mi direccion es",
    "es en",
    "queda en",
    "enviar a",
  ];

  return addressWords.some((word) => normalized.includes(word)) ||
    correctionWords.some((word) => normalized.includes(word));
}

export function classifyPendingAddressVerificationReply(
  content: string,
  buttonPayload = "",
): PendingAddressVerificationDecision {
  if (buttonPayload === "ADDRESS_CORRECT") return "confirm";
  if (buttonPayload === "ADDRESS_WRONG") return "request_correction";

  const normalized = normalizeAddressVerificationText(content);
  if (!normalized) return "not_address";

  if (isConfirmationText(normalized)) return "confirm";
  if (isWrongAddressText(normalized)) return "request_correction";

  // New product/order intent must not be swallowed by stale pending address metadata.
  if (isLikelyNewPurchaseIntent(normalized)) return "not_address";

  if (isLikelyAddressCorrection(normalized)) return "address_correction";

  // Safer default: let Elsa handle unrelated follow-ups instead of repeating
  // the address-update acknowledgment forever.
  return "not_address";
}
