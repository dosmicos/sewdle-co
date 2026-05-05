
-- Crear un usuario administrador por defecto
-- Primero necesitamos obtener el ID del usuario actual autenticado
-- y asignarle el rol de admin

-- Insertar rol de admin para el usuario actual (si existe)
INSERT INTO public.user_roles (user_id, role)
SELECT auth.uid(), 'admin'
WHERE auth.uid() IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid()
)
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- También vamos a crear una función para asignar roles de admin manualmente
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_uuid uuid;
BEGIN
  -- Buscar el usuario por email en auth.users
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = user_email;
  
  IF user_uuid IS NOT NULL THEN
    -- Insertar o actualizar el rol
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_uuid, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
  END IF;
END;
$$;

-- Función para verificar si un usuario está autenticado y tiene permisos
CREATE OR REPLACE FUNCTION public.user_has_workshop_permissions()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    CASE 
      WHEN auth.uid() IS NULL THEN false
      ELSE true
    END;
$$;
