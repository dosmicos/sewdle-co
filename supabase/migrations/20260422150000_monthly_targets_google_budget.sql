-- Add explicit per-channel ad spend budgets to monthly_targets so the
-- Growth Manager can compute Google-specific pacing without approximating
-- from the trailing 30-day spend split.
--
-- Both columns are nullable. When NULL, the GM falls back to the
-- historical-split approximation and flags the report accordingly.
-- When set, they are the authoritative targets for each channel.

ALTER TABLE public.monthly_targets
  ADD COLUMN IF NOT EXISTS google_ad_spend_budget NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS meta_ad_spend_budget   NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.monthly_targets.google_ad_spend_budget IS
  'Optional per-channel budget for Google Ads in COP. When NULL, Growth Manager approximates from trailing 30d split.';
COMMENT ON COLUMN public.monthly_targets.meta_ad_spend_budget IS
  'Optional per-channel budget for Meta Ads in COP. When NULL, Growth Manager approximates from trailing 30d split.';

-- Optional sanity check: if both per-channel budgets are set, they
-- should roughly sum to ad_spend_budget (within ±5%). Not enforced as
-- a constraint because operators may intentionally overbudget one
-- channel while keeping the total as a soft cap.
