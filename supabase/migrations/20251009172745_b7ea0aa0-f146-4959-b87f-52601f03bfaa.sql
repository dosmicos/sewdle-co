-- Crear función para marcar contraseña como cambiada
CREATE OR REPLACE FUNCTION public.mark_password_changed(user_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET requires_password_change = false,
      updated_at = now()
  WHERE id = user_uuid;
END;
$$;

-- Política: Los usuarios pueden leer su propio perfil
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can view own profile fully'
  ) THEN
    CREATE POLICY "Users can view own profile fully"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
  END IF;
END $$;

-- Política: Los usuarios pueden actualizar su flag de cambio de contraseña
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can update own password change flag'
  ) THEN
    CREATE POLICY "Users can update own password change flag"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;