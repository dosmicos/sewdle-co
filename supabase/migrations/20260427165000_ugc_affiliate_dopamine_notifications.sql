-- UGC Affiliate Dopamine Notifications — Phase 1
-- WhatsApp template notification layer for CMD affiliate retention.

CREATE TABLE IF NOT EXISTS ugc_affiliate_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN (
    'sale',
    'first_sale',
    'rank_top5',
    'rank_proximity',
    'weekly_challenge'
  )),
  template_name text NOT NULL,
  template_language text NOT NULL DEFAULT 'es_CO',
  is_enabled boolean NOT NULL DEFAULT false,
  description text,
  body_parameters jsonb NOT NULL DEFAULT '[]'::jsonb,
  sample_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, notification_type)
);

CREATE TABLE IF NOT EXISTS ugc_affiliate_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES ugc_creators(id) ON DELETE CASCADE,
  discount_link_id uuid REFERENCES ugc_discount_links(id) ON DELETE SET NULL,
  attributed_order_id uuid REFERENCES ugc_attributed_orders(id) ON DELETE SET NULL,
  notification_type text NOT NULL CHECK (notification_type IN (
    'sale',
    'first_sale',
    'rank_top5',
    'rank_proximity',
    'weekly_challenge'
  )),
  whatsapp_number text,
  template_name text,
  template_language text NOT NULL DEFAULT 'es_CO',
  template_parameters jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_preview text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'dry_run',
    'skipped_disabled',
    'skipped_no_phone',
    'skipped_duplicate',
    'sent',
    'failed'
  )),
  external_message_id text,
  period_start date,
  rank integer,
  error jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ugc_affiliate_notifications_org_created
  ON ugc_affiliate_notifications(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ugc_affiliate_notifications_creator_created
  ON ugc_affiliate_notifications(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ugc_affiliate_notifications_status
  ON ugc_affiliate_notifications(status);

-- Prevent duplicate order-triggered notifications.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ugc_affiliate_notifications_order_type_unique
  ON ugc_affiliate_notifications(attributed_order_id, notification_type)
  WHERE attributed_order_id IS NOT NULL
    AND notification_type IN ('sale', 'first_sale');

-- Prevent repeated rank/proximity pings for the same creator/rank/week.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ugc_affiliate_notifications_rank_week_unique
  ON ugc_affiliate_notifications(organization_id, creator_id, notification_type, period_start, rank)
  WHERE notification_type IN ('rank_top5', 'rank_proximity')
    AND period_start IS NOT NULL
    AND rank IS NOT NULL;

-- Prevent repeated weekly challenge sends for a creator in the same week.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ugc_affiliate_notifications_weekly_unique
  ON ugc_affiliate_notifications(organization_id, creator_id, notification_type, period_start)
  WHERE notification_type = 'weekly_challenge'
    AND period_start IS NOT NULL;

ALTER TABLE ugc_affiliate_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ugc_affiliate_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ugc_affiliate_notification_settings_org_access" ON ugc_affiliate_notification_settings
  FOR ALL USING (organization_id = get_current_organization_safe())
  WITH CHECK (organization_id = get_current_organization_safe());

CREATE POLICY "ugc_affiliate_notifications_org_access" ON ugc_affiliate_notifications
  FOR ALL USING (organization_id = get_current_organization_safe())
  WITH CHECK (organization_id = get_current_organization_safe());

CREATE OR REPLACE FUNCTION update_ugc_affiliate_notification_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ugc_affiliate_notification_settings_updated_at ON ugc_affiliate_notification_settings;
CREATE TRIGGER ugc_affiliate_notification_settings_updated_at
  BEFORE UPDATE ON ugc_affiliate_notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_ugc_affiliate_notification_settings_updated_at();

-- Seed Dosmicos Phase 1 templates. Disabled by default until Meta approves templates.
-- After templates exist in Meta, enable with:
-- UPDATE ugc_affiliate_notification_settings SET is_enabled = true WHERE organization_id = '<org-id>';
INSERT INTO ugc_affiliate_notification_settings (
  organization_id,
  notification_type,
  template_name,
  template_language,
  is_enabled,
  description,
  body_parameters,
  sample_message
)
SELECT
  o.id,
  v.notification_type,
  v.template_name,
  'es_CO',
  false,
  v.description,
  v.body_parameters::jsonb,
  v.sample_message
FROM organizations o
CROSS JOIN (VALUES
  (
    'sale',
    'dosmicos_cmd_sale_v1',
    'Venta nueva por link CMD',
    '["creator_name", "commission_amount", "pending_balance", "week_rank", "creator_link"]',
    '💛 Dosmicos CMD: ¡vendiste con tu link, {{1}}! Acabas de ganar {{2}}. Tu saldo acumulado va en {{3}} y estás en el puesto #{{4}} esta semana. Sigue compartiendo tu link: {{5}}'
  ),
  (
    'first_sale',
    'dosmicos_cmd_first_sale_v1',
    'Primera venta por link CMD',
    '["creator_name", "commission_amount", "pending_balance", "creator_link"]',
    '💛 Dosmicos CMD: {{1}}, ¡lograste tu primera venta con tu link! Acabas de ganar {{2}} y tu saldo va en {{3}}. Esta es la prueba de que tu comunidad sí compra cuando recomiendas algo real. Comparte de nuevo tu link hoy: {{4}}'
  ),
  (
    'rank_top5',
    'dosmicos_cmd_rank_top5_v1',
    'Entrada o permanencia en top 5 semanal CMD',
    '["creator_name", "week_rank", "week_commission", "creator_link"]',
    '🏆 Dosmicos CMD: {{1}}, estás en el top 5 esta semana. Vas en el puesto #{{2}} con {{3}} en comisión. Publica otra historia hoy y defiende tu lugar: {{4}}'
  ),
  (
    'rank_proximity',
    'dosmicos_cmd_rank_proximity_v1',
    'Creadora cerca del top 5 semanal CMD',
    '["creator_name", "week_rank", "gap_to_top5", "week_commission", "creator_link"]',
    '👀 Dosmicos CMD: {{1}}, estás en el puesto #{{2}} esta semana. Te faltan aprox. {{3}} para entrar al top 5. Ya llevas {{4}} en comisión. Comparte tu link hoy: {{5}}'
  ),
  (
    'weekly_challenge',
    'dosmicos_cmd_weekly_challenge_v1',
    'Reto semanal CMD',
    '["creator_name", "challenge_title", "challenge_prompt", "creator_link"]',
    '💛 Reto Dosmicos CMD de la semana, {{1}}: {{2}}. Idea para publicar: {{3}}. Recuerda poner tu link para que tu comunidad reciba descuento y tú ganes comisión: {{4}}'
  )
) AS v(notification_type, template_name, description, body_parameters, sample_message)
WHERE o.slug = 'dosmicos-org'
ON CONFLICT (organization_id, notification_type) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  template_language = EXCLUDED.template_language,
  description = EXCLUDED.description,
  body_parameters = EXCLUDED.body_parameters,
  sample_message = EXCLUDED.sample_message,
  updated_at = now();

-- Weekly challenge cron: every Tuesday 9:00 AM Colombia (14:00 UTC).
-- It will no-op while weekly_challenge setting is disabled.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('ugc-affiliate-weekly-challenge')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'ugc-affiliate-weekly-challenge'
);

SELECT cron.schedule(
  'ugc-affiliate-weekly-challenge',
  '0 14 * * 2',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/send-ugc-affiliate-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'action', 'send_weekly_challenge',
      'organizationSlug', 'dosmicos-org',
      'dryRun', false,
      'challengeTitle', '3 historias reales usando Dosmicos',
      'challengePrompt', 'Muestra cómo usas Dosmicos en la vida real: frío, sueño, bebé que se destapa o salida familiar. Cierra con tu link.',
      'maxSend', 200
    )
  );
  $$
);
