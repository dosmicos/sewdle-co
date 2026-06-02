-- Update June 600M scorecard targets after Claude/Julian operating-plan correction.
-- Angie + Ana María are both producers 50/50: 30 statics/week produced, 24 published/tested.

WITH org AS (
  SELECT id FROM public.organizations WHERE slug = 'dosmicos-org' LIMIT 1
)
UPDATE public.growth_weekly_targets tgt
SET
  static_creatives_target = 30,
  static_published_target = 24,
  notes = concat_ws(
    ' ',
    nullif(tgt.notes, ''),
    'Updated 2026-06-01: static production target is 30/week and 24 published/tested; Angie + Ana María split production 50/50; Kira owns creative direction.'
  ),
  updated_at = now()
FROM org
WHERE tgt.organization_id = org.id
  AND tgt.period_start >= '2026-06-01'::date
  AND tgt.period_start < '2026-07-01'::date;
