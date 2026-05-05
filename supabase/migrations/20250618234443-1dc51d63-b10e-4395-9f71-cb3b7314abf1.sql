
-- Función para obtener el desglose por variantes de una orden
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
    
    -- Total ordenado para esta variante
    COALESCE(SUM(oi.quantity), 0)::INTEGER as total_ordered,
    
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
    
    -- Total pendiente para esta variante (ordenado - aprobado)
    GREATEST(0, 
      COALESCE(SUM(oi.quantity), 0) - 
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
      WHEN COALESCE(SUM(oi.quantity), 0) = 0 THEN 0
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
        ), 0)::NUMERIC / SUM(oi.quantity)::NUMERIC) * 100, 
        2
      )
    END as completion_percentage
    
  FROM orders o
  LEFT JOIN order_items oi ON o.id = oi.order_id
  LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
  LEFT JOIN products p ON pv.product_id = p.id
  LEFT JOIN delivery_items di ON oi.id = di.order_item_id
  LEFT JOIN deliveries d ON di.delivery_id = d.id
  WHERE o.id = order_id_param
  GROUP BY p.name, pv.size, pv.color, pv.sku_variant
  ORDER BY p.name, pv.size, pv.color;
$$;
