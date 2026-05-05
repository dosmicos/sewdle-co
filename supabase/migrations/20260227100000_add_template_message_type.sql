-- Add 'template' to messaging_messages.message_type CHECK constraint
-- Needed for WhatsApp template messages sent from new conversation modal
-- Root cause: INSERT with message_type='template' was silently failing,
-- which is why template messages didn't appear in conversation thread

ALTER TABLE public.messaging_messages
  DROP CONSTRAINT IF EXISTS messaging_messages_message_type_check;

ALTER TABLE public.messaging_messages
  ADD CONSTRAINT messaging_messages_message_type_check
  CHECK (message_type IN (
    'text', 'image', 'audio', 'video', 'document', 'sticker',
    'story_reply', 'reaction', 'location', 'contacts', 'button',
    'interactive', 'order', 'comment', 'template'
  ));
