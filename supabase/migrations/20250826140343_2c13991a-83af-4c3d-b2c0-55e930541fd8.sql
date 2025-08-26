-- Add order reference to replenishment_suggestions table
ALTER TABLE public.replenishment_suggestions 
ADD COLUMN order_id uuid REFERENCES public.orders(id);