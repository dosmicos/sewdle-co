
-- Actualizar las funciones problemáticas para usar el nuevo sistema de roles

-- 1. Actualizar get_current_user_role() para usar el nuevo sistema user_roles -> roles
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT r.name
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = auth.uid() 
  LIMIT 1;
$$;

-- 2. Actualizar get_current_user_role_safe() para usar el nuevo sistema
CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT r.name
     FROM public.user_roles ur
     JOIN public.roles r ON ur.role_id = r.id
     WHERE ur.user_id = auth.uid() 
     LIMIT 1),
    'user'
  );
$$;

-- 3. Actualizar get_user_role() para usar el nuevo sistema
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT r.name
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid 
  LIMIT 1;
$$;

-- 4. Verificar y actualizar cualquier política RLS que pueda estar usando las funciones obsoletas
-- (Las políticas RLS actuales ya usan las funciones correctas como get_user_role_info, is_admin, has_permission)

-- 5. Crear índices para mejorar el rendimiento de las consultas de roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
