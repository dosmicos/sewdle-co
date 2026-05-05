
-- Corregir la función get_order_delivery_stats para evitar conteos duplicados
CREATE OR REPLACE FUNCTION public.get_order_delivery_stats(order_id_param UUID)
RETURNS TABLE (
  total_ordered INTEGER,
  total_delivered INTEGER,
  total_approved INTEGER,
  total_defective INTEGER,
  total_pending INTEGER,
  completion_percentage NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH order_totals AS (
    SELECT 
      COALESCE(SUM(oi.quantity), 0) as total_ordered_qty
    FROM order_items oi
    WHERE oi.order_id = order_id_param
  ),
  delivery_stats AS (
    SELECT 
      COALESCE(SUM(di.quantity_delivered), 0) as total_delivered_qty,
      COALESCE(SUM(
        CASE 
          WHEN di.quality_status = 'approved' THEN di.quantity_delivered
          WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
            COALESCE(
              (regexp_match(di.notes, 'Aprobadas: (\d+)'))[1]::INTEGER, 
              0
            )
          ELSE 0
        END
      ), 0) as total_approved_qty,
      COALESCE(SUM(
        CASE 
          WHEN di.quality_status = 'rejected' THEN di.quantity_delivered
          WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
            COALESCE(
              (regexp_match(di.notes, 'Defectuosas: (\d+)'))[1]::INTEGER, 
              0
            )
          ELSE 0
        END
      ), 0) as total_defective_qty
    FROM delivery_items di
    INNER JOIN deliveries d ON di.delivery_id = d.id
    WHERE d.order_id = order_id_param
  )
  SELECT 
    ot.total_ordered_qty::INTEGER as total_ordered,
    ds.total_delivered_qty::INTEGER as total_delivered,
    ds.total_approved_qty::INTEGER as total_approved,
    ds.total_defective_qty::INTEGER as total_defective,
    GREATEST(0, ot.total_ordered_qty - ds.total_approved_qty)::INTEGER as total_pending,
    CASE 
      WHEN ot.total_ordered_qty = 0 THEN 0
      ELSE ROUND((ds.total_approved_qty::NUMERIC / ot.total_ordered_qty::NUMERIC) * 100, 2)
    END as completion_percentage
  FROM order_totals ot
  CROSS JOIN delivery_stats ds;
$$;

-- Corregir la función get_order_variants_breakdown para evitar conteos duplicados
CREATE OR REPLACE FUNCTION public.get_order_variants_breakdown(order_id_param UUID)
RETURNS TABLE (
  product_name TEXT,
  variant_size TEXT,
  variant_color TEXT,
  sku_variant TEXT,
  total_ordered INTEGER,
  total_approved INTEGER,
  total_pending INTEGER,
  completion_percentage NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    p.name as product_name,
    pv.size as variant_size,
    pv.color as variant_color,
    pv.sku_variant,
    
    -- Total ordenado para esta variante (sin duplicados)
    oi.quantity::INTEGER as total_ordered,
    
    -- Total aprobado para esta variante
    COALESCE(SUM(
      CASE 
        WHEN di.quality_status = 'approved' THEN di.quantity_delivered
        WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
          COALESCE(
            (regexp_match(di.notes, 'Aprobadas: (\d+)'))[1]::INTEGER, 
            0
          )
        ELSE 0
      END
    ), 0)::INTEGER as total_approved,
    
    -- Total pendiente para esta variante
    GREATEST(0, 
      oi.quantity - 
      COALESCE(SUM(
        CASE 
          WHEN di.quality_status = 'approved' THEN di.quantity_delivered
          WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
            COALESCE(
              (regexp_match(di.notes, 'Aprobadas: (\d+)'))[1]::INTEGER, 
              0
            )
          ELSE 0
        END
      ), 0)
    )::INTEGER as total_pending,
    
    -- Porcentaje de completitud para esta variante
    CASE 
      WHEN oi.quantity = 0 THEN 0
      ELSE ROUND(
        (COALESCE(SUM(
          CASE 
            WHEN di.quality_status = 'approved' THEN di.quantity_delivered
            WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
              COALESCE(
                (regexp_match(di.notes, 'Aprobadas: (\d+)'))[1]::INTEGER, 
                0
              )
            ELSE 0
          END
        ), 0)::NUMERIC / oi.quantity::NUMERIC) * 100, 
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
