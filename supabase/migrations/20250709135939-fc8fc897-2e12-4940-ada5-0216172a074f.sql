-- Actualizar el bucket delivery-evidence para permitir archivos PDF
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png', 
  'image/webp',
  'image/gif',
  'application/pdf'
]
WHERE id = 'delivery-evidence';