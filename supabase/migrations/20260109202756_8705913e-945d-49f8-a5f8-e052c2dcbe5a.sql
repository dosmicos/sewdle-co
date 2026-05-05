-- Create table to persist AI catalog product connections
CREATE TABLE public.ai_catalog_connections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    shopify_product_id BIGINT NOT NULL,
    connected BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(organization_id, shopify_product_id)
);

-- Enable Row Level Security
ALTER TABLE public.ai_catalog_connections ENABLE ROW LEVEL SECURITY;

-- Create policies for organization access
CREATE POLICY "Users can view their organization's AI catalog connections"
ON public.ai_catalog_connections
FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert AI catalog connections for their organization"
ON public.ai_catalog_connections
FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their organization's AI catalog connections"
ON public.ai_catalog_connections
FOR UPDATE
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete their organization's AI catalog connections"
ON public.ai_catalog_connections
FOR DELETE
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ai_catalog_connections_updated_at
BEFORE UPDATE ON public.ai_catalog_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();