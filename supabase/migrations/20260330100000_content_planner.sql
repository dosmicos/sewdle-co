-- Content Planner: planificación de contenido semana a semana
-- Tabla para piezas de contenido con soporte multi-plataforma

create table if not exists public.content_pieces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  content_type text not null check (content_type in (
    'reel', 'carousel', 'story', 'static_post', 'tiktok', 'live', 'ugc', 'email', 'blog'
  )),
  platform text not null check (platform in (
    'instagram', 'tiktok', 'facebook', 'email', 'blog', 'whatsapp'
  )),
  status text not null default 'idea' check (status in (
    'idea', 'briefed', 'in_production', 'review', 'approved', 'scheduled', 'published'
  )),
  assigned_to uuid references auth.users(id) on delete set null,
  scheduled_date date,
  scheduled_time time,
  copy_text text,
  hashtags text[] default '{}',
  assets_needed text,
  assets_url text,
  approval_notes text,
  week_number int not null,
  year int not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_content_pieces_org_week on public.content_pieces(org_id, year, week_number);
create index idx_content_pieces_org_date on public.content_pieces(org_id, scheduled_date);
create index idx_content_pieces_assigned on public.content_pieces(assigned_to);
create index idx_content_pieces_status on public.content_pieces(status);

-- RLS
alter table public.content_pieces enable row level security;

create policy "Users can view content pieces in their org"
  on public.content_pieces for select
  using (
    org_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Users can insert content pieces in their org"
  on public.content_pieces for insert
  with check (
    org_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Users can update content pieces in their org"
  on public.content_pieces for update
  using (
    org_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Users can delete content pieces in their org"
  on public.content_pieces for delete
  using (
    org_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

-- Auto-update updated_at
create or replace function public.update_content_pieces_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger content_pieces_updated_at
  before update on public.content_pieces
  for each row execute function public.update_content_pieces_updated_at();
