
-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Authenticated users can view workshops" ON workshops;
DROP POLICY IF EXISTS "Authenticated users can create workshops" ON workshops;
DROP POLICY IF EXISTS "Authenticated users can update workshops" ON workshops;
DROP POLICY IF EXISTS "Authenticated users can delete workshops" ON workshops;

-- Asegurar que la tabla workshops tiene todas las columnas necesarias
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS specialties text[];
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS working_hours_start time;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS working_hours_end time;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS notes text;

-- Habilitar Row Level Security
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;

-- Política para que usuarios autenticados puedan ver todos los talleres
CREATE POLICY "Authenticated users can view workshops" 
  ON workshops 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Política para que usuarios autenticados puedan crear talleres
CREATE POLICY "Authenticated users can create workshops" 
  ON workshops 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Política para que usuarios autenticados puedan actualizar talleres
CREATE POLICY "Authenticated users can update workshops" 
  ON workshops 
  FOR UPDATE 
  TO authenticated 
  USING (true);

-- Política para que usuarios autenticados puedan eliminar talleres
CREATE POLICY "Authenticated users can delete workshops" 
  ON workshops 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_workshops_updated_at ON workshops;
CREATE TRIGGER update_workshops_updated_at 
  BEFORE UPDATE ON workshops 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
