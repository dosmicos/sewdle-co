/// <reference lib="deno.ns" />

import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

Deno.test("Elsa learnings page is routed and visible from the messaging menu", async () => {
  const [app, sidebar, page] = await Promise.all([
    Deno.readTextFile("src/App.tsx"),
    Deno.readTextFile("src/components/AppSidebar.tsx"),
    Deno.readTextFile("src/pages/ElsaLearningsPage.tsx"),
  ]);

  assert(app.includes("ElsaLearningsPage"), "App must import the Elsa learnings page");
  assert(app.includes('path="elsa-learnings"'), "App must expose /elsa-learnings route");
  assert(sidebar.includes("Aprendizajes Elsa"), "Sidebar must expose Aprendizajes Elsa");
  assert(sidebar.includes("/elsa-learnings"), "Sidebar menu item must navigate to /elsa-learnings");
  assert(page.includes("elsa_response_learnings"), "Page must read Elsa learning rows");
  assert(page.includes("elsa-review-learning"), "Page must call the review Edge Function for actions");
  assert(page.includes("Aprobar") && page.includes("Archivar") && page.includes("Guardar"), "Page must expose approve/archive/save actions");
});
