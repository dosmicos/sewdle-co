-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admin users can delete material deliveries" ON public.material_deliveries;

-- Create new policy that allows both Administrador and Diseñador roles to delete
CREATE POLICY "Admin and designer users can delete material deliveries" 
ON public.material_deliveries 
FOR DELETE 
USING (get_current_user_role_safe() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text]));