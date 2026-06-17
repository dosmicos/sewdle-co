function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

import {
  buildImageScreenshotFallbackReply,
  buildVisionImageContent,
  extractReadableImageHint,
  mergeImageContextWithLatestUserText,
  shouldReplaceGenericImageReply,
} from './image-ocr.ts';

Deno.test('image OCR helper rewrites generic handoffs for screenshots into a useful fallback', () => {
  const content = [
    { type: 'text', text: 'OCR del texto visible:\nSleeping Walker Mapach TOG 3.5' },
    { type: 'text', text: 'El cliente envió esta imagen.' },
    { type: 'image_url', image_url: { url: 'https://example.com/product.png' } },
  ];

  const hint = extractReadableImageHint(content);
  const reply = buildImageScreenshotFallbackReply(content);

  assert(hint?.includes('Sleeping Walker Mapach TOG 3.5'), 'expected product hint from OCR');
  assert(
    reply.includes('Sleeping Walker Mapach TOG 3.5') && reply.includes('Para avanzar con el pedido'),
    'expected screenshot-aware fallback reply',
  );
  assert(
    shouldReplaceGenericImageReply('No tengo esa información, te conecto con el equipo 🙌', content),
    'expected generic handoff to be replaced for image content',
  );
  assert(
    shouldReplaceGenericImageReply(
      'Ya vi tu imagen 😊 si ya es el producto que quieres, me pasas el nombre o la referencia y te ayudo a cerrarlo.',
      content,
    ),
    'expected exact generic image prompt to be replaced for screenshot content',
  );
  assert(
    shouldReplaceGenericImageReply(
      'Aquí no me deja identificar bien el sleeping. ¿Me confirmas el nombre o me reenvías una foto más clara para cerrarte el pedido?',
      content,
    ),
    'expected name/photo-clarification handoff to be replaced for screenshot content',
  );
  assert(
    shouldReplaceGenericImageReply(
      'Claro 😊 ¿Me escribes el nombre o la referencia del producto de la imagen para revisarte disponibilidad y ayudarte a comprarlo?',
      content,
    ),
    'expected the exact live WhatsApp failure phrase to be replaced for readable OCR content',
  );
  assert(
    shouldReplaceGenericImageReply(
      'Primero eliges el producto en el catálogo y luego me envías tus datos de compra 😊',
      content,
    ),
    'expected catalog-loop checkout wording to be replaced for readable OCR content',
  );
});

Deno.test('image OCR helper advances checkout when screenshot text shows Dosmi Zapatos Koala', () => {
  const content = [
    { type: 'text', text: 'OCR del texto visible:\nDosmi Zapatos Koala\nPrecio visible: $69.000' },
    { type: 'text', text: 'Quiero comprar este producto' },
  ];

  const hint = extractReadableImageHint(content);
  const reply = buildImageScreenshotFallbackReply(content);

  assert(hint === 'Dosmi Zapatos Koala', 'expected product title from OCR, not customer caption');
  assert(reply.includes('Dosmi Zapatos Koala'), 'expected fallback to name the OCR product title');
  assert(reply.includes('Para avanzar con el pedido'), 'expected fallback to continue checkout');
  assert(!reply.toLowerCase().includes('nombre o la referencia'), 'must not ask for name/reference when OCR title is readable');
  assert(
    shouldReplaceGenericImageReply(
      'Claro 😊 ¿Me escribes el nombre o la referencia del producto de la imagen para revisarte disponibilidad y ayudarte a comprarlo?',
      content,
    ),
    'expected live failure wording to be replaced for Dosmi Zapatos Koala OCR content',
  );
});

Deno.test('image OCR helper catches readable ruana screenshot when model asks for the design again', () => {
  const content = [
    {
      type: 'text',
      text: 'OCR del texto visible:\nRuana Venado Aurora\nPrecio visible: $96.900\nBotones: WhatsApp',
    },
    { type: 'text', text: 'En eata tienes talla 8' },
  ];

  const hint = extractReadableImageHint(content);
  const reply = buildImageScreenshotFallbackReply(content);

  assert(hint === 'Ruana Venado Aurora', `expected visible ruana title, got ${hint}`);
  assert(reply.includes('Ruana Venado Aurora'), 'expected fallback to name the visible ruana');
  assert(reply.includes('talla 8'), 'expected fallback to preserve requested size');
  assert(reply.includes('envío estándar o express'), 'expected fallback to ask next missing checkout decision');
  assert(!reply.toLowerCase().includes('confirmas porfa la talla'), 'must not ask for size again when caption already has talla');
  assert(
    shouldReplaceGenericImageReply(
      'Perfecto, talla 8 😊 ¿Me confirmas porfa qué diseño de ruana quieres? En la imagen no se alcanza a leer el nombre.',
      content,
    ),
    'expected exact live failure phrase to be replaced for readable Ruana Venado Aurora screenshot',
  );
});

