-- Fase 1: Crear funciones de permisos dinámicos

-- 1.1. Función para verificar permisos específicos de entregas
CREATE OR REPLACE FUNCTION public.has_delivery_permission(
  user_uuid uuid, 
  action_name text
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (r.permissions->'deliveries'->>action_name)::boolean,
    false
  )
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid
  LIMIT 1;
$$;

-- 1.2. Función para identificar usuarios que pueden ver todas las entregas
CREATE OR REPLACE FUNCTION public.user_can_view_all_deliveries(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT r.name = ANY(ARRAY['Administrador', 'Diseñador', 'Líder QC'])
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid
  LIMIT 1;
$$;

-- Fase 2: Reescribir políticas RLS de deliveries

-- 2.1. DROP todas las políticas actuales
DROP POLICY IF EXISTS "Admins can view all deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Workshop users view assigned deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Users can create deliveries in their organization" ON public.deliveries;
DROP POLICY IF EXISTS "Users can update deliveries in their organization" ON public.deliveries;
DROP POLICY IF EXISTS "Admins can delete deliveries in their organization" ON public.deliveries;

-- 2.2. Crear políticas basadas en permisos dinámicos

-- SELECT: Basado en permisos y tipo de usuario
CREATE POLICY "Users can view deliveries based on permissions"
ON public.deliveries
FOR SELECT
TO authenticated
USING (
  organization_id = get_current_organization_safe()
  AND (
    -- Usuarios con permiso view Y rol que ve todo (Admin, Diseñador, Líder QC)
    (has_delivery_permission(auth.uid(), 'view') 
     AND user_can_view_all_deliveries(auth.uid()))
    OR
    -- Usuarios de taller ven solo sus entregas
    (has_delivery_permission(auth.uid(), 'view')
     AND workshop_id IN (
       SELECT workshop_id FROM user_roles 
       WHERE user_id = auth.uid() AND workshop_id IS NOT NULL
     ))
  )
);

-- INSERT: Basado en permiso create
CREATE POLICY "Users can create deliveries based on permissions"
ON public.deliveries
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_current_organization_safe()
  AND has_delivery_permission(auth.uid(), 'create')
  AND (
    -- Admin/Diseñador/Líder QC pueden crear para cualquier taller
    user_can_view_all_deliveries(auth.uid())
    OR
    -- Usuarios de taller solo para su taller
    workshop_id IN (
      SELECT workshop_id FROM user_roles 
      WHERE user_id = auth.uid() AND workshop_id IS NOT NULL
    )
  )
);

-- UPDATE: Basado en permiso edit
CREATE POLICY "Users can update deliveries based on permissions"
ON public.deliveries
FOR UPDATE
TO authenticated
USING (
  organization_id = get_current_organization_safe()
  AND (
    -- Admin/Diseñador/Líder QC pueden editar todas
    (has_delivery_permission(auth.uid(), 'edit')
     AND user_can_view_all_deliveries(auth.uid()))
    OR
    -- Usuarios de taller solo sus entregas
    (has_delivery_permission(auth.uid(), 'edit')
     AND workshop_id IN (
       SELECT workshop_id FROM user_roles 
       WHERE user_id = auth.uid() AND workshop_id IS NOT NULL
     ))
  )
);

-- DELETE: Basado en permiso delete
CREATE POLICY "Users can delete deliveries based on permissions"
ON public.deliveries
FOR DELETE
TO authenticated
USING (
  organization_id = get_current_organization_safe()
  AND has_delivery_permission(auth.uid(), 'delete')
  AND user_can_view_all_deliveries(auth.uid())
);

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_workshop_id ON public.user_roles(workshop_id) WHERE workshop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_workshop_id ON public.deliveries(workshop_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_organization_id ON public.deliveries(organization_id);