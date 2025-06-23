
-- Agregar campo para controlar sincronización única en deliveries
ALTER TABLE public.deliveries 
ADD COLUMN synced_to_shopify BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN sync_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN last_sync_attempt TIMESTAMP WITH TIME ZONE,
ADD COLUMN sync_error_message TEXT;

-- Crear vista para estadísticas de entregas (reemplaza la función inexistente)
CREATE OR REPLACE VIEW public.deliveries_stats AS
SELECT 
  COUNT(*) as total_deliveries,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
  COUNT(*) FILTER (WHERE status = 'in_quality') as in_quality_deliveries,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_deliveries,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_deliveries
FROM deliveries;

-- Función para obtener entregas con detalles mejorada
CREATE OR REPLACE FUNCTION public.get_deliveries_with_sync_status()
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
  created_at timestamp with time zone,
  items_count bigint,
  total_quantity bigint,
  total_approved bigint,
  total_defective bigint,
  synced_to_shopify boolean,
  sync_attempts integer,
  last_sync_attempt timestamp with time zone,
  sync_error_message text
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    d.id,
    d.tracking_number,
    d.order_id,
    o.order_number,
    d.workshop_id,
    w.name as workshop_name,
    d.delivery_date,
    d.status,
    d.delivered_by,
    p.name as delivered_by_name,
    d.recipient_name,
    d.recipient_phone,
    d.recipient_address,
    d.notes,
    d.created_at,
    COUNT(di.id) as items_count,
    COALESCE(SUM(di.quantity_delivered), 0) as total_quantity,
    COALESCE(SUM(di.quantity_approved), 0) as total_approved,
    COALESCE(SUM(di.quantity_defective), 0) as total_defective,
    d.synced_to_shopify,
    d.sync_attempts,
    d.last_sync_attempt,
    d.sync_error_message
  FROM deliveries d
  LEFT JOIN orders o ON d.order_id = o.id
  LEFT JOIN workshops w ON d.workshop_id = w.id
  LEFT JOIN profiles p ON d.delivered_by = p.id
  LEFT JOIN delivery_items di ON d.id = di.delivery_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$$;
