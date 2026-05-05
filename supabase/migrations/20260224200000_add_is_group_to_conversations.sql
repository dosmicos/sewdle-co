-- Add is_group flag to messaging_conversations for group chat filtering
ALTER TABLE public.messaging_conversations
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;

-- Index for fast filtering by group status
CREATE INDEX IF NOT EXISTS idx_messaging_conversations_is_group
  ON messaging_conversations(is_group)
  WHERE is_group = true;
