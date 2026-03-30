#!/bin/bash
# Send HotDays2 WhatsApp campaign - fetch all pages then send in batches

FUNCTION_URL="https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/send-hotdays-campaign"
AUTH_TOKEN="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1NjQ4MjEsImV4cCI6MjA1MzE0MDgyMX0.pCJMLaW0QLe6Y0MFaqrSpVOzGP5PYy-69UhFkXJlOQU"
ORG_ID="cb497af2-3f29-4bb4-be53-91b7f19e5ffb"
TAG="hotdays2"
BATCH_SIZE=20
RECIPIENTS_FILE="/tmp/hotdays2_all_recipients.json"

echo "=== HotDays2 WhatsApp Campaign ==="
echo "Tag: $TAG"
echo "Started at: $(date)"
echo ""

# ── Step 1: Fetch all pages ──
echo "📦 Step 1: Fetching all customer pages with tag '$TAG'..."

ALL_RECIPIENTS="[]"
PAGE_NUM=0
NEXT_PAGE=""

while true; do
  PAGE_NUM=$((PAGE_NUM + 1))

  if [ -z "$NEXT_PAGE" ]; then
    PAYLOAD="{\"organizationId\": \"$ORG_ID\", \"action\": \"fetch_page\", \"tag\": \"$TAG\"}"
  else
    PAYLOAD=$(python3 -c "import json; print(json.dumps({'organizationId': '$ORG_ID', 'action': 'fetch_page', 'tag': '$TAG', 'pageUrl': '$NEXT_PAGE'}))")
  fi

  RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: $AUTH_TOKEN" \
    -d "$PAYLOAD")

  ERROR=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null)
  if [ -n "$ERROR" ] && [ "$ERROR" != "" ]; then
    echo "  ❌ Error on page $PAGE_NUM: $ERROR"
    break
  fi

  INFO=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"{d['customersInPage']}|{d['recipientsInPage']}|{d.get('nextPageUrl', '')}\")
" 2>/dev/null)

  CUSTOMERS=$(echo "$INFO" | cut -d'|' -f1)
  RECIPIENTS=$(echo "$INFO" | cut -d'|' -f2)
  NEXT_PAGE=$(echo "$INFO" | cut -d'|' -f3)

  echo "  Page $PAGE_NUM: $CUSTOMERS customers, $RECIPIENTS with phone"

  ALL_RECIPIENTS=$(python3 -c "
import sys, json
existing = json.loads(sys.stdin.read().split('|||')[0])
response = json.loads(sys.stdin.read().split('|||')[1]) if '|||' in sys.stdin.read() else {}
" 2>/dev/null || echo "[]")

  # Simpler merge approach
  python3 -c "
import json, sys
try:
    existing = json.load(open('$RECIPIENTS_FILE'))
except:
    existing = []
response = json.loads('''$RESPONSE''')
new = response.get('recipients', [])
existing.extend(new)
json.dump(existing, open('$RECIPIENTS_FILE', 'w'))
" 2>/dev/null

  if [ -z "$NEXT_PAGE" ] || [ "$NEXT_PAGE" = "None" ] || [ "$NEXT_PAGE" = "null" ]; then
    echo "  ✅ No more pages"
    break
  fi

  # Small delay to avoid Shopify rate limits
  sleep 1
done

# Deduplicate
python3 -c "
import json
recipients = json.load(open('$RECIPIENTS_FILE'))
seen = set()
unique = []
for r in recipients:
    if r['phone'] not in seen:
        seen.add(r['phone'])
        unique.append(r)
json.dump(unique, open('$RECIPIENTS_FILE', 'w'))
print(f'Total: {len(unique)} unique recipients (removed {len(recipients) - len(unique)} duplicates)')
"

TOTAL=$(python3 -c "import json; d=json.load(open('$RECIPIENTS_FILE')); print(len(d))")

# Also remove phones that were already sent in HotDays campaign
python3 -c "
import json
hotdays2 = json.load(open('$RECIPIENTS_FILE'))
try:
    hotdays1 = json.load(open('/tmp/hotdays_all_recipients.json'))
    sent_phones = {r['phone'] for r in hotdays1}
    new_only = [r for r in hotdays2 if r['phone'] not in sent_phones]
    already_sent = len(hotdays2) - len(new_only)
    json.dump(new_only, open('$RECIPIENTS_FILE', 'w'))
    print(f'Removed {already_sent} already sent in HotDays campaign, {len(new_only)} new to send')
except:
    print('No HotDays1 file found, sending all')
"

TOTAL=$(python3 -c "import json; d=json.load(open('$RECIPIENTS_FILE')); print(len(d))")
echo ""
echo "📊 New recipients to send: $TOTAL"
echo ""

if [ "$TOTAL" -eq 0 ]; then
  echo "✅ No new recipients to send"
  exit 0
fi

# ── Step 2: Send in batches ──
echo "🚀 Step 2: Sending in batches of $BATCH_SIZE..."

TOTAL_SENT=0
TOTAL_FAILED=0
OFFSET=0

while [ $OFFSET -lt $TOTAL ]; do
  END=$((OFFSET + BATCH_SIZE))
  if [ $END -gt $TOTAL ]; then
    END=$TOTAL
  fi

  BATCH_JSON=$(python3 -c "
import json
recipients = json.load(open('$RECIPIENTS_FILE'))
batch = recipients[$OFFSET:$END]
payload = {
    'organizationId': '$ORG_ID',
    'action': 'send_direct',
    'directRecipients': batch
}
print(json.dumps(payload))
")

  RESULT=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: $AUTH_TOKEN" \
    -d "$BATCH_JSON" \
    --max-time 120)

  BATCH_SENT=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sent',0))" 2>/dev/null || echo "0")
  BATCH_FAILED=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('failed',0))" 2>/dev/null || echo "0")

  TOTAL_SENT=$((TOTAL_SENT + BATCH_SENT))
  TOTAL_FAILED=$((TOTAL_FAILED + BATCH_FAILED))

  echo "  [$OFFSET-$END] ✅$BATCH_SENT ❌$BATCH_FAILED (total: $TOTAL_SENT sent)"

  OFFSET=$END
  sleep 1
done

echo ""
echo "════════════════════════════════════"
echo "  📊 HOTDAYS2 CAMPAIGN COMPLETE"
echo "  Total recipients: $TOTAL"
echo "  ✅ Sent: $TOTAL_SENT"
echo "  ❌ Failed: $TOTAL_FAILED"
echo "  Finished at: $(date)"
echo "════════════════════════════════════"
