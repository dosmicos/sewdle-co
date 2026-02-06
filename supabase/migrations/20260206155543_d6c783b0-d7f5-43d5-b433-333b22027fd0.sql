
-- PROBLEMA 2: Cambiar birth_date por age_description en hijos
ALTER TABLE public.ugc_creator_children 
DROP COLUMN IF EXISTS birth_date,
ADD COLUMN IF NOT EXISTS age_description TEXT;

-- PROBLEMA 4: Agregar nuevos status al creador (respondio_no, respondio_si)
-- No constraint exists, status is just TEXT, so we just need to handle in UI

-- PROBLEMA 5: Agregar campos adicionales a creadores
ALTER TABLE public.ugc_creators
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'instagram',
ADD COLUMN IF NOT EXISTS content_types TEXT[],
ADD COLUMN IF NOT EXISTS tiktok_handle TEXT,
ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
