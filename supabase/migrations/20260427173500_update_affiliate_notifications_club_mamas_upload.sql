-- Update UGC affiliate dopamine notifications to Club de Mamás Dosmicos + upload-link CTA.
-- Templates remain disabled until approved in Meta.

UPDATE ugc_affiliate_notification_settings s
SET
  template_name = v.template_name,
  body_parameters = v.body_parameters::jsonb,
  sample_message = v.sample_message,
  description = v.description,
  is_enabled = false,
  updated_at = now()
FROM (VALUES
  (
    'sale',
    'dosmicos_club_mamas_sale_v1',
    'Venta nueva por link Club de Mamás Dosmicos con CTA de upload para ADS',
    '["creator_name", "commission_amount", "pending_balance", "week_rank", "upload_link", "creator_link"]',
    '💛 Club de Mamás Dosmicos: ¡vendiste con tu link, {{1}}! Acabas de ganar {{2}}. Tu saldo acumulado va en {{3}} y estás en el puesto #{{4}} esta semana. Sube el contenido que usaste o un video corto aquí para que podamos revisarlo para ADS: {{5}}. Tu link de descuento: {{6}}'
  ),
  (
    'first_sale',
    'dosmicos_club_mamas_first_sale_v1',
    'Primera venta por link Club de Mamás Dosmicos con CTA de upload para ADS',
    '["creator_name", "commission_amount", "pending_balance", "upload_link", "creator_link"]',
    '💛 Club de Mamás Dosmicos: {{1}}, ¡lograste tu primera venta con tu link! Ganaste {{2}} y tu saldo va en {{3}}. Si tienes foto/video/testimonio de lo que publicaste, súbelo aquí para que podamos revisarlo para ADS: {{4}}. Tu link de descuento: {{5}}'
  ),
  (
    'rank_top5',
    'dosmicos_club_mamas_rank_top5_v1',
    'Entrada o permanencia en top 5 semanal Club de Mamás Dosmicos con CTA de upload para ADS',
    '["creator_name", "week_rank", "week_commission", "upload_link", "creator_link"]',
    '🏆 Club de Mamás Dosmicos: {{1}}, estás en el top 5 esta semana. Vas en el puesto #{{2}} con {{3}} en comisión. Sube tu mejor contenido aquí para que podamos revisarlo para ADS: {{4}}. Sigue compartiendo tu link: {{5}}'
  ),
  (
    'rank_proximity',
    'dosmicos_club_mamas_rank_proximity_v1',
    'Creadora cerca del top 5 semanal Club de Mamás Dosmicos con CTA de upload para ADS',
    '["creator_name", "week_rank", "gap_to_top5", "week_commission", "upload_link", "creator_link"]',
    '👀 Club de Mamás Dosmicos: {{1}}, estás en el puesto #{{2}} esta semana. Te faltan aprox. {{3}} para entrar al top 5 y ya llevas {{4}} en comisión. Sube contenido nuevo aquí: {{5}}. Tu link de descuento: {{6}}'
  ),
  (
    'weekly_challenge',
    'dosmicos_club_mamas_weekly_challenge_v1',
    'Reto semanal Club de Mamás Dosmicos con upload para ADS y link de descuento',
    '["creator_name", "challenge_title", "challenge_prompt", "upload_link", "creator_link"]',
    '💛 Reto Club de Mamás Dosmicos de la semana, {{1}}: {{2}}. Idea para crear: {{3}}. Súbelo aquí para que podamos revisarlo para ADS: {{4}}. Y compártelo con tu link de descuento: {{5}}'
  )
) AS v(notification_type, template_name, description, body_parameters, sample_message)
WHERE s.notification_type = v.notification_type
  AND s.organization_id IN (SELECT id FROM organizations WHERE slug = 'dosmicos-org');
