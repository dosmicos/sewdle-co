/// <reference lib="deno.ns" />

import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import {
  ELSA_LEARNING_STATUSES,
  formatLearningConfidence,
  getLearningStatusLabel,
  normalizeLearningStatus,
} from "./elsaLearningReview.ts";

Deno.test("Elsa learning review helpers normalize known statuses and labels", () => {
  assertEquals(ELSA_LEARNING_STATUSES, ["needs_review", "active", "archived"]);
  assertEquals(normalizeLearningStatus("active"), "active");
  assertEquals(normalizeLearningStatus("bad-value"), "needs_review");
  assertEquals(getLearningStatusLabel("needs_review"), "Por revisar");
  assertEquals(getLearningStatusLabel("active"), "Activo");
  assertEquals(getLearningStatusLabel("archived"), "Archivado");
});

Deno.test("Elsa learning review helpers format confidence for UI", () => {
  assertEquals(formatLearningConfidence(0.55), "55%");
  assertEquals(formatLearningConfidence("0.8"), "80%");
  assertEquals(formatLearningConfidence(null), "Sin confianza");
  assertEquals(formatLearningConfidence("not-a-number"), "Sin confianza");
});
