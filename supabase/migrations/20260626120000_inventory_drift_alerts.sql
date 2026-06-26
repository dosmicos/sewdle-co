-- Inventory Drift Guard (detection only)
--
-- Context: on 2026-06-26 the Ruana Mapache T6 audit found Shopify carrying 37
-- phantom units from an unattributed inventory_levels/update on 2026-05-28 that
-- lived ~30 days until a physical count caught it. There was no inventory
-- reconciler and the daily snapshot had been dead since 2026-04-14. This guard
-- reconstructs the expected stock per variant each day and flags unexplained
-- gaps. It NEVER mutates inventory — corrections are applied manually (human GO).

-- 1. Alerts table -----------------------------------------------------------
create table if not exists public.inventory_drift_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  product_variant_id uuid not null references public.product_variants(id) on delete cascade,
  sku_variant text not null,
  product_name text,
  target_date date not null,                 -- BOG day audited
  stock_start integer not null,              -- last stock before the window
  deliveries_in integer not null,            -- approved delivery syncs in window
  sales_out integer not null,                -- net units sold in window
  expected_available integer not null,       -- stock_start + deliveries_in - sales_out
  actual_available integer not null,         -- observed stock at window end
  drift_units integer not null,              -- actual - expected (signed)
  classification text not null check (classification in ('PHANTOM_UNITS','SHORTAGE')),
  evidence jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  reviewed_by text,
  correction_note text
);

comment on table public.inventory_drift_alerts is
  'Unexplained inventory gaps (phantom units / shortages) detected daily by run_inventory_drift_guard(). Detection only — corrections are manual with human GO.';

-- One open alert per variant. Re-detections refresh last_seen_at; the guard
-- auto-resolves when drift falls back within threshold.
create unique index if not exists inventory_drift_alerts_one_open_per_variant
  on public.inventory_drift_alerts (product_variant_id)
  where resolved_at is null;

create index if not exists inventory_drift_alerts_open_idx
  on public.inventory_drift_alerts (resolved_at, drift_units desc)
  where resolved_at is null;

create index if not exists inventory_drift_alerts_target_date_idx
  on public.inventory_drift_alerts (target_date desc);

alter table public.inventory_drift_alerts enable row level security;

-- 2. Detector function ------------------------------------------------------
-- For a BOG calendar day:
--   expected = stock_before_day + approved_delivery_syncs_in_day - net_sales_in_day
--   drift    = observed_stock_at_day_end - expected
-- Source of truth for the stock series is product_stock_history (shopify_webhook
-- + daily_snapshot rows); delivery syncs come from inventory_sync_logs.sync_results.
create or replace function public.run_inventory_drift_guard(
  p_target_date date default ((now() at time zone 'America/Bogota')::date - 1),
  p_min_units int default 5,
  p_min_pct numeric default 10,
  p_dry_run boolean default true
)
returns table(
  o_product_variant_id uuid, o_sku_variant text, o_product_name text, o_target_date date,
  o_stock_start int, o_deliveries_in int, o_sales_out int, o_expected_available int,
  o_actual_available int, o_drift_units int, o_classification text, o_threshold int
)
language plpgsql security definer set search_path = public
as $$
declare
  v_start timestamptz := (p_target_date::timestamp at time zone 'America/Bogota');
  v_end   timestamptz := ((p_target_date + 1)::timestamp at time zone 'America/Bogota');
