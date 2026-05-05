-- CRITICAL SECURITY FIX: Fix order_files RLS policies
-- All current policies use 'true' which allows public access to business documents
-- This exposes sensitive order information, file names, and document URLs

-- Step 1: Drop all insecure policies that allow unrestricted public access
DROP POLICY IF EXISTS "Users can create order files" ON public.order_files;
DROP POLICY IF EXISTS "Users can delete order files" ON public.order_files;
DROP POLICY IF EXISTS "Users can update order files" ON public.order_files;
DROP POLICY IF EXISTS "Users can view order files" ON public.order_files;

-- Step 2: Create secure policies that restrict access based on organization membership
-- Users can only access files for orders within their organization

CREATE POLICY "Users can view order files in their organization"
ON public.order_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_files.order_id
    AND o.organization_id = get_current_organization_safe()
  )
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can create order files in their organization"
ON public.order_files
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_files.order_id
    AND o.organization_id = get_current_organization_safe()
  )
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update order files in their organization"
ON public.order_files
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_files.order_id
    AND o.organization_id = get_current_organization_safe()
  )
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_files.order_id
    AND o.organization_id = get_current_organization_safe()
  )
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete order files in their organization"
ON public.order_files
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_files.order_id
    AND o.organization_id = get_current_organization_safe()
  )
  AND auth.uid() IS NOT NULL
);

-- Step 3: Additional security - restrict sensitive operations to admin/designer roles only
CREATE POLICY "Admin users can manage all order files in their organization"
ON public.order_files
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_files.order_id
    AND o.organization_id = get_current_organization_safe()
  )
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_files.order_id
    AND o.organization_id = get_current_organization_safe()
  )
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
);

-- Step 4: Verify RLS is enabled
DO $$
BEGIN
  -- Double-check that RLS is enabled on order_files
  IF NOT EXISTS (
    SELECT 1 FROM pg_class 
    WHERE relname = 'order_files' 
    AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on order_files table - this is a critical security issue';
  END IF;
  
  RAISE NOTICE 'Security fix completed successfully - RLS is properly configured for order_files';
END $$;

-- Step 5: Check for any existing storage buckets that might need similar protection
-- Note: This is informational only, storage policies need to be handled separately
DO $$
DECLARE
  bucket_record RECORD;
BEGIN
  FOR bucket_record IN 
    SELECT id, name, public 
    FROM storage.buckets 
    WHERE name LIKE '%order%' OR name LIKE '%file%'
  LOOP
    IF bucket_record.public = true THEN
      RAISE WARNING 'Storage bucket "%" is public - consider reviewing storage policies for order files', bucket_record.name;
    END IF;
  END LOOP;
END $$;