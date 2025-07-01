
-- Create table for delivery evidence files
CREATE TABLE public.delivery_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Add RLS policies for delivery_files
ALTER TABLE public.delivery_files ENABLE ROW LEVEL SECURITY;

-- Users can view delivery files based on delivery permissions
CREATE POLICY "Users can view delivery files based on permissions"
ON public.delivery_files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.deliveries d 
    WHERE d.id = delivery_id 
    AND (
      -- Admins and designers can see all
      get_current_user_role_safe() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text])
      OR 
      -- Workshop users can see their workshop's deliveries
      (get_current_user_role_safe() = 'Taller'::text AND d.workshop_id IN (
        SELECT ur.workshop_id FROM user_roles ur 
        WHERE ur.user_id = auth.uid() AND ur.workshop_id IS NOT NULL
      ))
    )
  )
);

-- Users can upload delivery files based on delivery permissions
CREATE POLICY "Users can upload delivery files based on permissions"
ON public.delivery_files FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.deliveries d 
    WHERE d.id = delivery_id 
    AND (
      -- Admins and designers can upload to any delivery
      get_current_user_role_safe() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text])
      OR 
      -- Workshop users can upload to their workshop's deliveries
      (get_current_user_role_safe() = 'Taller'::text AND d.workshop_id IN (
        SELECT ur.workshop_id FROM user_roles ur 
        WHERE ur.user_id = auth.uid() AND ur.workshop_id IS NOT NULL
      ))
    )
  )
);

-- Users can delete delivery files based on permissions
CREATE POLICY "Users can delete delivery files based on permissions"
ON public.delivery_files FOR DELETE
USING (
  -- Only admins can delete delivery files
  get_current_user_role_safe() = 'Administrador'::text
  OR 
  -- Users can delete their own uploaded files
  uploaded_by = auth.uid()
);

-- Create storage bucket for delivery evidence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-evidence',
  'delivery-evidence',
  true,
  5242880, -- 5MB limit per file
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
);

-- Create storage policies for delivery evidence
CREATE POLICY "Authenticated users can upload delivery evidence"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'delivery-evidence' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Public can view delivery evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-evidence');

CREATE POLICY "Users can update delivery evidence"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'delivery-evidence' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete delivery evidence"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'delivery-evidence' AND
  auth.role() = 'authenticated'
);
