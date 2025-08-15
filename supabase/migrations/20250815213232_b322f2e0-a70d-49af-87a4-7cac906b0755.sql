-- Fix remaining material_deliveries records with NULL organization_id
-- For records without an order_id, we'll need to infer the organization from the workshop or user context

-- First, update records that have order_id but still NULL organization_id
UPDATE public.material_deliveries 
SET organization_id = orders.organization_id
FROM public.orders 
WHERE material_deliveries.order_id = orders.id 
  AND material_deliveries.organization_id IS NULL;

-- For records without order_id, try to get organization from workshop
UPDATE public.material_deliveries 
SET organization_id = workshops.organization_id
FROM public.workshops 
WHERE material_deliveries.workshop_id = workshops.id 
  AND material_deliveries.organization_id IS NULL
  AND material_deliveries.order_id IS NULL;

-- For records without order_id or workshop_id, use the material's organization
UPDATE public.material_deliveries 
SET organization_id = materials.organization_id
FROM public.materials 
WHERE material_deliveries.material_id = materials.id 
  AND material_deliveries.organization_id IS NULL
  AND material_deliveries.order_id IS NULL
  AND material_deliveries.workshop_id IS NULL;

-- Create a trigger function to ensure organization_id is always set
CREATE OR REPLACE FUNCTION public.ensure_material_delivery_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If organization_id is already set, keep it
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Try to get organization_id from order
  IF NEW.order_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.orders
    WHERE id = NEW.order_id;
    
    IF NEW.organization_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
  -- Try to get organization_id from workshop
  IF NEW.workshop_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.workshops
    WHERE id = NEW.workshop_id;
    
    IF NEW.organization_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
  -- Try to get organization_id from material
  IF NEW.material_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.materials
    WHERE id = NEW.material_id;
    
    IF NEW.organization_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
  -- As fallback, use current user's organization
  SELECT get_current_organization_safe() INTO NEW.organization_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS ensure_material_delivery_org_id ON public.material_deliveries;
CREATE TRIGGER ensure_material_delivery_org_id
  BEFORE INSERT OR UPDATE ON public.material_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_material_delivery_organization_id();