-- Crear política específica para que usuarios puedan crear su propio perfil
CREATE POLICY "Users can create their own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Nota: Esta política complementa la existente "Users can manage their own profile"
-- y permite específicamente la operación INSERT durante el registro de usuarios