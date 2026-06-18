import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  classifyPendingAddressVerificationReply,
  isLikelyAddressCorrection,
  isLikelyNewPurchaseIntent,
} from "./address-verification-routing.ts";

Deno.test("pending address verification does not swallow a later new product request", () => {
  assertEquals(
    classifyPendingAddressVerificationReply("Necesito un sleeping de poppy talla 2 con mangas"),
    "not_address",
  );
  assertEquals(isLikelyNewPurchaseIntent("Necesito un sleeping de poppy talla 2 con mangas"), true);
});

Deno.test("pending address verification does not repeat address ack on greeting", () => {
  assertEquals(classifyPendingAddressVerificationReply("Hola"), "not_address");
});

Deno.test("pending address verification keeps buttons and direct confirmations in address flow", () => {
  assertEquals(classifyPendingAddressVerificationReply("", "ADDRESS_CORRECT"), "confirm");
  assertEquals(classifyPendingAddressVerificationReply("", "ADDRESS_WRONG"), "request_correction");
  assertEquals(classifyPendingAddressVerificationReply("Sí, correcto"), "confirm");
  assertEquals(classifyPendingAddressVerificationReply("No, está mal"), "request_correction");
});

Deno.test("pending address verification recognizes actual address corrections", () => {
  assertEquals(
    classifyPendingAddressVerificationReply("Cra 15 # 82-10 apto 402, barrio El Retiro, Bogotá"),
    "address_correction",
  );
  assertEquals(isLikelyAddressCorrection("mi dirección es calle 10 # 20-30"), true);
});
