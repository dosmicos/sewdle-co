-- Cron Jobs para Ad Intelligence Agent
-- 3 jobs: compute-intelligence, daily-ad-analysis, review-agent-accuracy

-- Asegurar extensiones
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ═══════════════════════════════════════════════════════════════
-- 1. Compute Intelligence Daily — 7:30 AM Colombia (12:30 UTC)
--    Actualiza lifecycle, patterns y fatigue signals
-- ═══════════════════════════════════════════════════════════════

SELECT cron.unschedule('compute-intelligence-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'compute-intelligence-daily'
);

SELECT cron.schedule(
  'compute-intelligence-daily',
  '30 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/compute-ad-intelligence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer TU_SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'meta'
    AND aa.is_active = true;
  $$
);

-- ═══════════════════════════════════════════════════════════════
-- 2. Daily Ad Analysis — 8:00 AM Colombia (13:00 UTC)
--    Ejecuta el agente AI de análisis con Mem0
-- ═══════════════════════════════════════════════════════════════

SELECT cron.unschedule('daily-ad-analysis-8am')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-ad-analysis-8am'
);

SELECT cron.schedule(
  'daily-ad-analysis-8am',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/daily-ad-analysis',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer TU_SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'meta'
    AND aa.is_active = true;
  $$
);

-- ═══════════════════════════════════════════════════════════════
-- 3. Review Agent Accuracy — Domingos 10pm Colombia (03:00 UTC lunes)
--    Evalúa accuracy, actualiza autonomía, recalcula benchmarks
-- ═══════════════════════════════════════════════════════════════

SELECT cron.unschedule('review-agent-accuracy-weekly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'review-agent-accuracy-weekly'
);

SELECT cron.schedule(
  'review-agent-accuracy-weekly',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/review-agent-accuracy',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer TU_SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'meta'
    AND aa.is_active = true;
  $$
);
