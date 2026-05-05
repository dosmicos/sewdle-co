-- Fase 1: Implementación Multi-Tenant - Modelo de Datos

-- 1. Crear tabla organizations
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  settings JSONB DEFAULT '{}',
  branding JSONB DEFAULT '{}',
  shopify_store_url TEXT,
  shopify_credentials JSONB,
  max_users INTEGER DEFAULT 5,
  max_orders_per_month INTEGER DEFAULT 100,
  max_workshops INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Crear tabla organization_users para membresías
CREATE TABLE public.organization_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- 3. Agregar organization_id a profiles
ALTER TABLE public.profiles 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 4. Agregar organization_id a user_roles
ALTER TABLE public.user_roles 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 5. Agregar organization_id a orders
ALTER TABLE public.orders 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 6. Agregar organization_id a products
ALTER TABLE public.products 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 7. Agregar organization_id a workshops
ALTER TABLE public.workshops 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 8. Agregar organization_id a deliveries
ALTER TABLE public.deliveries 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 9. Agregar organization_id a materials
ALTER TABLE public.materials 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 10. Agregar organization_id a roles
ALTER TABLE public.roles 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 11. Agregar organization_id a order_advances
ALTER TABLE public.order_advances 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 12. Agregar organization_id a delivery_payments
ALTER TABLE public.delivery_payments 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 13. Agregar organization_id a material_deliveries
ALTER TABLE public.material_deliveries 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 14. Agregar organization_id a workshop_assignments
ALTER TABLE public.workshop_assignments 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 15. Agregar organization_id a workshop_pricing
ALTER TABLE public.workshop_pricing 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 16. Crear índices para performance
CREATE INDEX idx_organizations_slug ON public.organizations(slug);
CREATE INDEX idx_organizations_status ON public.organizations(status);
CREATE INDEX idx_organization_users_org_id ON public.organization_users(organization_id);
CREATE INDEX idx_organization_users_user_id ON public.organization_users(user_id);

-- Índices en tablas existentes para organization_id
CREATE INDEX idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX idx_user_roles_organization_id ON public.user_roles(organization_id);
CREATE INDEX idx_orders_organization_id ON public.orders(organization_id);
CREATE INDEX idx_products_organization_id ON public.products(organization_id);
CREATE INDEX idx_workshops_organization_id ON public.workshops(organization_id);
CREATE INDEX idx_deliveries_organization_id ON public.deliveries(organization_id);
CREATE INDEX idx_materials_organization_id ON public.materials(organization_id);

-- 17. Función para obtener la organización actual del usuario
CREATE OR REPLACE FUNCTION public.get_current_organization()
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ou.organization_id
  FROM public.organization_users ou
  WHERE ou.user_id = auth.uid()
  AND ou.status = 'active'
  LIMIT 1;
$$;

-- 18. Función para verificar si el usuario pertenece a una organización
CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.organization_id = org_id
    AND ou.status = 'active'
  );
$$;

-- 19. Trigger para actualizar updated_at en organizations
CREATE OR REPLACE FUNCTION public.update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organizations_updated_at();

-- 20. Trigger para actualizar updated_at en organization_users
CREATE OR REPLACE FUNCTION public.update_organization_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organization_users_updated_at
  BEFORE UPDATE ON public.organization_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_users_updated_at();

-- 21. Habilitar RLS en las nuevas tablas
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;

-- 22. Políticas RLS básicas para organizations
CREATE POLICY "Users can view their own organizations" 
ON public.organizations FOR SELECT 
USING (
  id IN (
    SELECT organization_id 
    FROM public.organization_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Organization owners and admins can update" 
ON public.organizations FOR UPDATE 
USING (
  id IN (
    SELECT organization_id 
    FROM public.organization_users 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND status = 'active'
  )
);

-- 23. Políticas RLS para organization_users
CREATE POLICY "Users can view organization memberships" 
ON public.organization_users FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Organization admins can manage memberships" 
ON public.organization_users FOR ALL 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_users 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND status = 'active'
  )
);

-- 24. Crear organización demo para datos existentes
INSERT INTO public.organizations (
  name, 
  slug, 
  plan, 
  status,
  settings
) VALUES (
  'Demo Organization',
  'demo-org',
  'professional',
  'active',
  '{"demo": true}'
) ON CONFLICT (slug) DO NOTHING;