-- Backfill missing message rows for conversations that have last_message_preview/last_message_at
-- This fixes historical threads created when outbound message insert failed previously.
INSERT INTO public.messaging_messages (
  conversation_id,
  channel_type,
  direction,
  sender_type,
  content,
  message_type,
  sent_at,
  metadata
)
SELECT
  c.id,
  c.channel_type,
  'outbound',
  'agent',
  c.last_message_preview,
  'text',
  c.last_message_at,
  jsonb_build_object('backfilled', true, 'source', 'messaging_conversations.last_message_preview')
FROM public.messaging_conversations c
WHERE c.last_message_preview IS NOT NULL
  AND c.last_message_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.messaging_messages m
    WHERE m.conversation_id = c.id
  );