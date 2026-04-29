-- Enable automatic Club de Mamás purchase notifications.
-- Julian approved this on 2026-04-28: every attributed affiliate purchase should
-- send the creator the sale / first-sale WhatsApp notification automatically.
-- Ranking nudges remain disabled to avoid double-message spam per order.

UPDATE ugc_affiliate_notification_settings s
SET
  is_enabled = CASE
    WHEN s.notification_type IN ('first_sale', 'sale') THEN true
    WHEN s.notification_type IN ('rank_top5', 'rank_proximity') THEN false
    ELSE s.is_enabled
  END,
  updated_at = now()
WHERE s.organization_id IN (SELECT id FROM organizations WHERE slug = 'dosmicos-org')
  AND s.notification_type IN ('first_sale', 'sale', 'rank_top5', 'rank_proximity');
