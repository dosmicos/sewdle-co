-- Simple fix for profiles_limited view RLS

-- Recreate profiles_limited view with security invoker
DROP VIEW IF EXISTS public.profiles_limited CASCADE;

CREATE VIEW public.profiles_limited WITH (security_invoker = on) AS
SELECT
  id,
  name,
  avatar_url,
  organization_id
FROM public.profiles;

COMMENT ON VIEW public.profiles_limited IS
'Limited view of profiles showing only non-sensitive information. Email addresses are excluded to prevent harvesting. This view respects the RLS policies of the underlying profiles table.';