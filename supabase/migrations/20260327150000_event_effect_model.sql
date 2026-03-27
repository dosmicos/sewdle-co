-- ============================================================
-- Event Effect Model: Expected vs Actual revenue tracking + peak planning
-- ============================================================

-- Add event effect tracking columns to marketing_events
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS expected_revenue NUMERIC(14,2);
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS expected_new_customers INTEGER;
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS attributed_revenue NUMERIC(14,2);
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS attributed_orders INTEGER;
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS ad_spend_during NUMERIC(14,2);
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS roas_during NUMERIC(5,2);
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS roi_percent NUMERIC(8,2);
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS attribution_window_days INTEGER DEFAULT 7;
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS why_now TEXT;
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS peak_name TEXT;
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS is_peak BOOLEAN DEFAULT false;
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS peak_phase TEXT; -- 'concept', 'creative', 'teaser', 'peak', 'analysis'
ALTER TABLE marketing_events ADD COLUMN IF NOT EXISTS learnings TEXT;
