-- Remove explicit ADS wording from Club de Mamás Dosmicos WhatsApp templates.
-- Keep upload CTA natural/customer-facing; internal ADS use remains an internal workflow.

UPDATE ugc_affiliate_notification_settings s
SET
  sample_message = v.sample_message,
  description = v.description,
  is_enabled = false,
  updated_at = now()
FROM (VALUES
  (
    'sale',
    'Venta nueva por link Club de Mamás Dosmicos con CTA natural de upload',
    '💛 Club de Mamás Dosmicos: ¡vendiste con tu link, {{1}}! Acabas de ganar {{2}}. Tu saldo acumulado va en {{3}} y estás en el puesto #{{4}} esta semana. Sube en tu link todo el contenido que hayas creado sobre Dosmicos: {{5}}. Tu link de descuento: {{6}}'
  ),
  (
    'first_sale',
    'Primera venta por link Club de Mamás Dosmicos con CTA natural de upload',
    '💛 Club de Mamás Dosmicos: {{1}}, ¡lograste tu primera venta con tu link! Ganaste {{2}} y tu saldo va en {{3}}. Si tienes foto, video o testimonio de lo que publicaste, súbelo en tu link: {{4}}. Tu link de descuento: {{5}}'
  ),
  (
    'rank_top5',
    'Entrada o permanencia en top 5 semanal Club de Mamás Dosmicos con CTA natural de upload',
    '🏆 Club de Mamás Dosmicos: {{1}}, estás en el top 5 esta semana. Vas en el puesto #{{2}} con {{3}} en comisión. Sube en tu link tu mejor contenido de esta semana: {{4}}. Sigue compartiendo tu link de descuento: {{5}}'
  ),
  (
    'rank_proximity',
    'Creadora cerca del top 5 semanal Club de Mamás Dosmicos con CTA natural de upload',
    '👀 Club de Mamás Dosmicos: {{1}}, estás en el puesto #{{2}} esta semana. Te faltan aprox. {{3}} para entrar al top 5 y ya llevas {{4}} en comisión. Sube contenido nuevo en tu link: {{5}}. Tu link de descuento: {{6}}'
  ),
  (
    'weekly_challenge',
    'Reto semanal Club de Mamás Dosmicos con upload y link de descuento',
    '💛 Reto Club de Mamás Dosmicos de la semana, {{1}}: {{2}}. Idea para crear: {{3}}. Cuando lo tengas, súbelo en tu link: {{4}}. Y compártelo con tu link de descuento: {{5}}'
  )
) AS v(notification_type, description, sample_message)
WHERE s.notification_type = v.notification_type
  AND s.organization_id IN (SELECT id FROM organizations WHERE slug = 'dosmicos-org');
