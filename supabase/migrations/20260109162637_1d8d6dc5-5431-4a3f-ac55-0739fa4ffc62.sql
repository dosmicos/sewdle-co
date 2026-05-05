-- Add unique constraint to prevent duplicate conversations for the same phone number + channel
-- First, we need to clean up existing duplicates by keeping only the newest one
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY 
             REGEXP_REPLACE(external_user_id, '[^0-9]', '', 'g'),
             channel_type,
             organization_id
           ORDER BY 
             COALESCE(last_message_at, created_at) DESC NULLS LAST
         ) as rn
  FROM public.messaging_conversations
)
DELETE FROM public.messaging_conversations
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Create a function to normalize phone numbers (remove all non-digits)
CREATE OR REPLACE FUNCTION public.normalize_phone_number(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN REGEXP_REPLACE(phone, '[^0-9]', '', 'g');
END;
$$;

-- Add unique index on normalized phone number + channel + organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_messaging_conversations_unique_phone
ON public.messaging_conversations (
  normalize_phone_number(external_user_id),
  channel_type,
  organization_id
);