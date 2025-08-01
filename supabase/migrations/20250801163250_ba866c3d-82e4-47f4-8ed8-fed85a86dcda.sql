-- Migrar usuarios existentes al sistema multi-tenant
-- Asociar todos los usuarios existentes con la "Demo Organization"

-- Insertar todos los usuarios existentes en organization_users con la Demo Organization
INSERT INTO public.organization_users (
  user_id, 
  organization_id, 
  role, 
  status, 
  joined_at
)
SELECT 
  p.id as user_id,
  '5cf91bae-7a1d-4d4b-9f3e-123456789012' as organization_id, -- Demo Organization ID
  CASE 
    -- Si el usuario tiene rol de Administrador, hacerlo owner/admin
    WHEN EXISTS (
      SELECT 1 FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = p.id AND r.name = 'Administrador'
    ) THEN 'admin'
    -- Si tiene rol de Diseñador, hacerlo admin
    WHEN EXISTS (
      SELECT 1 FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = p.id AND r.name = 'Diseñador'
    ) THEN 'admin'
    -- Talleres y otros roles como member
    ELSE 'member'
  END as role,
  'active' as status,
  COALESCE(p.created_at, now()) as joined_at
FROM public.profiles p
WHERE NOT EXISTS (
  -- Solo insertar si el usuario no está ya en organization_users
  SELECT 1 FROM public.organization_users ou 
  WHERE ou.user_id = p.id
);

-- Hacer que el primer usuario administrador sea owner
UPDATE public.organization_users 
SET role = 'owner'
WHERE user_id = (
  SELECT ur.user_id 
  FROM user_roles ur 
  JOIN roles r ON ur.role_id = r.id 
  WHERE r.name = 'Administrador' 
  ORDER BY ur.created_at ASC 
  LIMIT 1
)
AND organization_id = '5cf91bae-7a1d-4d4b-9f3e-123456789012';

-- Actualizar el organization_id en user_roles para mantener consistencia
UPDATE public.user_roles 
SET organization_id = '5cf91bae-7a1d-4d4b-9f3e-123456789012'
WHERE organization_id IS NULL;

-- Actualizar todos los datos existentes con organization_id si no lo tienen
UPDATE public.orders 
SET organization_id = '5cf91bae-7a1d-4d4b-9f3e-123456789012'
WHERE organization_id IS NULL;

UPDATE public.products 
SET organization_id = '5cf91bae-7a1d-4d4b-9f3e-123456789012'
WHERE organization_id IS NULL;

UPDATE public.workshops 
SET organization_id = '5cf91bae-7a1d-4d4b-9f3e-123456789012'
WHERE organization_id IS NULL;

UPDATE public.materials 
SET organization_id = '5cf91bae-7a1d-4d4b-9f3e-123456789012'
WHERE organization_id IS NULL;

UPDATE public.deliveries 
SET organization_id = '5cf91bae-7a1d-4d4b-9f3e-123456789012'
WHERE organization_id IS NULL;

UPDATE public.workshop_assignments 
SET organization_id = '5cf91bae-7a1d-4d4b-9f3e-123456789012'
WHERE organization_id IS NULL;

UPDATE public.profiles 
SET organization_id = '5cf91bae-7a1d-4d4b-9f3e-123456789012'
WHERE organization_id IS NULL;