begin
  drop table if exists _recon;
  drop table if exists _flagged;

  create temporary table _recon on commit drop as
  with active_variants as (
    select pv.id, pv.sku_variant, p.organization_id, p.name as product_name
    from product_variants pv join products p on p.id = pv.product_id
    where p.status = 'active' and p.organization_id is not null
  ),
  start_stock as (
    select av.id,
      (select psh.stock_quantity from product_stock_history psh
       where psh.product_variant_id = av.id and psh.recorded_at < v_start
       order by psh.recorded_at desc limit 1) as stock_start
    from active_variants av
  ),
  end_stock as (
    select av.id,
      (select psh.stock_quantity from product_stock_history psh
       where psh.product_variant_id = av.id and psh.recorded_at < v_end
       order by psh.recorded_at desc limit 1) as stock_end
    from active_variants av
  ),
  sales as (
    select av.id, coalesce(sum(li.quantity), 0)::int as sales_out
    from active_variants av
    join shopify_order_line_items li on li.variant_id::text = av.sku_variant
     and li.created_at >= v_start and li.created_at < v_end
    left join shopify_orders so on so.shopify_order_id = li.shopify_order_id
    where so.cancelled_at is null
    group by av.id
  ),
  deliveries as (
    select av.id, coalesce(sum((r->>'addedQuantity')::int), 0)::int as deliveries_in
    from active_variants av
    join inventory_sync_logs isl on isl.synced_at >= v_start and isl.synced_at < v_end
    cross join lateral jsonb_array_elements(isl.sync_results->'results') r
    where r->>'shopifyVariantId' = av.sku_variant and r->>'status' = 'success'
    group by av.id
  )
  select av.id as product_variant_id, av.sku_variant, av.product_name, av.organization_id,
    ss.stock_start::int as stock_start,
    coalesce(d.deliveries_in, 0)::int as deliveries_in,
    coalesce(s.sales_out, 0)::int as sales_out,
    (ss.stock_start + coalesce(d.deliveries_in, 0) - coalesce(s.sales_out, 0))::int as expected_available,
    es.stock_end::int as actual_available,
    (es.stock_end - (ss.stock_start + coalesce(d.deliveries_in, 0) - coalesce(s.sales_out, 0)))::int as drift_units
  from active_variants av
  join start_stock ss on ss.id = av.id
  join end_stock es on es.id = av.id
  left join sales s on s.id = av.id
  left join deliveries d on d.id = av.id
  where ss.stock_start is not null and es.stock_end is not null;

  create temporary table _flagged on commit drop as
  select r.*,
    greatest(p_min_units, ceil((p_min_pct / 100.0) * greatest(r.expected_available, 0)))::int as threshold,
    case when r.drift_units > 0 then 'PHANTOM_UNITS' else 'SHORTAGE' end as classification
  from _recon r
  where abs(r.drift_units) >= greatest(p_min_units, ceil((p_min_pct / 100.0) * greatest(r.expected_available, 0)))::int
    and r.drift_units <> 0;

  if not p_dry_run then
    update inventory_drift_alerts a
      set resolved_at = now(),
          correction_note = trim(both ' ' from coalesce(a.correction_note, '') || ' [auto-resolved by guard: drift within threshold]')
    where a.resolved_at is null
      and a.product_variant_id not in (select f.product_variant_id from _flagged f);

    insert into inventory_drift_alerts as a (
      organization_id, product_variant_id, sku_variant, product_name, target_date,
      stock_start, deliveries_in, sales_out, expected_available, actual_available,
      drift_units, classification, evidence
    )
    select f.organization_id, f.product_variant_id, f.sku_variant, f.product_name, p_target_date,
      f.stock_start, f.deliveries_in, f.sales_out, f.expected_available, f.actual_available,
      f.drift_units, f.classification,
      jsonb_build_object(
        'window_start_utc', v_start, 'window_end_utc', v_end,
        'reconciliation', format('stock_start %s + deliveries %s - sales %s = expected %s; observed %s; drift %s',
          f.stock_start, f.deliveries_in, f.sales_out, f.expected_available, f.actual_available, f.drift_units),
        'threshold', f.threshold,
        'inventory_history_hint', 'https://dosmicos.myshopify.com/admin/products/inventory/<inventory_item_id>/inventory_history (resolve item id from sku ' || f.sku_variant || ')'
      )
    from _flagged f
    on conflict (product_variant_id) where (resolved_at is null)
    do update set
      target_date = excluded.target_date, stock_start = excluded.stock_start,
      deliveries_in = excluded.deliveries_in, sales_out = excluded.sales_out,
      expected_available = excluded.expected_available, actual_available = excluded.actual_available,
      drift_units = excluded.drift_units, classification = excluded.classification,
      evidence = excluded.evidence, last_seen_at = now();
  end if;

  return query
    select f.product_variant_id, f.sku_variant, f.product_name, p_target_date,
           f.stock_start, f.deliveries_in, f.sales_out, f.expected_available,
           f.actual_available, f.drift_units, f.classification, f.threshold
    from _flagged f order by abs(f.drift_units) desc;
end;
$$;

revoke all on function public.run_inventory_drift_guard(date, int, numeric, boolean) from public, anon, authenticated;
