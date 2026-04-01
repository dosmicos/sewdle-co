ALTER TABLE marketing_events
  ADD COLUMN IF NOT EXISTS scheduled_time text,
  ADD COLUMN IF NOT EXISTS copy_text text,
  ADD COLUMN IF NOT EXISTS hashtags text[],
  ADD COLUMN IF NOT EXISTS assets_needed text,
  ADD COLUMN IF NOT EXISTS assets_url text,
  ADD COLUMN IF NOT EXISTS approval_notes text;
