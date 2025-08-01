-- Fase 2: Seguridad Multi-Tenant - Actualización de políticas RLS

-- Función auxiliar para obtener organization_id de manera más eficiente
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT ou.organization_id
     FROM public.organization_users ou
     WHERE ou.user_id = auth.uid()
     AND ou.status = 'active'
     LIMIT 1),
    -- Fallback para compatibilidad con datos existentes
    (SELECT id FROM public.organizations WHERE slug = 'demo-org')
  );
$$;

-- ================================
-- 1. ACTUALIZAR POLÍTICAS DE PROFILES
-- ================================

-- Eliminar políticas existentes de profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Administrators can view all profiles" ON public.profiles;

-- Nuevas políticas multi-tenant para profiles
CREATE POLICY "Users can view profiles in their organization" 
ON public.profiles FOR SELECT 
USING (
  (auth.uid() = id) OR 
  (organization_id = get_current_organization_safe() AND organization_id IS NOT NULL)
);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles in organization" 
ON public.profiles FOR SELECT 
USING (
  is_current_user_admin() OR 
  (organization_id = get_current_organization_safe() AND 
   EXISTS (
     SELECT 1 FROM public.organization_users ou
     WHERE ou.user_id = auth.uid() 
     AND ou.organization_id = organization_id
     AND ou.role IN ('owner', 'admin')
     AND ou.status = 'active'
   ))
);

-- ================================
-- 2. ACTUALIZAR POLÍTICAS DE ORDERS
-- ================================

-- Eliminar políticas existentes de orders
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Users can manage orders based on permissions" ON public.orders;

-- Nuevas políticas multi-tenant para orders
CREATE POLICY "Users can view orders in their organization" 
ON public.orders FOR SELECT 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can create orders in their organization" 
ON public.orders FOR INSERT 
WITH CHECK (organization_id = get_current_organization_safe());

CREATE POLICY "Users can update orders in their organization" 
ON public.orders FOR UPDATE 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can delete orders in their organization" 
ON public.orders FOR DELETE 
USING (
  organization_id = get_current_organization_safe() AND
  (is_current_user_admin() OR has_permission(auth.uid(), 'orders', 'delete'))
);

-- ================================
-- 3. ACTUALIZAR POLÍTICAS DE PRODUCTS
-- ================================

-- Eliminar políticas existentes de products
DROP POLICY IF EXISTS "Users can create products" ON public.products;
DROP POLICY IF EXISTS "Users can delete products" ON public.products;
DROP POLICY IF EXISTS "Users can update products" ON public.products;
DROP POLICY IF EXISTS "Users can view products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Admins and designers can manage products" ON public.products;

-- Nuevas políticas multi-tenant para products
CREATE POLICY "Users can view products in their organization" 
ON public.products FOR SELECT 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can manage products in their organization" 
ON public.products FOR ALL 
USING (
  organization_id = get_current_organization_safe() AND
  has_permission(auth.uid(), 'products', 'edit')
)
WITH CHECK (organization_id = get_current_organization_safe());

-- ================================
-- 4. ACTUALIZAR POLÍTICAS DE WORKSHOPS
-- ================================

-- Eliminar políticas existentes de workshops
DROP POLICY IF EXISTS "Anyone authenticated can create workshops" ON public.workshops;
DROP POLICY IF EXISTS "Anyone authenticated can delete workshops" ON public.workshops;
DROP POLICY IF EXISTS "Anyone authenticated can update workshops" ON public.workshops;
DROP POLICY IF EXISTS "Anyone authenticated can view workshops" ON public.workshops;
DROP POLICY IF EXISTS "Admins can manage workshops" ON public.workshops;

-- Nuevas políticas multi-tenant para workshops
CREATE POLICY "Users can view workshops in their organization" 
ON public.workshops FOR SELECT 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can manage workshops in their organization" 
ON public.workshops FOR ALL 
USING (
  organization_id = get_current_organization_safe() AND
  (is_current_user_admin() OR has_permission(auth.uid(), 'workshops', 'edit'))
)
WITH CHECK (organization_id = get_current_organization_safe());

-- ================================
-- 5. ACTUALIZAR POLÍTICAS DE DELIVERIES
-- ================================

-- Eliminar políticas existentes de deliveries
DROP POLICY IF EXISTS "Users can view deliveries based on role and workshop" ON public.deliveries;
DROP POLICY IF EXISTS "Users can create deliveries based on role and workshop" ON public.deliveries;
DROP POLICY IF EXISTS "Users can update deliveries based on role and workshop" ON public.deliveries;
DROP POLICY IF EXISTS "Only admins can delete deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Users can manage deliveries based on permissions" ON public.deliveries;

-- Nuevas políticas multi-tenant para deliveries
CREATE POLICY "Users can view deliveries in their organization" 
ON public.deliveries FOR SELECT 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can create deliveries in their organization" 
ON public.deliveries FOR INSERT 
WITH CHECK (
  organization_id = get_current_organization_safe() AND
  (get_current_user_role_safe() = ANY (ARRAY['Administrador', 'Diseñador']) OR
   (get_current_user_role_safe() = 'Taller' AND 
    workshop_id IN (
      SELECT ur.workshop_id FROM user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.workshop_id IS NOT NULL
    )))
);

