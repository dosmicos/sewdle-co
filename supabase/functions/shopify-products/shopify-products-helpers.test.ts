import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  extractNextPageInfo,
  productMatchesSearch,
} from "./shopify-products-helpers.ts";

Deno.test("extractNextPageInfo returns next cursor from Shopify Link header", () => {
  const linkHeader =
    '<https://dosmicos.myshopify.com/admin/api/2023-10/products.json?limit=250&page_info=abc123>; rel="next"';

  assertEquals(extractNextPageInfo(linkHeader), "abc123");
});

Deno.test("extractNextPageInfo ignores previous-only Link header", () => {
  const linkHeader =
    '<https://dosmicos.myshopify.com/admin/api/2023-10/products.json?limit=250&page_info=prev>; rel="previous"';

  assertEquals(extractNextPageInfo(linkHeader), null);
});

Deno.test("productMatchesSearch matches title, tags and variant SKU", () => {
  const product = {
    title: "Zapatos Osito Rosa",
    body_html: "",
    product_type: "Zapatos",
    tags: ["Bebé", "Zapatos Niña"],
    variants: [{ sku: "ZAPA-OSITO-0-6", title: "0-6M" }],
  };

  assertEquals(productMatchesSearch(product, "zapa"), true);
  assertEquals(productMatchesSearch(product, "niña"), true);
  assertEquals(productMatchesSearch(product, "0-6"), true);
  assertEquals(productMatchesSearch(product, "sleeping"), false);
});

Deno.test("productMatchesSearch handles Shopify REST comma-separated tags", () => {
  const product = {
    title: "Dosmi Zapatos Koala",
    body_html: null,
    product_type: "",
    tags: "Bebé (0 a 12M), Ropa Bebé, Zapatos Niño",
    variants: [],
  };

  assertEquals(productMatchesSearch(product, "zapatos niño"), true);
});
