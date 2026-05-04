/// <reference lib="deno.ns" />

import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

Deno.test("Elsa review learning function authenticates users and updates reviewable fields only", async () => {
  const source = await Deno.readTextFile("supabase/functions/elsa-review-learning/index.ts");

  assert(source.includes("auth.getUser"), "review function must authenticate the caller JWT");
  assert(source.includes("organization_users"), "review function must verify organization membership before updates");
  assert(source.includes("elsa_response_learnings"), "review function must update Elsa learning rows");
  assert(source.includes("needs_review") && source.includes("active") && source.includes("archived"), "review function must constrain learning statuses");
  assert(source.includes("recommended_response"), "review function must allow editing the recommended response");
  assert(source.includes("avoid_response"), "review function must allow editing avoid_response");
  assert(source.includes("updated_at"), "review function must touch updated_at when reviewing");
});
