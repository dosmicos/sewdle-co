-- Grant EXECUTE permissions on refresh_inventory_replenishment function
GRANT EXECUTE ON FUNCTION public.refresh_inventory_replenishment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_inventory_replenishment(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.refresh_inventory_replenishment(UUID) TO service_role;

-- Grant permissions on inventory_replenishment table (the correct table name)
GRANT SELECT, INSERT, DELETE ON public.inventory_replenishment TO authenticated;

-- Grant permissions on v_replenishment_details view
GRANT SELECT ON public.v_replenishment_details TO authenticated;