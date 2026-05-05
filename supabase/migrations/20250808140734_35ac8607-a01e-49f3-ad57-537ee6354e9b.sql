-- Fix the security definer function to have proper search path
CREATE OR REPLACE FUNCTION prevent_duplicate_material_consumption()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check for duplicates when inserting consumption records (quantity_consumed > 0)
  IF NEW.quantity_consumed > 0 THEN
    -- Check if there's already a consumption record for this material, order, date, and user
    IF EXISTS (
      SELECT 1 FROM public.material_deliveries
      WHERE material_id = NEW.material_id
        AND order_id = NEW.order_id
        AND delivery_date = NEW.delivery_date
        AND COALESCE(delivered_by, auth.uid()) = COALESCE(NEW.delivered_by, auth.uid())
        AND quantity_consumed > 0
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Ya existe un registro de consumo para este material, orden y fecha. Por favor, edite el registro existente en lugar de crear uno nuevo.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';