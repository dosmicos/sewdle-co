-- Actualizar políticas RLS de shopify_order_line_items para incluir rol Líder QC

-- Eliminar política SELECT existente
DROP POLICY IF EXISTS "Admin users can view shopify line items in their organization" ON shopify_order_line_items;

-- Crear nueva política SELECT que incluye Líder QC
CREATE POLICY "Admin users can view shopify line items in their organization"
ON shopify_order_line_items
FOR SELECT
TO authenticated
USING (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text, 'Líder QC'::text])
);