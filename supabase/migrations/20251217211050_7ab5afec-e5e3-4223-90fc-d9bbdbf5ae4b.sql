-- Add missing columns for COD tracking in shipping labels
ALTER TABLE shipping_labels 
ADD COLUMN IF NOT EXISTS cod_requested BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cod_amount_requested NUMERIC(10,2);