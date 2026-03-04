-- Add ai_pending_since field to messaging_conversations for debounce logic
-- When a message arrives, this is set to the current timestamp.
-- After the debounce delay, we check if this value changed (another message arrived).
-- If unchanged, the AI responds with all accumulated messages.
ALTER TABLE messaging_conversations
ADD COLUMN IF NOT EXISTS ai_pending_since timestamptz DEFAULT NULL;
