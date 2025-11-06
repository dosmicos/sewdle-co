-- Tabla para guardar filtros preestablecidos
CREATE TABLE saved_picking_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_saved_filters_org ON saved_picking_filters(organization_id);
CREATE INDEX idx_saved_filters_user ON saved_picking_filters(user_id);
CREATE INDEX idx_saved_filters_shared ON saved_picking_filters(organization_id, is_shared);

-- RLS Policies
ALTER TABLE saved_picking_filters ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver sus propios filtros y los compartidos de su organización
CREATE POLICY "Users can view own and shared filters"
ON saved_picking_filters
FOR SELECT
USING (
  user_id = auth.uid() 
  OR (is_shared = true AND organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ))
);

-- Los usuarios pueden crear sus propios filtros
CREATE POLICY "Users can create own filters"
ON saved_picking_filters
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Los usuarios pueden actualizar sus propios filtros
CREATE POLICY "Users can update own filters"
ON saved_picking_filters
FOR UPDATE
USING (user_id = auth.uid());

-- Los usuarios pueden eliminar sus propios filtros
CREATE POLICY "Users can delete own filters"
ON saved_picking_filters
FOR DELETE
USING (user_id = auth.uid());