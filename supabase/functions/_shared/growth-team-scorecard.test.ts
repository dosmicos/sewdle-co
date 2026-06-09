/// <reference lib="deno.ns" />

import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";
import {
  attributeDrivePerson,
  buildKpi,
  normalizePercentMetric,
  resolveBogotaWeek,
  summarizeCustomerAcquisition,
  summarizeStaticCreatives,
  toBogotaIsoWindow,
} from "./growth-team-scorecard.ts";

Deno.test("attributeDrivePerson maps Angie by owner and keeps info@dosmicos shared", () => {
  const maps = [
    { email: "angiecdiazb@gmail.com", person_key: "angie", person_label: "Angie", priority: 10 },
    { email: "info@dosmicos.co", person_key: "shared", person_label: "Shared / Sin asignar", priority: 20 },
    { email: "julian@dosmicos.co", person_key: "julian", person_label: "Julian", priority: 30 },
  ];

  assertEquals(
    attributeDrivePerson({ owner_email: "angiecdiazb@gmail.com", last_modifying_user_email: "info@dosmicos.co" }, maps),
    { personKey: "angie", personLabel: "Angie" },
  );
  assertEquals(
    attributeDrivePerson({ owner_email: "info@dosmicos.co", last_modifying_user_email: "angiecdiazb@gmail.com" }, maps),
    { personKey: "shared", personLabel: "Shared / Sin asignar" },
  );
  assertEquals(
    attributeDrivePerson({ owner_email: "unknown@example.com" }, maps),
    { personKey: "unknown", personLabel: "Sin asignar" },
  );
});

Deno.test("summarizeStaticCreatives counts current window by product/person and exposes unassigned", () => {
  const folders = [
    { product_key: "ruanas", product_name: "Ruanas", drive_folder_id: "folder-ruanas" },
    { product_key: "combos", product_name: "Combos", drive_folder_id: "folder-combos" },
  ];
  const assets = [
    { drive_file_id: "1", product_key: "ruanas", product_name: "Ruanas", source_folder_id: "folder-ruanas", file_name: "a.jpg", created_time: "2026-06-02T10:00:00Z", attributed_person_key: "angie", attributed_person_label: "Angie", web_view_link: "https://drive/1" },
    { drive_file_id: "2", product_key: "ruanas", product_name: "Ruanas", source_folder_id: "folder-ruanas", file_name: "b.png", created_time: "2026-06-03T10:00:00Z", attributed_person_key: "shared", attributed_person_label: "Shared / Sin asignar", web_view_link: "https://drive/2" },
    { drive_file_id: "3", product_key: "combos", product_name: "Combos", source_folder_id: "folder-combos", file_name: "c.webp", created_time: "2026-05-31T10:00:00Z", attributed_person_key: "angie", attributed_person_label: "Angie", web_view_link: "https://drive/3" },
  ];

  const summary = summarizeStaticCreatives(assets, folders, "2026-06-01", "2026-06-08", 30);

  assertEquals(summary.total, 2);
  assertEquals(summary.target, 30);
  assertEquals(summary.byPerson.angie, 1);
  assertEquals(summary.byPerson.shared, 1);
  assertEquals(summary.byProduct[0].productKey, "ruanas");
  assertEquals(summary.byProduct[0].total, 2);
  assertEquals(summary.byProduct[0].byPerson.shared, 1);
  assertEquals(summary.byProduct[1].productKey, "combos");
  assertEquals(summary.byProduct[1].total, 0);
  assertEquals(summary.latestAssets.length, 2);
});

Deno.test("buildKpi sets traffic-light status from target progress", () => {
  assertEquals(buildKpi(95, 100, "higher_better").status, "green");
  assertEquals(buildKpi(86, 100, "higher_better").status, "yellow");
  assertEquals(buildKpi(70, 100, "higher_better").status, "red");
  assertEquals(buildKpi(2.99, 3.5, "higher_better").status, "yellow");
  assertEquals(buildKpi(null, 25, "higher_better").status, "missing");
});

Deno.test("normalizePercentMetric converts ratio-shaped values to percentage points", () => {
  assertEquals(normalizePercentMetric(0.762), 76.2);
  assertEquals(normalizePercentMetric(76.2), 76.2);
  assertEquals(normalizePercentMetric(null), null);
});

Deno.test("summarizeCustomerAcquisition matches Customer Health unique-customer rules", () => {
  const metrics = summarizeCustomerAcquisition([
    { customer_id: 1, customer_email: "new@example.com", current_total_price: "100000" },
    { customer_id: 2, customer_email: "returning@example.com", current_total_price: "50000" },
    { customer_id: 3, customer_email: "repeat@example.com", current_total_price: "40000" },
    { customer_id: 3, customer_email: "repeat@example.com", current_total_price: "30000" },
  ], new Set(["id:2"]));

  assertEquals(metrics.newCustomerCount, 1);
  assertEquals(metrics.returningCustomerCount, 2);
  assertEquals(metrics.newCustomerOrders, 1);
  assertEquals(metrics.returningCustomerOrders, 3);
  assertEquals(metrics.newCustomerRevenue, 100000);
  assertEquals(metrics.returningCustomerRevenue, 120000);
});

Deno.test("resolveBogotaWeek returns approved non-linear June milestone window", () => {
  const week = resolveBogotaWeek(new Date("2026-06-10T15:00:00Z"));
  assertEquals(week.start, "2026-06-08");
  assertEquals(week.end, "2026-06-15");
  assert(week.label.includes("Semana 2"));
});

Deno.test("toBogotaIsoWindow maps inclusive/exclusive Bogotá dates to UTC instants", () => {
  assertEquals(toBogotaIsoWindow("2026-06-01", "2026-06-08"), {
    start: "2026-06-01T05:00:00.000Z",
    end: "2026-06-08T04:59:59.999Z",
  });
});
