-- Keep a per-variant save timestamp and immutable audit trail for delivery item edits.
-- This lets ops answer exactly when delivered/approved/defective quantities were saved.

ALTER TABLE public.delivery_items
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS quantity_last_saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS quantity_last_saved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quality_last_saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS quality_last_saved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.delivery_items
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE public.delivery_items
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.delivery_item_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_item_id uuid NOT NULL REFERENCES public.delivery_items(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('created', 'updated')),
  changed_fields text[] NOT NULL DEFAULT '{}',
  old_values jsonb,
  new_values jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_item_audit_events_delivery_item_id
  ON public.delivery_item_audit_events(delivery_item_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_item_audit_events_delivery_id
  ON public.delivery_item_audit_events(delivery_id, changed_at DESC);

ALTER TABLE public.delivery_item_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view delivery item audit events" ON public.delivery_item_audit_events;
CREATE POLICY "Users can view delivery item audit events"
  ON public.delivery_item_audit_events
  FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'deliveries', 'view'));

CREATE OR REPLACE FUNCTION public.set_delivery_item_save_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();

  IF TG_OP = 'INSERT'
    OR NEW.quantity_delivered IS DISTINCT FROM OLD.quantity_delivered THEN
    NEW.quantity_last_saved_at = now();
    NEW.quantity_last_saved_by = auth.uid();
  END IF;

  IF TG_OP = 'INSERT'
    OR NEW.quantity_approved IS DISTINCT FROM OLD.quantity_approved
    OR NEW.quantity_defective IS DISTINCT FROM OLD.quantity_defective
    OR NEW.quality_status IS DISTINCT FROM OLD.quality_status
    OR NEW.quality_notes IS DISTINCT FROM OLD.quality_notes THEN
    NEW.quality_last_saved_at = now();
    NEW.quality_last_saved_by = auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_delivery_item_save_metadata ON public.delivery_items;
CREATE TRIGGER set_delivery_item_save_metadata
  BEFORE INSERT OR UPDATE ON public.delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_delivery_item_save_metadata();

CREATE OR REPLACE FUNCTION public.log_delivery_item_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_fields text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    changed_fields = ARRAY[
      'quantity_delivered',
      'quantity_approved',
      'quantity_defective',
      'quality_status',
      'quality_notes',
      'notes',
      'synced_to_shopify'
    ];

    INSERT INTO public.delivery_item_audit_events (
      delivery_item_id,
      delivery_id,
      order_item_id,
      event_type,
      changed_fields,
      old_values,
      new_values,
      changed_by,
      changed_at
    )
    VALUES (
      NEW.id,
      NEW.delivery_id,
      NEW.order_item_id,
      'created',
      changed_fields,
      NULL,
      jsonb_build_object(
        'quantity_delivered', NEW.quantity_delivered,
        'quantity_approved', NEW.quantity_approved,
        'quantity_defective', NEW.quantity_defective,
        'quality_status', NEW.quality_status,
        'quality_notes', NEW.quality_notes,
        'notes', NEW.notes,
        'synced_to_shopify', NEW.synced_to_shopify,
        'last_sync_attempt', NEW.last_sync_attempt,
        'sync_attempt_count', NEW.sync_attempt_count,
        'sync_error_message', NEW.sync_error_message
      ),
      auth.uid(),
      now()
    );

    RETURN NEW;
  END IF;

  changed_fields = array_remove(ARRAY[
    CASE WHEN NEW.quantity_delivered IS DISTINCT FROM OLD.quantity_delivered THEN 'quantity_delivered' END,
    CASE WHEN NEW.quantity_approved IS DISTINCT FROM OLD.quantity_approved THEN 'quantity_approved' END,
    CASE WHEN NEW.quantity_defective IS DISTINCT FROM OLD.quantity_defective THEN 'quantity_defective' END,
    CASE WHEN NEW.quality_status IS DISTINCT FROM OLD.quality_status THEN 'quality_status' END,
    CASE WHEN NEW.quality_notes IS DISTINCT FROM OLD.quality_notes THEN 'quality_notes' END,
    CASE WHEN NEW.notes IS DISTINCT FROM OLD.notes THEN 'notes' END,
    CASE WHEN NEW.synced_to_shopify IS DISTINCT FROM OLD.synced_to_shopify THEN 'synced_to_shopify' END,
    CASE WHEN NEW.last_sync_attempt IS DISTINCT FROM OLD.last_sync_attempt THEN 'last_sync_attempt' END,
    CASE WHEN NEW.sync_attempt_count IS DISTINCT FROM OLD.sync_attempt_count THEN 'sync_attempt_count' END,
    CASE WHEN NEW.sync_error_message IS DISTINCT FROM OLD.sync_error_message THEN 'sync_error_message' END
  ]::text[], NULL);

  IF array_length(changed_fields, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.delivery_item_audit_events (
    delivery_item_id,
    delivery_id,
    order_item_id,
    event_type,
    changed_fields,
    old_values,
    new_values,
    changed_by,
    changed_at
  )
  VALUES (
    NEW.id,
    NEW.delivery_id,
    NEW.order_item_id,
    'updated',
    changed_fields,
    jsonb_build_object(
      'quantity_delivered', OLD.quantity_delivered,
      'quantity_approved', OLD.quantity_approved,
      'quantity_defective', OLD.quantity_defective,
      'quality_status', OLD.quality_status,
      'quality_notes', OLD.quality_notes,
      'notes', OLD.notes,
      'synced_to_shopify', OLD.synced_to_shopify,
      'last_sync_attempt', OLD.last_sync_attempt,
      'sync_attempt_count', OLD.sync_attempt_count,
      'sync_error_message', OLD.sync_error_message
    ),
    jsonb_build_object(
      'quantity_delivered', NEW.quantity_delivered,
      'quantity_approved', NEW.quantity_approved,
      'quantity_defective', NEW.quantity_defective,
      'quality_status', NEW.quality_status,
      'quality_notes', NEW.quality_notes,
      'notes', NEW.notes,
      'synced_to_shopify', NEW.synced_to_shopify,
      'last_sync_attempt', NEW.last_sync_attempt,
      'sync_attempt_count', NEW.sync_attempt_count,
      'sync_error_message', NEW.sync_error_message
    ),
    auth.uid(),
    now()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_delivery_item_audit_event ON public.delivery_items;
CREATE TRIGGER log_delivery_item_audit_event
  AFTER INSERT OR UPDATE ON public.delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_delivery_item_audit_event();
