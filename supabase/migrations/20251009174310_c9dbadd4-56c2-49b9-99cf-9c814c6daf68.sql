-- Permitir NULL en changed_by_user_id para operaciones del sistema
ALTER TABLE public.role_change_audit 
ALTER COLUMN changed_by_user_id DROP NOT NULL;

-- Actualizar el trigger para manejar mejor las operaciones del sistema
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  org_id uuid;
  current_user_id uuid;
BEGIN
  -- Obtener el usuario actual (puede ser NULL para operaciones del sistema)
  current_user_id := auth.uid();
  
  -- Get organization_id from the user's profile
  SELECT organization_id INTO org_id
  FROM profiles
  WHERE id = COALESCE(NEW.user_id, OLD.user_id)
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO role_change_audit (
      changed_user_id,
      changed_by_user_id,
      new_role_id,
      action,
      organization_id
    ) VALUES (
      NEW.user_id,
      current_user_id, -- Puede ser NULL para operaciones del sistema
      NEW.role_id,
      'insert',
      org_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO role_change_audit (
      changed_user_id,
      changed_by_user_id,
      old_role_id,
      new_role_id,
      action,
      organization_id
    ) VALUES (
      NEW.user_id,
      current_user_id,
      OLD.role_id,
      NEW.role_id,
      'update',
      org_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO role_change_audit (
      changed_user_id,
      changed_by_user_id,
      old_role_id,
      action,
      organization_id
    ) VALUES (
      OLD.user_id,
      current_user_id,
      OLD.role_id,
      'delete',
      org_id
    );
    RETURN OLD;
  END IF;
END;
$$;

-- Agregar comentario para documentar el cambio
COMMENT ON COLUMN public.role_change_audit.changed_by_user_id IS 
'Usuario que realizó el cambio. Puede ser NULL cuando el cambio es realizado por el sistema (edge functions, triggers, etc.)';