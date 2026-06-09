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

Deno.test("Growth Team Scorecard renders June 600M owner contract", async () => {
  const page = await Deno.readTextFile("src/pages/GrowthTeamScorecardPage.tsx");
  const edge = await Deno.readTextFile("supabase/functions/growth-team-scorecard/index.ts");

  assert(page.includes("Junio 600M Operating Dashboard"), "page must use the June 600M dashboard framing");
  assert(page.includes("Risk matrix — triggers automáticos"), "page must expose the operating risk matrix");
  assert(page.includes("Kira") && page.includes("dirección creativa IA"), "page must show Kira as AI creative direction");
  assert(page.includes("Angie + Ana María") && page.includes("productoras 50/50"), "page must show Angie + Ana María as 50/50 production");
  assert(page.includes("Data no disponible = action item"), "missing metrics must be explicit action items");
  assert(edge.includes("static_creatives_target: 30"), "edge fallback must use 30 statics/week");
  assert(edge.includes("static_published_target: 24"), "edge fallback must use 24 published/tested statics/week");
  assert(edge.includes("riskMatrix"), "edge response must include riskMatrix");
  assert(edge.includes("fetchKiraCreativeDirection"), "edge must connect Kira to structured AngleOS data");
  assert(edge.includes('"ad_tags AngleOS"'), "edge metadata must expose Kira/AngleOS source");
  assert(!edge.includes("Conectar sales-angle report/foco semanal como dato estructurado"), "Kira must no longer be hard-coded as pending connection");
});
