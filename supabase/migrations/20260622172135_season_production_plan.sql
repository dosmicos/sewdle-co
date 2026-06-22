-- ============================================================================
-- Plan de Temporada (reposición time-phased): construir una reserva por categoría
-- a una fecha objetivo, produciendo progresivamente según una capacidad semanal
-- creciente. Aditivo sobre la "Reposición IA" actual; no cambia su contrato.
-- ============================================================================

-- A. Clasificador de categoría — fuente única (replica extractCategory del front,
--    src/hooks/useInventoryStats.ts). products.category NO sirve (es 'Shopify Import').
create or replace function public.classify_product_category(p_name text)
returns text language sql immutable as $$
  select case
    when lower(coalesce(p_name, '')) like '%ruana%'    then 'Ruanas'
    when lower(coalesce(p_name, '')) like '%sleeping%' then 'Sleepings'
    when lower(coalesce(p_name, '')) like '%chaqueta%'
      or lower(coalesce(p_name, '')) like '%parka%'
      or lower(coalesce(p_name, '')) like '%buso%'     then 'Chaquetas'
    else 'Otros'
  end;
$$;

-- B. Config y salida -----------------------------------------------------------
create table if not exists public.season_production_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null default 'Temporada',
  target_date date not null,
  plan_start_date date not null default current_date,
  capacity_mode text not null default 'shared' check (capacity_mode in ('shared','per_category')),
  baseline_weekly_capacity integer,                 -- NULL => autoestimar del histórico
  target_weekly_capacity integer not null default 0,
  ramp_weeks integer not null default 6 check (ramp_weeks >= 0),
  ramp_profile text not null default 'linear' check (ramp_profile in ('linear','immediate','s_curve')),
  seasonal_uplift numeric not null default 1.0 check (seasonal_uplift >= 0),
  lead_weeks integer not null default 0 check (lead_weeks >= 0),
  include_zero_sales_variants boolean not null default false,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_season_plan_active_per_org
  on public.season_production_plans (organization_id) where status = 'active';

create table if not exists public.season_plan_category_targets (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.season_production_plans(id) on delete cascade,
  organization_id uuid not null,
  category text not null,
  reserve_target integer not null default 0,
  baseline_weekly_capacity integer,                 -- override opcional (modo per_category)
  target_weekly_capacity integer,
  ramp_weeks integer,
  unique (plan_id, category)
);

create table if not exists public.production_plan_weeks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.season_production_plans(id) on delete cascade,
  organization_id uuid not null,
  category text not null,
  week_index integer not null,                      -- 0 = semana actual
  week_start date not null,
  expected_sales integer not null default 0,
  weekly_capacity integer not null default 0,
  planned_production integer not null default 0,
  reserve_quota integer not null default 0,
  sales_replenishment integer not null default 0,
  projected_on_hand_end integer not null default 0,
  projected_reserve_accumulated integer not null default 0,
  stockout boolean not null default false,
  calculation_date date not null default current_date,
  unique (plan_id, category, week_index, calculation_date)
);
create index if not exists idx_ppw_lookup on public.production_plan_weeks (organization_id, calculation_date, category, week_index);

create table if not exists public.production_plan_feasibility (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.season_production_plans(id) on delete cascade,
  organization_id uuid not null,
  category text not null,                            -- 'Ruanas'|'Sleepings'|... o 'ALL' (rollup)
  horizon_weeks integer not null,
  current_pipeline integer not null default 0,
  expected_sales_total integer not null default 0,
  reserve_target integer not null default 0,
  production_needed integer not null default 0,
  total_capacity integer not null default 0,
  baseline_weekly_capacity integer not null default 0,
  feasible boolean not null default false,
  shortfall integer not null default 0,
  min_target_weekly_capacity integer,
  calculation_date date not null default current_date,
  unique (plan_id, category, calculation_date)
);

-- C. Columnas aditivas en inventory_replenishment (las llena el RPC; inserts actuales = NULL)
alter table public.inventory_replenishment
  add column if not exists season_suggested integer,
  add column if not exists season_reserve_quota integer;

