-- Add unique constraint to prevent future duplications of material consumption
-- This constraint will prevent inserting duplicate consumption records for the same material, order, and date
CREATE UNIQUE INDEX CONCURRENTLY idx_material_deliveries_unique_consumption 
ON public.material_deliveries (material_id, order_id, delivery_date, delivered_by)
WHERE quantity_consumed > 0;

-- Add a comment to explain the constraint
COMMENT ON INDEX idx_material_deliveries_unique_consumption IS 
'Prevents duplicate material consumption records for the same material, order, date, and user';