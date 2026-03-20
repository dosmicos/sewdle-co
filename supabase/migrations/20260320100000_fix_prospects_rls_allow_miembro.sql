-- Fix: Allow any authenticated org member to create/update prospects
-- Previously only "Administrador" and "Diseñador" could create/update,
-- but custom roles like "Reclutamiento" also need access.
-- Simplified to: any authenticated user in the organization can manage prospects.

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins and designers can create prospects" ON public.workshop_prospects;
DROP POLICY IF EXISTS "Admins and designers can update prospects" ON public.workshop_prospects;
DROP POLICY IF EXISTS "Org members can create prospects" ON public.workshop_prospects;
DROP POLICY IF EXISTS "Org members can update prospects" ON public.workshop_prospects;

-- Any authenticated org member can create prospects
CREATE POLICY "Org members can create prospects"
ON public.workshop_prospects
FOR INSERT
WITH CHECK (
  organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL
);

-- Any authenticated org member can update prospects
CREATE POLICY "Org members can update prospects"
ON public.workshop_prospects
FOR UPDATE
USING (
  organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL
);

-- Fix prospect_activities policies
DROP POLICY IF EXISTS "Admins and designers can create activities" ON public.prospect_activities;
DROP POLICY IF EXISTS "Admins and designers can update activities" ON public.prospect_activities;
DROP POLICY IF EXISTS "Org members can create activities" ON public.prospect_activities;
DROP POLICY IF EXISTS "Org members can update activities" ON public.prospect_activities;

CREATE POLICY "Org members can create activities"
ON public.prospect_activities
FOR INSERT
WITH CHECK (
  organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Org members can update activities"
ON public.prospect_activities
FOR UPDATE
USING (
  organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL
);

-- Fix prospect_files policies
DROP POLICY IF EXISTS "Admins and designers can upload files" ON public.prospect_files;
DROP POLICY IF EXISTS "Admins and designers can delete files" ON public.prospect_files;
DROP POLICY IF EXISTS "Org members can upload files" ON public.prospect_files;
DROP POLICY IF EXISTS "Org members can delete files" ON public.prospect_files;

CREATE POLICY "Org members can upload files"
ON public.prospect_files
FOR INSERT
WITH CHECK (
  organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Org members can delete files"
ON public.prospect_files
FOR DELETE
USING (
  organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL
);
