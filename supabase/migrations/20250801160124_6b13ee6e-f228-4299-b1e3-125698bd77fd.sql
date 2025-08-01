-- Actualizar límites por defecto de las organizaciones según los nuevos planes

-- Actualizar organizaciones Starter (plan por defecto)
UPDATE public.organizations 
SET 
  max_users = 3,
  max_orders_per_month = 10,
  max_workshops = 5
WHERE plan = 'starter' OR plan IS NULL;

-- Actualizar organizaciones Professional
UPDATE public.organizations 
SET 
  max_users = 10,
  max_orders_per_month = -1, -- ilimitado
  max_workshops = 20
WHERE plan = 'professional';

-- Actualizar organizaciones Enterprise
UPDATE public.organizations 
SET 
  max_users = -1, -- ilimitado
  max_orders_per_month = -1, -- ilimitado
  max_workshops = -1 -- ilimitado
WHERE plan = 'enterprise';

-- Asegurar que las organizaciones tengan un plan válido
UPDATE public.organizations 
SET plan = 'starter' 
WHERE plan IS NULL OR plan NOT IN ('starter', 'professional', 'enterprise');