-- D. RLS (mismo patrón que inventory_replenishment) ---------------------------
alter table public.season_production_plans      enable row level security;
alter table public.season_plan_category_targets enable row level security;
alter table public.production_plan_weeks        enable row level security;
alter table public.production_plan_feasibility  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['season_production_plans','season_plan_category_targets','production_plan_weeks','production_plan_feasibility']
  loop
    execute format($f$
      drop policy if exists "Users view %1$s in their org" on public.%1$s;
      create policy "Users view %1$s in their org" on public.%1$s for select
        using (organization_id in (
          select organization_users.organization_id from organization_users
          where organization_users.user_id = auth.uid() and organization_users.status = 'active'));
      drop policy if exists "Admins manage %1$s" on public.%1$s;
      create policy "Admins manage %1$s" on public.%1$s for all
        using (organization_id in (
                 select organization_users.organization_id from organization_users
                 where organization_users.user_id = auth.uid() and organization_users.status = 'active')
               and get_current_user_role_safe() = any (array['Administrador','Diseñador']))
        with check (organization_id in (
          select organization_users.organization_id from organization_users
          where organization_users.user_id = auth.uid() and organization_users.status = 'active'));
    $f$, t);
  end loop;
end $$;

-- E. RPC time-phased -----------------------------------------------------------
-- Lee el snapshot de hoy de inventory_replenishment (reusa stock/pipeline/velocidad),
-- agrupa por categoría, y produce el plan semanal + factibilidad + cuota por SKU.
create or replace function public.refresh_season_production_plan(org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_plan       public.season_production_plans%rowtype;
  v_today      date := current_date;
  v_week0      date;
  v_n          integer;
  v_t          integer;
  v_cat        record;
  v_ramp       numeric;
  v_pool_base  numeric;
  v_pool_tgt   numeric;
  v_pool_cap   numeric;
  v_weight_sum numeric;
  v_alloc      numeric;
  v_sales_prod numeric;
  v_res_prod   numeric;
  v_cap_left   numeric;
  v_need_sales numeric;
  v_planned0   integer;
  v_reserve0   integer;
begin
  select * into v_plan from public.season_production_plans
   where organization_id = org_id and status = 'active' limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_active_plan');
  end if;

  v_week0 := date_trunc('week', greatest(v_plan.plan_start_date, v_today))::date;
  v_n     := greatest(1, ceil((v_plan.target_date - v_week0)::numeric / 7.0)::int);

  -- limpiar snapshot de hoy
  delete from public.production_plan_weeks       where plan_id = v_plan.id and calculation_date = v_today;
  delete from public.production_plan_feasibility where plan_id = v_plan.id and calculation_date = v_today;
  update public.inventory_replenishment set season_suggested = null, season_reserve_quota = null
   where organization_id = org_id and calculation_date = v_today;

  -- Tabla de trabajo por categoría (solo las que tienen meta)
  create temp table _cat on commit drop as
  with snap as (
    select classify_product_category(p.name) as category,
           sum(ir.current_stock + ir.pending_production + ir.in_transit) as pipeline,
           round(sum(ir.avg_daily_sales) * 7.0)::int as weekly_sales0
    from public.inventory_replenishment ir
    join public.product_variants pv on pv.id = ir.variant_id
    join public.products p on p.id = pv.product_id
    where ir.organization_id = org_id and ir.calculation_date = v_today
    group by 1
  ),
  -- capacidad base autoestimada: media recortada (sin min/max) de aprobadas/semana, 8 semanas completas
  thru as (
    select category, week, approved,
           row_number() over (partition by category order by approved) as rn_lo,
           count(*)    over (partition by category) as cnt
    from (
      select classify_product_category(p.name) as category,
             date_trunc('week', d.created_at)::date as week,
             sum(di.quantity_approved) as approved
      from public.deliveries d
      join public.delivery_items di on di.delivery_id = d.id
      join public.order_items oi on oi.id = di.order_item_id
      join public.product_variants pv on pv.id = oi.product_variant_id
      join public.products p on p.id = pv.product_id
      where d.created_at >= v_today - interval '8 weeks'
        and date_trunc('week', d.created_at)::date < date_trunc('week', v_today)::date
      group by 1, 2
    ) w
  ),
  base_cap as (
    select category, round(avg(approved))::int as baseline_auto
    from thru
    where cnt < 3 or (rn_lo > 1 and rn_lo < cnt)   -- recorta min y max si hay >=3 semanas
    group by category
  )
  select t.category,
         coalesce(t.reserve_target, 0) as reserve_target,
         coalesce(s.pipeline, 0)       as pipeline,
         coalesce(s.weekly_sales0, 0)  as weekly_sales0,
         coalesce(t.baseline_weekly_capacity, bc.baseline_auto, 0) as baseline_cap,
         coalesce(t.target_weekly_capacity, v_plan.target_weekly_capacity, 0) as target_cap,
         coalesce(t.ramp_weeks, v_plan.ramp_weeks) as ramp_weeks,
         -- ledgers de ejecución
         coalesce(s.pipeline, 0)::numeric as on_hand,
         0::numeric as reserve_acc,
         coalesce(t.reserve_target, 0)::numeric as remaining_reserve,
         -- agregados de factibilidad (se llenan abajo)
         0::numeric as expected_sales_total,
         0::numeric as total_capacity
  from public.season_plan_category_targets t
  left join snap s     on s.category = t.category
  left join base_cap bc on bc.category = t.category
  where t.plan_id = v_plan.id;

  -- Recorre semanas y, en cada una, reparte capacidad (modo shared = un pool repartido
  -- por necesidad restante; per_category = cada categoría con su propia curva).
  for v_t in 0 .. v_n - 1 loop
    -- factor de rampa segun perfil (ramp_weeks=0 => inmediato)
    if v_plan.ramp_profile = 'immediate' then
      v_ramp := 1;
    elsif v_plan.ramp_profile = 's_curve' then
      v_ramp := 1.0 / (1.0 + exp(-(v_t - (v_plan.ramp_weeks / 2.0))));
    else -- linear
      v_ramp := case when v_plan.ramp_weeks <= 0 then 1 else least(1.0, v_t::numeric / v_plan.ramp_weeks) end;
    end if;

    if v_plan.capacity_mode = 'shared' then
      v_pool_base := (select sum(baseline_cap) from _cat);
      v_pool_tgt  := coalesce(nullif(v_plan.target_weekly_capacity, 0), v_pool_base);
      v_pool_cap  := round(v_pool_base + (v_pool_tgt - v_pool_base) * v_ramp);
      -- peso = necesidad restante de la semana (reserva pendiente + ventas de la semana)
      v_weight_sum := (select sum(remaining_reserve + round(weekly_sales0 * (1 + (v_plan.seasonal_uplift - 1) * case when v_n>1 then v_t::numeric/(v_n-1) else 0 end)))
                       from _cat);
    end if;

    for v_cat in select * from _cat loop
      declare
        v_exp_sales numeric := round(v_cat.weekly_sales0 * (1 + (v_plan.seasonal_uplift - 1) * case when v_n>1 then v_t::numeric/(v_n-1) else 0 end));
        v_cap       numeric;
      begin
        if v_plan.capacity_mode = 'shared' then
          if v_weight_sum > 0 then
            v_cap := round(v_pool_cap * (v_cat.remaining_reserve + v_exp_sales) / v_weight_sum);
          else
            v_cap := 0;
          end if;
        else
          v_cap := round(v_cat.baseline_cap + (coalesce(nullif(v_cat.target_cap,0), v_cat.baseline_cap) - v_cat.baseline_cap) * v_ramp);
        end if;

        v_cap_left := v_cap;
        -- 1) cubrir ventas de la semana desde inventario; producir lo faltante
        v_need_sales := greatest(0, v_exp_sales - v_cat.on_hand);
        v_sales_prod := least(v_cap_left, v_need_sales);
        v_cap_left   := v_cap_left - v_sales_prod;
        -- 2) acumular reserva con la capacidad restante (front-load)
        v_res_prod   := least(v_cap_left, v_cat.remaining_reserve);

        -- actualizar ledgers en _cat
        update _cat set
          on_hand           = v_cat.on_hand + v_sales_prod - v_exp_sales,
          reserve_acc       = v_cat.reserve_acc + v_res_prod,
          remaining_reserve = v_cat.remaining_reserve - v_res_prod,
          expected_sales_total = v_cat.expected_sales_total + v_exp_sales,
          total_capacity    = v_cat.total_capacity + v_cap
        where category = v_cat.category;

        insert into public.production_plan_weeks (
          plan_id, organization_id, category, week_index, week_start,
          expected_sales, weekly_capacity, planned_production, reserve_quota,
          sales_replenishment, projected_on_hand_end, projected_reserve_accumulated, stockout, calculation_date)
        values (
          v_plan.id, org_id, v_cat.category, v_t, (v_week0 + (v_t * 7)),
          v_exp_sales::int, v_cap::int, (v_sales_prod + v_res_prod)::int, v_res_prod::int,
          v_sales_prod::int, round(v_cat.on_hand + v_sales_prod - v_exp_sales)::int, round(v_cat.reserve_acc + v_res_prod)::int,
          (v_need_sales > v_sales_prod), v_today);
      end;
    end loop;
  end loop;

  -- Factibilidad por categoría + min_target (fórmula lineal)
  insert into public.production_plan_feasibility (
    plan_id, organization_id, category, horizon_weeks, current_pipeline, expected_sales_total,
    reserve_target, production_needed, total_capacity, baseline_weekly_capacity, feasible, shortfall,
    min_target_weekly_capacity, calculation_date)
  select v_plan.id, org_id, c.category, v_n, c.pipeline, round(c.expected_sales_total)::int,
         c.reserve_target,
         greatest(0, round(c.reserve_target + c.expected_sales_total - c.pipeline))::int as needed,
         round(c.total_capacity)::int,
         c.baseline_cap,
         (c.total_capacity >= (c.reserve_target + c.expected_sales_total - c.pipeline)) as feasible,
         greatest(0, round((c.reserve_target + c.expected_sales_total - c.pipeline) - c.total_capacity))::int as shortfall,
         -- min target semanal = base + (needed - N*base)/R   con R = sum(ramp(t))
         case when v_plan.capacity_mode = 'per_category' then
           ceil(c.baseline_cap + ((c.reserve_target + c.expected_sales_total - c.pipeline) - v_n * c.baseline_cap) /
                nullif((select sum(case when v_plan.ramp_profile='immediate' then 1
                                        when v_plan.ramp_profile='s_curve' then 1.0/(1.0+exp(-(gs - v_plan.ramp_weeks/2.0)))
                                        else case when v_plan.ramp_weeks<=0 then 1 else least(1.0, gs::numeric/v_plan.ramp_weeks) end end)
                          from generate_series(0, v_n-1) gs), 0))::int
         else null end
  from _cat c;

  -- Rollup 'ALL' (útil en modo shared)
  insert into public.production_plan_feasibility (
    plan_id, organization_id, category, horizon_weeks, current_pipeline, expected_sales_total,
    reserve_target, production_needed, total_capacity, baseline_weekly_capacity, feasible, shortfall,
    min_target_weekly_capacity, calculation_date)
  select v_plan.id, org_id, 'ALL', v_n, sum(c.pipeline), round(sum(c.expected_sales_total))::int,
         sum(c.reserve_target),
         greatest(0, round(sum(c.reserve_target + c.expected_sales_total - c.pipeline)))::int,
         round(sum(c.total_capacity))::int, sum(c.baseline_cap),
         (sum(c.total_capacity) >= sum(c.reserve_target + c.expected_sales_total - c.pipeline)),
         greatest(0, round(sum((c.reserve_target + c.expected_sales_total - c.pipeline)) - sum(c.total_capacity)))::int,
         ceil( sum(c.baseline_cap)
               + (sum(c.reserve_target + c.expected_sales_total - c.pipeline) - v_n * sum(c.baseline_cap))
                 / nullif((select sum(case when v_plan.ramp_profile = 'immediate' then 1
                                           when v_plan.ramp_profile = 's_curve' then 1.0/(1.0+exp(-(gs - v_plan.ramp_weeks/2.0)))
                                           else case when v_plan.ramp_weeks <= 0 then 1 else least(1.0, gs::numeric/v_plan.ramp_weeks) end end)
                             from generate_series(0, v_n - 1) gs), 0) )::int
  from _cat c;

  -- Reparto por SKU de la SEMANA 0 (mayor residuo) → season_suggested / season_reserve_quota
  -- Peso = avg_daily_sales del SKU (mezcla de demanda, ya calculada).
  with wk0 as (
    select category, planned_production, reserve_quota
    from public.production_plan_weeks
    where plan_id = v_plan.id and calculation_date = v_today and week_index = 0
  ),
  variants as (
    select ir.id, ir.variant_id, classify_product_category(p.name) as category,
           greatest(ir.avg_daily_sales, 0) as w
    from public.inventory_replenishment ir
    join public.product_variants pv on pv.id = ir.variant_id
    join public.products p on p.id = pv.product_id
    where ir.organization_id = org_id and ir.calculation_date = v_today
      and classify_product_category(p.name) in (select category from wk0)
  ),
  tot as (select category, sum(w) as tw from variants group by category),
  alloc as (
    select v.id, v.category, w0.planned_production, w0.reserve_quota,
           case when t.tw > 0 then v.w / t.tw else 0 end as share
    from variants v join wk0 w0 on w0.category = v.category join tot t on t.category = v.category
  ),
  base_alloc as (
    select id, category, planned_production, reserve_quota, share,
           floor(share * planned_production) as base_plan,
           share * planned_production - floor(share * planned_production) as frac_plan,
           floor(share * reserve_quota) as base_res,
           share * reserve_quota - floor(share * reserve_quota) as frac_res
    from alloc
  ),
  ranked as (
    select b.*,
           row_number() over (partition by category order by frac_plan desc, id) as rk_plan,
           (planned_production - sum(base_plan) over (partition by category))     as rem_plan,
           row_number() over (partition by category order by frac_res desc, id)   as rk_res,
           (reserve_quota - sum(base_res) over (partition by category))           as rem_res
    from base_alloc b
  ),
  final as (
    select id,
           (base_plan + case when rk_plan <= rem_plan then 1 else 0 end) as season_suggested,
           (base_res  + case when rk_res  <= rem_res  then 1 else 0 end) as season_reserve_quota
    from ranked
  )
  update public.inventory_replenishment ir
     set season_suggested = f.season_suggested,
         season_reserve_quota = f.season_reserve_quota
  from final f
  where ir.id = f.id;

  drop table if exists _cat;

  return jsonb_build_object('ok', true, 'weeks', v_n, 'plan_id', v_plan.id);
end;
$function$;

-- F. Vistas --------------------------------------------------------------------
-- Recrear v_replenishment_details agregando season_suggested, season_reserve_quota
-- y this_week_target (= COALESCE(season_suggested, suggested_quantity) → cero cambio sin plan).
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
    COALESCE(ir.season_suggested, ir.suggested_quantity) AS this_week_target
   FROM inventory_replenishment ir
     JOIN product_variants pv ON ir.variant_id = pv.id
     JOIN products p ON pv.product_id = p.id;

create or replace view public.v_production_plan_weeks as
select w.*, pf.feasible, pf.shortfall, pf.production_needed, pf.total_capacity,
       pf.min_target_weekly_capacity, pf.current_pipeline
from public.production_plan_weeks w
left join public.production_plan_feasibility pf
  on pf.plan_id = w.plan_id and pf.category = w.category and pf.calculation_date = w.calculation_date;
