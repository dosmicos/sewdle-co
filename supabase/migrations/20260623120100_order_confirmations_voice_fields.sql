-- Voice-confirmation fields on order_confirmations. The canonical `status` stays
-- (pending/confirmed/needs_attention/expired/cancelled); voice detail lives here so the
-- existing WhatsApp flow and the confirmations panel keep working unchanged.
ALTER TABLE public.order_confirmations
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_status TEXT,
  ADD COLUMN IF NOT EXISTS voice_outcome TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_channel TEXT DEFAULT 'whatsapp';
