// Deterministic safety net for Elsa's most common failure mode: hedging about
// availability ("te reviso", "validando inventario", "te confirmamos por aquí") when
// the live catalog already knows the stock. The model names the product + size in its
// own (evasive) reply, so we resolve that against the catalog and answer directly:
// in stock, or agotada + the sizes we do have.
//
// IMPORTANT: this is meant to run in the elsa-hermes-agent reply path — the one the
// Dosmicos WhatsApp channel actually uses — NOT the legacy whatsapp-webhook OpenAI path.
// A prior attempt wired an equivalent guard only into that legacy path, so it never ran
// for Dosmicos. It also resolved the product from the customer's text, which for image
// messages does not contain the product name (that comes from the image). Resolving from
// the model's own reply text fixes both gaps.

import type { CommerceProduct } from "./elsa-commerce.ts";

function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "I'll go check and confirm later" hedges. Deliberately EXCLUDES legit replies such as
// "está agotada ..." and back-in-stock offers ("te aviso apenas vuelva").
const DEFERRAL_PATTERNS = [
  "validando inventario",
  "validando con bodega",
  "validar en inventario",
  "validar con bodega",
  "con bodega",
  "validando esa talla",
  "validar esa talla",
  "validando la talla",
  "validar la talla",
  "validacion de inventario",
  "en validacion",
  "debo validar",
  "reviso si",
  "te reviso",
  "lo reviso",
  "revisamos disponibilidad",
  "te revisamos disponibilidad",
  "revisamos si",
  "te confirmamos disponibilidad",
  "confirmamos disponibilidad",
  "te confirmamos por aqui",
  "te confirmo disponibilidad",
];

// Phrases that mean the reply is already correct (out of stock / back-in-stock offer),
// so it must NOT be treated as an availability hedge.
const NOT_DEFERRAL = [
  "apenas vuelva",
  "cuando vuelva",
  "te aviso cuando",
  "apenas nos llegue",
  "apenas vuelvan",
];

export function isAvailabilityDeferral(reply: string): boolean {
  const n = norm(reply);
  if (!n) return false;
  if (NOT_DEFERRAL.some((p) => n.includes(p))) return false;
  return DEFERRAL_PATTERNS.some((p) => n.includes(p));
}

export function extractSizeToken(text: string): string | null {
  const n = norm(text);
  const m = n.match(/talla\s*([0-9]{1,2})/) || n.match(/talla\s*([a-z]{1,3})\b/);
  return m ? m[1] : null;
}

function variantLeadingToken(variant: { title?: string }): string {
  const m = String(variant.title ?? "").trim().match(/^\s*([0-9]{1,2}|[a-zA-Z]+)/);
  return m ? norm(m[1]) : "";
}

// Find the catalog product whose full normalized title appears in the text. Longest
// match wins, so "Ruana Hipopótamo" is picked over a shorter coincidence, and a longer
// variant like "Ruana de Hipopotamo Adulto" only wins if the text actually names it.
function resolveProductFromText(
  catalog: CommerceProduct[],
  text: string,
): CommerceProduct | null {
  const n = norm(text);
  if (!n) return null;
  let best: CommerceProduct | null = null;
  let bestLen = 0;
  for (const product of catalog) {
    const title = norm(product.title);
    if (title.length >= 6 && n.includes(title) && title.length > bestLen) {
      best = product;
      bestLen = title.length;
    }
  }
  return best;
}

// Comma list of the size numbers we currently have in stock, e.g. "2, 4, 6 y 8".
function availableSizesList(product: CommerceProduct): string {
  const toks = (product.variants || [])
    .filter((v) => Number(v.inventory_quantity ?? 0) > 0)
    .map((v) => variantLeadingToken(v))
    .filter(Boolean);
  const seen: string[] = [];
  for (const t of toks) if (!seen.includes(t)) seen.push(t);
  if (seen.length === 0) return "";
  if (seen.length === 1) return seen[0];
  return `${seen.slice(0, -1).join(", ")} y ${seen[seen.length - 1]}`;
}

// If the reply hedges about availability AND we can pin the product + size to the live
// catalog, return a direct availability reply; otherwise null (leave the reply as-is).
export function buildAvailabilityCorrection(
  catalog: CommerceProduct[],
  reply: string,
  userText: string,
): string | null {
  if (!Array.isArray(catalog) || catalog.length === 0) return null;
  if (!isAvailabilityDeferral(reply)) return null;

  const combined = `${reply} ${userText}`;
  const product = resolveProductFromText(catalog, combined);
  if (!product) return null;

  const sizeTok = extractSizeToken(combined);
  if (!sizeTok) return null;

  const name = product.title || "ese producto";
  const variant = (product.variants || []).find(
    (v) => variantLeadingToken(v) === norm(sizeTok),
  );

  if (!variant) {
    const sizes = availableSizesList(product);
    return sizes
      ? `En la ${name} no manejamos talla ${sizeTok} 😊 Tenemos en talla ${sizes}. ¿Quieres que te ayude con otra?`
      : null;
  }

  const stock = Number(variant.inventory_quantity ?? 0);
  if (stock > 0) {
    return `¡Sí! La ${name} en talla ${sizeTok} está disponible 😊 ¿Quieres que te ayude a hacer el pedido?`;
  }

  const sizes = availableSizesList(product);
  return sizes
    ? `La ${name} en talla ${sizeTok} está agotada por ahora 😕 Tenemos disponible en talla ${sizes}. ¿Quieres que te ayude con otra talla o revisamos otro diseño?`
    : `La ${name} en talla ${sizeTok} está agotada por ahora 😕 ¿Quieres que revisemos otro diseño?`;
}
