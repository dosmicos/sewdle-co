-- Eliminar las sugerencias de reposición específicas que bloquean la variante 46678145859819
DELETE FROM public.replenishment_suggestions 
WHERE id IN (
  '20cfbd16-f3f4-48b5-b198-be3ce3720d7d',  -- Sugerencia pendiente
  'ca9cffde-aab2-447a-9039-15fa7fabd571'   -- Sugerencia rechazada
);

-- Verificar que no quedan más sugerencias para esta variante
-- Esta consulta debería retornar 0 filas después de la eliminación
SELECT 
  id, 
  status, 
  created_at,
  urgency_level,
  suggested_quantity
FROM public.replenishment_suggestions 
WHERE product_variant_id = (
  SELECT id FROM public.product_variants 
  WHERE sku_variant = '46678145859819'
);