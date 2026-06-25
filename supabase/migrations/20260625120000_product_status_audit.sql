-- Audit trail de auto-product-status-sync (la edge function ya escribe aquí, pero
-- la tabla nunca existió → los inserts fallaban en silencio y se perdía la traza).
-- Registra cada activación/desactivación de producto en Shopify.
create table if not exists public.product_status_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  shopify_product_gid text,
  shopify_product_id text,
  product_title text,
  action text,                 -- 'activated' | 'deactivated' | 'error'
  reason text,
  previous_status text,
  new_status text,
  total_inventory integer,
  has_images boolean,
  was_dry_run boolean,
  triggered_by text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_status_audit_org on public.product_status_audit(organization_id);
create index if not exists idx_product_status_audit_created on public.product_status_audit(created_at desc);

alter table public.product_status_audit enable row level security;

create policy "Users can view product status audit for their organization"
  on public.product_status_audit for select
  using (
    organization_id in (
      select organization_id from public.organization_users where user_id = auth.uid()
    )
  );

create policy "Service role full access to product_status_audit"
  on public.product_status_audit for all
  using (auth.role() = 'service_role');
