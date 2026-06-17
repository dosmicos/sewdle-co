function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("meta-webhook-openai prioritizes visible text in screenshots of products", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assert(
    source.includes("No intentes reconocer productos por apariencia visual"),
    "the prompt must not ask the reply model to guess products visually",
  );
  assert(
    source.includes("Usa únicamente el texto OCR y lo que escriba el cliente"),
    "the prompt must use OCR/customer text as the product evidence",
  );
  assert(
    source.includes("Si el cliente escribe el nombre exacto del producto"),
    "the prompt must treat typed product names as selected products",
  );
  assert(
    source.includes("no le pidas el nombre exacto ni una foto más clara"),
    "the prompt must push readable screenshots straight into checkout",
  );
  assert(
    source.includes("número de cuenta, datos de transferencia"),
    "the prompt must answer bank/transfer account questions directly from knowledge",
  );
  assert(
    source.includes("los sleepings y las chaquetas de bebé SÍ se pueden bordar/personalizar"),
    "the prompt must not deny embroidery for sleepings or baby jackets",
  );
  assert(
    source.includes("no ofrezcas ruanas como reemplazo"),
    "the prompt must not redirect sleeping embroidery requests to ruanas",
  );
});

Deno.test("image OCR helper is wired into the route", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assert(
    source.includes("buildVisionImageContent"),
    "the route must enrich image messages with OCR text before customer reply generation",
  );
});
