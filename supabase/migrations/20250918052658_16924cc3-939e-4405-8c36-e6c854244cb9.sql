-- Crear tabla de bodegas (solo una bodega central)
CREATE TABLE public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  is_central BOOLEAN NOT NULL DEFAULT false,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de inventario por ubicación
CREATE TABLE public.material_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('warehouse', 'workshop')),
  location_id UUID NOT NULL, -- warehouse_id o workshop_id
  current_stock NUMERIC NOT NULL DEFAULT 0,
  reserved_stock NUMERIC NOT NULL DEFAULT 0,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(material_id, location_type, location_id)
);

-- Crear tabla de transferencias de materiales
CREATE TABLE public.material_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL,
  from_location_type TEXT NOT NULL CHECK (from_location_type IN ('warehouse', 'workshop')),
  from_location_id UUID NOT NULL,
  to_location_type TEXT NOT NULL CHECK (to_location_type IN ('warehouse', 'workshop')),
  to_location_id UUID NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
  notes TEXT,
  requested_by UUID,
  approved_by UUID,
  completed_by UUID,
  transfer_date TIMESTAMP WITH TIME ZONE,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_transfers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para warehouses
CREATE POLICY "Users can view warehouses in their organization" 
ON public.warehouses FOR SELECT 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Admin users can manage warehouses" 
ON public.warehouses FOR ALL 
USING (organization_id = get_current_organization_safe() AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador']))
WITH CHECK (organization_id = get_current_organization_safe());

-- Políticas RLS para material_inventory
CREATE POLICY "Users can view material inventory in their organization" 
ON public.material_inventory FOR SELECT 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can manage material inventory in their organization" 
ON public.material_inventory FOR ALL 
USING (organization_id = get_current_organization_safe() AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador']))
WITH CHECK (organization_id = get_current_organization_safe());

-- Políticas RLS para material_transfers
CREATE POLICY "Users can view material transfers in their organization" 
ON public.material_transfers FOR SELECT 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can create material transfers in their organization" 
ON public.material_transfers FOR INSERT 
WITH CHECK (organization_id = get_current_organization_safe() AND auth.uid() IS NOT NULL);

CREATE POLICY "Admin users can manage material transfers" 
ON public.material_transfers FOR ALL 
USING (organization_id = get_current_organization_safe() AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador']))
WITH CHECK (organization_id = get_current_organization_safe());

-- Función para obtener stock disponible en una ubicación
CREATE OR REPLACE FUNCTION public.get_material_stock_by_location(
  p_material_id UUID,
  p_location_type TEXT,
  p_location_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  available_stock NUMERIC := 0;
BEGIN
  SELECT COALESCE(current_stock - reserved_stock, 0) 
  INTO available_stock
  FROM material_inventory
  WHERE material_id = p_material_id 
    AND location_type = p_location_type 
    AND location_id = p_location_id;
    
  RETURN COALESCE(available_stock, 0);
END;
$$;

-- Función para procesar transferencia de materiales
CREATE OR REPLACE FUNCTION public.process_material_transfer(
  p_transfer_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  transfer_record RECORD;
  available_stock NUMERIC;
BEGIN
  -- Obtener datos de la transferencia
  SELECT * INTO transfer_record
  FROM material_transfers
  WHERE id = p_transfer_id AND status = 'approved';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found or not approved';
  END IF;
  
  -- Verificar stock disponible en origen
  available_stock := get_material_stock_by_location(
    transfer_record.material_id,
    transfer_record.from_location_type,
    transfer_record.from_location_id
  );
  
  IF available_stock < transfer_record.quantity THEN
    RAISE EXCEPTION 'Insufficient stock available. Available: %, Required: %', available_stock, transfer_record.quantity;
  END IF;
  
  -- Reducir stock en origen
  INSERT INTO material_inventory (material_id, location_type, location_id, current_stock, organization_id)
  VALUES (transfer_record.material_id, transfer_record.from_location_type, transfer_record.from_location_id, -transfer_record.quantity, transfer_record.organization_id)
  ON CONFLICT (material_id, location_type, location_id)
  DO UPDATE SET 
    current_stock = material_inventory.current_stock - transfer_record.quantity,
    updated_at = now();
  
  -- Aumentar stock en destino
  INSERT INTO material_inventory (material_id, location_type, location_id, current_stock, organization_id)
  VALUES (transfer_record.material_id, transfer_record.to_location_type, transfer_record.to_location_id, transfer_record.quantity, transfer_record.organization_id)
  ON CONFLICT (material_id, location_type, location_id)
  DO UPDATE SET 
    current_stock = material_inventory.current_stock + transfer_record.quantity,
    updated_at = now();
  
  -- Marcar transferencia como completada
  UPDATE material_transfers
  SET status = 'completed',
      completed_by = auth.uid(),
      transfer_date = now(),
      updated_at = now()
  WHERE id = p_transfer_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error processing transfer: %', SQLERRM;
END;
$$;

-- Crear bodega central por defecto para cada organización
INSERT INTO public.warehouses (name, description, is_central, organization_id)
SELECT 
  'Bodega Central',
  'Bodega principal para almacenamiento de insumos',
  true,
  id
FROM public.organizations
WHERE NOT EXISTS (
  SELECT 1 FROM public.warehouses w 
  WHERE w.organization_id = organizations.id AND w.is_central = true
);

-- Triggers para actualizar timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_material_inventory_updated_at
  BEFORE UPDATE ON public.material_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_material_transfers_updated_at
  BEFORE UPDATE ON public.material_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();