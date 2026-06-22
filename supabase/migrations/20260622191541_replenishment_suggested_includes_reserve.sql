-- "Sugerida" pasa a ser el TOTAL a producir = demanda reactiva + reserva de temporada.
-- Se deriva EN LA VISTA (siempre en vivo, sin depender del RPC ni de que se borre el snapshot):
--   season_reserve_total = cuota total de reserva de la talla = round(meta_categoría × share_demanda)
--   suggested_total      = suggested_quantity + season_reserve_total
-- "Esta semana" (this_week_target) sigue siendo la porción semanal.
-- Para categorías sin meta (chaquetas/otros), reserve = NULL → suggested_total = suggested_quantity.
drop view if exists public.v_replenishment_details;
create view public.v_replenishment_details as
with active_plan as (
  select sp.id, sp.organization_id
  from public.season_production_plans sp
  where sp.status = 'active'
),
cat_targets as (
  select ap.organization_id, t.category, t.reserve_target
  from active_plan ap
  join public.season_plan_category_targets t on t.plan_id = ap.id
),
base as (
  select ir.*,
         p.name as product_name,
         p.sku,
         pv.sku_variant,
         pv.size  as variant_size,
         pv.color as variant_color,
         classify_product_category(p.name) as _category
  from public.inventory_replenishment ir
  join public.product_variants pv on ir.variant_id = pv.id
  join public.products p on pv.product_id = p.id
),
shares as (
  select b.*,
         ct.reserve_target,
         case when sum(b.avg_daily_sales) over (partition by b.organization_id, b._category, b.calculation_date) > 0
              then b.avg_daily_sales / sum(b.avg_daily_sales) over (partition by b.organization_id, b._category, b.calculation_date)
              else 0 end as _share
  from base b
  left join cat_targets ct on ct.organization_id = b.organization_id and ct.category = b._category
)
select
  id, variant_id, organization_id, current_stock, pending_production, in_transit, sales_30d, orders_count_30d,
  avg_daily_sales, days_of_supply, projected_demand_40d, suggested_quantity, urgency, reason, data_confidence,
  calculated_at, calculation_date, status, last_known_velocity,
  product_name, sku, sku_variant, variant_size, variant_color,
  case when avg_daily_sales > 0::numeric
       then round((current_stock + pending_production + coalesce(in_transit, 0))::numeric / avg_daily_sales, 1)
       else null::numeric end as pipeline_coverage_days,
  season_suggested,
  season_reserve_quota,
  coalesce(season_suggested, suggested_quantity) as this_week_target,
  case when reserve_target is not null then round(reserve_target * _share)::int else null end as season_reserve_total,
  suggested_quantity + coalesce(case when reserve_target is not null then round(reserve_target * _share)::int else 0 end, 0) as suggested_total
from shares;
