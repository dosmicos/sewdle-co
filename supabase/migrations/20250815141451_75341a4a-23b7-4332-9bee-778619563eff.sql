-- Create the missing get_current_organization_safe function
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT ou.organization_id
  FROM public.organization_users ou
  WHERE ou.user_id = auth.uid()
  AND ou.status = 'active'
  LIMIT 1;
$function$;