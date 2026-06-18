import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

Deno.test("Elsa conversation insights migration creates a PII-safe review table", async () => {
  const sql = await Deno.readTextFile("supabase/migrations/20260613170000_elsa_conversation_insights.sql");

  assert(sql.includes("CREATE TABLE IF NOT EXISTS public.elsa_conversation_insights"));
  assert(sql.includes("summary TEXT NOT NULL"));
  assert(sql.includes("evidence TEXT"));
  assert(sql.includes("source_conversation_ids UUID[]"));
  assert(sql.includes("source_message_ids UUID[]"));
  assert(sql.includes("CHECK (status IN ('new', 'reviewing', 'approved', 'archived', 'done'))"));
  assert(sql.includes("CHECK (type IN"));
  assert(sql.includes("product_request"));
  assert(sql.includes("answer_improvement"));
  assert(sql.includes("quality_feedback"));
  assert(sql.includes("ALTER TABLE public.elsa_conversation_insights ENABLE ROW LEVEL SECURITY"));
  assert(sql.includes("get_user_organizations()"));
  assert(sql.includes("USING GIN(tags)"));
});
