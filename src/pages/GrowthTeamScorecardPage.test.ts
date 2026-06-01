/// <reference lib="deno.ns" />

import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

Deno.test("Growth Team Scorecard is routed, visible in sidebar, and linked from summary", async () => {
  const app = await Deno.readTextFile("src/App.tsx");
  const sidebar = await Deno.readTextFile("src/components/finance-dashboard/FinanceSidebar.tsx");
  const home = await Deno.readTextFile("src/pages/FinanceDashboardPage.tsx");

  assert(app.includes("GrowthTeamScorecardPage"), "App must lazy-load GrowthTeamScorecardPage");
  assert(app.includes('path="/team-scorecard"'), "growth subdomain must expose /team-scorecard route");
  assert(sidebar.includes("Team Scorecard"), "sidebar must show Team Scorecard item");
  assert(sidebar.includes("team-scorecard"), "sidebar must derive active team-scorecard section");
  assert(home.includes("Ver Team Scorecard"), "summary home must link to the new scorecard page");
});
