-- Fix existing material_deliveries records with NULL organization_id
-- Update records to use the organization_id from their associated orders
UPDATE public.material_deliveries 
SET organization_id = orders.organization_id
FROM public.orders 
WHERE material_deliveries.order_id = orders.id 
  AND material_deliveries.organization_id IS NULL;

-- Drop existing function to allow recreation with fixes
DROP FUNCTION IF EXISTS public.consume_order_materials(UUID, JSONB);

-- Create improved function to consume order materials with proper organization_id
CREATE OR REPLACE FUNCTION public.consume_order_materials(
  p_order_id UUID,
  p_consumptions JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  consumption_item JSONB;
  order_org_id UUID;
  current_workshop_id UUID;
BEGIN
  -- Get the order's organization_id and workshop_id
  SELECT 
    o.organization_id,
    wa.workshop_id
  INTO order_org_id, current_workshop_id
  FROM orders o
  LEFT JOIN workshop_assignments wa ON o.id = wa.order_id
  WHERE o.id = p_order_id
  LIMIT 1;
  
  IF order_org_id IS NULL THEN
    RAISE EXCEPTION 'Order not found or missing organization';
  END IF;
  
  -- Process each consumption item
  FOR consumption_item IN SELECT * FROM jsonb_array_elements(p_consumptions)
  LOOP
    -- Insert material consumption record with proper organization_id
    INSERT INTO material_deliveries (
      material_id,
      workshop_id,
      order_id,
      organization_id,
      quantity_consumed,
      quantity_delivered,
      quantity_remaining,
      delivery_date,
      delivered_by
    ) VALUES (
      (consumption_item->>'material_id')::UUID,
      COALESCE(current_workshop_id, (consumption_item->>'workshop_id')::UUID),
      p_order_id,
      order_org_id, -- Ensure organization_id is always set
      (consumption_item->>'quantity')::NUMERIC,
      0, -- No delivery, just consumption
      0, -- No remaining since this is consumption
      CURRENT_DATE,
      auth.uid()
    );
    
    -- Update material stock if needed
    UPDATE materials 
    SET current_stock = current_stock - (consumption_item->>'quantity')::NUMERIC
    WHERE id = (consumption_item->>'material_id')::UUID
      AND organization_id = order_org_id;
  END LOOP;
  
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error consuming materials: %', SQLERRM;
END;
$$;