ALTER TABLE marketing_events
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'idea',
  ADD COLUMN IF NOT EXISTS assigned_to text;
