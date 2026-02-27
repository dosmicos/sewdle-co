-- Add index to support fallback lookup by phone + status in whatsapp-webhook
-- This enables the webhook to find pending confirmations when conversation metadata is missing
CREATE INDEX IF NOT EXISTS idx_order_confirmations_phone_status
  ON public.order_confirmations(customer_phone, status);
