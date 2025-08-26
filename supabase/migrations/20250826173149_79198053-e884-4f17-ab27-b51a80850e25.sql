-- Create missing RLS policies for workshops table

-- Policy for INSERT: Allow authenticated users to create workshops in their organization
CREATE POLICY "Users can create workshops in their organization"
ON public.workshops
FOR INSERT
WITH CHECK (
  organization_id = get_current_organization_safe() 
  AND auth.uid() IS NOT NULL
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
);

-- Policy for UPDATE: Allow users to update workshops in their organization with appropriate roles
CREATE POLICY "Users can update workshops in their organization"
ON public.workshops
FOR UPDATE
USING (
  organization_id = get_current_organization_safe()
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
);

-- Policy for DELETE: Only allow administrators to delete workshops
CREATE POLICY "Administrators can delete workshops in their organization"
ON public.workshops  
FOR DELETE
USING (
  organization_id = get_current_organization_safe()
  AND get_current_user_role_safe() = 'Administrador'
);

-- Make organization_id NOT NULL to prevent RLS issues
ALTER TABLE public.workshops 
ALTER COLUMN organization_id SET NOT NULL;