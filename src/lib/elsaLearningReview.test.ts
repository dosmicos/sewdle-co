/// <reference lib="deno.ns" />

import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import {
  ELSA_LEARNING_STATUSES,
  formatLearningConfidence,
  getLearningCurationSummary,
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

Deno.test("Elsa learning review helpers describe auto-curation rationale", () => {
  const summary = getLearningCurationSummary({
    status: "active",
    confidence: 0.91,
    metadata: {
      curation: {
        auto_apply: true,
        recommended_status: "active",
        reason: "safe_repeated_pattern",
        duplicate_count: 3,
        risk_flags: [],
      },
    },
  });

  assertEquals(summary?.headline, "Autoaprobado por patrón repetido");
  assertEquals(summary?.tone, "success");
  assertEquals(summary?.details.includes("3 veces"), true);
  assertEquals(summary?.details.includes("91%"), true);
});

Deno.test("Elsa learning review helpers describe review rationale and risks", () => {
  const summary = getLearningCurationSummary({
    status: "needs_review",
    confidence: 0.4,
    metadata: {
      curation: {
        auto_apply: false,
        recommended_status: "needs_review",
        reason: "needs_human_review",
        duplicate_count: 2,
        risk_flags: ["possible_pii", "sensitive_policy_or_order"],
      },
    },
  });

  assertEquals(summary?.headline, "Sigue en revisión con alertas");
  assertEquals(summary?.tone, "warning");
  assertEquals(summary?.details.includes("2 veces"), true);
  assertEquals(summary?.details.includes("PII posible"), true);
  assertEquals(summary?.badges.includes("possible_pii"), true);
});
