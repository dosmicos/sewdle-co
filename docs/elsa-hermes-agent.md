# Elsa-Hermes Agent for Sewdle

Elsa is an isolated Hermes Agent profile that acts as the brain/memory layer for
Dosmicos customer support and sales, while Sewdle remains the inbox and system
of record.

## Architecture

```text
WhatsApp / IG / Messenger
  → Sewdle webhook
  → messaging_messages + messaging_conversations
  → elsa-hermes-agent Edge Function
  → Elsa Hermes API Server
  → JSON reply/actions
  → Sewdle sends + stores outbound message
```

## Hermes profile

Created locally:

```text
Profile: elsa
Command: /Users/juliancastro/.local/bin/elsa
Home: /Users/juliancastro/.hermes/profiles/elsa
Workspace: /Users/juliancastro/.hermes/profiles/elsa/workspace
API server: http://127.0.0.1:8644/v1
Model name: elsa
```

Important files:

```text
~/.hermes/profiles/elsa/SOUL.md
~/.hermes/profiles/elsa/memories/MEMORY.md
~/.hermes/profiles/elsa/memories/USER.md
~/.hermes/profiles/elsa/workspace/AGENTS.md
~/.hermes/profiles/elsa/workspace/knowledge/dosmicos-support-baseline.md
```

## Sewdle additions

### Edge Functions

```text
supabase/functions/whatsapp-webhook/index.ts
supabase/functions/elsa-hermes-agent/index.ts
supabase/functions/elsa-capture-human-reply/index.ts
supabase/functions/_shared/elsa-supervision.ts
```

Current production entrypoint is `whatsapp-webhook`:

- It receives Meta webhooks, creates/updates `messaging_conversations` and
  stores inbound rows in `messaging_messages`.
- It applies operational guards before AI: duplicate message guard,
  cart-recovery opt-out, image receipt ack, address verification, COD
  confirmation, auto-reply detection, debounce, and duplicate outbound AI guard.
- For WhatsApp, after debounce it loads the last 15 DB messages, maps inbound
  messages to `role: 'user'` and outbound messages to `role: 'assistant'`,
  includes stored `media_url` for image messages, then invokes the configured AI
  Edge Function.
- For Instagram/Messenger/comment flows, `handleAIAutoReply` does the same with
  the last 10 messages.

AI generation paths:

- Existing/default: `messaging-ai-openai` or `messaging-ai-minimax` depending on
  `channel.ai_config.aiProvider`.
- Elsa replacement: `elsa-hermes-agent` when `channel.ai_config.aiProvider` is
  `elsa`, `hermes`, or `elsa-hermes`.
- Local legacy fallback still exists inside `whatsapp-webhook` as
  `generateAIResponse(...)`, which calls OpenAI directly if the Edge Function
  invocation fails.

- `elsa-hermes-agent` generates Elsa replies. `elsa-capture-human-reply` is a
  safe learning hook the inbox can call after a human sends a response; it
  stores an anonymized `needs_review` learning candidate and does not message
  customers.
- Shared test-covered helpers live in
  `supabase/functions/_shared/elsa-hermes-core.ts` and
  `supabase/functions/_shared/elsa-supervision.ts`.
- Elsa prompts include a deterministic Colombia date/time line so
  shipping/dispatch answers do not depend on stale conversation context.

Request shape mirrors the old AI functions:

```json
{
  "messages": [{ "role": "user", "content": "Hola" }],
  "systemPrompt": "...",
  "organizationId": "...",
  "conversationId": "..."
}
```

Response:

```json
{
  "response": "mensaje para cliente",
  "provider": "hermes",
  "confidence": 0.8,
  "handoff_required": false,
  "actions": [{ "type": "none" }],
  "learning_notes": [],
  "elapsed_ms": 1200,
  "fallback_error": null
}
```

## Supervised rollout mode

First rollout should be supervised: Elsa generates suggestions but Sewdle does
not send them to the customer.

Enable per channel:

