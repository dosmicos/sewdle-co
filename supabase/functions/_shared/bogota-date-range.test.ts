import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildFinanceDateRanges,
  formatBogotaDateForQuery,
  toBogotaDateString,
} from "../../../src/lib/bogotaDateRange.ts";

Deno.test("MTD on first day of month uses one Bogotá day and compares against previous one day", () => {
  const ranges = buildFinanceDateRanges("mtd", new Date("2026-06-01T16:13:00.000Z"));

  assertEquals(ranges.current.start.toISOString(), "2026-06-01T05:00:00.000Z");
  assertEquals(ranges.current.end.toISOString(), "2026-06-02T04:59:59.999Z");
  assertEquals(ranges.previous.start.toISOString(), "2026-05-31T05:00:00.000Z");
  assertEquals(ranges.previous.end.toISOString(), "2026-06-01T04:59:59.999Z");
});

Deno.test("today follows America/Bogota even when UTC is already the next day", () => {
  const ranges = buildFinanceDateRanges("today", new Date("2026-06-01T03:30:00.000Z"));

  assertEquals(toBogotaDateString(new Date("2026-06-01T03:30:00.000Z")), "2026-05-31");
  assertEquals(formatBogotaDateForQuery(ranges.current.start), "2026-05-31");
  assertEquals(ranges.current.start.toISOString(), "2026-05-31T05:00:00.000Z");
  assertEquals(ranges.current.end.toISOString(), "2026-06-01T04:59:59.999Z");
});

Deno.test("rolling seven day preset compares against exactly seven prior Bogotá days", () => {
  const ranges = buildFinanceDateRanges("7d", new Date("2026-06-10T15:00:00.000Z"));

  assertEquals(formatBogotaDateForQuery(ranges.current.start), "2026-06-04");
  assertEquals(formatBogotaDateForQuery(ranges.current.end), "2026-06-10");
  assertEquals(formatBogotaDateForQuery(ranges.previous.start), "2026-05-28");
  assertEquals(formatBogotaDateForQuery(ranges.previous.end), "2026-06-03");
});
