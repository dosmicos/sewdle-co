-- Fix: Auto-cleanup de sync locks atorados y mejora de diagnósticos en get_deliveries_with_sync_status

-- 1. Función para limpiar locks de sincronización atorados (> 30 min)
CREATE OR REPLACE FUNCTION public.cleanup_stale_sync_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cleaned_count integer;
BEGIN
  UPDATE deliveries
  SET sync_lock_acquired_at = NULL,
      sync_lock_acquired_by = NULL,
      sync_error_message = COALESCE(sync_error_message, '') ||
        CASE WHEN sync_error_message IS NOT NULL THEN ' | ' ELSE '' END ||
        'Lock liberado automáticamente por timeout (' ||
        EXTRACT(EPOCH FROM (NOW() - sync_lock_acquired_at))::integer || 's)'
  WHERE sync_lock_acquired_at IS NOT NULL
    AND sync_lock_acquired_at < NOW() - INTERVAL '30 minutes';

  GET DIAGNOSTICS cleaned_count = ROW_COUNT;

  IF cleaned_count > 0 THEN
    RAISE LOG 'cleanup_stale_sync_locks: Liberados % locks atorados', cleaned_count;
  END IF;

  RETURN cleaned_count;
END;
$$;

-- 2. Mejorar get_deliveries_with_sync_status con validación de organización
DROP FUNCTION IF EXISTS public.get_deliveries_with_sync_status();

CREATE FUNCTION public.get_deliveries_with_sync_status()
RETURNS TABLE(
  id uuid,
  tracking_number text,
  order_id uuid,
  order_number text,
  workshop_id uuid,
  workshop_name text,
  delivery_date date,
  status text,
  delivered_by uuid,
  delivered_by_name text,
  recipient_name text,
  recipient_phone text,
  recipient_address text,
  notes text,
  created_at timestamptz,
  items_count bigint,
  total_quantity numeric,
  total_approved numeric,
  total_defective numeric,
  synced_to_shopify boolean,
  sync_attempts integer,
  last_sync_attempt timestamptz,
  sync_error_message text,
  product_names text,
  product_skus text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_org_id uuid;
BEGIN
  -- Limpiar locks atorados antes de consultar
  PERFORM cleanup_stale_sync_locks();

  current_org_id := get_current_organization_safe();

  IF current_org_id IS NULL THEN
    RAISE WARNING 'get_deliveries_with_sync_status: organization_id is NULL for user %. El usuario puede no tener organización activa o role_id asignado.', auth.uid();
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.tracking_number,
    d.order_id,
    o.order_number,
    d.workshop_id,
    w.name AS workshop_name,
    d.delivery_date,
    d.status,
    d.delivered_by,
    p.name AS delivered_by_name,
    d.recipient_name,
    d.recipient_phone,
    d.recipient_address,
    d.notes,
    d.created_at,
    COUNT(di.id) AS items_count,
    COALESCE(SUM(di.quantity_delivered), 0) AS total_quantity,
    COALESCE(SUM(di.quantity_approved), 0) AS total_approved,
    COALESCE(SUM(di.quantity_defective), 0) AS total_defective,
    d.synced_to_shopify,
    d.sync_attempts,
    d.last_sync_attempt,
    d.sync_error_message,
    COALESCE(
      STRING_AGG(DISTINCT prod.name, ' | ') FILTER (WHERE prod.name IS NOT NULL),
      ''
    ) AS product_names,
    COALESCE(
      STRING_AGG(
        DISTINCT COALESCE(NULLIF(pv.sku_variant, ''), NULLIF(prod.sku, '')),
        ' | '
      ) FILTER (
        WHERE COALESCE(NULLIF(pv.sku_variant, ''), NULLIF(prod.sku, '')) IS NOT NULL
      ),
      ''
    ) AS product_skus
  FROM public.deliveries d
  LEFT JOIN public.orders o ON d.order_id = o.id
  LEFT JOIN public.workshops w ON d.workshop_id = w.id
  LEFT JOIN public.profiles p ON d.delivered_by = p.id
  LEFT JOIN public.delivery_items di ON d.id = di.delivery_id
  LEFT JOIN public.order_items oi ON di.order_item_id = oi.id
  LEFT JOIN public.product_variants pv ON oi.product_variant_id = pv.id
  LEFT JOIN public.products prod ON pv.product_id = prod.id
  WHERE d.organization_id = current_org_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
END;
$$;

-- 3. Índices faltantes para mejorar performance
CREATE INDEX IF NOT EXISTS idx_deliveries_sync_lock
  ON deliveries(sync_lock_acquired_at)
  WHERE sync_lock_acquired_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_sync_logs_delivery_verification
  ON inventory_sync_logs(delivery_id, verification_status);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_fulfillment_status
  ON shopify_orders(fulfillment_status)
  WHERE fulfillment_status IS NOT NULL;
