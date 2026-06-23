-- Suma del lado del servidor de las tarjetas del Dashboard General.
-- Antes el hook traía order_items/delivery_items al cliente y sumaba, pero PostgREST
-- corta en 1000 filas por defecto, así que "Unidades en Producción" salía truncado
-- (mostraba ~2.463 cuando el real es ~11.900). Aquí se suma en la base, sin límite.
create or replace function public.get_admin_dashboard_stats(p_org_id uuid, p_store_id uuid default null)
returns table(
  active_orders integer,
  units_in_production integer,
  delivered_this_week integer,
  approved_this_week integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with active as (
    select o.id
    from orders o
    where o.organization_id = p_org_id
      and o.status in ('pending','assigned','in_progress')
      and (p_store_id is null or o.store_id = p_store_id)
  ),
  ordered as (
    select coalesce(sum(oi.quantity),0) s
    from order_items oi
    where oi.order_id in (select id from active)
  ),
  approved as (
    select coalesce(sum(di.quantity_approved),0) s
    from delivery_items di
    join deliveries d on d.id = di.delivery_id
    where d.order_id in (select id from active)
  ),
  week as (
    select
      coalesce(sum(di.quantity_delivered),0) as delivered,
      coalesce(sum(di.quantity_approved),0) as approved
    from delivery_items di
    join deliveries d on d.id = di.delivery_id
    join orders o on o.id = d.order_id
    where o.organization_id = p_org_id
      and (p_store_id is null or o.store_id = p_store_id)
      and d.delivery_date >= (current_date - interval '7 days')
  )
  select
    (select count(*)::int from active) as active_orders,
    greatest(0, (select s from ordered) - (select s from approved))::int as units_in_production,
    (select delivered from week)::int as delivered_this_week,
    (select approved from week)::int as approved_this_week;
$function$;