CREATE POLICY "Users can update deliveries in their organization" 
ON public.deliveries FOR UPDATE 
USING (
  organization_id = get_current_organization_safe() AND
  (get_current_user_role_safe() = ANY (ARRAY['Administrador', 'Diseñador']) OR
   (get_current_user_role_safe() = 'Taller' AND 
    workshop_id IN (
      SELECT ur.workshop_id FROM user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.workshop_id IS NOT NULL
    )))
);

CREATE POLICY "Admins can delete deliveries in their organization" 
ON public.deliveries FOR DELETE 
USING (
  organization_id = get_current_organization_safe() AND
  get_current_user_role_safe() = 'Administrador'
);

-- ================================
-- 6. ACTUALIZAR POLÍTICAS DE MATERIALS
-- ================================

-- Eliminar políticas existentes de materials
DROP POLICY IF EXISTS "Users can create materials" ON public.materials;
DROP POLICY IF EXISTS "Users can delete materials" ON public.materials;
DROP POLICY IF EXISTS "Users can update materials" ON public.materials;
DROP POLICY IF EXISTS "Users can view materials" ON public.materials;
DROP POLICY IF EXISTS "Authenticated users can view materials" ON public.materials;
DROP POLICY IF EXISTS "Admins can manage materials" ON public.materials;

-- Nuevas políticas multi-tenant para materials
CREATE POLICY "Users can view materials in their organization" 
ON public.materials FOR SELECT 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can manage materials in their organization" 
ON public.materials FOR ALL 
USING (
  organization_id = get_current_organization_safe() AND
  (is_current_user_admin() OR has_permission(auth.uid(), 'materials', 'edit'))
)
WITH CHECK (organization_id = get_current_organization_safe());

-- ================================
-- 7. ACTUALIZAR POLÍTICAS DE USER_ROLES
-- ================================

-- Eliminar políticas existentes de user_roles
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can manage user roles" ON public.user_roles;

-- Nuevas políticas multi-tenant para user_roles
CREATE POLICY "Users can view roles in their organization" 
ON public.user_roles FOR SELECT 
USING (
  (user_id = auth.uid()) OR
  (organization_id = get_current_organization_safe() AND 
   EXISTS (
     SELECT 1 FROM public.organization_users ou
     WHERE ou.user_id = auth.uid() 
     AND ou.organization_id = user_roles.organization_id
     AND ou.role IN ('owner', 'admin')
     AND ou.status = 'active'
   ))
);

CREATE POLICY "Organization admins can manage user roles" 
ON public.user_roles FOR ALL 
USING (
  organization_id = get_current_organization_safe() AND
  EXISTS (
    SELECT 1 FROM public.organization_users ou
    WHERE ou.user_id = auth.uid() 
    AND ou.organization_id = user_roles.organization_id
    AND ou.role IN ('owner', 'admin')
    AND ou.status = 'active'
  )
)
WITH CHECK (organization_id = get_current_organization_safe());

-- ================================
-- 8. ACTUALIZAR POLÍTICAS DE ROLES
-- ================================

-- Eliminar políticas existentes de roles
DROP POLICY IF EXISTS "Admin can manage roles" ON public.roles;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.roles;

-- Nuevas políticas multi-tenant para roles
CREATE POLICY "Users can view roles in their organization" 
ON public.roles FOR SELECT 
USING (
  organization_id = get_current_organization_safe() OR
  organization_id IS NULL -- Roles del sistema
);

CREATE POLICY "Organization admins can manage custom roles" 
ON public.roles FOR ALL 
USING (
  organization_id = get_current_organization_safe() AND
  is_system = false AND
  EXISTS (
    SELECT 1 FROM public.organization_users ou
    WHERE ou.user_id = auth.uid() 
    AND ou.organization_id = roles.organization_id
    AND ou.role IN ('owner', 'admin')
    AND ou.status = 'active'
  )
)
WITH CHECK (
  organization_id = get_current_organization_safe() AND
  is_system = false
);

-- ================================
-- 9. ACTUALIZAR POLÍTICAS DE TABLAS RELACIONADAS
-- ================================

-- ORDER_ITEMS
DROP POLICY IF EXISTS "Users can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can delete order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can manage order items based on permissions" ON public.order_items;

CREATE POLICY "Users can manage order items in their organization" 
ON public.order_items FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_items.order_id 
    AND o.organization_id = get_current_organization_safe()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_items.order_id 
    AND o.organization_id = get_current_organization_safe()
  )
);

-- PRODUCT_VARIANTS
DROP POLICY IF EXISTS "Users can create product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Users can delete product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Users can update product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Users can view product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Authenticated users can view product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins and designers can manage product variants" ON public.product_variants;

CREATE POLICY "Users can manage product variants in their organization" 
ON public.product_variants FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_variants.product_id 
    AND p.organization_id = get_current_organization_safe()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_variants.product_id 
    AND p.organization_id = get_current_organization_safe()
  )
);

