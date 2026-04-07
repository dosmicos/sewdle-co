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


-- ═══════════════════════════════════════════════════════════════
-- Agent Knowledge Tables (reemplaza Mem0)
-- ═══════════════════════════════════════════════════════════════

-- 4. Learnings del agente — conocimiento acumulado
CREATE TABLE IF NOT EXISTS agent_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence TEXT DEFAULT 'medium',
  evidence TEXT,
  source TEXT DEFAULT 'agent',
  sample_size INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  superseded_by UUID REFERENCES agent_learnings(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_learnings_org_category
  ON agent_learnings(organization_id, category);

CREATE INDEX IF NOT EXISTS idx_agent_learnings_active
  ON agent_learnings(organization_id, is_active);

ALTER TABLE agent_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agent learnings for their org"
  ON agent_learnings FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Service role can manage agent learnings"
  ON agent_learnings FOR ALL
  USING (true) WITH CHECK (true);

GRANT SELECT ON agent_learnings TO authenticated;
GRANT ALL ON agent_learnings TO service_role;


-- 5. Benchmarks del agente — umbrales de métricas
CREATE TABLE IF NOT EXISTS agent_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  metric TEXT NOT NULL,
  value_good NUMERIC,
  value_avg NUMERIC,
  value_bad NUMERIC,
  source TEXT DEFAULT 'initial',
  calculated_from_days INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, metric)
);

ALTER TABLE agent_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agent benchmarks for their org"
  ON agent_benchmarks FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Service role can manage agent benchmarks"
  ON agent_benchmarks FOR ALL
  USING (true) WITH CHECK (true);

GRANT SELECT ON agent_benchmarks TO authenticated;
GRANT ALL ON agent_benchmarks TO service_role;


-- 6. Reglas aprendidas del agente
CREATE TABLE IF NOT EXISTS agent_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  rule TEXT NOT NULL,
  learned_from TEXT,
  learned_date DATE,
  times_applied INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agent rules for their org"
  ON agent_rules FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Service role can manage agent rules"
  ON agent_rules FOR ALL
  USING (true) WITH CHECK (true);

GRANT SELECT ON agent_rules TO authenticated;
GRANT ALL ON agent_rules TO service_role;


-- ═══════════════════════════════════════════════════════════════
-- Seed Data: Dosmicos (org cb497af2-3f29-4bb4-be53-91b7f19e5ffb)
-- ═══════════════════════════════════════════════════════════════

-- Benchmarks iniciales
INSERT INTO agent_benchmarks (organization_id, metric, value_good, value_avg, value_bad, source) VALUES
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'roas', 3.0, 2.0, 1.5, 'initial'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'cpa', 25000, 35000, 50000, 'initial'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'ctr', 2.0, 1.2, 0.8, 'initial'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'frequency', 1.5, 2.5, 3.5, 'initial'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'cpm', 15000, 25000, 40000, 'initial'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'hook_rate', 30, 20, 10, 'initial')
ON CONFLICT (organization_id, metric) DO NOTHING;

-- Learnings iniciales
INSERT INTO agent_learnings (organization_id, category, content, confidence, evidence, source) VALUES
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'creative', 'Videos cortos (15-30s) con hook en primeros 3 segundos tienen mejor CTR', 'high', 'Patrón observado en top performers Q1 2026', 'initial_seed'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'creative', 'UGC content supera a branded content en ROAS por 40% promedio', 'high', 'Análisis comparativo últimos 3 meses', 'initial_seed'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'audience', 'Lookalike 1% de compradores últimos 30 días es la audiencia más rentable', 'high', 'CPA 30% menor que otras audiencias', 'initial_seed'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'audience', 'Retargeting de visitantes 1-7 días tiene ROAS 3x vs 8-30 días', 'medium', 'Basado en datos de pixel Meta', 'initial_seed'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'budget', 'No escalar más de 20% diario en campañas ganadoras para evitar reset de learning', 'high', 'Best practice Meta + experiencia propia', 'initial_seed'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'budget', 'Mejor hora para cambios de presupuesto: 12am-4am zona horaria de la cuenta', 'medium', 'Recomendación Meta Business Help Center', 'initial_seed'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'fatigue', 'Frequency > 3.0 en 7 días indica fatiga creativa, rotar inmediatamente', 'high', 'Correlación con caída de CTR en 85% de casos', 'initial_seed'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'fatigue', 'CTR cayendo >20% en 3 días consecutivos = señal temprana de fatiga', 'high', 'Patrón consistente en últimos 6 meses', 'initial_seed'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'seasonality', 'Viernes y sábados tienen CPA 15% menor para e-commerce moda', 'medium', 'Datos históricos Dosmicos 2025', 'initial_seed'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'seasonality', 'Enero es mes más débil, reducir spend 30% y enfocarse en retargeting', 'medium', 'Tendencia consistente 2024-2025', 'initial_seed'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'platform', 'Instagram Reels genera 2x más conversiones que Feed para Dosmicos', 'high', 'Datos de placement breakdown últimos 90 días', 'initial_seed'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'platform', 'Advantage+ Shopping campaigns tienen mejor ROAS que campañas manuales para catálogo', 'medium', 'A/B test Febrero 2026', 'initial_seed')
ON CONFLICT DO NOTHING;
