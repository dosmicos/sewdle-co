-- Holiday Suggestions table for AI-powered marketing calendar suggestions
CREATE TABLE public.holiday_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('co', 'us', 'both')),
  category TEXT NOT NULL CHECK (category IN ('cultural', 'commercial', 'brand', 'seasonal')),
  expected_impact TEXT NOT NULL CHECK (expected_impact IN ('high', 'medium', 'low')),
  why_now TEXT,
  quarter_peak TEXT CHECK (quarter_peak IN ('q1', 'q2', 'q3', 'q4')),
  suggested_event_type TEXT,
  campaign_idea TEXT,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'dismissed')),
  is_ai_generated BOOLEAN DEFAULT true,
  source_model TEXT DEFAULT 'gemini-2.0-flash',
  year INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name, date)
);

-- RLS
ALTER TABLE public.holiday_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org suggestions" ON public.holiday_suggestions
  FOR SELECT USING (org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own org suggestions" ON public.holiday_suggestions
  FOR UPDATE USING (org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org suggestions" ON public.holiday_suggestions
  FOR INSERT WITH CHECK (org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Service role can manage all" ON public.holiday_suggestions
  FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_holiday_suggestions_org_year ON public.holiday_suggestions(org_id, year);
CREATE INDEX idx_holiday_suggestions_date ON public.holiday_suggestions(date);
CREATE INDEX idx_holiday_suggestions_status ON public.holiday_suggestions(org_id, status);
