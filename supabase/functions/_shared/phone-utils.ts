/**
 * Shared phone number normalization utilities.
 */

/**
 * Normalize a phone number to Colombian format (57XXXXXXXXXX).
 * Returns null if the phone number is invalid.
 */
export function normalizeColombianPhone(raw: string): string | null {
  // Remove all non-digits
  let phone = (raw || '').replace(/\D/g, '');

  // Colombian mobiles: 3xx xxx xxxx (10 digits)
  // With country code: 57 3xx xxx xxxx (12 digits)

  if (phone.startsWith('57') && phone.length === 12) {
    return phone; // already correct
  }

  if (phone.startsWith('3') && phone.length === 10) {
    return '57' + phone;
  }

  // If it's 11+ digits and starts with 57, keep as-is
  if (phone.startsWith('57') && phone.length >= 11) {
    return phone;
  }

  // For other formats, try adding 57 if it looks like a local number
  if (phone.length === 10) {
    return '57' + phone;
  }

  // Already international (not Colombian maybe)
  if (phone.length >= 10) {
    return phone;
  }

  return null; // invalid
}

/**
 * Extract a delivery code from order notes.
 * Looks for patterns like "Código: 4521", "codigo 4521", "Código:4521", etc.
 */
export function extractDeliveryCode(note: string | null | undefined): string | null {
  if (!note) return null;
  const match = note.match(/c[oó]digo[:\s]*[\s]*([a-zA-Z0-9]+)/i);
  return match?.[1] || null;
}
