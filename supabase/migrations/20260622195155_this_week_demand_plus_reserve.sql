-- "Esta semana" (lo que se produce/ordena cada semana) = demanda reactiva por talla
-- (suggested_quantity, reponer la venta) + la cuota de reserva de esta semana
-- (season_reserve_quota). Antes "Esta semana" solo traía la reserva (la parte de ventas
-- se calculaba por categoría y quedaba en 0 para la talla individual).
-- "Sugerida" vuelve a ser la demanda reactiva (no el total de la temporada).
drop view if exists public.v_replenishment_details;
create view public.v_replenishment_details as
 SELECT ir.id,
    ir.variant_id,
    ir.organization_id,
    ir.current_stock,
    ir.pending_production,
    ir.in_transit,
    ir.sales_30d,
    ir.orders_count_30d,
    ir.avg_daily_sales,
    ir.days_of_supply,
    ir.projected_demand_40d,
    ir.suggested_quantity,
    ir.urgency,
    ir.reason,
    ir.data_confidence,
    ir.calculated_at,
    ir.calculation_date,
    ir.status,
    ir.last_known_velocity,
    p.name AS product_name,
    p.sku,
    pv.sku_variant,
    pv.size AS variant_size,
    pv.color AS variant_color,
        CASE
            WHEN ir.avg_daily_sales > 0::numeric THEN round((ir.current_stock + ir.pending_production + COALESCE(ir.in_transit, 0))::numeric / ir.avg_daily_sales, 1)
            ELSE NULL::numeric
        END AS pipeline_coverage_days,
    ir.season_suggested,
    ir.season_reserve_quota,
    -- "Esta semana" = reponer la venta (suggested_quantity) + cuota de reserva de la semana
    ir.suggested_quantity + COALESCE(ir.season_reserve_quota, 0) AS this_week_target
   FROM inventory_replenishment ir
     JOIN product_variants pv ON ir.variant_id = pv.id
     JOIN products p ON pv.product_id = p.id;
