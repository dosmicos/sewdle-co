-- Update is_dosmicos_user function to use correct slug
CREATE OR REPLACE FUNCTION public.is_dosmicos_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_users ou
    JOIN public.organizations o ON ou.organization_id = o.id
    WHERE ou.user_id = auth.uid() 
    AND o.slug = 'dosmicos-org'
    AND ou.status = 'active'
  );
$function$;

-- Update get_dosmicos_org_id function to use correct slug
CREATE OR REPLACE FUNCTION public.get_dosmicos_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id 
  FROM public.organizations 
  WHERE slug = 'dosmicos-org'
  LIMIT 1;
$function$;