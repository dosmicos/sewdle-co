
-- Agregar campo para controlar si el usuario requiere cambio de contraseña
ALTER TABLE public.profiles 
ADD COLUMN requires_password_change BOOLEAN DEFAULT false;

-- Función para marcar que un usuario ya cambió su contraseña
CREATE OR REPLACE FUNCTION public.mark_password_changed(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.profiles 
  SET requires_password_change = false,
      updated_at = now()
  WHERE id = user_uuid;
END;
$function$;

-- Función para marcar que un usuario necesita cambiar contraseña (útil para administradores)
CREATE OR REPLACE FUNCTION public.require_password_change(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.profiles 
  SET requires_password_change = true,
      updated_at = now()
  WHERE id = user_uuid;
END;
$function$;
