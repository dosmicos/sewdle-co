-- Crear ENUM types para OKRs
CREATE TYPE okr_level AS ENUM ('company', 'area', 'team', 'individual');
CREATE TYPE okr_area AS ENUM ('marketing', 'diseno_prod', 'operaciones');
CREATE TYPE okr_tier AS ENUM ('T1', 'T2');
CREATE TYPE okr_visibility AS ENUM ('public', 'area', 'private');
CREATE TYPE okr_unit AS ENUM ('%', '#', '$', 'rate', 'binary');
CREATE TYPE okr_data_source AS ENUM ('manual', 'auto', 'computed');
CREATE TYPE okr_confidence AS ENUM ('low', 'med', 'high');
CREATE TYPE okr_incentive_status AS ENUM ('pending', 'approved', 'paid');
CREATE TYPE okr_incentive_value_type AS ENUM ('days', 'bonus', 'recognition');

-- 1. Tabla okr_objective
CREATE TABLE public.okr_objective (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level okr_level NOT NULL,
  area okr_area NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  tier okr_tier DEFAULT 'T2',
  visibility okr_visibility DEFAULT 'public',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  parent_objective_id UUID NULL REFERENCES okr_objective(id),
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tabla okr_key_result
CREATE TABLE public.okr_key_result (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES okr_objective(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  unit okr_unit DEFAULT '%',
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  data_source okr_data_source DEFAULT 'manual',
  progress_pct NUMERIC DEFAULT 0,
  confidence okr_confidence DEFAULT 'med',
  guardrail BOOLEAN DEFAULT false,
  private BOOLEAN DEFAULT false,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Tabla okr_alignment
CREATE TABLE public.okr_alignment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_objective_id UUID NOT NULL REFERENCES okr_objective(id) ON DELETE CASCADE,
  child_objective_id UUID NOT NULL REFERENCES okr_objective(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(parent_objective_id, child_objective_id)
);

-- 4. Tabla okr_checkin
CREATE TABLE public.okr_checkin (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kr_id UUID NOT NULL REFERENCES okr_key_result(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  delta_value NUMERIC,
  progress_pct NUMERIC,
  confidence okr_confidence DEFAULT 'med',
  note TEXT,
  blockers TEXT,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Tabla okr_incentive
CREATE TABLE public.okr_incentive (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  kr_id UUID NULL REFERENCES okr_key_result(id),
  rule_key TEXT NOT NULL,
  status okr_incentive_status DEFAULT 'pending',
  value_type okr_incentive_value_type NOT NULL,
  value_num NUMERIC,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Tabla okr_evidence
CREATE TABLE public.okr_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kr_id UUID NOT NULL REFERENCES okr_key_result(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Tabla okr_score_history
CREATE TABLE public.okr_score_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kr_id UUID NOT NULL REFERENCES okr_key_result(id) ON DELETE CASCADE,
  score_0_1 NUMERIC NOT NULL CHECK (score_0_1 >= 0 AND score_0_1 <= 1.2),
  scored_by UUID NOT NULL REFERENCES profiles(id),
  organization_id UUID NOT NULL,
  scored_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS en todas las tablas OKR
ALTER TABLE public.okr_objective ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_key_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_alignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_checkin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_incentive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_score_history ENABLE ROW LEVEL SECURITY;

-- Función para verificar si user pertenece a Dosmicos
CREATE OR REPLACE FUNCTION public.is_dosmicos_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_users ou
    JOIN public.organizations o ON ou.organization_id = o.id
    WHERE ou.user_id = auth.uid() 
    AND o.slug = 'dosmicos'
    AND ou.status = 'active'
  );
$$;

-- Función para obtener organization_id de Dosmicos
CREATE OR REPLACE FUNCTION public.get_dosmicos_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id 
  FROM public.organizations 
  WHERE slug = 'dosmicos'
  LIMIT 1;
$$;

-- Función para verificar si user es manager de área
CREATE OR REPLACE FUNCTION public.is_okr_manager(user_uuid UUID, area_name TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid 
    AND r.name IN ('Administrador', 'Diseñador')
  );
$$;

-- Función de cálculo automático de progress_pct
CREATE OR REPLACE FUNCTION public.calculate_okr_progress()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Calcular progress_pct: clamp((current_value / target_value) * 100, 0, 120)
  NEW.progress_pct := CASE 
    WHEN NEW.target_value = 0 OR NEW.target_value IS NULL THEN 0
    ELSE GREATEST(0, LEAST(120, (NEW.current_value / NEW.target_value) * 100))
  END;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger para auto-calcular progress en okr_key_result
CREATE TRIGGER okr_kr_calculate_progress
  BEFORE INSERT OR UPDATE ON public.okr_key_result
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_okr_progress();

-- Función para scoring automático (0.0-1.0)
CREATE OR REPLACE FUNCTION public.calculate_okr_score(kr_id_param UUID)
RETURNS NUMERIC
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  progress_value NUMERIC;
  score_result NUMERIC;
BEGIN
  SELECT progress_pct INTO progress_value
  FROM public.okr_key_result
  WHERE id = kr_id_param;
  
  -- Convertir progress_pct a score 0.0-1.0
  score_result := CASE 
    WHEN progress_value >= 100 THEN 1.0
    WHEN progress_value >= 70 THEN 0.7 + ((progress_value - 70) * 0.3 / 30)
    WHEN progress_value >= 40 THEN 0.4 + ((progress_value - 40) * 0.3 / 30)
    ELSE progress_value * 0.4 / 40
  END;
  
  RETURN LEAST(1.2, GREATEST(0.0, score_result));
END;
$$;

-- RLS POLICIES

-- okr_objective policies
CREATE POLICY "OKR objectives - Dosmicos users can view public and area"
ON public.okr_objective FOR SELECT
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND (
    visibility = 'public' 
    OR (visibility = 'area' AND area IN (
      SELECT UNNEST(ARRAY['marketing', 'diseno_prod', 'operaciones'])
    ))
    OR (visibility = 'private' AND (
      owner_id = auth.uid() OR is_okr_manager(auth.uid())
    ))
  )
);

CREATE POLICY "OKR objectives - Owners and managers can insert"
ON public.okr_objective FOR INSERT
WITH CHECK (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND (owner_id = auth.uid() OR is_okr_manager(auth.uid()))
);

CREATE POLICY "OKR objectives - Owners and managers can update"
ON public.okr_objective FOR UPDATE
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND (owner_id = auth.uid() OR is_okr_manager(auth.uid()))
);

CREATE POLICY "OKR objectives - Owners and managers can delete"
ON public.okr_objective FOR DELETE
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND (owner_id = auth.uid() OR is_okr_manager(auth.uid()))
);

-- okr_key_result policies
CREATE POLICY "OKR key results - Dosmicos users can view non-private"
ON public.okr_key_result FOR SELECT
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND (
    private = false 
    OR owner_id = auth.uid() 
    OR is_okr_manager(auth.uid())
  )
);

CREATE POLICY "OKR key results - Owners and managers can manage"
ON public.okr_key_result FOR ALL
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND (owner_id = auth.uid() OR is_okr_manager(auth.uid()))
)
WITH CHECK (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND (owner_id = auth.uid() OR is_okr_manager(auth.uid()))
);

-- okr_alignment policies
CREATE POLICY "OKR alignment - Dosmicos users can view"
ON public.okr_alignment FOR SELECT
USING (is_dosmicos_user());

CREATE POLICY "OKR alignment - Managers can manage"
ON public.okr_alignment FOR ALL
USING (is_dosmicos_user() AND is_okr_manager(auth.uid()))
WITH CHECK (is_dosmicos_user() AND is_okr_manager(auth.uid()));

-- okr_checkin policies
CREATE POLICY "OKR checkins - Dosmicos users can view"
ON public.okr_checkin FOR SELECT
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
);

