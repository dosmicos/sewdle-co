/// <reference lib="deno.ns" />

import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

Deno.test("Elsa suggestion review function marks rejected suggestions and creates a needs_review correction learning", async () => {
  const source = await Deno.readTextFile("supabase/functions/elsa-review-suggestion/index.ts");

  assert(source.includes("supabase.auth.getUser(token)"), "Function must authenticate user JWT manually");
  assert(source.includes("organization_users"), "Function must verify organization membership");
  assert(source.includes("review_status: \"rejected\""), "Function must mark the supervised suggestion as rejected in metadata");
  assert(source.includes("elsa_response_learnings"), "Function must create a learning candidate");
  assert(source.includes("status: \"needs_review\""), "Rejected/corrected suggestions must require review before Elsa uses them");
  assert(source.includes("avoid_response"), "Learning candidate must preserve what Elsa should avoid saying");
});
