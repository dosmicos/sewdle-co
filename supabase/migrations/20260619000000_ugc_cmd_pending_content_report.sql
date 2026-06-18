-- Report RPC: CMD creators whose order was DELIVERED (carrier-confirmed) but who
-- have NOT uploaded any content yet, with the order placed >= p_min_days ago.
-- Used by the "Exportar pendientes de contenido" button on the UGC Creators page.
--
-- "Delivered" = a shipping_labels row with status='delivered' for the order
-- (the only carrier-confirmed delivery signal; Shopify/P&P have no delivered state).
-- Elapsed time is measured from the Shopify order date (delivery dates are sparse).

CREATE OR REPLACE FUNCTION public.get_ugc_cmd_pending_content_report(p_min_days integer DEFAULT 7)
RETURNS TABLE(
  order_number text,
  contact_phone text,
  creator_name text,
  username text,
  order_date date,
  delivered_date date,
  days_since_order integer,
  product_items text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (SELECT get_current_organization_safe() AS id),
  cmd AS (
    SELECT DISTINCT c.id, c.name, c.phone, c.instagram_handle, c.tiktok_handle
    FROM ugc_creators c
    JOIN ugc_creator_tag_assignments a ON a.creator_id = c.id
    JOIN ugc_creator_tags t ON t.id = a.tag_id
    WHERE lower(t.name) = 'cmd' AND c.organization_id = (SELECT id FROM org)
  ),
  content AS (
    SELECT DISTINCT creator_id FROM ugc_videos
    WHERE video_url IS NOT NULL AND status <> 'rechazado'
      AND organization_id = (SELECT id FROM org)
  )
  SELECT
    camp.order_number,
    cmd.phone AS contact_phone,
    cmd.name AS creator_name,
    COALESCE(NULLIF('@' || cmd.instagram_handle, '@'), NULLIF('@' || cmd.tiktok_handle, '@')) AS username,
    so.created_at::date AS order_date,
    sl.delivered_date,
    (CURRENT_DATE - so.created_at::date)::int AS days_since_order,
    (SELECT string_agg(li.title || CASE WHEN li.quantity > 1 THEN ' x' || li.quantity ELSE '' END, ', ')
       FROM shopify_order_line_items li
      WHERE li.shopify_order_id = so.shopify_order_id) AS product_items
  FROM cmd
  JOIN ugc_campaigns camp ON camp.creator_id = cmd.id AND camp.order_number IS NOT NULL
  LEFT JOIN content ct ON ct.creator_id = cmd.id
  JOIN shopify_orders so ON so.organization_id = (SELECT id FROM org)
       AND replace(so.order_number, '#', '') = replace(camp.order_number, '#', '')
  JOIN LATERAL (
    SELECT max(s.updated_at)::date AS delivered_date
    FROM shipping_labels s
    WHERE s.organization_id = (SELECT id FROM org)
      AND replace(s.order_number, '#', '') = replace(camp.order_number, '#', '')
      AND s.status = 'delivered'
  ) sl ON sl.delivered_date IS NOT NULL
  WHERE ct.creator_id IS NULL
    AND so.created_at::date <= CURRENT_DATE - p_min_days
  ORDER BY days_since_order DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_ugc_cmd_pending_content_report(integer) TO authenticated;
