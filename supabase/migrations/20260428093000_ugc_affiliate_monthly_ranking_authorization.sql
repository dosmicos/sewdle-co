-- Club de Mamás affiliate ranking: monthly ranking + weekly progress reporting.
-- Also keep WhatsApp notification templates disabled by default; Edge Function requires
-- an explicit `authorized: true` flag before any external WhatsApp send.

CREATE OR REPLACE FUNCTION get_ugc_public_ranking(p_org_slug text)
RETURNS TABLE(
  creator_name text,
  instagram_handle text,
  avatar_url text,
  orders_in_period bigint,
  commission_in_period numeric,
  pending_balance numeric,
  rank bigint
)
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  WITH org AS (
    SELECT id
    FROM organizations
    WHERE slug = p_org_slug
       OR (p_org_slug = 'dosmicos' AND slug = 'dosmicos-org')
       OR lower(name) = lower(p_org_slug)
    ORDER BY CASE WHEN slug = p_org_slug THEN 0 ELSE 1 END
    LIMIT 1
  ),
  ranking_start AS (
    SELECT (date_trunc('month', timezone('America/Bogota', now())) AT TIME ZONE 'America/Bogota') AS started_at
  )
  SELECT
    c.name::text AS creator_name,
    COALESCE(c.instagram_handle, '')::text AS instagram_handle,
    COALESCE(c.avatar_url, '')::text AS avatar_url,
    COUNT(ao.id) AS orders_in_period,
    COALESCE(SUM(ao.commission_amount), 0) AS commission_in_period,
    GREATEST(dl.total_commission - COALESCE(dl.total_paid_out, 0), 0) AS pending_balance,
    RANK() OVER (ORDER BY COALESCE(SUM(ao.commission_amount), 0) DESC) AS rank
  FROM ugc_discount_links dl
  JOIN ugc_creators c ON c.id = dl.creator_id
  JOIN org ON org.id = dl.organization_id
  LEFT JOIN ugc_attributed_orders ao
    ON ao.discount_link_id = dl.id
    AND ao.order_date >= (SELECT started_at FROM ranking_start)
  WHERE dl.organization_id = (SELECT id FROM org)
    AND dl.is_active = true
  GROUP BY c.id, c.name, c.instagram_handle, c.avatar_url,
           dl.total_commission, dl.total_paid_out
  ORDER BY commission_in_period DESC, pending_balance DESC;
$$;

GRANT EXECUTE ON FUNCTION get_ugc_public_ranking(text) TO anon;
GRANT EXECUTE ON FUNCTION get_ugc_public_ranking(text) TO authenticated;

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
    'dosmicos_club_mamas_sale_monthly_v1',
    'Venta nueva por link Club de Mamás Dosmicos con puesto en ranking mensual',
    '["creator_name", "commission_amount", "pending_balance", "month_rank", "upload_link"]',
    '💛 Club de Mamás Dosmicos: ¡vendiste con tu link, {{1}}! Acabas de ganar {{2}}. Tu saldo acumulado va en {{3}} y estás en el puesto #{{4}} del ranking mensual. Sube en este link todo el contenido que hayas creado sobre Dosmicos: {{5}}. Queremos ver lo que creaste 💛'
  ),
  (
    'rank_top5',
    'dosmicos_club_mamas_rank_top5_monthly_v1',
    'Top 5 del ranking mensual Club de Mamás Dosmicos',
    '["creator_name", "month_rank", "monthly_commission", "upload_link"]',
    '🏆 Club de Mamás Dosmicos: {{1}}, estás en el top 5 del ranking mensual. Vas en el puesto #{{2}} con {{3}} en comisión. Sube aquí tu mejor contenido de esta semana: {{4}}. Queremos ver lo que creaste 💛'
  ),
  (
    'rank_proximity',
    'dosmicos_club_mamas_rank_proximity_monthly_v1',
    'Creadora cerca del top 5 mensual Club de Mamás Dosmicos',
    '["creator_name", "month_rank", "gap_to_top5", "monthly_commission", "upload_link"]',
    '👀 Club de Mamás Dosmicos: {{1}}, estás en el puesto #{{2}} del ranking mensual. Te faltan aprox. {{3}} para entrar al top 5 y ya llevas {{4}} en comisión mensual. Sube contenido nuevo aquí: {{5}}. Queremos ver lo que creaste 💛'
  )
) AS v(notification_type, template_name, description, body_parameters, sample_message)
WHERE s.notification_type = v.notification_type
  AND s.organization_id IN (SELECT id FROM organizations WHERE slug = 'dosmicos-org');
