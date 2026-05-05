-- Configurar precios faltantes para productos "con Mangas" del Taller Sofía
-- Basándose en precios existentes: Sleeping Walker normal = $9,500, con Mangas = $11,500

INSERT INTO public.workshop_pricing (
  workshop_id,
  product_id,
  unit_price,
  currency,
  effective_from,
  notes,
  created_by
) VALUES
-- Sleeping Walker Blue Sky con Mangas TOG 2.5
('c9edfa5e-60d9-4b3a-9034-4cbfdc452d30', '4c2ef718-41f6-4493-b81b-5d491b44136e', 11500.00, 'COP', '2025-09-08', 'Precio ajustado para productos con mangas', null),

-- Sleeping Walker Dinosaurios con Mangas TOG 2.5  
('c9edfa5e-60d9-4b3a-9034-4cbfdc452d30', '1a25c9da-919e-48e8-aa2b-70187afc504f', 11500.00, 'COP', '2025-09-08', 'Precio ajustado para productos con mangas', null),

-- Sleeping Walker Estrellas Gris con Mangas TOG 2.5
('c9edfa5e-60d9-4b3a-9034-4cbfdc452d30', 'fc491db6-a723-4439-9ef7-843a93f3495b', 11500.00, 'COP', '2025-09-08', 'Precio ajustado para productos con mangas', null),

-- Sleeping Walker Poppy con Mangas TOG 2.5
('c9edfa5e-60d9-4b3a-9034-4cbfdc452d30', 'd1650d1e-61d3-4ac6-b322-730f30a35716', 11500.00, 'COP', '2025-09-08', 'Precio ajustado para productos con mangas', null),

-- Sleeping Walker Star con Mangas TOG 2.5
('c9edfa5e-60d9-4b3a-9034-4cbfdc452d30', '2025ce2b-2cae-4305-91f0-264a9e913742', 11500.00, 'COP', '2025-09-08', 'Precio ajustado para productos con mangas', null);

-- Crear función para detectar talleres sin precios configurados
CREATE OR REPLACE FUNCTION public.get_workshop_pricing_gaps()
RETURNS TABLE(
  workshop_id UUID,
  workshop_name TEXT,
  product_id UUID,
  product_name TEXT,
  base_price NUMERIC,
  deliveries_count BIGINT,
  avg_sale_price NUMERIC
)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    w.id as workshop_id,
    w.name as workshop_name,
    p.id as product_id,
    p.name as product_name,
    p.base_price,
    COUNT(DISTINCT di.delivery_id) as deliveries_count,
    AVG(oi.unit_price) as avg_sale_price
  FROM workshops w
  CROSS JOIN products p
  LEFT JOIN workshop_pricing wp ON w.id = wp.workshop_id AND p.id = wp.product_id
    AND wp.effective_from <= CURRENT_DATE
    AND (wp.effective_until IS NULL OR wp.effective_until > CURRENT_DATE)
  LEFT JOIN deliveries d ON w.id = d.workshop_id
  LEFT JOIN delivery_items di ON d.id = di.delivery_id
  LEFT JOIN order_items oi ON di.order_item_id = oi.id
  LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
  WHERE wp.id IS NULL  -- Sin precio configurado
    AND p.organization_id = w.organization_id
    AND w.organization_id = get_current_organization_safe()
    -- Solo productos que han sido entregados por este taller
    AND EXISTS (
      SELECT 1 FROM delivery_items di2 
      JOIN deliveries d2 ON di2.delivery_id = d2.id
      JOIN order_items oi2 ON di2.order_item_id = oi2.id
      JOIN product_variants pv2 ON oi2.product_variant_id = pv2.id
      WHERE d2.workshop_id = w.id AND pv2.product_id = p.id
    )
  GROUP BY w.id, w.name, p.id, p.name, p.base_price
  HAVING COUNT(DISTINCT di.delivery_id) > 0
  ORDER BY deliveries_count DESC, p.name;
$$;