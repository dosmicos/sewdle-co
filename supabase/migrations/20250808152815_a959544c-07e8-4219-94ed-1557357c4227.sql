-- Add verification fields to inventory_sync_logs table
ALTER TABLE public.inventory_sync_logs 
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS inventory_before jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS inventory_after jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS mathematical_verification jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS rollback_performed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS rollback_details jsonb DEFAULT NULL;

-- Add index for delivery_id lookups
CREATE INDEX IF NOT EXISTS idx_inventory_sync_logs_delivery_id ON public.inventory_sync_logs(delivery_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sync_logs_verification_status ON public.inventory_sync_logs(verification_status);

-- Add function to check recent successful syncs for a delivery
CREATE OR REPLACE FUNCTION public.has_recent_successful_sync(delivery_id_param uuid, minutes_threshold integer DEFAULT 30)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_sync_logs 
    WHERE delivery_id = delivery_id_param 
    AND success_count > 0 
    AND error_count = 0
    AND verification_status = 'verified'
    AND synced_at > now() - (minutes_threshold || ' minutes')::interval
  );
$$;