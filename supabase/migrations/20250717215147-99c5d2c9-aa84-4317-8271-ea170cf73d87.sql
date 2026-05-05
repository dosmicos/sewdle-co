-- Create a function to get material consumptions with workshop from order assignment
CREATE OR REPLACE FUNCTION public.get_material_consumptions_by_order()
RETURNS TABLE (
  id uuid,
  material_id uuid,
  workshop_id uuid,
  order_id uuid,
  quantity_consumed numeric,
  delivery_date date,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  material_name text,
  material_unit text,
  material_category text,
  workshop_name text,
  order_number text
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    md.id,
    md.material_id,
    wa.workshop_id,
    md.order_id,
    md.quantity_consumed,
    md.delivery_date,
    md.created_at,
    md.updated_at,
    m.name as material_name,
    m.unit as material_unit,
    m.category as material_category,
    w.name as workshop_name,
    o.order_number
  FROM public.material_deliveries md
  JOIN public.orders o ON md.order_id = o.id
  JOIN public.workshop_assignments wa ON o.id = wa.order_id
  JOIN public.workshops w ON wa.workshop_id = w.id
  JOIN public.materials m ON md.material_id = m.id
  WHERE md.quantity_consumed > 0
  AND md.order_id IS NOT NULL
  ORDER BY md.created_at DESC;
$$;