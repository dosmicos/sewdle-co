-- Fix: Allow "Miembro" role to create and update prospects
-- Previously only "Administrador" and "Diseñador" could create/update prospects,
-- but "Miembro" users also need access to the Reclutamiento module.

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins and designers can create prospects" ON public.workshop_prospects;
DROP POLICY IF EXISTS "Admins and designers can update prospects" ON public.workshop_prospects;

-- Recreate INSERT policy allowing Miembro role
CREATE POLICY "Org members can create prospects"
ON public.workshop_prospects
FOR INSERT
WITH CHECK (
  organization_id = get_current_organization_safe()
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador', 'Miembro'])
);

-- Recreate UPDATE policy allowing Miembro role
CREATE POLICY "Org members can update prospects"
ON public.workshop_prospects
FOR UPDATE
USING (
  organization_id = get_current_organization_safe()
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador', 'Miembro'])
);

-- Also fix prospect_activities policies
DROP POLICY IF EXISTS "Admins and designers can create activities" ON public.prospect_activities;
DROP POLICY IF EXISTS "Admins and designers can update activities" ON public.prospect_activities;

CREATE POLICY "Org members can create activities"
ON public.prospect_activities
FOR INSERT
WITH CHECK (
  organization_id = get_current_organization_safe()
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador', 'Miembro'])
);

CREATE POLICY "Org members can update activities"
ON public.prospect_activities
FOR UPDATE
USING (
  organization_id = get_current_organization_safe()
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador', 'Miembro'])
);

-- Also fix prospect_files policies
DROP POLICY IF EXISTS "Admins and designers can upload files" ON public.prospect_files;
DROP POLICY IF EXISTS "Admins and designers can delete files" ON public.prospect_files;

CREATE POLICY "Org members can upload files"
ON public.prospect_files
FOR INSERT
WITH CHECK (
  organization_id = get_current_organization_safe()
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador', 'Miembro'])
);

CREATE POLICY "Org members can delete files"
ON public.prospect_files
FOR DELETE
USING (
  organization_id = get_current_organization_safe()
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador', 'Miembro'])
);
