-- Create storage bucket for messaging media (images, audio, documents)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'messaging-media', 
  'messaging-media', 
  true,
  20971520, -- 20MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/wav', 'video/mp4', 'video/webm', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to read files
CREATE POLICY "Allow public read access on messaging-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'messaging-media');

-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated upload to messaging-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'messaging-media');

-- Allow service role to manage all files
CREATE POLICY "Allow service role full access on messaging-media"
ON storage.objects
USING (bucket_id = 'messaging-media')
WITH CHECK (bucket_id = 'messaging-media');