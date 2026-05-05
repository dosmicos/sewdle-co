
-- Create storage bucket for order files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'order-files',
  'order-files',
  true,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
);

-- Create policy to allow authenticated users to upload order files
CREATE POLICY "Authenticated users can upload order files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'order-files' AND
  auth.role() = 'authenticated'
);

-- Create policy to allow public read access to order files
CREATE POLICY "Public can view order files"
ON storage.objects FOR SELECT
USING (bucket_id = 'order-files');

-- Create policy to allow users to update order files
CREATE POLICY "Users can update order files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'order-files' AND
  auth.role() = 'authenticated'
);

-- Create policy to allow users to delete order files
CREATE POLICY "Users can delete order files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'order-files' AND
  auth.role() = 'authenticated'
);
