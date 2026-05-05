-- CRITICAL SECURITY FIX: Phase 2C - Fix remaining functions and add missing function
-- First create the missing get_current_organization_safe function

-- Check if function exists and create if missing
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = auth.uid() 
  AND status = 'active' 
  LIMIT 1;
$$;

-- Now fix the remaining functions that need search_path
CREATE OR REPLACE FUNCTION public.get_materials_with_stock_status()
RETURNS TABLE(id uuid, sku text, name text, description text, unit text, color text, category text, min_stock_alert integer, current_stock integer, supplier text, unit_cost numeric, image_url text, stock_status text, created_at timestamp with time zone)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT 
    m.id,
    m.sku,
    m.name,
    m.description,
    m.unit,
    m.color,
    m.category,
    m.min_stock_alert,
    m.current_stock,
    m.supplier,
    m.unit_cost,
    m.image_url,
    CASE 
      WHEN m.current_stock <= m.min_stock_alert THEN 'critical'
      WHEN m.current_stock <= (m.min_stock_alert * 1.5) THEN 'warning'
      ELSE 'good'
    END as stock_status,
    m.created_at
  FROM public.materials m
  ORDER BY m.name;
$$;

CREATE OR REPLACE FUNCTION public.get_material_deliveries_with_real_balance()
RETURNS TABLE(id uuid, material_id uuid, workshop_id uuid, order_id uuid, delivery_date date, delivered_by uuid, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, total_delivered numeric, total_consumed numeric, real_balance numeric, material_name text, material_sku text, material_unit text, material_color text, material_category text, workshop_name text, order_number text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH material_workshop_totals AS (
    SELECT 
      md.material_id,
      md.workshop_id,
      COALESCE(SUM(CASE WHEN md.quantity_delivered > 0 THEN md.quantity_delivered ELSE 0 END), 0) as total_delivered_qty,
      COALESCE(SUM(CASE WHEN md.quantity_consumed > 0 THEN md.quantity_consumed ELSE 0 END), 0) as total_consumed_qty,
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
    mwt.total_delivered_qty as total_delivered,
    mwt.total_consumed_qty as total_consumed,
    mwt.real_balance_qty as real_balance,
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
  WHERE EXISTS (
    SELECT 1 FROM public.material_deliveries md2 
    WHERE md2.material_id = md.material_id 
    AND md2.workshop_id = md.workshop_id 
    AND md2.quantity_delivered > 0
  )
  ORDER BY md.material_id, md.workshop_id, md.delivery_date DESC;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_material_stock()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  material_record RECORD;
  total_delivered INTEGER;
  total_consumed INTEGER;
  calculated_stock INTEGER;
BEGIN
  FOR material_record IN SELECT id, name, sku FROM public.materials LOOP
    SELECT COALESCE(SUM(quantity_delivered), 0) 
    INTO total_delivered
    FROM public.material_deliveries 
    WHERE material_id = material_record.id AND quantity_delivered > 0;
    
    SELECT COALESCE(SUM(quantity_consumed), 0) 
    INTO total_consumed
    FROM public.material_deliveries 
    WHERE material_id = material_record.id AND quantity_consumed > 0;
    
    calculated_stock := total_delivered - total_consumed;
    
    UPDATE public.materials 
    SET current_stock = calculated_stock,
        updated_at = now()
    WHERE id = material_record.id;
  END LOOP;
  
  UPDATE public.material_deliveries 
  SET quantity_remaining = quantity_delivered - COALESCE(quantity_consumed, 0)
  WHERE quantity_delivered > 0 
    AND quantity_remaining != (quantity_delivered - COALESCE(quantity_consumed, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_deliveries_with_details_v2()
RETURNS TABLE(id uuid, tracking_number text, order_id uuid, order_number text, workshop_id uuid, workshop_name text, delivery_date date, status text, delivered_by uuid, delivered_by_name text, recipient_name text, recipient_phone text, recipient_address text, notes text, created_at timestamp with time zone, items_count bigint, total_quantity bigint, total_approved bigint, total_defective bigint)
LANGUAGE sql
STABLE
SET search_path = ''
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
    COALESCE(SUM(di.quantity_defective), 0) as total_defective
  FROM public.deliveries d
  LEFT JOIN public.orders o ON d.order_id = o.id
  LEFT JOIN public.workshops w ON d.workshop_id = w.id
  LEFT JOIN public.profiles p ON d.delivered_by = p.id
  LEFT JOIN public.delivery_items di ON d.id = di.delivery_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$$;