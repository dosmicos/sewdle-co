-- Update existing conversations with null ai_managed to true (AI enabled by default)
UPDATE public.messaging_conversations 
SET ai_managed = true 
WHERE ai_managed IS NULL;