Deno.test('image OCR helper keeps readable screenshot product when customer sends a follow-up after the image', () => {
  const imageContent = [
    {
      type: 'text',
      text: 'OCR del texto visible:\nNombre visible: Ruana Mapache\nPrecio visible: $96.900\nBotones: WhatsApp',
    },
    { type: 'text', text: 'El cliente envió una imagen de un producto. Usa solo el OCR/texto visible de la imagen para responder.' },
  ];
  const latestFollowUp = 'Quiero esta ruana para mi bebé pero vi que ahora le bordan el nombre';
  const mergedContent = mergeImageContextWithLatestUserText(imageContent, latestFollowUp);

  const hint = extractReadableImageHint(mergedContent);
  const reply = buildImageScreenshotFallbackReply(mergedContent);

  assert(hint === 'Ruana Mapache', `expected visible Ruana Mapache title, got ${hint}`);
  assert(reply.includes('Ruana Mapache'), 'expected fallback to preserve the previous screenshot product title');
  assert(!reply.toLowerCase().includes('nombre o la referencia'), 'must not ask for name/reference after a readable screenshot');
  assert(
    shouldReplaceGenericImageReply(
      '¡Buenos días! Soy Luisa de Dosmicos 😊 ¿Me confirmas porfa el nombre o referencia del producto de la foto para revisarlo?',
      mergedContent,
    ),
    'expected follow-up failure wording to be replaceable with the previous readable screenshot context',
  );
});

Deno.test('image OCR fallback does not loop after customer has answered shipping and size', () => {
  const content = [
    {
      type: 'text',
      text: 'OCR del texto visible:\nNombre visible: Ruana Mapache\nPrecio visible: $96.900\nBotones: WhatsApp',
    },
    { type: 'text', text: 'El cliente envió una imagen de un producto. Usa solo el OCR/texto visible de la imagen para responder.' },
    { type: 'text', text: 'Estándar' },
    { type: 'text', text: 'Talla 2' },
  ];

  const reply = buildImageScreenshotFallbackReply(content);
  const normalized = reply.toLowerCase();

  assert(reply.includes('Ruana Mapache'), 'expected fallback to preserve the screenshot product title');
  assert(normalized.includes('talla 2'), 'expected fallback to preserve the selected size');
  assert(normalized.includes('envío estándar'), 'expected fallback to preserve selected standard shipping');
  assert(normalized.includes('datos de compra'), 'expected fallback to advance to checkout data collection');
  assert(!normalized.includes('prefieres envío estándar o express'), 'must not ask shipping again after customer answered standard');
  assert(!normalized.includes('confirmas porfa la talla'), 'must not ask size again after customer answered talla 2');
});

