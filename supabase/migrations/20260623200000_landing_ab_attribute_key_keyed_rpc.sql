-- A/B de PRECIO (ortogonal al de ángulo): mide experimentos por un note_attribute configurable
-- (lp_version=ángulo, lp_precio=precio) + revenue/discounts para computar CM/visitante.
-- El EF landing-ab-dashboard (v2) y este RPC ya están desplegados (vía MCP, 2026-06-23);
-- este archivo versiona el cambio de schema en el repo. Idempotente.

alter table public.landing_ab_experiments
  add column if not exists attribute_key text not null default 'lp_version';

comment on column public.landing_ab_experiments.attribute_key is
  'Clave del note_attribute por la que se mide este experimento. Default lp_version (ángulo). Permite dimensiones ortogonales en el mismo destino (ej. lp_precio para el A/B de precio).';

create or replace function public.landing_ab_order_stats_keyed(p_org uuid, p_start date, p_end date, p_attr text)
returns table(variant text, day date, orders bigint, revenue numeric, discounts numeric)
language sql stable as $func$
  with tagged as (
    select
      (select na->>'value'
         from jsonb_array_elements(o.raw_data->'note_attributes') na
         where na->>'name' = p_attr limit 1) as variant,
      (o.created_at_shopify at time zone 'America/Bogota')::date as day,
      o.total_price as total_price,
      coalesce(o.total_discounts, 0) as total_discounts
    from shopify_orders o
    where o.organization_id = p_org
      and o.cancelled_at is null
      and o.created_at_shopify >= (p_start::timestamp at time zone 'America/Bogota')
      and o.created_at_shopify <  ((p_end + 1)::timestamp at time zone 'America/Bogota')
      and jsonb_typeof(o.raw_data->'note_attributes') = 'array'
  )
  select variant, day, count(*)::bigint as orders,
         coalesce(sum(total_price), 0) as revenue,
         coalesce(sum(total_discounts), 0) as discounts
  from tagged
  where variant is not null
  group by variant, day;
$func$;
