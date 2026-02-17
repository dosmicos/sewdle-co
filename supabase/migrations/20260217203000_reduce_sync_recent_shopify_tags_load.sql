-- Reduce load from frequent tag synchronization and avoid per-row updates.

-- 1) Bulk update helper: updates only rows with real changes.
CREATE OR REPLACE FUNCTION public.bulk_update_shopify_order_tags(
  org_id_param uuid,
  orders_param jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_rows integer := 0;
BEGIN
  IF org_id_param IS NULL THEN
    RETURN 0;
  END IF;

  IF orders_param IS NULL OR jsonb_typeof(orders_param) <> 'array' OR jsonb_array_length(orders_param) = 0 THEN
    RETURN 0;
  END IF;

  WITH payload AS (
    SELECT
      (item->>'shopify_order_id')::bigint AS shopify_order_id,
      NULLIF(item->>'tags', '') AS tags,
      NULLIF(item->>'note', '') AS note,
      NULLIF(item->>'financial_status', '') AS financial_status,
      NULLIF(item->>'fulfillment_status', '') AS fulfillment_status,
      NULLIF(item->>'cancelled_at', '')::timestamptz AS cancelled_at,
      NULLIF(item->>'updated_at_shopify', '')::timestamptz AS updated_at_shopify
    FROM jsonb_array_elements(orders_param) AS item
    WHERE item ? 'shopify_order_id'
  ),
  updated AS (
    UPDATE public.shopify_orders so
    SET
      tags = payload.tags,
      note = payload.note,
      financial_status = payload.financial_status,
      fulfillment_status = payload.fulfillment_status,
      cancelled_at = payload.cancelled_at,
      updated_at_shopify = payload.updated_at_shopify
    FROM payload
    WHERE so.shopify_order_id = payload.shopify_order_id
      AND so.organization_id = org_id_param
      AND (
        so.tags IS DISTINCT FROM payload.tags
        OR so.note IS DISTINCT FROM payload.note
        OR so.financial_status IS DISTINCT FROM payload.financial_status
        OR so.fulfillment_status IS DISTINCT FROM payload.fulfillment_status
        OR so.cancelled_at IS DISTINCT FROM payload.cancelled_at
        OR so.updated_at_shopify IS DISTINCT FROM payload.updated_at_shopify
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO updated_rows FROM updated;

  RETURN updated_rows;
END;
$$;

-- 2) Replace every-minute cron with every-5-minutes cron.
SELECT cron.unschedule('sync-shopify-tags-every-minute')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'sync-shopify-tags-every-minute'
);

SELECT cron.unschedule('sync-shopify-tags-every-5-min')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'sync-shopify-tags-every-5-min'
);

SELECT cron.schedule(
  'sync-shopify-tags-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-recent-shopify-tags',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzQyODksImV4cCI6MjA2NTM1MDI4OX0.LA-Z6t1uSQrVvZsPimxy65uPSEAf3sOHzOQD_zdt-mI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
