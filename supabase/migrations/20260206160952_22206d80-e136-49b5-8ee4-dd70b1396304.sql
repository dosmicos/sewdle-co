ALTER TABLE public.ugc_creators DROP CONSTRAINT ugc_creators_status_check;

ALTER TABLE public.ugc_creators ADD CONSTRAINT ugc_creators_status_check 
CHECK (status = ANY (ARRAY['prospecto','contactado','respondio_no','respondio_si','negociando','activo','inactivo']));