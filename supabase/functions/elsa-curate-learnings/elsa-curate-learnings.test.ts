const functionSource = await Deno.readTextFile(
  new URL("./index.ts", import.meta.url),
);

function assertIncludes(needle: string) {
  if (!functionSource.includes(needle)) {
    throw new Error(`Expected Elsa curation function to include: ${needle}`);
  }
}

Deno.test("elsa-curate-learnings requires an explicit curation token", () => {
  assertIncludes('Deno.env.get("ELSA_CURATION_TOKEN")');
  assertIncludes("bearer !== curationToken");
  assertIncludes('return jsonResponse({ error: "unauthorized" }, 401)');
});

Deno.test("elsa-curate-learnings only scans pending learning candidates", () => {
  assertIncludes('.from("elsa_response_learnings")');
  assertIncludes('.eq("status", "needs_review")');
  assertIncludes("learningCurationSignature");
  assertIncludes("classifyLearningForCuration");
});

Deno.test("elsa-curate-learnings can dry-run without applying changes", () => {
  assertIncludes("const apply = body.apply === true");
  assertIncludes('mode: apply ? "apply" : "dry_run"');
  assertIncludes("if (!apply)");
});
