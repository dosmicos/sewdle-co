
-- Tabla de carpetas
CREATE TABLE public.messaging_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Columnas nuevas en messaging_conversations
ALTER TABLE public.messaging_conversations
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES messaging_folders(id) ON DELETE SET NULL;

-- RLS para messaging_folders
ALTER TABLE public.messaging_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage folders in their org"
  ON public.messaging_folders FOR ALL
  USING (organization_id = get_current_organization_safe());
