
-- Actualizar la política de shopify_orders para usar permisos en lugar de roles hardcodeados
DROP POLICY IF EXISTS "Admins can view shopify orders in their organization only" ON public.shopify_orders;

-- Crear nueva política basada en permisos
CREATE POLICY "Users can view shopify orders based on permissions" 
ON public.shopify_orders 
FOR SELECT 
TO authenticated
USING (
  organization_id = get_current_organization_safe()
  AND has_permission(auth.uid(), 'orders', 'view')
);

-- También actualizar políticas de UPDATE y DELETE si existen
DROP POLICY IF EXISTS "Admins can update shopify orders in their organization only" ON public.shopify_orders;
DROP POLICY IF EXISTS "Admins can delete shopify orders in their organization only" ON public.shopify_orders;
DROP POLICY IF EXISTS "Admins can insert shopify orders in their organization only" ON public.shopify_orders;

CREATE POLICY "Users can update shopify orders based on permissions" 
ON public.shopify_orders 
FOR UPDATE 
TO authenticated
USING (
  organization_id = get_current_organization_safe()
  AND has_permission(auth.uid(), 'orders', 'edit')
);

CREATE POLICY "Users can delete shopify orders based on permissions" 
ON public.shopify_orders 
FOR DELETE 
TO authenticated
USING (
  organization_id = get_current_organization_safe()
  AND has_permission(auth.uid(), 'orders', 'delete')
);

CREATE POLICY "Users can insert shopify orders based on permissions" 
ON public.shopify_orders 
FOR INSERT 
TO authenticated
WITH CHECK (
  organization_id = get_current_organization_safe()
  AND has_permission(auth.uid(), 'orders', 'create')
);
