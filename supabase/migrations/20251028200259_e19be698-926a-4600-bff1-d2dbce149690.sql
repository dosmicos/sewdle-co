-- Add form_data column to store Phase 1 structured data
ALTER TABLE order_timeline_phases 
ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN order_timeline_phases.form_data IS 'Stores structured form data for each phase, especially Phase 1 product specification and materials';