-- Crear un usuario temporal de prueba para el Taller Marisol Trujillo
-- Primero obtenemos el ID del rol "Taller" y del workshop
DO $$
DECLARE
  taller_role_id uuid;
  workshop_id uuid := '862d85b6-4c63-4845-a448-015ccc5c79ab'; -- Taller Marisol Trujillo
  temp_user_id uuid := gen_random_uuid();
BEGIN
  -- Obtener el ID del rol "Taller"
  SELECT id INTO taller_role_id FROM public.roles WHERE name = 'Taller';
  
  -- Insertar perfil temporal (simularemos que ya existe el usuario en auth)
  -- En este caso vamos a crear directamente el perfil y el rol
  INSERT INTO public.profiles (id, name, email, requires_password_change)
  VALUES (
    temp_user_id,
    'Usuario Prueba Taller',
    'prueba-taller@dosmicos.co',
    false
  );
  
  -- Asignar rol de taller al usuario temporal
  INSERT INTO public.user_roles (user_id, role_id, workshop_id)
  VALUES (temp_user_id, taller_role_id, workshop_id);
  
  -- Log de la creación
  RAISE NOTICE 'Usuario temporal creado: %', temp_user_id;
  RAISE NOTICE 'Email: prueba-taller@dosmicos.co';
  RAISE NOTICE 'Asignado al Taller Marisol Trujillo';
END $$;