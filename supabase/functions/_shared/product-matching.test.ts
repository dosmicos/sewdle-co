import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractSearchTerms,
  formatProductsForContext,
  isProductQuery,
  scoreProductNameMatch,
  searchRelevantProducts,
  buildProductSearchContext,
} from "./product-matching.ts";

Deno.test("extractSearchTerms keeps product words and removes stop words", () => {
  assertEquals(extractSearchTerms("Walter poppy con mangas"), ["walter", "poppy", "mangas"]);
});

Deno.test("extractSearchTerms maps thermal pajamas to sleeping products", () => {
  const terms = extractSearchTerms("pijama térmica para bebé de 9 meses");
  assert(terms.includes("sleeping"));
  assert(terms.includes("walker"));
});

Deno.test("isProductQuery treats photo/color/product follow-up as product query", () => {
  assert(isProductQuery("Hay más colores ?"));
  assert(isProductQuery("Te mando una foto del sleeping"));
});

Deno.test("scoreProductNameMatch ignores size/unit suffixes in the AI name", () => {
  assertEquals(scoreProductNameMatch("Ruana Perrito Azul", "Ruana Perrito Azul talla 6 unidad 1"), 98);
});

Deno.test("buildProductSearchContext keeps the earlier product topic for follow-ups", () => {
  const context = buildProductSearchContext(
    "Y para niña de 4 años",
    [
      { direction: "inbound", content: "Me compartes por favor catálogo de ruanas para bebés" },
      { direction: "outbound", content: "Claro, aquí tienes el catálogo" },
      { direction: "inbound", content: "Niño de 3 meses" },
    ],
  );

  assert(context.includes("catálogo de ruanas para bebés"));
  assert(context.includes("Y para niña de 4 años"));
});

Deno.test("buildProductSearchContext turns product links into explicit selected-product hints", () => {
  const context = buildProductSearchContext(
    "Estoy interesada en esta, en talla 8",
    [
      { direction: "inbound", content: "https://dosmicos.co/products/ruana-de-vaca-cafe" },
    ],
  );

  assert(context.includes("Producto ya compartido: ruana de vaca cafe"));
  assert(context.includes("Estoy interesada en esta, en talla 8"));
});

Deno.test("buildProductSearchContext keeps outbound catalog links for selected-from-catalog checkout", () => {
  const context = buildProductSearchContext(
    "Estoy interesada en esta, en talla 8",
    [
      { direction: "outbound", content: "Mira todos los productos aquí: https://dosmicos.co/collections/nuevos-productos" },
    ],
  );

  assert(context.includes("Catálogo ya compartido: nuevos productos"));
  assert(context.includes("continúa checkout y no reenvíes catálogo"));
  assert(context.includes("Estoy interesada en esta, en talla 8"));
});

Deno.test("buildProductSearchContext reads OCR text from multimodal content", () => {
  const context = buildProductSearchContext(
    "Mira este",
    [
      {
        direction: "inbound",
        content: [
          { type: "text", text: "OCR del texto visible:\nSleeping Walker Mapach TOG 3.5" },
          { type: "image_url", image_url: { url: "https://example.com/product.png" } },
        ],
      },
    ],
  );

  assert(context.includes("Sleeping Walker Mapach TOG 3.5"));
  assert(context.includes("Mira este"));
});

Deno.test("buildProductSearchContext also accepts role=user messages", () => {
  const context = buildProductSearchContext(
    "Mira este",
    [
      {
        role: "user",
        content: [
          { type: "text", text: "OCR del texto visible:\nSleeping Walker Mapach TOG 3.5" },
          { type: "image_url", image_url: { url: "https://example.com/product.png" } },
        ],
      },
    ],
  );

  assert(context.includes("Sleeping Walker Mapach TOG 3.5"));
});

