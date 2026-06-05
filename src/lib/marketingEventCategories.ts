// ─── Marketing event category helpers ───────────────────────────────
// Activity types for the Marketing Calendar are org-customizable and live in
// the `marketing_event_categories` table. These defaults mirror the seeded
// built-ins and act as a safety fallback when the DB hasn't loaded yet or an
// event references a key with no matching (e.g. just-deleted) category.

export interface CategoryLike {
  key: string;
  label: string;
  color: string; // hex, e.g. '#a855f7'
  is_active?: boolean;
}

export interface ResolvedCategory {
  key: string;
  label: string;
  color: string;
}

// Built-in defaults (hex = the Tailwind -500 shades used before this feature).
export const DEFAULT_EVENT_CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: 'product_launch', label: 'Lanzamiento', color: '#a855f7' },
  { key: 'promotion', label: 'Promocion', color: '#ef4444' },
  { key: 'email_campaign', label: 'Email', color: '#3b82f6' },
  { key: 'sms_blast', label: 'SMS', color: '#22c55e' },
  { key: 'influencer_collab', label: 'Influencer', color: '#ec4899' },
  { key: 'pr_hit', label: 'PR', color: '#eab308' },
  { key: 'organic_viral', label: 'Viral', color: '#10b981' },
  { key: 'cultural_moment', label: 'Cultural', color: '#f97316' },
  { key: 'price_change', label: 'Precio', color: '#6366f1' },
  { key: 'new_creative_batch', label: 'Creativo', color: '#06b6d4' },
  { key: 'channel_expansion', label: 'Canal', color: '#14b8a6' },
  { key: 'other', label: 'Otro', color: '#6b7280' },
];

const FALLBACK_COLOR = '#6b7280';

/** Convert a #rrggbb hex to an rgba() string with the given alpha. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = (hex || FALLBACK_COLOR).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return `rgba(107,114,128,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Build a resolver from the org's categories (active + inactive — inactive
 * types are hidden from pickers but must still render on existing events).
 * Falls back to the built-in defaults, then to a neutral gray for unknown keys.
 */
export function buildCategoryResolver(
  categories?: CategoryLike[]
): (key: string | null | undefined) => ResolvedCategory {
  const map = new Map<string, ResolvedCategory>();
  for (const d of DEFAULT_EVENT_CATEGORIES) {
    map.set(d.key, { key: d.key, label: d.label, color: d.color });
  }
  if (categories) {
    for (const c of categories) {
      map.set(c.key, { key: c.key, label: c.label, color: c.color });
    }
  }
  return (key) => {
    if (!key) return { key: 'other', label: 'Otro', color: FALLBACK_COLOR };
    return map.get(key) ?? { key, label: key, color: FALLBACK_COLOR };
  };
}
