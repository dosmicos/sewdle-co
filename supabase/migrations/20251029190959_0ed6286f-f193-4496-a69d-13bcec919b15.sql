-- Grant EXECUTE permissions on refresh_inventory_replenishment function
GRANT EXECUTE ON FUNCTION public.refresh_inventory_replenishment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_inventory_replenishment(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.refresh_inventory_replenishment(UUID) TO service_role;

-- Grant permissions on v_replenishment_details view
GRANT SELECT ON public.v_replenishment_details TO authenticated;