Deno.test("searchRelevantProducts matches typo-heavy product names", () => {
  const products = [
    {
      id: 1,
      title: "Sleeping Walker Poppy con Mangas TOG 2.5",
      handle: "sleeping-walker-poppy-con-mangas-tog-2-5",
      product_type: "Sleeping Walker",
      tags: "poppy, mangas, rosado",
      body_html: "",
      variants: [
        { title: "Rosado / Talla 6", option1: "Rosado", option2: "Talla 6", inventory_quantity: 4 },
      ],
    },
    {
      id: 2,
      title: "Cobija Nube",
      handle: "cobija-nube",
      product_type: "Cobija",
      tags: "azul",
      body_html: "",
      variants: [
        { title: "Azul", option1: "Azul", inventory_quantity: 10 },
      ],
    },
  ];

  const results = searchRelevantProducts(products, extractSearchTerms("Walter poppy con mangas"), 5);
  assertEquals(results[0].title, "Sleeping Walker Poppy con Mangas TOG 2.5");
});

Deno.test("searchRelevantProducts matches exact typed product names in uppercase", () => {
  const products = [
    {
      id: 10,
      title: "Ruana Venado Dosmicos Camel",
      handle: "ruana-venado-dosmicos-camel",
      product_type: "Ruana",
      tags: "venado, camel",
      body_html: "",
      variants: [
        { title: "Talla 2", option1: "Talla 2", inventory_quantity: 3, price: "96900" },
      ],
    },
    {
      id: 11,
      title: "Ruana Vaca Café",
      handle: "ruana-vaca-cafe",
      product_type: "Ruana",
      tags: "vaca, cafe",
      body_html: "",
      variants: [
        { title: "Talla 2", option1: "Talla 2", inventory_quantity: 5, price: "96900" },
      ],
    },
  ];

  const results = searchRelevantProducts(products, extractSearchTerms("RUANA VENADO DOSMICOS CAMEL"), 5);
  assertEquals(results[0].title, "Ruana Venado Dosmicos Camel");
});

Deno.test("searchRelevantProducts prioritizes exact OCR product title from screenshot", () => {
  const products = [
    {
      id: 20,
      title: "Ruana Reno Rudolph",
      handle: "ruana-reno-rudolph",
      product_type: "Ruana",
      tags: "reno, navidad",
      body_html: "",
      variants: [{ title: "Talla 8", option1: "Talla 8", inventory_quantity: 4, price: "96900" }],
    },
    {
      id: 21,
      title: "Ruana Venado Aurora",
      handle: "ruana-venado-aurora",
      product_type: "Ruana",
      tags: "venado, aurora",
      body_html: "",
      variants: [{ title: "Talla 8", option1: "Talla 8", inventory_quantity: 3, price: "96900" }],
    },
  ];

  const context = buildProductSearchContext("En esta tienes talla 8", [
    { role: "user", content: [{ type: "text", text: "OCR del texto visible:\nNombre visible: Ruana Venado Aurora\nPrecio visible: $96.900" }] },
  ]);
  const results = searchRelevantProducts(products, extractSearchTerms(context), 5);

  assertEquals(results[0].title, "Ruana Venado Aurora");
});

Deno.test("formatProductsForContext includes options and reference clues", () => {
  const context = formatProductsForContext([
    {
      id: 1,
      title: "Sleeping Walker Poppy con Mangas TOG 2.5",
      handle: "sleeping-walker-poppy-con-mangas-tog-2-5",
      variants: [
        {
          title: "Rosado / Talla 6",
          option1: "Rosado",
          option2: "Talla 6",
          inventory_quantity: 4,
          price: "139900",
        },
        {
          title: "Azul / Talla 6",
          option1: "Azul",
          option2: "Talla 6",
          inventory_quantity: 2,
          price: "139900",
        },
      ],
      options: [
        { name: "Color", values: ["Rosado", "Azul"] },
        { name: "Talla", values: ["6"] },
      ],
    },
  ]);

  assert(context.includes("🎨 Opciones:"));
  assert(context.includes("Referencia:"));
  assert(context.includes("Rosado"));
  assert(context.includes("Azul"));
});
