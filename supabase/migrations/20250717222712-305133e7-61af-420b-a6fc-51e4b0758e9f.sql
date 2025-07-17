-- Fix negative values in material_deliveries quantity_remaining field
-- First, update any current negative values to 0 since negative inventory doesn't make sense
UPDATE material_deliveries
SET quantity_remaining = 0,
    updated_at = now()
WHERE quantity_remaining < 0;

-- Update the get_material_deliveries_with_real_balance function to prevent negative values
CREATE OR REPLACE FUNCTION public.get_material_deliveries_with_real_balance()
RETURNS TABLE(
  id uuid,
  material_id uuid,
  workshop_id uuid,
  order_id uuid,
  delivery_date date,
  delivered_by uuid,
  notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  total_delivered integer,
  total_consumed integer,
  real_balance integer,
  material_name text,
  material_sku text,
  material_unit text,
  material_color text,
  material_category text,
  workshop_name text,
  order_number text
)
LANGUAGE sql
STABLE
AS $function$
  WITH material_workshop_totals AS (
    SELECT 
      md.material_id,
      md.workshop_id,
      -- Total entregado por taller + material
      COALESCE(SUM(CASE WHEN md.quantity_delivered > 0 THEN md.quantity_delivered ELSE 0 END), 0) as total_delivered_qty,
      -- Total consumido por taller + material
      COALESCE(SUM(CASE WHEN md.quantity_consumed > 0 THEN md.quantity_consumed ELSE 0 END), 0) as total_consumed_qty,
      -- Balance real = entregado - consumido (asegurar que nunca sea negativo)
      GREATEST(0, COALESCE(SUM(CASE WHEN md.quantity_delivered > 0 THEN md.quantity_delivered ELSE 0 END), 0) - 
      COALESCE(SUM(CASE WHEN md.quantity_consumed > 0 THEN md.quantity_consumed ELSE 0 END), 0)) as real_balance_qty
    FROM public.material_deliveries md
    GROUP BY md.material_id, md.workshop_id
  )
  SELECT DISTINCT ON (md.material_id, md.workshop_id)
    md.id,
    md.material_id,
    md.workshop_id,
    md.order_id,
    md.delivery_date,
    md.delivered_by,
    md.notes,
    md.created_at,
    md.updated_at,
    -- Totales calculados
    mwt.total_delivered_qty::integer as total_delivered,
    mwt.total_consumed_qty::integer as total_consumed,
    mwt.real_balance_qty::integer as real_balance,
    -- Información relacionada
    m.name as material_name,
    m.sku as material_sku,
    m.unit as material_unit,
    m.color as material_color,
    m.category as material_category,
    w.name as workshop_name,
    o.order_number
  FROM public.material_deliveries md
  INNER JOIN material_workshop_totals mwt ON md.material_id = mwt.material_id AND md.workshop_id = mwt.workshop_id
  LEFT JOIN public.materials m ON md.material_id = m.id
  LEFT JOIN public.workshops w ON md.workshop_id = w.id
  LEFT JOIN public.orders o ON md.order_id = o.id
  -- Solo mostrar registros con entregas reales (no consumos puros)
  WHERE EXISTS (
    SELECT 1 FROM public.material_deliveries md2 
    WHERE md2.material_id = md.material_id 
    AND md2.workshop_id = md.workshop_id 
    AND md2.quantity_delivered > 0
  )
  ORDER BY md.material_id, md.workshop_id, md.delivery_date DESC;
$function$;