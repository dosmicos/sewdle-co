-- Create enums for prospect stages and activity types
CREATE TYPE public.prospect_stage AS ENUM (
  'lead',
  'videocall_scheduled',
  'videocall_completed',
  'visit_scheduled',
  'visit_completed',
  'sample_requested',
  'sample_in_progress',
  'sample_approved',
  'sample_rejected',
  'trial_production',
  'trial_approved',
  'trial_rejected',
  'approved_workshop',
  'rejected'
);

CREATE TYPE public.prospect_activity_type AS ENUM (
  'note',
  'call',
  'videocall',
  'visit',
  'email',
  'whatsapp',
  'stage_change',
  'sample_sent',
  'sample_received'
);

CREATE TYPE public.prospect_activity_status AS ENUM (
  'pending',
  'completed',
  'cancelled'
);

CREATE TYPE public.prospect_file_category AS ENUM (
  'facility_photo',
  'sample_photo',
  'contract',
  'other'
);

-- Create workshop_prospects table
CREATE TABLE public.workshop_prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  source TEXT,
  stage public.prospect_stage NOT NULL DEFAULT 'lead',
  quality_index NUMERIC,
  specialties TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  converted_workshop_id UUID REFERENCES public.workshops(id)
);

-- Create prospect_activities table
CREATE TABLE public.prospect_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.workshop_prospects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  activity_type public.prospect_activity_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  status public.prospect_activity_status NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create prospect_files table
CREATE TABLE public.prospect_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.workshop_prospects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_category public.prospect_file_category NOT NULL DEFAULT 'other',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_workshop_prospects_organization ON public.workshop_prospects(organization_id);
CREATE INDEX idx_workshop_prospects_stage ON public.workshop_prospects(stage);
CREATE INDEX idx_workshop_prospects_assigned_to ON public.workshop_prospects(assigned_to);
CREATE INDEX idx_prospect_activities_prospect ON public.prospect_activities(prospect_id);
CREATE INDEX idx_prospect_activities_organization ON public.prospect_activities(organization_id);
CREATE INDEX idx_prospect_files_prospect ON public.prospect_files(prospect_id);

-- Enable Row Level Security
ALTER TABLE public.workshop_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workshop_prospects
CREATE POLICY "Users can view prospects in their organization"
ON public.workshop_prospects
FOR SELECT
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Admins and designers can create prospects"
ON public.workshop_prospects
FOR INSERT
WITH CHECK (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
);

CREATE POLICY "Admins and designers can update prospects"
ON public.workshop_prospects
FOR UPDATE
USING (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
);

CREATE POLICY "Admins can delete prospects"
ON public.workshop_prospects
FOR DELETE
USING (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = 'Administrador'
);

-- RLS Policies for prospect_activities
CREATE POLICY "Users can view activities in their organization"
ON public.prospect_activities
FOR SELECT
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Admins and designers can create activities"
ON public.prospect_activities
FOR INSERT
WITH CHECK (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
);

CREATE POLICY "Admins and designers can update activities"
ON public.prospect_activities
FOR UPDATE
USING (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
);

CREATE POLICY "Admins can delete activities"
ON public.prospect_activities
FOR DELETE
USING (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = 'Administrador'
);

-- RLS Policies for prospect_files
CREATE POLICY "Users can view files in their organization"
ON public.prospect_files
FOR SELECT
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Admins and designers can upload files"
ON public.prospect_files
FOR INSERT
WITH CHECK (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
);

CREATE POLICY "Admins and designers can delete files"
ON public.prospect_files
FOR DELETE
USING (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_workshop_prospects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workshop_prospects_updated_at
BEFORE UPDATE ON public.workshop_prospects
FOR EACH ROW
EXECUTE FUNCTION public.update_workshop_prospects_updated_at();