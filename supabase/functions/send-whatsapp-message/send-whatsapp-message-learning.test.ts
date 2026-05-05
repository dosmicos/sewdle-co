/// <reference lib="deno.ns" />

import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

Deno.test("manual WhatsApp sends trigger Elsa human-reply learning capture after DB insert", async () => {
  const source = await Deno.readTextFile("supabase/functions/send-whatsapp-message/index.ts");

  assert(
    source.includes("organization_id"),
    "send-whatsapp-message must fetch conversation.organization_id so Elsa learnings stay scoped to the organization",
  );

  assert(
    source.includes(".select('id')") || source.includes('.select("id")'),
    "manual outbound message insert must return the saved message id for learning capture",
  );

  assert(
    source.includes("elsa-capture-human-reply"),
    "manual outbound messages must invoke elsa-capture-human-reply so Elsa can learn from human responses",
  );

  assert(
    source.includes("messageId: savedMessageId"),
    "Elsa learning capture must receive the saved human message id, not just the conversation id",
  );

  assert(
    source.includes("organizationId"),
    "Elsa learning capture must receive organizationId",
  );
});
