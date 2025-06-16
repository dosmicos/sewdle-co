
-- Crear tabla para asignaciones de trabajo con campos adicionales
CREATE TABLE IF NOT EXISTS public.workshop_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_date DATE DEFAULT CURRENT_DATE,
  expected_completion_date DATE,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled', 'delayed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id, workshop_id)
);

-- Habilitar RLS en workshop_assignments
ALTER TABLE public.workshop_assignments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para workshop_assignments
CREATE POLICY "Authenticated users can view assignments" 
  ON workshop_assignments 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can create assignments" 
  ON workshop_assignments 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update assignments" 
  ON workshop_assignments 
  FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete assignments" 
  ON workshop_assignments 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- Agregar campos de seguimiento a la tabla orders si no existen
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled'));

-- Función para obtener estadísticas de capacidad de talleres
CREATE OR REPLACE FUNCTION public.get_workshop_capacity_stats()
RETURNS TABLE (
  workshop_id UUID,
  workshop_name TEXT,
  total_capacity INTEGER,
  current_assignments BIGINT,
  available_capacity INTEGER,
  completion_rate NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    w.id as workshop_id,
    w.name as workshop_name,
    COALESCE(w.capacity, 0) as total_capacity,
    COUNT(wa.id) FILTER (WHERE wa.status IN ('assigned', 'in_progress')) as current_assignments,
    GREATEST(0, COALESCE(w.capacity, 0) - COUNT(wa.id) FILTER (WHERE wa.status IN ('assigned', 'in_progress'))) as available_capacity,
    CASE 
      WHEN COUNT(wa.id) FILTER (WHERE wa.status IN ('completed', 'cancelled')) > 0 
      THEN ROUND(
        (COUNT(wa.id) FILTER (WHERE wa.status = 'completed')::NUMERIC / 
         COUNT(wa.id) FILTER (WHERE wa.status IN ('completed', 'cancelled'))::NUMERIC) * 100, 
        2
      )
      ELSE 0
    END as completion_rate
  FROM workshops w
  LEFT JOIN workshop_assignments wa ON w.id = wa.workshop_id
  WHERE w.status = 'active'
  GROUP BY w.id, w.name, w.capacity
  ORDER BY w.name;
$$;

-- Trigger para actualizar el estado de la orden cuando se asigna
CREATE OR REPLACE FUNCTION public.update_order_status_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Actualizar estado de la orden cuando se crea una asignación
  IF TG_OP = 'INSERT' THEN
    UPDATE public.orders 
    SET status = 'assigned', updated_at = now()
    WHERE id = NEW.order_id;
    RETURN NEW;
  END IF;
  
  -- Actualizar estado de la orden cuando se actualiza una asignación
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.orders 
    SET status = CASE 
      WHEN NEW.status = 'completed' THEN 'completed'
      WHEN NEW.status = 'in_progress' THEN 'in_progress'
      WHEN NEW.status = 'cancelled' THEN 'cancelled'
      ELSE 'assigned'
    END,
    updated_at = now()
    WHERE id = NEW.order_id;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Crear el trigger
DROP TRIGGER IF EXISTS trigger_update_order_status ON public.workshop_assignments;
CREATE TRIGGER trigger_update_order_status
  AFTER INSERT OR UPDATE ON public.workshop_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_status_on_assignment();

-- Función para obtener órdenes disponibles para asignar
CREATE OR REPLACE FUNCTION public.get_available_orders()
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  client_name TEXT,
  due_date DATE,
  total_amount NUMERIC,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    o.id,
    o.order_number,
    o.client_name,
    o.due_date,
    o.total_amount,
    o.status,
    o.created_at
  FROM orders o
  WHERE o.status IN ('pending', 'assigned')
  ORDER BY o.due_date ASC NULLS LAST, o.created_at ASC;
$$;
