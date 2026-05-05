-- Eliminar y recrear función con orden correcto de columnas
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Limpiar datos antiguos de la organización
  DELETE FROM inventory_replenishment 
  WHERE organization_id = org_id;
  
  -- Insertar nuevos cálculos
  INSERT INTO inventory_replenishment (
    organization_id,
    product_variant_id,
    current_stock,
    pending_orders,
    sales_30d,
    orders_count_30d,
    avg_daily_sales,
    days_of_stock,
    projected_30d_demand,
    suggested_quantity,
    urgency_level,
    reason,
    data_confidence,
    calculation_date
  )
  SELECT 
    org_id,
    pv.id,
    COALESCE(
      (SELECT COALESCE(SUM(mi.quantity), 0) 
       FROM material_inventory mi 
       WHERE mi.product_variant_id = pv.id),
      0
    ) as stock,
    COALESCE(
      (SELECT COALESCE(SUM(oi.quantity), 0)
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_variant_id = pv.id 
       AND o.status IN ('pending', 'in_production')
       AND o.organization_id = org_id),
      0
    ) as pending,
    COALESCE(
      (SELECT COALESCE(SUM(oi.quantity), 0)
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_variant_id = pv.id
       AND o.organization_id = org_id
       AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
      0
    ) as total_sold,
    COALESCE(
      (SELECT COUNT(DISTINCT o.id)
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_variant_id = pv.id
       AND o.organization_id = org_id
       AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
      0
    ) as order_count,
    CASE 
      WHEN COALESCE(
        (SELECT COALESCE(SUM(oi.quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) > 0 THEN
        COALESCE(
          (SELECT COALESCE(SUM(oi.quantity), 0)
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE oi.product_variant_id = pv.id
           AND o.organization_id = org_id
           AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
          0
        ) / 30.0
      ELSE 0
    END as avg_daily_sales,
    CASE 
      WHEN COALESCE(
        (SELECT COALESCE(SUM(oi.quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) > 0 THEN
        COALESCE(
          (SELECT COALESCE(SUM(mi.quantity), 0) 
           FROM material_inventory mi 
           WHERE mi.product_variant_id = pv.id),
          0
        ) / (COALESCE(
          (SELECT COALESCE(SUM(oi.quantity), 0)
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE oi.product_variant_id = pv.id
           AND o.organization_id = org_id
           AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
          0
        ) / 30.0)
      ELSE 999
    END as days_of_supply,
    COALESCE(
      (SELECT COALESCE(SUM(oi.quantity), 0)
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_variant_id = pv.id
       AND o.organization_id = org_id
       AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
      0
    ) as projected_30d_demand,
    GREATEST(
      0,
      COALESCE(
        (SELECT COALESCE(SUM(oi.quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) - COALESCE(
        (SELECT COALESCE(SUM(mi.quantity), 0) 
         FROM material_inventory mi 
         WHERE mi.product_variant_id = pv.id),
        0
      )
    ) as suggested_quantity,
    CASE 
      WHEN COALESCE(
        (SELECT COALESCE(SUM(mi.quantity), 0) 
         FROM material_inventory mi 
         WHERE mi.product_variant_id = pv.id),
        0
      ) = 0 THEN 'critical'
      WHEN COALESCE(
        (SELECT COALESCE(SUM(oi.quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) > 0 AND
      (COALESCE(
        (SELECT COALESCE(SUM(mi.quantity), 0) 
         FROM material_inventory mi 
         WHERE mi.product_variant_id = pv.id),
        0
      ) / (COALESCE(
        (SELECT COALESCE(SUM(oi.quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) / 30.0)) < 7 THEN 'high'
      WHEN COALESCE(
        (SELECT COALESCE(SUM(oi.quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) > 0 AND
      (COALESCE(
        (SELECT COALESCE(SUM(mi.quantity), 0) 
         FROM material_inventory mi 
         WHERE mi.product_variant_id = pv.id),
        0
      ) / (COALESCE(
        (SELECT COALESCE(SUM(oi.quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) / 30.0)) < 15 THEN 'normal'
      ELSE 'low'
    END as urgency,
    CASE 
      WHEN COALESCE(
        (SELECT COALESCE(SUM(mi.quantity), 0) 
         FROM material_inventory mi 
         WHERE mi.product_variant_id = pv.id),
        0
      ) = 0 THEN 'Sin stock disponible'
      WHEN COALESCE(
        (SELECT COALESCE(SUM(oi.quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) > 0 AND
      (COALESCE(
        (SELECT COALESCE(SUM(mi.quantity), 0) 
         FROM material_inventory mi 
         WHERE mi.product_variant_id = pv.id),
        0
      ) / (COALESCE(
        (SELECT COALESCE(SUM(oi.quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) / 30.0)) < 7 THEN 'Stock bajo - menos de 1 semana'
      WHEN COALESCE(
        (SELECT COALESCE(SUM(oi.quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) > 0 AND
      (COALESCE(
        (SELECT COALESCE(SUM(mi.quantity), 0) 
         FROM material_inventory mi 
         WHERE mi.product_variant_id = pv.id),
        0
      ) / (COALESCE(
        (SELECT COALESCE(SUM(oi.quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) / 30.0)) < 15 THEN 'Stock medio - menos de 2 semanas'
      ELSE 'Stock suficiente'
    END as reason,
    CASE
      WHEN COALESCE(
        (SELECT COUNT(DISTINCT o.id)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) >= 5 THEN 'high'
      WHEN COALESCE(
        (SELECT COUNT(DISTINCT o.id)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) >= 2 THEN 'medium'
      ELSE 'low'
    END as data_confidence,
    CURRENT_DATE
  FROM product_variants pv
  WHERE pv.organization_id = org_id;
END;
$$;