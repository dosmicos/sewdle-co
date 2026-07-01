-- Agregado del lado del servidor para el gráfico "Progreso de la Producción".
-- Antes el hook traía delivery_items al cliente y agrupaba, pero PostgREST corta
-- en 1000 filas por defecto → con >1000 entregas en la ventana (6 meses / 8 semanas)
-- los meses del medio salían truncados (mar/abr/may mostraban ~1/4 de lo real).
-- Aquí se suma en la base, sin límite. Devuelve los buckets ya calculados
-- (más antiguo → más reciente); el front solo arma la etiqueta.
create or replace function public.get_admin_production_progress(
  p_org_id uuid,
  p_store_id uuid default null,
  p_mode text default 'monthly',   -- 'monthly' | 'weekly'
  p_periods int default 6
)
returns table(period_start date, period_end date, delivered integer, approved integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with today as (
    select (now() at time zone 'America/Bogota')::date as d
  ),
  periods as (
    select
      case when p_mode = 'weekly'
        then (select d from today) - ((p_periods - 1 - g) * 7 + 6)
        else (date_trunc('month', (select d from today))::date - make_interval(months => (p_periods - 1 - g)))::date
      end as period_start,
      case when p_mode = 'weekly'
        then (select d from today) - ((p_periods - 1 - g) * 7)
        else (date_trunc('month', (select d from today))::date - make_interval(months => (p_periods - 1 - g)) + interval '1 month' - interval '1 day')::date
      end as period_end
    from generate_series(0, p_periods - 1) g
  ),
  items as (
    select d.delivery_date::date as dd, di.quantity_delivered, di.quantity_approved
    from delivery_items di
    join deliveries d on d.id = di.delivery_id
    join orders o on o.id = d.order_id
    where o.organization_id = p_org_id
      and (p_store_id is null or o.store_id = p_store_id)
      and d.delivery_date >= (select min(period_start) from periods)
      and d.delivery_date <= (select max(period_end) from periods)
  )
  select
    p.period_start,
    p.period_end,
    coalesce(sum(i.quantity_delivered), 0)::int as delivered,
    coalesce(sum(i.quantity_approved), 0)::int as approved
  from periods p
  left join items i on i.dd >= p.period_start and i.dd <= p.period_end
  group by p.period_start, p.period_end
  order by p.period_start;
$function$;
