-- Agregar campo para distinguir el propósito del archivo
ALTER TABLE delivery_files 
ADD COLUMN file_category TEXT DEFAULT 'evidence';

-- Actualizar archivos PDF existentes para marcarlos como invoice
UPDATE delivery_files 
SET file_category = 'invoice' 
WHERE file_type = 'application/pdf';

-- Comentario: Los valores serán 'evidence' para evidencia fotográfica e 'invoice' para cuenta de cobro/remisión