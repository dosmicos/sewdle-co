-- Growth team scorecard: weekly milestones + static Drive creative source of truth
-- Source: Julian approval via Telegram, 2026-06-01; Brain insights 2026-06-01 June 600M plan/anexo.

CREATE TABLE IF NOT EXISTS public.growth_weekly_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL, -- exclusive
  revenue_target numeric NOT NULL DEFAULT 0,
  ad_spend_budget numeric NOT NULL DEFAULT 0,
  mer_target numeric NOT NULL DEFAULT 0,
  cm_percent_target numeric NOT NULL DEFAULT 25,
  new_customers_target integer NOT NULL DEFAULT 0,
  ugc_content_target integer NOT NULL DEFAULT 40,
  ugc_active_creators_target integer NOT NULL DEFAULT 35,
  static_creatives_target integer NOT NULL DEFAULT 25,
  static_published_target integer NOT NULL DEFAULT 20,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT growth_weekly_targets_org_period_unique UNIQUE (organization_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS public.growth_static_drive_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_key text NOT NULL,
  product_name text NOT NULL,
  drive_folder_id text NOT NULL,
  drive_folder_name text,
  source_mode text NOT NULL DEFAULT 'static_folder' CHECK (source_mode IN ('static_folder', 'product_root_direct_images')),
  include_child_folders boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT growth_static_drive_folders_org_product_folder_unique UNIQUE (organization_id, product_key, drive_folder_id)
);

CREATE TABLE IF NOT EXISTS public.growth_drive_identity_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  person_key text NOT NULL,
  person_label text NOT NULL,
  email text,
  display_name_pattern text,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_drive_identity_map_email_unique
  ON public.growth_drive_identity_map(organization_id, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS growth_drive_identity_map_display_name_unique
  ON public.growth_drive_identity_map(organization_id, lower(display_name_pattern))
  WHERE display_name_pattern IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.growth_static_drive_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  product_key text NOT NULL,
  product_name text NOT NULL,
  source_folder_id text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  created_time timestamptz NOT NULL,
  modified_time timestamptz,
  owner_email text,
  owner_name text,
  last_modifying_user_email text,
  last_modifying_user_name text,
  attributed_person_key text NOT NULL DEFAULT 'unknown',
  attributed_person_label text NOT NULL DEFAULT 'Sin asignar',
  web_view_link text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  trashed boolean NOT NULL DEFAULT false,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT growth_static_drive_assets_org_file_unique UNIQUE (organization_id, drive_file_id)
);

CREATE INDEX IF NOT EXISTS growth_weekly_targets_org_period_idx
  ON public.growth_weekly_targets(organization_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS growth_static_drive_folders_org_active_idx
  ON public.growth_static_drive_folders(organization_id, active, product_key);
CREATE INDEX IF NOT EXISTS growth_static_drive_assets_org_created_idx
  ON public.growth_static_drive_assets(organization_id, created_time DESC);
CREATE INDEX IF NOT EXISTS growth_static_drive_assets_org_product_created_idx
  ON public.growth_static_drive_assets(organization_id, product_key, created_time DESC);
CREATE INDEX IF NOT EXISTS growth_static_drive_assets_org_person_created_idx
  ON public.growth_static_drive_assets(organization_id, attributed_person_key, created_time DESC);

ALTER TABLE public.growth_weekly_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_static_drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_drive_identity_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_static_drive_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "growth_weekly_targets_select_org" ON public.growth_weekly_targets;
CREATE POLICY "growth_weekly_targets_select_org"
  ON public.growth_weekly_targets FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "growth_weekly_targets_manage_org" ON public.growth_weekly_targets;
CREATE POLICY "growth_weekly_targets_manage_org"
  ON public.growth_weekly_targets FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "growth_static_drive_folders_select_org" ON public.growth_static_drive_folders;
CREATE POLICY "growth_static_drive_folders_select_org"
  ON public.growth_static_drive_folders FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "growth_static_drive_folders_manage_org" ON public.growth_static_drive_folders;
CREATE POLICY "growth_static_drive_folders_manage_org"
  ON public.growth_static_drive_folders FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "growth_drive_identity_map_select_org" ON public.growth_drive_identity_map;
CREATE POLICY "growth_drive_identity_map_select_org"
  ON public.growth_drive_identity_map FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "growth_drive_identity_map_manage_org" ON public.growth_drive_identity_map;
CREATE POLICY "growth_drive_identity_map_manage_org"
  ON public.growth_drive_identity_map FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "growth_static_drive_assets_select_org" ON public.growth_static_drive_assets;
CREATE POLICY "growth_static_drive_assets_select_org"
  ON public.growth_static_drive_assets FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations()));