-- DELIVERY_ITEMS
DROP POLICY IF EXISTS "Allow authenticated users full access to delivery items" ON public.delivery_items;
DROP POLICY IF EXISTS "Users can manage delivery items based on permissions" ON public.delivery_items;

CREATE POLICY "Users can manage delivery items in their organization" 
ON public.delivery_items FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.deliveries d 
    WHERE d.id = delivery_items.delivery_id 
    AND d.organization_id = get_current_organization_safe()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.deliveries d 
    WHERE d.id = delivery_items.delivery_id 
    AND d.organization_id = get_current_organization_safe()
  )
);

-- WORKSHOP_ASSIGNMENTS
DROP POLICY IF EXISTS "Authenticated users can create assignments" ON public.workshop_assignments;
DROP POLICY IF EXISTS "Authenticated users can delete assignments" ON public.workshop_assignments;
DROP POLICY IF EXISTS "Authenticated users can update assignments" ON public.workshop_assignments;
DROP POLICY IF EXISTS "Authenticated users can view assignments" ON public.workshop_assignments;
DROP POLICY IF EXISTS "Authenticated users can view workshop assignments" ON public.workshop_assignments;
DROP POLICY IF EXISTS "Admins can manage workshop assignments" ON public.workshop_assignments;

CREATE POLICY "Users can manage workshop assignments in their organization" 
ON public.workshop_assignments FOR ALL 
USING (organization_id = get_current_organization_safe())
WITH CHECK (organization_id = get_current_organization_safe());

-- ================================
-- 10. TRIGGER PARA AUTO-ASIGNAR ORGANIZATION_ID
-- ================================

-- Función para auto-asignar organization_id en inserts
CREATE OR REPLACE FUNCTION public.auto_assign_organization()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := get_current_organization_safe();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar trigger a tablas principales
DROP TRIGGER IF EXISTS auto_assign_organization_orders ON public.orders;
CREATE TRIGGER auto_assign_organization_orders
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION auto_assign_organization();

DROP TRIGGER IF EXISTS auto_assign_organization_products ON public.products;
CREATE TRIGGER auto_assign_organization_products
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION auto_assign_organization();

DROP TRIGGER IF EXISTS auto_assign_organization_workshops ON public.workshops;
CREATE TRIGGER auto_assign_organization_workshops
  BEFORE INSERT ON public.workshops
  FOR EACH ROW EXECUTE FUNCTION auto_assign_organization();

DROP TRIGGER IF EXISTS auto_assign_organization_deliveries ON public.deliveries;
CREATE TRIGGER auto_assign_organization_deliveries
  BEFORE INSERT ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION auto_assign_organization();

DROP TRIGGER IF EXISTS auto_assign_organization_materials ON public.materials;
CREATE TRIGGER auto_assign_organization_materials
  BEFORE INSERT ON public.materials
  FOR EACH ROW EXECUTE FUNCTION auto_assign_organization();

-- ================================
-- 11. MIGRAR DATOS EXISTENTES A DEMO ORGANIZATION
-- ================================

-- Obtener ID de la organización demo
DO $$
DECLARE
  demo_org_id UUID;
BEGIN
  SELECT id INTO demo_org_id FROM public.organizations WHERE slug = 'demo-org';
  
  IF demo_org_id IS NOT NULL THEN
    -- Actualizar orders
    UPDATE public.orders SET organization_id = demo_org_id WHERE organization_id IS NULL;
    
    -- Actualizar products
    UPDATE public.products SET organization_id = demo_org_id WHERE organization_id IS NULL;
    
    -- Actualizar workshops
    UPDATE public.workshops SET organization_id = demo_org_id WHERE organization_id IS NULL;
    
    -- Actualizar deliveries
    UPDATE public.deliveries SET organization_id = demo_org_id WHERE organization_id IS NULL;
    
    -- Actualizar materials
    UPDATE public.materials SET organization_id = demo_org_id WHERE organization_id IS NULL;
    
    -- Actualizar roles (solo los no del sistema)
    UPDATE public.roles SET organization_id = demo_org_id WHERE organization_id IS NULL AND is_system = false;
    
    -- Actualizar user_roles
    UPDATE public.user_roles SET organization_id = demo_org_id WHERE organization_id IS NULL;
    
    -- Actualizar profiles
    UPDATE public.profiles SET organization_id = demo_org_id WHERE organization_id IS NULL;
    
    -- Actualizar tablas relacionadas
    UPDATE public.order_advances SET organization_id = demo_org_id WHERE organization_id IS NULL;
    UPDATE public.delivery_payments SET organization_id = demo_org_id WHERE organization_id IS NULL;
    UPDATE public.material_deliveries SET organization_id = demo_org_id WHERE organization_id IS NULL;
    UPDATE public.workshop_assignments SET organization_id = demo_org_id WHERE organization_id IS NULL;
    UPDATE public.workshop_pricing SET organization_id = demo_org_id WHERE organization_id IS NULL;
  END IF;
END $$;