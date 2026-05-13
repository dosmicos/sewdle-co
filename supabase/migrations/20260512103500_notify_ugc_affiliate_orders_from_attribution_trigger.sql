-- Ensure Club de Mamás affiliate purchase notifications fire for robust DB-side attributions.
--
-- Context:
-- - shopify-ugc-webhook already calls send-ugc-affiliate-notification after inserting
--   ugc_attributed_orders.
-- - Later robust attribution was moved into public.sync_ugc_order_attribution_from_shopify_order()
--   via the shopify_orders trigger. That path inserts ugc_attributed_orders directly in DB
--   and did not call the Edge Function, so purchases were attributed but moms were not notified.
--
-- Safety:
-- - This only triggers on new rows in ugc_attributed_orders.
-- - send-ugc-affiliate-notification is idempotent via unique indexes on
--   (attributed_order_id, notification_type), so duplicate insert paths skip safely.
-- - The function itself checks notification settings, creator phone, WhatsApp channel,
--   and Meta template result before logging sent/failed/skipped.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.enqueue_ugc_affiliate_purchase_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_role text;
BEGIN
  -- Keep auth compatible with the existing cron style. The Edge Function is currently
  -- configured with verify_jwt=false, but this header preserves compatibility if the
  -- Supabase runtime exposes the service role setting.
  v_service_role := current_setting('supabase.service_role_key', true);

  PERFORM net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/send-ugc-affiliate-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', CASE
        WHEN v_service_role IS NULL OR v_service_role = '' THEN ''
        ELSE 'Bearer ' || v_service_role
      END
    ),
    body := jsonb_build_object(
      'action', 'notify_order',
      'attributedOrderId', NEW.id,
      'dryRun', false,
      -- Julian approved automatic Club de Mamás sale notifications on 2026-04-28.
      'authorized', true
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_ugc_affiliate_purchase_notification ON public.ugc_attributed_orders;
CREATE TRIGGER trg_enqueue_ugc_affiliate_purchase_notification
AFTER INSERT ON public.ugc_attributed_orders
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_ugc_affiliate_purchase_notification();
