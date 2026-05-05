-- Simplify Club de Mamás Dosmicos WhatsApp templates for Meta approval.
-- One link per template: upload_link only. No template ends with a variable.

UPDATE ugc_affiliate_notification_settings s
SET
  body_parameters = v.body_parameters::jsonb,
  sample_message = v.sample_message,
  description = v.description,
  is_enabled = false,
  updated_at = now()
FROM (VALUES
  (
    'sale',
    'Venta nueva por link Club de Mamás Dosmicos con solo Upload Link',
    '["creator_name", "commission_amount", "pending_balance", "week_rank", "upload_link"]',
    '💛 Club de Mamás Dosmicos: ¡vendiste con tu link, {{1}}! Acabas de ganar {{2}}. Tu saldo acumulado va en {{3}} y estás en el puesto #{{4}} esta semana. Sube en este link todo el contenido que hayas creado sobre Dosmicos: {{5}}. Queremos ver lo que creaste 💛'
  ),
  (
    'first_sale',
    'Primera venta por link Club de Mamás Dosmicos con solo Upload Link',
    '["creator_name", "commission_amount", "pending_balance", "upload_link"]',
    '💛 Club de Mamás Dosmicos: {{1}}, ¡lograste tu primera venta con tu link! Ganaste {{2}} y tu saldo va en {{3}}. Si tienes foto, video o testimonio de lo que publicaste, súbelo aquí: {{4}}. Queremos ver lo que creaste 💛'
  ),
  (
    'rank_top5',
    'Entrada o permanencia en top 5 semanal Club de Mamás Dosmicos con solo Upload Link',
    '["creator_name", "week_rank", "week_commission", "upload_link"]',
    '🏆 Club de Mamás Dosmicos: {{1}}, estás en el top 5 esta semana. Vas en el puesto #{{2}} con {{3}} en comisión. Sube aquí tu mejor contenido de esta semana: {{4}}. Queremos ver lo que creaste 💛'
  ),
  (
    'rank_proximity',
    'Creadora cerca del top 5 semanal Club de Mamás Dosmicos con solo Upload Link',
    '["creator_name", "week_rank", "gap_to_top5", "week_commission", "upload_link"]',
    '👀 Club de Mamás Dosmicos: {{1}}, estás en el puesto #{{2}} esta semana. Te faltan aprox. {{3}} para entrar al top 5 y ya llevas {{4}} en comisión. Sube contenido nuevo aquí: {{5}}. Queremos ver lo que creaste 💛'
  ),
  (
    'weekly_challenge',
    'Reto semanal Club de Mamás Dosmicos con solo Upload Link',
    '["creator_name", "challenge_title", "challenge_prompt", "upload_link"]',
    '💛 Reto Club de Mamás Dosmicos de la semana, {{1}}: {{2}}. Idea para crear: {{3}}. Cuando lo tengas, súbelo aquí: {{4}}. Queremos ver lo que creaste 💛'
  )
) AS v(notification_type, description, body_parameters, sample_message)
WHERE s.notification_type = v.notification_type
  AND s.organization_id IN (SELECT id FROM organizations WHERE slug = 'dosmicos-org');
