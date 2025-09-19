-- Add updated_at column to product_variants table
ALTER TABLE public.product_variants 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Create trigger to automatically update updated_at column
CREATE TRIGGER update_product_variants_updated_at
    BEFORE UPDATE ON public.product_variants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();