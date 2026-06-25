// Canonical carrier codes used across the whole shipping pipeline
// (lowercase, no accents). Single source of truth so that labels, manifests
// and the manifest carrier filter all agree.
//
// Fixes the historical split where the same carrier was stored under two
// different strings (e.g. "interRapidisimo" AND "interrapidisimo"), which made
// any exact `.eq('carrier', code)` silently miss most of its guides.
const CANON = [
  "coordinadora",
  "interrapidisimo",
  "deprisa",
  "servientrega",
  "tcc",
  "envia",
] as const;

/** Normalize any carrier label/name/code to its canonical internal code. */
export function canonicalCarrier(raw: string | null | undefined): string {
  const n = (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (tildes)
    .replace(/[^a-z0-9]/g, "");      // strip spaces, dots, punctuation
  if (!n) return "";
  const hit = CANON.find((c) => n.includes(c) || c.includes(n));
  return hit || n;
}
