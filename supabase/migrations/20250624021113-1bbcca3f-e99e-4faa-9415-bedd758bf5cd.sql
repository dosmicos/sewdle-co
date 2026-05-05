
-- 1. Crear el perfil faltante para julian@nodek.co
INSERT INTO public.profiles (id, name, email, created_at, updated_at)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', au.email),
  au.email,
  au.created_at,
  now()
FROM auth.users au
WHERE au.email = 'julian@nodek.co'
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id);

-- 2. Crear función para verificar si el usuario actual es administrador
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'Administrador'
  );
$$;

-- 3. Agregar política RLS para que administradores puedan ver todos los perfiles
CREATE POLICY "Administrators can view all profiles" 
  ON public.profiles 
  FOR SELECT 
  TO authenticated
  USING (public.is_current_user_admin());

-- 4. Verificar que existe una política para que usuarios vean su propio perfil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can view own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view own profile" 
      ON public.profiles 
      FOR SELECT 
      TO authenticated
      USING (auth.uid() = id)';
  END IF;
END $$;