CREATE POLICY "OKR checkins - Authors and managers can manage"
ON public.okr_checkin FOR ALL
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND (author_id = auth.uid() OR is_okr_manager(auth.uid()))
)
WITH CHECK (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
);

-- okr_incentive policies
CREATE POLICY "OKR incentives - Users can view own incentives"
ON public.okr_incentive FOR SELECT
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND (user_id = auth.uid() OR is_okr_manager(auth.uid()))
);

CREATE POLICY "OKR incentives - Only managers can manage incentives"
ON public.okr_incentive FOR ALL
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND is_okr_manager(auth.uid())
)
WITH CHECK (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND is_okr_manager(auth.uid())
);

-- okr_evidence policies
CREATE POLICY "OKR evidence - Dosmicos users can view"
ON public.okr_evidence FOR SELECT
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
);

CREATE POLICY "OKR evidence - Authenticated users can manage"
ON public.okr_evidence FOR ALL
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
)
WITH CHECK (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
);

-- okr_score_history policies
CREATE POLICY "OKR score history - Dosmicos users can view"
ON public.okr_score_history FOR SELECT
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
);

CREATE POLICY "OKR score history - Managers can manage"
ON public.okr_score_history FOR ALL
USING (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND is_okr_manager(auth.uid())
)
WITH CHECK (
  is_dosmicos_user() 
  AND organization_id = get_dosmicos_org_id()
  AND is_okr_manager(auth.uid())
);

-- Triggers para updated_at
CREATE TRIGGER okr_objective_updated_at
  BEFORE UPDATE ON public.okr_objective
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER okr_key_result_updated_at
  BEFORE UPDATE ON public.okr_key_result
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER okr_incentive_updated_at
  BEFORE UPDATE ON public.okr_incentive
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();