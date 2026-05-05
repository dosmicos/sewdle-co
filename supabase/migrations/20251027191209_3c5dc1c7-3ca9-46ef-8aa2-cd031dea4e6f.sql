-- Actualizar políticas RLS de shopify_orders para incluir rol Líder QC

-- Eliminar política SELECT existente
DROP POLICY IF EXISTS "Admins can view shopify orders in their organization only" ON shopify_orders;

-- Crear nueva política SELECT que incluye Líder QC
CREATE POLICY "Admins can view shopify orders in their organization only"
ON shopify_orders
FOR SELECT
TO public
USING (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text, 'Líder QC'::text])
);

-- Eliminar política ALL existente
DROP POLICY IF EXISTS "Admin users can manage shopify orders in their organization" ON shopify_orders;

-- Crear nueva política ALL que incluye Líder QC
CREATE POLICY "Admin users can manage shopify orders in their organization"
ON shopify_orders
FOR ALL
TO authenticated
USING (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text, 'Líder QC'::text])
)
WITH CHECK (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text, 'Líder QC'::text])
);