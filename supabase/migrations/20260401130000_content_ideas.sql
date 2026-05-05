CREATE TABLE IF NOT EXISTS content_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT, -- donde se encontró (TikTok trending, competitor, audience request, etc.)
  reference_url TEXT, -- link de referencia (TikTok video, tweet, article)
  content_type TEXT, -- reel, story, post, carousel, etc.
  platform TEXT[], -- instagram, tiktok, facebook, etc.
  suggested_date DATE, -- fecha sugerida para publicar
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'approved', 'rejected', 'converted')),
  submitted_by TEXT, -- quien encontró/propuso la idea
  reviewed_by TEXT, -- quien aprobó/rechazó
  review_notes TEXT, -- notas del revisor
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view content_ideas in their org" ON content_ideas
  FOR SELECT USING (org_id = get_current_organization_safe());

CREATE POLICY "Users can insert content_ideas in their org" ON content_ideas
  FOR INSERT WITH CHECK (org_id = get_current_organization_safe());

CREATE POLICY "Users can update content_ideas in their org" ON content_ideas
  FOR UPDATE USING (org_id = get_current_organization_safe());

CREATE POLICY "Users can delete content_ideas in their org" ON content_ideas
  FOR DELETE USING (org_id = get_current_organization_safe());

CREATE INDEX idx_content_ideas_org ON content_ideas(org_id);
CREATE INDEX idx_content_ideas_status ON content_ideas(status);
