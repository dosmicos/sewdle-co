export const extractRollNumberFromNotes = (notes?: string | null): string | null => {
  if (!notes) return null;
  const normalized = notes.trim();
  if (!normalized) return null;

  const rollMatch = normalized.match(/(?:#\s*de\s*)?rollo\s*#?\s*([A-Za-z0-9._/-]+)/i);
  if (rollMatch?.[1]) return rollMatch[1].trim();

  const hashRollMatch = normalized.match(/#\s*(?:de\s*)?rollo\s*([A-Za-z0-9._/-]+)/i);
  if (hashRollMatch?.[1]) return hashRollMatch[1].trim();

  return null;
};
