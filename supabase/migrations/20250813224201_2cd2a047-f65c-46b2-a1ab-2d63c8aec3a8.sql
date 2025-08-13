-- Fix functions with correct column names based on actual table structure

CREATE OR REPLACE FUNCTION public.get_available_orders()
 RETURNS TABLE(id uuid, order_number text, due_date date, total_amount numeric, status text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path = 'public'
AS $function$
  SELECT 
    o.id,
    o.order_number,
    o.due_date,
    o.total_amount,
    o.status,
    o.created_at
  FROM orders o
  WHERE o.status IN ('pending', 'assigned')
  ORDER BY o.due_date ASC NULLS LAST, o.created_at ASC;
$function$;

-- Fix remaining critical security functions with search_path
CREATE OR REPLACE FUNCTION public.get_materials_with_stock_status()
 RETURNS TABLE(id uuid, sku text, name text, description text, unit text, color text, category text, min_stock_alert integer, current_stock integer, supplier text, unit_cost numeric, image_url text, stock_status text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path = 'public'
AS $function$
  SELECT 
    m.id,
    m.sku,
    m.name,
    m.description,
    m.unit,
    m.color,
    m.category,
    m.min_stock_alert::integer,
    m.current_stock::integer,
    m.supplier,
    m.unit_cost,
    m.image_url,
    CASE 
      WHEN m.current_stock <= m.min_stock_alert THEN 'critical'
      WHEN m.current_stock <= (m.min_stock_alert * 1.5) THEN 'warning'
      ELSE 'good'
    END as stock_status,
    m.created_at
  FROM materials m
  ORDER BY m.name;
$function$;

CREATE OR REPLACE FUNCTION public.get_material_deliveries_with_real_balance()
 RETURNS TABLE(id uuid, material_id uuid, workshop_id uuid, order_id uuid, delivery_date date, delivered_by uuid, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, total_delivered numeric, total_consumed numeric, real_balance numeric, material_name text, material_sku text, material_unit text, material_color text, material_category text, workshop_name text, order_number text)
 LANGUAGE sql
 STABLE
 SET search_path = 'public'
AS $function$
  WITH material_workshop_totals AS (
    SELECT 
      md.material_id,
      md.workshop_id,
      -- Total entregado por taller + material (usando numeric para manejar decimales)
      COALESCE(SUM(CASE WHEN md.quantity_delivered > 0 THEN md.quantity_delivered ELSE 0 END), 0) as total_delivered_qty,
      -- Total consumido por taller + material (usando numeric para manejar decimales)
      COALESCE(SUM(CASE WHEN md.quantity_consumed > 0 THEN md.quantity_consumed ELSE 0 END), 0) as total_consumed_qty,
      -- Balance real = entregado - consumido (mantener decimales, asegurar que nunca sea negativo)
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
    -- Totales calculados mantener como numeric para decimales
    mwt.total_delivered_qty as total_delivered,
    mwt.total_consumed_qty as total_consumed,
    mwt.real_balance_qty as real_balance,
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

CREATE OR REPLACE FUNCTION public.recalculate_material_stock()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
DECLARE
  material_record RECORD;
  total_delivered INTEGER;
  total_consumed INTEGER;
  calculated_stock INTEGER;
BEGIN
  -- Para cada material, recalcular el stock basado en entregas y consumos
  FOR material_record IN SELECT id, name, sku FROM public.materials LOOP
    -- Calcular total entregado (solo registros con quantity_delivered > 0)
    SELECT COALESCE(SUM(quantity_delivered), 0) 
    INTO total_delivered
    FROM public.material_deliveries 
    WHERE material_id = material_record.id AND quantity_delivered > 0;
    
    -- Calcular total consumido (solo registros con quantity_consumed > 0)
    SELECT COALESCE(SUM(quantity_consumed), 0) 
    INTO total_consumed
    FROM public.material_deliveries 
    WHERE material_id = material_record.id AND quantity_consumed > 0;
    
    -- Stock actual = entregado - consumido
    calculated_stock := total_delivered - total_consumed;
    
    -- Actualizar el stock del material
    UPDATE public.materials 
    SET current_stock = calculated_stock,
        updated_at = now()
    WHERE id = material_record.id;
    
  END LOOP;
  
  -- También actualizar quantity_remaining en material_deliveries para entregas
  UPDATE public.material_deliveries 
  SET quantity_remaining = quantity_delivered - COALESCE(quantity_consumed, 0)
  WHERE quantity_delivered > 0 
    AND quantity_remaining != (quantity_delivered - COALESCE(quantity_consumed, 0));
  
END;
$function$;