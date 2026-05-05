-- Add user_observations field to deliveries table to preserve original user observations
ALTER TABLE public.deliveries 
ADD COLUMN user_observations TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN public.deliveries.user_observations IS 'Original observations entered by the user during delivery creation - never modified by system processes';