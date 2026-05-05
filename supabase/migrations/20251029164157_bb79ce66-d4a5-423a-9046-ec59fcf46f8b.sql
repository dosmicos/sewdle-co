-- Grant permissions for inventory replenishment system

-- 1. Grant EXECUTE permissions on the RPC function
GRANT EXECUTE ON FUNCTION refresh_inventory_replenishment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_inventory_replenishment(UUID) TO service_role;

-- 2. Grant SELECT permissions on the view
GRANT SELECT ON v_replenishment_details TO authenticated;
GRANT SELECT ON v_replenishment_details TO service_role;

-- 3. Grant permissions on the inventory_replenishment table
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_replenishment TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_replenishment TO service_role;