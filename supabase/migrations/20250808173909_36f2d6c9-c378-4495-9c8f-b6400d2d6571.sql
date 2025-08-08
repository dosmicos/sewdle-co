-- Crear función para el manejo automático de setup de organización tras confirmación de email
CREATE OR REPLACE FUNCTION public.handle_user_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  organization_id_var UUID;
  organization_name TEXT;
  organization_type TEXT;
  selected_plan TEXT;
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 1;
  plan_limits RECORD;
BEGIN
  -- Solo procesar si el usuario se confirma por primera vez
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    
    -- Verificar si ya tiene una organización
    IF EXISTS (
      SELECT 1 FROM public.organization_users 
      WHERE user_id = NEW.id AND status = 'active'
    ) THEN
      RETURN NEW; -- Ya tiene organización, salir
    END IF;
    
    -- Extraer datos del metadata del usuario
    organization_name := COALESCE(NEW.raw_user_meta_data->>'organizationName', 'Mi Organización');
    organization_type := COALESCE(NEW.raw_user_meta_data->>'organizationType', 'brand');
    selected_plan := COALESCE(NEW.raw_user_meta_data->>'selectedPlan', 'starter');
    
    -- Generar slug único
    base_slug := lower(regexp_replace(organization_name, '[^a-z0-9\s-]', '', 'g'));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(base_slug);
    base_slug := substring(base_slug from 1 for 50);
    
    final_slug := base_slug;
    
    -- Asegurar que el slug sea único
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    
    -- Definir límites según el plan
    IF selected_plan = 'professional' THEN
      plan_limits := ROW(10, -1, 20);
    ELSIF selected_plan = 'enterprise' THEN
      plan_limits := ROW(-1, -1, -1);
    ELSE -- starter
      plan_limits := ROW(3, 10, 5);
    END IF;
    
    -- Crear organización
    INSERT INTO public.organizations (
      name, 
      slug, 
      plan, 
      status,
      max_users,
      max_orders_per_month,
      max_workshops,
      settings
    ) VALUES (
      organization_name,
      final_slug,
      selected_plan,
      'active',
      plan_limits.f1, -- max_users
      plan_limits.f2, -- max_orders_per_month  
      plan_limits.f3, -- max_workshops
      jsonb_build_object('organization_type', organization_type)
    ) RETURNING id INTO organization_id_var;
    
    -- Agregar usuario como owner
    INSERT INTO public.organization_users (
      organization_id,
      user_id,
      role,
      status
    ) VALUES (
      organization_id_var,
      NEW.id,
      'owner',
      'active'
    );
    
    -- Crear perfil del usuario
    INSERT INTO public.profiles (
      id,
      name,
      email,
      organization_id
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', ''),
      NEW.email,
      organization_id_var
    ) ON CONFLICT (id) DO UPDATE SET
      organization_id = organization_id_var,
      name = COALESCE(NEW.raw_user_meta_data->>'name', profiles.name),
      email = NEW.email;
      
    RAISE LOG 'Organization auto-setup completed for user % with organization %', NEW.id, organization_id_var;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para el manejo automático
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;

CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_user_confirmation();

-- Función para completar setup manual para usuarios existentes
CREATE OR REPLACE FUNCTION public.complete_user_setup(
  p_user_id UUID,
  p_organization_name TEXT DEFAULT 'Mi Organización',
  p_organization_type TEXT DEFAULT 'brand',
  p_selected_plan TEXT DEFAULT 'starter'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  organization_id_var UUID;
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 1;
  plan_limits RECORD;
  user_info RECORD;
BEGIN
  -- Verificar si ya tiene organización
  IF EXISTS (
    SELECT 1 FROM public.organization_users 
    WHERE user_id = p_user_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already has organization');
  END IF;
  
  -- Obtener información del usuario
  SELECT email, raw_user_meta_data->>'name' as name
  INTO user_info
  FROM auth.users 
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Generar slug único
  base_slug := lower(regexp_replace(p_organization_name, '[^a-z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(base_slug);
  base_slug := substring(base_slug from 1 for 50);
  
  final_slug := base_slug;
  
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  -- Definir límites según el plan
  IF p_selected_plan = 'professional' THEN
    plan_limits := ROW(10, -1, 20);
  ELSIF p_selected_plan = 'enterprise' THEN
    plan_limits := ROW(-1, -1, -1);
  ELSE -- starter
    plan_limits := ROW(3, 10, 5);
  END IF;
  
  -- Crear organización
  INSERT INTO public.organizations (
    name, 
    slug, 
    plan, 
    status,
    max_users,
    max_orders_per_month,
    max_workshops,
    settings
  ) VALUES (
    p_organization_name,
    final_slug,
    p_selected_plan,
    'active',
    plan_limits.f1,
    plan_limits.f2,
    plan_limits.f3,
    jsonb_build_object('organization_type', p_organization_type)
  ) RETURNING id INTO organization_id_var;
  
  -- Agregar usuario como owner
  INSERT INTO public.organization_users (
    organization_id,
    user_id,
    role,
    status
  ) VALUES (
    organization_id_var,
    p_user_id,
    'owner',
    'active'
  );
  
  -- Crear/actualizar perfil del usuario
  INSERT INTO public.profiles (
    id,
    name,
    email,
    organization_id
  ) VALUES (
    p_user_id,
    COALESCE(user_info.name, ''),
    user_info.email,
    organization_id_var
  ) ON CONFLICT (id) DO UPDATE SET
    organization_id = organization_id_var,
    name = COALESCE(user_info.name, profiles.name),
    email = user_info.email;
    
  RETURN jsonb_build_object(
    'success', true,
    'organization_id', organization_id_var,
    'organization_name', p_organization_name,
    'slug', final_slug,
    'plan', p_selected_plan
  );
END;
$$;