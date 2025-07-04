
-- Agregar foreign key entre delivery_files.uploaded_by y profiles.id
ALTER TABLE public.delivery_files 
ADD CONSTRAINT delivery_files_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_delivery_files_uploaded_by ON public.delivery_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_delivery_files_delivery_id ON public.delivery_files(delivery_id);
