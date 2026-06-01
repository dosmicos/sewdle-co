-- Add Bre-B payment key to UGC creators.
-- Bre-B is a Colombian instant-payment system; the "llave" can be an alias (@user),
-- phone (#300...), document, or email. Stored as free text — formats vary widely.
ALTER TABLE public.ugc_creators
  ADD COLUMN IF NOT EXISTS bre_b text;
