-- Drop the existing policy that checks 'materials' permission
DROP POLICY IF EXISTS "Users can manage materials in their organization" ON public.materials;

-- Create new policy that checks 'insumos' permission (which is what the Diseñador role actually has)
CREATE POLICY "Users can manage materials in their organization" 
ON public.materials 
FOR ALL 
USING (
  (organization_id = get_current_organization_safe()) 
  AND (
    is_current_user_admin() 
    OR has_permission(auth.uid(), 'insumos'::text, 'edit'::text)
  )
)
WITH CHECK (organization_id = get_current_organization_safe());