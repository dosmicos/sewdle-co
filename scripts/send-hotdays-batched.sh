#!/bin/bash
# Script to send HotDays WhatsApp campaign in batches
# Step 1: Fetch all pages of customers
# Step 2: Send in batches of 20 via send_direct

FUNCTION_URL="https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/send-hotdays-campaign"
AUTH_TOKEN="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1NjQ4MjEsImV4cCI6MjA1MzE0MDgyMX0.pCJMLaW0QLe6Y0MFaqrSpVOzGP5PYy-69UhFkXJlOQU"
ORG_ID="cb497af2-3f29-4bb4-be53-91b7f19e5ffb"
BATCH_SIZE=20
ALL_RECIPIENTS_FILE="/tmp/hotdays_all_recipients.json"
RESULTS_FILE="/tmp/hotdays_results.json"

echo "=== HotDays WhatsApp Campaign ==="
echo "Started at: $(date)"
echo ""

# ── Step 1: Fetch all pages ──
echo "📦 Step 1: Fetching all customer pages from Shopify..."

ALL_RECIPIENTS="[]"
PAGE_NUM=0
NEXT_PAGE=""

while true; do
  PAGE_NUM=$((PAGE_NUM + 1))

  if [ -z "$NEXT_PAGE" ]; then
    PAYLOAD="{\"organizationId\": \"$ORG_ID\", \"action\": \"fetch_page\"}"
  else
    PAYLOAD=$(python3 -c "import json; print(json.dumps({'organizationId': '$ORG_ID', 'action': 'fetch_page', 'pageUrl': '$NEXT_PAGE'}))")
  fi

  RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: $AUTH_TOKEN" \
    -d "$PAYLOAD")

  # Check for error
  ERROR=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null)
  if [ -n "$ERROR" ] && [ "$ERROR" != "" ]; then
    echo "  ❌ Error on page $PAGE_NUM: $ERROR"
    break
  fi

  # Extract info
  INFO=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"{d['customersInPage']}|{d['recipientsInPage']}|{d.get('nextPageUrl', '')}\")
" 2>/dev/null)

  CUSTOMERS=$(echo "$INFO" | cut -d'|' -f1)
  RECIPIENTS=$(echo "$INFO" | cut -d'|' -f2)
  NEXT_PAGE=$(echo "$INFO" | cut -d'|' -f3)

  echo "  Page $PAGE_NUM: $CUSTOMERS customers, $RECIPIENTS with phone"

  # Merge recipients
  ALL_RECIPIENTS=$(python3 -c "
import sys, json
existing = json.loads('$ALL_RECIPIENTS') if '$ALL_RECIPIENTS' != '[]' else []
# Read from file if too large for env
response = json.loads(sys.stdin.read())
new = response.get('recipients', [])
existing.extend(new)
print(json.dumps(existing))
" <<< "$RESPONSE")

  if [ -z "$NEXT_PAGE" ] || [ "$NEXT_PAGE" = "None" ] || [ "$NEXT_PAGE" = "null" ]; then
    echo "  ✅ No more pages"
    break
  fi
done

# Save all recipients to file
echo "$ALL_RECIPIENTS" > "$ALL_RECIPIENTS_FILE"
TOTAL=$(python3 -c "import json; d=json.load(open('$ALL_RECIPIENTS_FILE')); print(len(d))")
echo ""
echo "📊 Total recipients with valid phone: $TOTAL"
echo ""

# Deduplicate by phone
python3 -c "
import json
recipients = json.load(open('$ALL_RECIPIENTS_FILE'))
seen = set()
unique = []
for r in recipients:
    if r['phone'] not in seen:
        seen.add(r['phone'])
        unique.append(r)
json.dump(unique, open('$ALL_RECIPIENTS_FILE', 'w'))
print(f'After dedup: {len(unique)} unique recipients (removed {len(recipients) - len(unique)} duplicates)')
"

TOTAL=$(python3 -c "import json; d=json.load(open('$ALL_RECIPIENTS_FILE')); print(len(d))")

# ── Step 2: Send in batches ──
echo ""
echo "🚀 Step 2: Sending in batches of $BATCH_SIZE..."
echo ""

TOTAL_SENT=0
TOTAL_FAILED=0
BATCH_NUM=0
ALL_SENT="[]"
ALL_ERRORS="[]"

while true; do
  OFFSET=$((BATCH_NUM * BATCH_SIZE))

  if [ $OFFSET -ge $TOTAL ]; then
    break
  fi

  BATCH_NUM=$((BATCH_NUM + 1))
  END=$((OFFSET + BATCH_SIZE))
  if [ $END -gt $TOTAL ]; then
    END=$TOTAL
  fi

  echo "  📤 Batch $BATCH_NUM: sending $OFFSET-$END of $TOTAL..."

  # Extract batch
  BATCH_JSON=$(python3 -c "
import json
recipients = json.load(open('$ALL_RECIPIENTS_FILE'))
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

  # Parse result
  BATCH_INFO=$(echo "$RESULT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    sent = d.get('sent', 0)
    failed = d.get('failed', 0)
    errors = d.get('errors', [])
    sent_list = d.get('sentList', [])
    print(f'{sent}|{failed}|{json.dumps(errors)}|{json.dumps(sent_list)}')
except:
    print('0|0|[]|[]')
" 2>/dev/null)

  BATCH_SENT=$(echo "$BATCH_INFO" | cut -d'|' -f1)
  BATCH_FAILED=$(echo "$BATCH_INFO" | cut -d'|' -f2)

  TOTAL_SENT=$((TOTAL_SENT + BATCH_SENT))
  TOTAL_FAILED=$((TOTAL_FAILED + BATCH_FAILED))

  echo "     ✅ Sent: $BATCH_SENT, ❌ Failed: $BATCH_FAILED (running total: $TOTAL_SENT sent)"

  # Small delay between batches
  sleep 2
done

echo ""
echo "════════════════════════════════════"
echo "  📊 CAMPAIGN COMPLETE"
echo "  Total recipients: $TOTAL"
echo "  ✅ Sent: $TOTAL_SENT"
echo "  ❌ Failed: $TOTAL_FAILED"
echo "  Finished at: $(date)"
echo "════════════════════════════════════"
