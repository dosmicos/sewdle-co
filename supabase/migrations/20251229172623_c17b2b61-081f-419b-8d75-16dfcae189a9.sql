-- Table to map Shopify products to Alegra catalog items
CREATE TABLE alegra_product_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shopify_product_title TEXT NOT NULL,
  shopify_variant_title TEXT,
  shopify_sku TEXT,
  alegra_item_id TEXT NOT NULL,
  alegra_item_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, shopify_product_title, shopify_variant_title)
);

-- Enable RLS
ALTER TABLE alegra_product_mapping ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view mappings in their organization"
ON alegra_product_mapping FOR SELECT
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can insert mappings in their organization"
ON alegra_product_mapping FOR INSERT
WITH CHECK (organization_id = get_current_organization_safe());

CREATE POLICY "Users can update mappings in their organization"
ON alegra_product_mapping FOR UPDATE
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can delete mappings in their organization"
ON alegra_product_mapping FOR DELETE
USING (organization_id = get_current_organization_safe());

-- Index for faster lookups
CREATE INDEX idx_alegra_product_mapping_lookup 
ON alegra_product_mapping(organization_id, shopify_product_title, shopify_variant_title);

CREATE INDEX idx_alegra_product_mapping_sku 
ON alegra_product_mapping(organization_id, shopify_sku) 
WHERE shopify_sku IS NOT NULL;