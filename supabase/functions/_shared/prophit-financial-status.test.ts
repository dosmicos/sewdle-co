import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  filterShopifyAnalyticsSaleOrders,
  isShopifyAnalyticsSaleStatus,
} from "./prophit-financial-status.ts";

Deno.test("Shopify Analytics sale statuses exclude pending orders", () => {
  assertEquals(isShopifyAnalyticsSaleStatus("paid"), true);
  assertEquals(isShopifyAnalyticsSaleStatus("partially_paid"), true);
  assertEquals(isShopifyAnalyticsSaleStatus("partially_refunded"), true);
  assertEquals(isShopifyAnalyticsSaleStatus("pending"), false);
  assertEquals(isShopifyAnalyticsSaleStatus("authorized"), false);
  assertEquals(isShopifyAnalyticsSaleStatus("refunded"), false);
  assertEquals(isShopifyAnalyticsSaleStatus("voided"), false);
});

Deno.test("filterShopifyAnalyticsSaleOrders keeps paid-like orders only", () => {
  const rows = [
    { id: "paid", financial_status: "paid", total_price: 100 },
    { id: "pending", financial_status: "pending", total_price: 200 },
    { id: "partial", financial_status: "partially_refunded", total_price: 300 },
  ];

  assertEquals(filterShopifyAnalyticsSaleOrders(rows).map((row) => row.id), ["paid", "partial"]);
});
