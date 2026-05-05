-- Crear función RPC para verificar si el usuario requiere cambio de contraseña
-- SECURITY DEFINER para ejecutar con privilegios del creador y evitar problemas de RLS
CREATE OR REPLACE FUNCTION public.get_password_change_required()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  -- Obtener el flag de la tabla profiles para el usuario autenticado
  SELECT requires_password_change INTO result
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Si no existe el perfil, retornar false (no requiere cambio)
  IF result IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN result;
END;
$$;

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.get_password_change_required() TO authenticated;