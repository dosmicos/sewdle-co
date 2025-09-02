
-- 1) Acelerar el cálculo: índice por material
CREATE INDEX IF NOT EXISTS idx_material_deliveries_material_id
  ON public.material_deliveries(material_id);

-- 2) Hacer que el catálogo lea stock "real" como el dashboard
CREATE OR REPLACE FUNCTION public.get_materials_with_stock_status()
RETURNS TABLE(
  id uuid,
  sku text,
  name text,
  description text,
  unit text,
  color text,
  category text,
  min_stock_alert integer,
  current_stock integer,
  supplier text,
  unit_cost numeric,
  image_url text,
  stock_status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    m.id,
    m.sku,
    m.name,
    m.description,
    m.unit,
    m.color,
    m.category,
    COALESCE(m.min_stock_alert, 0)::integer AS min_stock_alert,
    COALESCE(s.computed_stock, 0)::integer AS current_stock,
    m.supplier,
    m.unit_cost,
    m.image_url,
    CASE
      WHEN COALESCE(s.computed_stock, 0) <= COALESCE(m.min_stock_alert, 0) THEN 'critical'
      WHEN COALESCE(s.computed_stock, 0) <= (COALESCE(m.min_stock_alert, 0) * 1.5) THEN 'warning'
      ELSE 'good'
    END AS stock_status,
    m.created_at
  FROM public.materials m
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(CASE WHEN md.quantity_delivered > 0 THEN md.quantity_delivered ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN md.quantity_consumed > 0 THEN md.quantity_consumed ELSE 0 END), 0)
      AS computed_stock
    FROM public.material_deliveries md
    WHERE md.material_id = m.id
  ) s ON TRUE
  ORDER BY m.name;
$function$;
