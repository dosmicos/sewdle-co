-- Keep the automatic DB-triggered UGC sale flow internal-only.
-- Sebastián receives the private WhatsApp alert and manually posts to the mamá group.
-- This prevents accidental customer-facing creator notifications from the DB trigger.

CREATE OR REPLACE FUNCTION public.enqueue_ugc_affiliate_purchase_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_service_role text;
BEGIN
  v_service_role := current_setting('supabase.service_role_key', true);

  PERFORM net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/send-ugc-affiliate-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_service_role, '')
    ),
    body := jsonb_build_object(
      'action', 'notify_order',
      'attributedOrderId', NEW.id,
      'shopifyOrderId', NEW.shopify_order_id,
      'dryRun', false,
      'authorized', true,
      'internalOnly', true,
      'source', 'ugc_attributed_orders_trigger'
    )
  );

  RETURN NEW;
END;
$$;
