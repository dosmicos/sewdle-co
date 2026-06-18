import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

import {
  buildConversationInsightCandidate,
  redactInsightEvidence,
  shouldCaptureConversationInsight,
} from "./elsa-conversation-insights.ts";

Deno.test("conversation insight helper captures adult-version product requests without PII", () => {
  const candidate = buildConversationInsightCandidate({
    organizationId: "11111111-1111-4111-8111-111111111111",
    conversationId: "22222222-2222-4222-8222-222222222222",
    messageIds: ["33333333-3333-4333-8333-333333333333"],
    text: "Hola soy María, mi correo es maria@example.com y quiero el cerdito en adulto para llevarlo en combo con mi bebé. Tel 3001234567",
    source: "customer_message",
  });

  assert(candidate, "Expected an insight candidate");
  assertEquals(candidate?.type, "product_request");
  assertEquals(candidate?.sentiment, "opportunity");
  assertEquals(candidate?.priority, "medium");
  assertEquals(candidate?.status, "new");
  assert(candidate?.summary.toLowerCase().includes("adulto"));
  assert(candidate?.summary.toLowerCase().includes("combo"));
  assert(!candidate?.evidence.includes("maria@example.com"));
  assert(!candidate?.evidence.includes("3001234567"));
  assertEquals(candidate?.tags.includes("version-adulto"), true);
  assertEquals(candidate?.tags.includes("combo-familiar"), true);
});

Deno.test("conversation insight helper captures improvement feedback and bad answer corrections", () => {
  const candidate = buildConversationInsightCandidate({
    organizationId: "11111111-1111-4111-8111-111111111111",
    text: "Elsa no debería mandar otra vez al catálogo si la clienta ya eligió el producto del link. Lo lógico es ayudarle a crear el pedido.",
    source: "human_feedback",
  });

  assert(candidate, "Expected a correction insight");
  assertEquals(candidate?.type, "answer_improvement");
  assertEquals(candidate?.sentiment, "improvement");
  assertEquals(candidate?.priority, "high");
  assertEquals(candidate?.tags.includes("checkout-flow"), true);
  assertEquals(candidate?.tags.includes("no-reiniciar-catalogo"), true);
});

Deno.test("conversation insight helper ignores routine checkout data", () => {
  assertEquals(
    shouldCaptureConversationInsight("Nombre: Ana, dirección: Calle 1, ciudad Bogotá, cédula 123456789, pago PSE"),
    false,
  );
});

Deno.test("redactInsightEvidence removes common PII patterns", () => {
  const redacted = redactInsightEvidence(
    "Cliente Laura Gómez, email laura@test.com, celular +57 311 222 3344, pedido #75925, vive en Calle 123 #45-67 apto 890",
  );

  assert(!redacted.includes("laura@test.com"));
  assert(!redacted.includes("311 222 3344"));
  assert(!redacted.includes("#75925"));
  assert(!redacted.includes("Calle 123"));
  assert(redacted.includes("[email]"));
  assert(redacted.includes("[teléfono]"));
  assert(redacted.includes("[pedido]"));
  assert(redacted.includes("[dirección]"));
});
