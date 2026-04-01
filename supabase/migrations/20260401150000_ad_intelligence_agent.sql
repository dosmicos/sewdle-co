-- ═══════════════════════════════════════════════════════════════
-- Ad Intelligence Agent: Analysis Reports, Recommendations Log,
-- Autonomy Level
-- ═══════════════════════════════════════════════════════════════

-- 1. Historial de análisis diarios del agente
CREATE TABLE IF NOT EXISTS ad_analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  report_date DATE NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'daily',

  -- Contenido del reporte
  executive_summary TEXT,
  alerts JSONB,
  top_creatives JSONB,
  fatigued_creatives JSONB,
  recommendations JSONB,
  new_learnings JSONB,

  -- Métricas agregadas de la cuenta
  account_metrics JSONB,

  -- Metadata del modelo
  ai_model TEXT,
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  status TEXT DEFAULT 'completed',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, report_date, report_type)
);

CREATE INDEX idx_analysis_reports_org_date
  ON ad_analysis_reports(organization_id, report_date DESC);

ALTER TABLE ad_analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analysis reports for their org"
  ON ad_analysis_reports FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage analysis reports"
  ON ad_analysis_reports FOR ALL
  USING (true) WITH CHECK (true);

GRANT SELECT ON ad_analysis_reports TO authenticated;
GRANT ALL ON ad_analysis_reports TO service_role;


-- 2. Log de recomendaciones con tracking de accuracy
CREATE TABLE IF NOT EXISTS ad_recommendations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  report_id UUID REFERENCES ad_analysis_reports(id),
  recommendation_date DATE NOT NULL,

  -- La recomendación
  category TEXT,            -- scale, pause, creative_refresh, budget_realloc
  priority TEXT,            -- critical, high, medium, low
  action TEXT NOT NULL,
  rationale TEXT,
  affected_ad_ids TEXT[],
  confidence NUMERIC(3,2),  -- confianza del agente 0.00-1.00

  -- Tracking de ejecución
  executed BOOLEAN DEFAULT FALSE,
  executed_at TIMESTAMPTZ,
  executed_by TEXT,          -- 'human' o 'agent'
  auto_executed BOOLEAN DEFAULT FALSE,

  -- Métricas before (snapshot al momento de la recomendación)
  metrics_before JSONB,     -- {roas, cpa, ctr, frequency, spend}

  -- Outcome tracking (se llena 3-7 días después)
  outcome_measured_at DATE,
  metrics_after JSONB,      -- {roas, cpa, ctr, frequency, spend}
  outcome_delta JSONB,      -- {roas_delta_pct, cpa_delta_pct, ...}
  accuracy_score NUMERIC(3,2), -- 0.00-1.00

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recommendations_org_date
  ON ad_recommendations_log(organization_id, recommendation_date DESC);

CREATE INDEX idx_recommendations_org_category
  ON ad_recommendations_log(organization_id, category);

ALTER TABLE ad_recommendations_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recommendations for their org"
  ON ad_recommendations_log FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage recommendations"
  ON ad_recommendations_log FOR ALL
  USING (true) WITH CHECK (true);

GRANT SELECT ON ad_recommendations_log TO authenticated;
GRANT ALL ON ad_recommendations_log TO service_role;


-- 3. Nivel de autonomía del agente por cuenta de ads
ALTER TABLE ad_accounts
  ADD COLUMN IF NOT EXISTS agent_autonomy_level INTEGER DEFAULT 1;
-- 1 = Observar, 2 = Recomendar, 3 = Actuar

COMMENT ON COLUMN ad_accounts.agent_autonomy_level IS
  'Nivel de autonomía del agente: 1=Observar, 2=Recomendar, 3=Actuar. Se actualiza automáticamente basado en accuracy_score promedio de las últimas 20 recomendaciones.';
