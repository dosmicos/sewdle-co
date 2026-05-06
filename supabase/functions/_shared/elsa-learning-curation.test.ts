import {
  classifyLearningForCuration,
  learningCurationSignature,
} from "./elsa-learning-curation.ts";

function assertEquals(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}

Deno.test("classifyLearningForCuration auto-activates repeated safe size guidance", () => {
  const decision = classifyLearningForCuration({
    learning: {
      category: "sizes",
      situation:
        "Cliente pregunta qué talla escoger para un bebé según edad y estatura.",
      recommended_response:
        "Para ayudarte mejor con la talla, confírmame porfa la estatura del bebé 😊",
      confidence: 0.86,
      status: "needs_review",
    },
    duplicateCount: 3,
  });

  assertEquals(decision.recommendedStatus, "active");
  assertEquals(decision.autoApply, true);
  assertEquals(decision.reason, "safe_repeated_pattern");
});

Deno.test("classifyLearningForCuration leaves payment and order details for human review", () => {
  const decision = classifyLearningForCuration({
    learning: {
      category: "payments",
      situation: "Cliente pide datos para transferencia del pedido #75457.",
      recommended_response:
        "Te envío los datos de Bancolombia para pagar el pedido.",
      confidence: 0.95,
      status: "needs_review",
    },
    duplicateCount: 5,
  });

  assertEquals(decision.recommendedStatus, "needs_review");
  assertEquals(decision.autoApply, false);
  assertEquals(decision.riskFlags.includes("sensitive_policy_or_order"), true);
});

Deno.test("classifyLearningForCuration archives generic low-value captures", () => {
  const decision = classifyLearningForCuration({
    learning: {
      category: "general",
      situation: "Cliente saluda.",
      recommended_response:
        "No tengo esa información, te conecto con el equipo 🙌",
      confidence: 0.5,
      status: "needs_review",
    },
    duplicateCount: 1,
  });

  assertEquals(decision.recommendedStatus, "archived");
  assertEquals(decision.autoApply, true);
  assertEquals(decision.reason, "low_value_or_generic_capture");
});

Deno.test("classifyLearningForCuration does not auto-activate possible PII", () => {
  const decision = classifyLearningForCuration({
    learning: {
      category: "shipping",
      situation:
        "Cliente pregunta por envío a su dirección y comparte teléfono 3001234567.",
      recommended_response: "El envío a esa dirección queda confirmado.",
      confidence: 0.9,
      status: "needs_review",
    },
    duplicateCount: 4,
  });

  assertEquals(decision.recommendedStatus, "needs_review");
  assertEquals(decision.autoApply, false);
  assertEquals(decision.riskFlags.includes("possible_pii"), true);
});

Deno.test("learningCurationSignature groups normalized duplicate learning rows", () => {
  const first = learningCurationSignature({
    category: "Sizes",
    situation: "¿Qué talla le sirve?",
    recommended_response: "Confírmame la estatura porfa 😊",
  });
  const second = learningCurationSignature({
    category: "sizes",
    situation: "Que talla le sirve",
    recommended_response: "Confirmame la estatura porfa",
  });

  assertEquals(first, second);
});
