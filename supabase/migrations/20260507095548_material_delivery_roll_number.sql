-- Add first-class roll number tracking to material deliveries.
-- Keeps legacy notes untouched and backfills common historical note formats.

ALTER TABLE public.material_deliveries
ADD COLUMN IF NOT EXISTS roll_number text;

UPDATE public.material_deliveries
SET roll_number = COALESCE(
  NULLIF(trim((regexp_match(notes, '(?:#\s*de\s*)?rollo\s*#?\s*([A-Za-z0-9._/-]+)'))[1]), ''),
  NULLIF(trim((regexp_match(notes, '#\s*(?:de\s*)?rollo\s*([A-Za-z0-9._/-]+)'))[1]), '')
)
WHERE roll_number IS NULL
  AND notes IS NOT NULL
  AND (
    notes ~* '(?:#\s*de\s*)?rollo\s*#?\s*[A-Za-z0-9._/-]+'
    OR notes ~* '#\s*(?:de\s*)?rollo\s*[A-Za-z0-9._/-]+'
  );

CREATE INDEX IF NOT EXISTS idx_material_deliveries_roll_number
ON public.material_deliveries (roll_number)
WHERE roll_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_material_deliveries_material_roll
ON public.material_deliveries (material_id, roll_number)
WHERE roll_number IS NOT NULL;