DROP TRIGGER IF EXISTS growth_weekly_targets_updated_at ON public.growth_weekly_targets;
CREATE TRIGGER growth_weekly_targets_updated_at
  BEFORE UPDATE ON public.growth_weekly_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS growth_static_drive_folders_updated_at ON public.growth_static_drive_folders;
CREATE TRIGGER growth_static_drive_folders_updated_at
  BEFORE UPDATE ON public.growth_static_drive_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS growth_drive_identity_map_updated_at ON public.growth_drive_identity_map;
CREATE TRIGGER growth_drive_identity_map_updated_at
  BEFORE UPDATE ON public.growth_drive_identity_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed Dosmicos June 2026 non-linear weekly milestones.
WITH org AS (
  SELECT id FROM public.organizations WHERE slug = 'dosmicos-org' LIMIT 1
), rows AS (
  SELECT * FROM (VALUES
    ('Semana 1 · Jun 1–7', '2026-06-01'::date, '2026-06-08'::date, 105000000::numeric, 30000000::numeric, 3.50::numeric, 600::integer),
    ('Semana 2 · Jun 8–14', '2026-06-08'::date, '2026-06-15'::date, 140000000::numeric, 36000000::numeric, 3.89::numeric, 850::integer),
    ('Semana 3 · Jun 15–21', '2026-06-15'::date, '2026-06-22'::date, 160000000::numeric, 38000000::numeric, 4.21::numeric, 950::integer),
    ('Semana 4 · Jun 22–28', '2026-06-22'::date, '2026-06-29'::date, 170000000::numeric, 40000000::numeric, 4.25::numeric, 1000::integer),
    ('Final · Jun 29–30', '2026-06-29'::date, '2026-07-01'::date, 25000000::numeric, 6000000::numeric, 4.17::numeric, 200::integer)
  ) AS t(label, period_start, period_end, revenue_target, ad_spend_budget, mer_target, new_customers_target)
)
INSERT INTO public.growth_weekly_targets (
  organization_id, label, period_start, period_end, revenue_target, ad_spend_budget, mer_target,
  cm_percent_target, new_customers_target, ugc_content_target, ugc_active_creators_target,
  static_creatives_target, static_published_target, notes
)
SELECT org.id, rows.label, rows.period_start, rows.period_end, rows.revenue_target, rows.ad_spend_budget, rows.mer_target,
       25, rows.new_customers_target, 40, 35, 25, 20,
       'Seeded from Dosmicos June 600M operating anexo; period_end is exclusive.'
FROM org CROSS JOIN rows
ON CONFLICT (organization_id, period_start, period_end) DO UPDATE SET
  label = EXCLUDED.label,
  revenue_target = EXCLUDED.revenue_target,
  ad_spend_budget = EXCLUDED.ad_spend_budget,
  mer_target = EXCLUDED.mer_target,
  cm_percent_target = EXCLUDED.cm_percent_target,
  new_customers_target = EXCLUDED.new_customers_target,
  ugc_content_target = EXCLUDED.ugc_content_target,
  ugc_active_creators_target = EXCLUDED.ugc_active_creators_target,
  static_creatives_target = EXCLUDED.static_creatives_target,
  static_published_target = EXCLUDED.static_published_target,
  notes = EXCLUDED.notes;

