
-- Actualizar políticas de delivery_files para usar permisos
DROP POLICY IF EXISTS "Users can view delivery files based on permissions" ON public.delivery_files;
DROP POLICY IF EXISTS "Users can delete delivery files based on permissions" ON public.delivery_files;

-- Nueva política SELECT basada en permisos de deliveries
CREATE POLICY "Users can view delivery files based on permissions" 
ON public.delivery_files 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.id = delivery_files.delivery_id 
    AND d.organization_id = get_current_organization_safe()
    AND has_permission(auth.uid(), 'deliveries', 'view')
  )
);

-- Nueva política DELETE basada en permisos
CREATE POLICY "Users can delete delivery files based on permissions" 
ON public.delivery_files 
FOR DELETE 
TO authenticated
USING (
  has_permission(auth.uid(), 'deliveries', 'delete')
  OR uploaded_by = auth.uid()
);

-- Actualizar delivery_payments
DROP POLICY IF EXISTS "Admins and designers can manage delivery payments" ON public.delivery_payments;

CREATE POLICY "Users can view delivery payments based on permissions" 
ON public.delivery_payments 
FOR SELECT 
TO authenticated
USING (
  organization_id = get_current_organization_safe()
  AND has_permission(auth.uid(), 'deliveries', 'view')
);

CREATE POLICY "Users can manage delivery payments based on permissions" 
ON public.delivery_payments 
FOR ALL 
TO authenticated
USING (
  organization_id = get_current_organization_safe()
  AND has_permission(auth.uid(), 'finances', 'edit')
);

-- Actualizar order_files
DROP POLICY IF EXISTS "Admin users can manage all order files in their organization" ON public.order_files;

CREATE POLICY "Users can view order files based on permissions" 
ON public.order_files 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_files.order_id 
    AND o.organization_id = get_current_organization_safe()
    AND has_permission(auth.uid(), 'orders', 'view')
  )
);

CREATE POLICY "Users can manage order files based on permissions" 
ON public.order_files 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_files.order_id 
    AND o.organization_id = get_current_organization_safe()
  )
  AND has_permission(auth.uid(), 'orders', 'edit')
);