Deno.test('image OCR helper preserves image signal when OCR extraction is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.openai.com/v1/chat/completions')) {
        return new Response('ocr unavailable', { status: 500 });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    };

    const content = await buildVisionImageContent(
      {
        role: 'user',
        content: [{ type: 'text', text: 'Quiero comprar este producto' }],
        media_url: 'https://example.com/product.png',
        message_type: 'image',
      },
      'sk-test',
      new Map(),
    );

    assert(Array.isArray(content), 'expected content array');
    const text = (content as Array<Record<string, unknown>>)
      .map((part) => String(part.text || ''))
      .join('\n');
    assert(text.includes('OCR del texto visible'), 'missing OCR marker when extraction fails');
    assert(text.includes('Texto no legible o no disponible'), 'missing unavailable OCR marker');
    assert(
      shouldReplaceGenericImageReply(
        'Claro 😊 ¿Me escribes el nombre o la referencia del producto de la imagen para revisarte disponibilidad?',
        content,
      ),
      'expected generic image reply to be replaceable even when OCR is unavailable',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('image OCR helper ignores generic customer captions when no readable product title exists', () => {
  const content = [
    { type: 'text', text: 'Quiero comprar este sleeping' },
    { type: 'image_url', image_url: { url: 'https://example.com/product.png' } },
  ];

  const hint = extractReadableImageHint(content);
  const reply = buildImageScreenshotFallbackReply(content);

  assert(hint === null, 'expected generic caption not to be treated as a product hint');
  assert(
    reply.includes('me pasas el nombre o la referencia') && !reply.includes('Quiero comprar este sleeping'),
    'expected generic fallback when only a customer caption is present',
  );
});

Deno.test('image OCR helper prioritizes product title lines inside WhatsApp screenshots', () => {
  const content = [
    {
      type: 'text',
      text: [
        'OCR del texto visible:',
        '11:58',
        'Dosmicos Atención al Cliente',
        'Dosmicos',
        'Sleeping Bag Amigos de',
        'Quiero este producto',
        'Recibí tu imagen, déjame revisarla...',
      ].join('\n'),
    },
    { type: 'text', text: 'Quiero este producto' },
  ];

  const hint = extractReadableImageHint(content);
  const reply = buildImageScreenshotFallbackReply(content);

  assert(hint === 'Sleeping Bag Amigos de', `expected product title hint, got ${hint}`);
  assert(reply.includes('Sleeping Bag Amigos de'), 'expected fallback to use the visible product title');
  assert(!reply.toLowerCase().includes('nombre o la referencia'), 'must not ask for name/reference when visible title is readable');
});

Deno.test('image OCR helper uses OCR product_name field when title_line is missing', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes('api.openai.com/v1/chat/completions')) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        });
      }

      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ product_name: 'Ruana Venado Aurora', price: '$96.900', unreadable: false }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const content = await buildVisionImageContent(
      { role: 'user', content: [{ type: 'text', text: 'En esta tienes talla 8' }], media_url: 'https://example.com/ruana.png', message_type: 'image' },
      'sk-test',
      new Map(),
    );
    const text = (content as Array<Record<string, unknown>>).map((part) => String(part.text || '')).join('\n');
    assert(text.includes('Nombre visible: Ruana Venado Aurora'), 'expected product_name to become the visible product title');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('image OCR helper extracts likely product title from multi-line visible text', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes('api.openai.com/v1/chat/completions')) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        });
      }

      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          visible_text: ['11:58', 'Dosmicos Atención al Cliente', 'Ruana Venado Aurora', '$96.900', 'WhatsApp'].join('\n'),
          title_line: '',
          unreadable: false,
        }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const content = await buildVisionImageContent(
      { role: 'user', content: [{ type: 'text', text: 'En esta tienes talla 8' }], media_url: 'https://example.com/ruana-visible.png', message_type: 'image' },
      'sk-test',
      new Map(),
    );
    const text = (content as Array<Record<string, unknown>>).map((part) => String(part.text || '')).join('\n');
    assert(text.includes('Nombre visible: Ruana Venado Aurora'), `expected product title extracted from visible_text, got ${text}`);
    assert(!text.includes('Nombre visible: 11:58'), 'must not use WhatsApp time as the visible product title');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('image OCR helper enriches product screenshots with visible text', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes('api.openai.com/v1/chat/completions')) {
        throw new Error(`unexpected fetch: ${url}`);
      }

      const body = JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                visible_text: 'Ruana de Osito Rosa',
                product_name: 'Ruana de Osito Rosa',
                price: '$96.900',
                options: ['talla 6'],
                buttons: ['WhatsApp'],
                unreadable: false,
              }),
            },
          },
        ],
      });

      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const content = await buildVisionImageContent(
      {
        role: 'user',
        content: [
          { type: 'text', text: 'El cliente envió esta imagen.' },
          { type: 'image_url', image_url: { url: 'https://example.com/product.png' } },
        ],
      },
      'sk-test',
      new Map(),
    );

    assert(Array.isArray(content), 'expected multimodal content array');
    const textParts = (content as Array<Record<string, unknown>>)
      .filter((part) => part?.type === 'text')
      .map((part) => String((part as Record<string, unknown>).text ?? ''));

    assert(textParts.some((text) => text.includes('OCR del texto visible')), 'missing OCR text');
    assert(textParts.some((text) => text.includes('Ruana de Osito Rosa')), 'missing visible product name');
    assert(textParts.some((text) => text.includes('$96.900')), 'missing visible price');
    assert(
      !(content as Array<Record<string, unknown>>).some((part) => part?.type === 'image_url' || part?.type === 'input_image'),
      'customer reply model should receive OCR text only, not the raw image for product guessing',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