-- Seed static creative Drive folders. UGC folders are intentionally excluded.
WITH org AS (
  SELECT id FROM public.organizations WHERE slug = 'dosmicos-org' LIMIT 1
), rows AS (
  SELECT * FROM (VALUES
    ('ruanas', 'Ruanas', '1N-aIdR5Cc5IcHpI7SFUuQjS5s_w_RboD', 'Ruanas / Estáticos', 'static_folder', false, 'Static images only; UGC sibling folder excluded.'),
    ('sleepings', 'Sleepings', '1SD616MWIpNC7HuKZmMQMYg-S-T_Eb6vU', 'Sleepings / Estáticos', 'static_folder', false, 'Static images only; UGC sibling folder excluded.'),
    ('chaquetas_parkas', 'Chaquetas/Parkas', '1JuRoGxkxVMgAhmaokqZ2Zxpm4lal9fas', 'Chaquetas - Parkas / Estáticos', 'static_folder', false, 'Static images only; UGC sibling folder excluded.'),
    ('combos', 'Combos', '11PP9UMK9eJrjHRBcdA4mXDKnKzDJHym0', 'Combos root', 'product_root_direct_images', false, 'No Estáticos child found; count direct image files only.'),
    ('zapatitos', 'Zapatitos', '1An_LDAJ9L2OR8XkVkXdyOxA2asz5NL6R', 'Zapatitos root', 'product_root_direct_images', false, 'No Estáticos child found; count direct image files only.')
  ) AS t(product_key, product_name, drive_folder_id, drive_folder_name, source_mode, include_child_folders, notes)
)
INSERT INTO public.growth_static_drive_folders (
  organization_id, product_key, product_name, drive_folder_id, drive_folder_name, source_mode, include_child_folders, notes
)
SELECT org.id, rows.product_key, rows.product_name, rows.drive_folder_id, rows.drive_folder_name, rows.source_mode, rows.include_child_folders, rows.notes
FROM org CROSS JOIN rows
ON CONFLICT (organization_id, product_key, drive_folder_id) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  drive_folder_name = EXCLUDED.drive_folder_name,
  source_mode = EXCLUDED.source_mode,
  include_child_folders = EXCLUDED.include_child_folders,
  active = true,
  notes = EXCLUDED.notes;

-- Seed Drive identity map. Keep info@dosmicos.co as shared/unassigned until Julian explicitly remaps it.
WITH org AS (
  SELECT id FROM public.organizations WHERE slug = 'dosmicos-org' LIMIT 1
), rows AS (
  SELECT * FROM (VALUES
    ('angie', 'Angie', 'angiecdiazb@gmail.com', null, 10, 'Verified Drive owner/last modifier for static creatives.'),
    ('shared', 'Shared / Sin asignar', 'info@dosmicos.co', 'Información Dosmicos', 20, 'Shared production/service account; do not assign to Ana María without explicit confirmation.'),
    ('julian', 'Julian', 'julian@dosmicos.co', null, 30, 'Julian Drive account.')
  ) AS t(person_key, person_label, email, display_name_pattern, priority, notes)
)
INSERT INTO public.growth_drive_identity_map (
  organization_id, person_key, person_label, email, display_name_pattern, priority, notes
)
SELECT org.id, rows.person_key, rows.person_label, rows.email, rows.display_name_pattern, rows.priority, rows.notes
FROM org CROSS JOIN rows
ON CONFLICT (organization_id, (lower(email))) WHERE email IS NOT NULL DO UPDATE SET
  person_key = EXCLUDED.person_key,
  person_label = EXCLUDED.person_label,
  display_name_pattern = EXCLUDED.display_name_pattern,
  priority = EXCLUDED.priority,
  active = true,
  notes = EXCLUDED.notes;
