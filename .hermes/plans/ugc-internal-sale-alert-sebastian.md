# UGC internal sale alert to Sebastián

## Goal
Whenever a Club Dosmicos/UGC attributed sale is generated, send Sebastián (`3193661150`) a private WhatsApp alert through the existing Sewdle messaging/WhatsApp infrastructure so he can manually post a sanitized celebration message in the moms group.

## Scope
- Use existing `send-ugc-affiliate-notification` flow, because `shopify-ugc-webhook` and the DB attribution trigger call it when a row is created in `ugc_attributed_orders`.
- No customer PII in the alert.
- Send to Sebastián only.
- Persist alert attempt in DB for audit/idempotency.

## Implementation
1. Add an idempotency/audit table `ugc_internal_sale_alerts` with a unique row per `attributed_order_id`.
2. Extend `send-ugc-affiliate-notification`:
   - after fetching order/creator/link/ranking, build a concise internal message.
   - insert `pending` alert row before sending; if unique conflict, skip duplicate.
   - get/create a WhatsApp conversation for Sebastián under the active Dosmicos WhatsApp channel.
   - send via Meta WhatsApp text message through the same token/phone_number_id used by messaging IA.
   - store outbound message in `messaging_messages` and update `messaging_conversations`.
   - update alert row to `sent` or `failed`.
3. Verification:
   - type-check the edited Supabase function with Deno.
   - inspect git diff.

## Deployment note
Deploy requires applying the migration and deploying `send-ugc-affiliate-notification` to Supabase production using the approved Sewdle wrappers.
