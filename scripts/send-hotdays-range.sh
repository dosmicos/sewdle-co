#!/bin/bash
# Send HotDays campaign for a specific range of recipients
# Usage: ./send-hotdays-range.sh <START_OFFSET> <END_OFFSET>

START=${1:-0}
END=${2:-1717}
BATCH_SIZE=20

FUNCTION_URL="https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/send-hotdays-campaign"
AUTH_TOKEN="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1NjQ4MjEsImV4cCI6MjA1MzE0MDgyMX0.pCJMLaW0QLe6Y0MFaqrSpVOzGP5PYy-69UhFkXJlOQU"
ORG_ID="cb497af2-3f29-4bb4-be53-91b7f19e5ffb"
ALL_RECIPIENTS_FILE="/tmp/hotdays_all_recipients.json"

TOTAL_SENT=0
TOTAL_FAILED=0
OFFSET=$START

echo "🚀 Range $START-$END starting at $(date)"

while [ $OFFSET -lt $END ]; do
  BATCH_END=$((OFFSET + BATCH_SIZE))
  if [ $BATCH_END -gt $END ]; then
    BATCH_END=$END
  fi

  BATCH_JSON=$(python3 -c "
import json
recipients = json.load(open('$ALL_RECIPIENTS_FILE'))
batch = recipients[$OFFSET:$BATCH_END]
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

  echo "  [$OFFSET-$BATCH_END] ✅$BATCH_SENT ❌$BATCH_FAILED (total: $TOTAL_SENT sent)"

  OFFSET=$BATCH_END
  sleep 1
done

echo ""
echo "✅ Range $START-$END DONE: $TOTAL_SENT sent, $TOTAL_FAILED failed at $(date)"