```json
{
  "aiProvider": "elsa",
  "elsaMode": "supervised"
}
```

Or enable globally for Elsa providers only:

```bash
ELSA_SUPERVISED_MODE=true
# alias also supported:
HERMES_SUPERVISED_MODE=true
```

Behavior in supervised mode:

- `whatsapp-webhook` still applies the same debounce/duplicate/confirmation
  guards.
- It invokes `elsa-hermes-agent` and receives the same response payload.
- It does NOT call Meta send APIs and does NOT insert an outbound
  `messaging_messages` row.
- It stores the reviewable suggestion in
  `messaging_conversations.metadata.elsa_supervised_suggestion` with `text`,
  `provider`, `confidence`, `actions`, `handoff_required`, `elapsed_ms`,
  `generated_at`, and `sent_to_customer=false`.
- `elsa-hermes-agent` still logs the run in `elsa_agent_runs`, so quality can be
  audited before enabling auto-send.

To switch a channel from supervised to auto-send, keep `aiProvider: "elsa"` and
remove `elsaMode: "supervised"` (and ensure `ELSA_SUPERVISED_MODE` is not set).

### DB migration

```text
supabase/migrations/20260502131500_elsa_hermes_agent.sql
```

Creates:

- `elsa_agent_runs` — run logs, confidence, action suggestions, latency/errors.
- `elsa_response_learnings` — compact human-derived support learnings injected
  into future Elsa runs.

## Env vars

For local Hermes API:

```bash
# Elsa profile .env
API_SERVER_ENABLED=true
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8644
API_SERVER_MODEL_NAME=elsa
API_SERVER_KEY=<secret>
```

For Supabase Edge Function:

```bash
HERMES_API_URL=http://127.0.0.1:8644/v1 # local only
HERMES_API_KEY=<same API_SERVER_KEY>
HERMES_MODEL=elsa
OPENAI_API_KEY=<fallback only>
```

Production note: Supabase hosted Edge Functions cannot reach Julian's
`127.0.0.1`. For live WhatsApp production, expose Elsa through a secure
tunnel/server and set `HERMES_API_URL` to that reachable HTTPS URL.

## Verification

```bash
deno test --allow-env \
  supabase/functions/_shared/elsa-hermes-core.test.ts \
  supabase/functions/_shared/elsa-supervision.test.ts

deno check \
  supabase/functions/elsa-hermes-agent/index.ts \
  supabase/functions/elsa-capture-human-reply/index.ts \
  supabase/functions/whatsapp-webhook/index.ts
```

Local Elsa API smoke test:

```bash
curl -s http://127.0.0.1:8644/health
# expected: {"status":"ok","platform":"hermes-agent"}
```

## Human reply learning

There are two paths:

1. Batch learning from historical chats.
2. Incremental capture from new human frontend replies via
   `elsa-capture-human-reply`.

The incremental function expects:

```json
{
  "organizationId": "...",
  "conversationId": "...",
  "messageId": "optional-human-outbound-message-id"
}
```

It stores anonymized rows in `elsa_response_learnings` with
`status='needs_review'`.

## Historical learning pipeline

Export anonymized human replies:

```bash
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
ELSA_ORGANIZATION_ID=... \
node scripts/elsa-export-learning-corpus.mjs
```

Distill corpus into reusable learnings using Elsa:

```bash
HERMES_API_URL=http://127.0.0.1:8644/v1 \
HERMES_API_KEY=... \
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
ELSA_ORGANIZATION_ID=... \
node scripts/elsa-learn-from-corpus.mjs
```

Outputs are saved under:

```text
/Users/juliancastro/.hermes/profiles/elsa/workspace/knowledge/
```

## Safety design

- Elsa returns JSON with reply + confidence + proposed actions.
- Sewdle still decides what gets sent and stored.
- Order creation actions are explicit proposals until wired to a confirmed tool
  adapter.
- Fallback to OpenAI remains available if Hermes is unreachable.
- Historical learning corpus anonymizes PII before saving to Elsa workspace.
