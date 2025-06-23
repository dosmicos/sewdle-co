
-- Primero, eliminar todas las políticas RLS que dependen de la columna role
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage workshops" ON public.workshops;
DROP POLICY IF EXISTS "Designers and admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Designers and admins can manage product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Designers and admins can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Designers and admins can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can manage workshop assignments" ON public.workshop_assignments;
DROP POLICY IF EXISTS "Admins can manage materials" ON public.materials;
DROP POLICY IF EXISTS "Workshop users can update their deliveries" ON public.material_deliveries;
DROP POLICY IF EXISTS "Admins can manage material deliveries" ON public.material_deliveries;
DROP POLICY IF EXISTS "Workshop and admin users can manage deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Workshop and admin users can manage delivery items" ON public.delivery_items;

-- Crear tabla roles para gestionar roles del sistema
CREATE TABLE public.roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insertar roles del sistema
INSERT INTO public.roles (name, description, is_system, permissions) VALUES 
('Administrador', 'Control total de la plataforma', true, '{"dashboard": {"view": true, "create": true, "edit": true, "delete": true}, "orders": {"view": true, "create": true, "edit": true, "delete": true}, "workshops": {"view": true, "create": true, "edit": true, "delete": true}, "products": {"view": true, "create": true, "edit": true, "delete": true}, "deliveries": {"view": true, "create": true, "edit": true, "delete": true}, "users": {"view": true, "create": true, "edit": true, "delete": true}}'),
('Diseñador', 'Gestión de órdenes y reportes', true, '{"dashboard": {"view": true}, "orders": {"view": true, "create": true, "edit": true}, "workshops": {"view": true}, "products": {"view": true, "create": true, "edit": true}, "deliveries": {"view": true}}'),
('Taller', 'Acceso a órdenes asignadas y entregas', true, '{"dashboard": {"view": true}, "orders": {"view": true, "edit": true}, "deliveries": {"view": true, "create": true, "edit": true}}'),
('Líder QC', 'Control de calidad y revisión de entregas', true, '{"dashboard": {"view": true}, "orders": {"view": true}, "deliveries": {"view": true, "edit": true}}');

-- Agregar nueva columna role_id a user_roles
ALTER TABLE public.user_roles ADD COLUMN role_id UUID REFERENCES public.roles(id);

-- Actualizar los registros existentes para usar los nuevos IDs de roles
UPDATE public.user_roles 
SET role_id = (
  CASE 
    WHEN role = 'admin' THEN (SELECT id FROM public.roles WHERE name = 'Administrador' LIMIT 1)
    WHEN role = 'designer' THEN (SELECT id FROM public.roles WHERE name = 'Diseñador' LIMIT 1)
    WHEN role = 'workshop' THEN (SELECT id FROM public.roles WHERE name = 'Taller' LIMIT 1)
    WHEN role = 'qc' THEN (SELECT id FROM public.roles WHERE name = 'Líder QC' LIMIT 1)
    ELSE (SELECT id FROM public.roles WHERE name = 'Administrador' LIMIT 1)
  END
)
WHERE user_id IS NOT NULL;

-- Ahora eliminar la columna role antigua
ALTER TABLE public.user_roles DROP COLUMN role;

-- Función para obtener el rol de un usuario
CREATE OR REPLACE FUNCTION public.get_user_role_info(user_uuid uuid)
RETURNS TABLE(role_name text, permissions jsonb, workshop_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT 
    r.name as role_name,
    r.permissions,
    ur.workshop_id
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid 
  LIMIT 1;
$$;

-- Función para verificar permisos específicos
CREATE OR REPLACE FUNCTION public.has_permission(user_uuid uuid, module_name text, action_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT 
    COALESCE(
      (r.permissions->module_name->>action_name)::boolean, 
      false
    )
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid 
  LIMIT 1;
$$;

-- Función para verificar si un usuario es admin
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid AND r.name = 'Administrador'
  );
$$;

-- Habilitar RLS en todas las tablas relacionadas
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para roles (solo admins pueden gestionarlos)
CREATE POLICY "Admin can manage roles" ON public.roles
  FOR ALL USING (public.is_admin(auth.uid()));

-- Política para que todos los usuarios autenticados puedan ver roles (para formularios)
CREATE POLICY "Authenticated users can view roles" ON public.roles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Políticas RLS para user_roles
CREATE POLICY "Admin can manage user roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()));

-- Política para que los usuarios puedan ver su propio rol
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Recrear políticas RLS actualizadas para las otras tablas
CREATE POLICY "Admins can manage workshops" ON public.workshops
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins and designers can manage products" ON public.products
  FOR ALL USING (public.has_permission(auth.uid(), 'products', 'edit'));

CREATE POLICY "Admins and designers can manage product variants" ON public.product_variants
  FOR ALL USING (public.has_permission(auth.uid(), 'products', 'edit'));

CREATE POLICY "Users can manage orders based on permissions" ON public.orders
  FOR ALL USING (public.has_permission(auth.uid(), 'orders', 'edit'));

CREATE POLICY "Users can manage order items based on permissions" ON public.order_items
  FOR ALL USING (public.has_permission(auth.uid(), 'orders', 'edit'));

CREATE POLICY "Admins can manage workshop assignments" ON public.workshop_assignments
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage materials" ON public.materials
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Workshop users can manage material deliveries" ON public.material_deliveries
  FOR ALL USING (
    public.is_admin(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Taller'
    )
  );

CREATE POLICY "Users can manage deliveries based on permissions" ON public.deliveries
  FOR ALL USING (public.has_permission(auth.uid(), 'deliveries', 'edit'));

CREATE POLICY "Users can manage delivery items based on permissions" ON public.delivery_items
  FOR ALL USING (public.has_permission(auth.uid(), 'deliveries', 'edit'));

-- Trigger para actualizar updated_at en roles
CREATE OR REPLACE FUNCTION public.update_roles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_roles_updated_at_trigger
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_roles_updated_at();
