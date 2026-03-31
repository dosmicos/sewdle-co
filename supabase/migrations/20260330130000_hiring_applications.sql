-- =====================================================
-- Dosmicos Hiring - Migrar esquema a Dosmicos Brain
-- Tabla applications + bucket resumes + RLS
-- =====================================================

-- 1. Tabla principal de aplicaciones
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Step 1: Personal Information
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    university TEXT NOT NULL,
    portfolio_link TEXT,
    resume_url TEXT,
    impressive_achievement TEXT,

    -- Step 2: Diagnostic Questions
    diagnostic_whats_working TEXT NOT NULL,
    diagnostic_improvements TEXT NOT NULL,
    diagnostic_missed_opportunity TEXT NOT NULL,

    -- Step 3: Campaign Concept
    campaign_name TEXT NOT NULL,
    campaign_concept TEXT NOT NULL,
    campaign_executions TEXT NOT NULL,

    -- Step 4: Budget Challenge
    budget_challenge TEXT NOT NULL
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_applications_email ON public.applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON public.applications(created_at DESC);

-- 3. RLS
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Permitir inserts desde usuarios anónimos (formulario público)
CREATE POLICY "Allow anonymous inserts" ON public.applications
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Permitir lectura a usuarios autenticados (admin dashboard)
CREATE POLICY "Allow authenticated reads" ON public.applications
    FOR SELECT
    TO authenticated
    USING (true);

-- 4. Vista de aplicaciones recientes
CREATE OR REPLACE VIEW public.recent_applications AS
SELECT
    id,
    created_at,
    full_name,
    email,
    phone,
    university,
    portfolio_link,
    resume_url,
    impressive_achievement,
    LEFT(diagnostic_whats_working, 100) || '...' AS diagnostic_preview,
    campaign_name,
    LEFT(budget_challenge, 100) || '...' AS challenge_preview
FROM public.applications
ORDER BY created_at DESC
LIMIT 50;

GRANT SELECT ON public.recent_applications TO authenticated;
GRANT SELECT ON public.recent_applications TO anon;

-- 5. Bucket de storage para hojas de vida
-- NOTA: El bucket 'resumes' debe crearse manualmente en Supabase Dashboard > Storage
-- o ejecutar via API. Se incluyen las policies de storage:
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Política: cualquiera puede subir archivos al bucket resumes
CREATE POLICY "Allow public uploads to resumes"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'resumes');

-- Política: cualquiera puede leer archivos del bucket resumes
CREATE POLICY "Allow public reads from resumes"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'resumes');
