-- Tabla de formatos estratégicos de contenido
-- Permite crear/editar/desactivar formatos sin tocar código
-- Ejemplos: "GRWM mamá con bebé", "Outfits de bebés", "Carrusel educativo"

CREATE TABLE IF NOT EXISTS content_formats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  color TEXT DEFAULT '#6b7280',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Índice para queries frecuentes
CREATE INDEX idx_content_formats_org_active ON content_formats(organization_id, is_active);

-- RLS
ALTER TABLE content_formats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view content formats of their org"
  ON content_formats FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert content formats for their org"
  ON content_formats FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update content formats of their org"
  ON content_formats FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete content formats of their org"
  ON content_formats FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Agregar columna content_format_id a marketing_events
ALTER TABLE marketing_events
  ADD COLUMN IF NOT EXISTS content_format_id UUID REFERENCES content_formats(id) ON DELETE SET NULL;

-- Agregar columna content_format_id a content_ideas
ALTER TABLE content_ideas
  ADD COLUMN IF NOT EXISTS content_format_id UUID REFERENCES content_formats(id) ON DELETE SET NULL;
