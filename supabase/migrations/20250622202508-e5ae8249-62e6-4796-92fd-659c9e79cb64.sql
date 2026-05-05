
-- Actualizar la función get_order_deliveries_breakdown para usar los nuevos campos estructurados
CREATE OR REPLACE FUNCTION public.get_order_deliveries_breakdown(order_id_param uuid)
RETURNS TABLE (
  delivery_id uuid,
  tracking_number text,
  delivery_date date,
  delivery_status text,
  workshop_name text,
  items_delivered integer,
  items_approved integer,
  items_defective integer,
  delivery_notes text
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    d.id as delivery_id,
    d.tracking_number,
    d.delivery_date,
    d.status as delivery_status,
    w.name as workshop_name,
    
    -- Items entregados en esta entrega
    COALESCE(SUM(di.quantity_delivered), 0)::INTEGER as items_delivered,
    
    -- Items aprobados en esta entrega (usando el nuevo campo estructurado)
    COALESCE(SUM(di.quantity_approved), 0)::INTEGER as items_approved,
    
    -- Items defectuosos en esta entrega (usando el nuevo campo estructurado)
    COALESCE(SUM(di.quantity_defective), 0)::INTEGER as items_defective,
    
    d.notes as delivery_notes
    
  FROM deliveries d
  LEFT JOIN workshops w ON d.workshop_id = w.id
  LEFT JOIN delivery_items di ON d.id = di.delivery_id
  WHERE d.order_id = order_id_param
  GROUP BY d.id, d.tracking_number, d.delivery_date, d.status, w.name, d.notes
  ORDER BY d.delivery_date DESC, d.created_at DESC;
$$;

-- Actualizar la función get_order_variants_breakdown para usar los nuevos campos estructurados
CREATE OR REPLACE FUNCTION public.get_order_variants_breakdown(order_id_param uuid)
RETURNS TABLE (
  product_name text,
  variant_size text,
  variant_color text,
  sku_variant text,
  total_ordered integer,
  total_approved integer,
  total_pending integer,
  completion_percentage numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    p.name as product_name,
    pv.size as variant_size,
    pv.color as variant_color,
    pv.sku_variant,
    
    -- Total ordenado para esta variante
    oi.quantity::INTEGER as total_ordered,
    
    -- Total aprobado para esta variante (usando el nuevo campo estructurado)
    COALESCE(SUM(di.quantity_approved), 0)::INTEGER as total_approved,
    
    -- Total pendiente para esta variante
    GREATEST(0, 
      oi.quantity - COALESCE(SUM(di.quantity_approved), 0)
    )::INTEGER as total_pending,
    
    -- Porcentaje de completitud para esta variante
    CASE 
      WHEN oi.quantity = 0 THEN 0
      ELSE ROUND(
        (COALESCE(SUM(di.quantity_approved), 0)::NUMERIC / oi.quantity::NUMERIC) * 100, 
        2
      )
    END as completion_percentage
    
  FROM order_items oi
  INNER JOIN product_variants pv ON oi.product_variant_id = pv.id
  INNER JOIN products p ON pv.product_id = p.id
  LEFT JOIN delivery_items di ON oi.id = di.order_item_id
  LEFT JOIN deliveries d ON di.delivery_id = d.id AND d.order_id = order_id_param
  WHERE oi.order_id = order_id_param
  GROUP BY p.name, pv.size, pv.color, pv.sku_variant, oi.quantity
  ORDER BY p.name, pv.size, pv.color;
$$;
