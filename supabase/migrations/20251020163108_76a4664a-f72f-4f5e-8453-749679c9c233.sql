-- Eliminar la versión antigua de la función con parámetro org_id
-- Esta versión tiene referencias a columnas obsoletas como variant_id
DROP FUNCTION IF EXISTS public.get_replenishment_suggestions_with_details(org_id uuid);

-- La versión sin parámetros (correcta) se mantiene intacta y usa get_current_organization_safe() internamente