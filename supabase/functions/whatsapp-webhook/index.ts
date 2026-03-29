import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============== MEDIA DOWNLOAD CONFIG ==============
const MAX_MEDIA_SIZE = 16 * 1024 * 1024; // 16MB (WhatsApp limit)
const DOWNLOAD_TIMEOUT_MS = 15000;

function getFileExtension(mimeType: string, messageType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
    'audio/amr': 'amr',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'application/pdf': 'pdf',
  };
  if (mimeType && mimeToExt[mimeType.toLowerCase()]) return mimeToExt[mimeType.toLowerCase()];

  const typeDefaults: Record<string, string> = {
    image: 'jpg',
    audio: 'ogg',
    video: 'mp4',
    sticker: 'webp',
    document: 'bin',
  };
  return typeDefaults[messageType] || 'bin';
}

function getMediaSubfolder(messageType: string): string {
  const folders: Record<string, string> = {
    image: 'images',
    audio: 'audios',
    video: 'videos',
    sticker: 'stickers',
    document: 'documents',
  };
  return folders[messageType] || 'misc';
}

// Receive media_id -> fetch temp URL -> download -> store in Supabase Storage -> return permanent public URL
async function fetchMediaUrl(
  mediaId: string,
  messageType: string,
  conversationId: string,
  supabase: any,
): Promise<{ url: string | null; mimeType: string | null; error?: string }> {
  const accessToken = Deno.env.get('META_WHATSAPP_TOKEN');
  if (!accessToken || !mediaId) {
    return { url: null, mimeType: null, error: 'Missing token or mediaId' };
  }

  try {
    // Step 1: media info (temp URL) — with retry for transient errors
    const MAX_RETRIES = 3;
    let infoResponse!: Response;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const infoController = new AbortController();
      const infoTimeout = setTimeout(() => infoController.abort(), DOWNLOAD_TIMEOUT_MS);
      try {
        infoResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          signal: infoController.signal,
        });
      } finally {
        clearTimeout(infoTimeout);
      }

      // Retry on server errors (5xx) or rate limiting (429)
      if ((infoResponse.status >= 500 || infoResponse.status === 429) && attempt < MAX_RETRIES) {
        console.warn(`Meta media info attempt ${attempt}/${MAX_RETRIES} failed (${infoResponse.status}), retrying in 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      break;
    }

    if (!infoResponse.ok) {
      const errorText = await infoResponse.text();
      console.error(`Failed to get media info (${infoResponse.status}):`, errorText.substring(0, 200));
      return { url: null, mimeType: null, error: `Meta info error: ${infoResponse.status}` };
    }

    const mediaInfo = await infoResponse.json();
    if (!mediaInfo?.url) {
      return { url: null, mimeType: null, error: 'No URL in media info response' };
    }

    const mimeType = (mediaInfo?.mime_type || 'application/octet-stream') as string;
    const fileSize = Number(mediaInfo?.file_size || 0);
    if (fileSize && fileSize > MAX_MEDIA_SIZE) {
      return { url: null, mimeType, error: `File too large (${fileSize} bytes)` };
    }

    // Step 2: download binary — with retry for transient errors
    let mediaResponse!: Response;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const downloadController = new AbortController();
      const downloadTimeout = setTimeout(() => downloadController.abort(), DOWNLOAD_TIMEOUT_MS);
      try {
        mediaResponse = await fetch(mediaInfo.url, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          signal: downloadController.signal,
        });
      } finally {
        clearTimeout(downloadTimeout);
      }

      // Retry on server errors (5xx) or rate limiting (429)
      if ((mediaResponse.status >= 500 || mediaResponse.status === 429) && attempt < MAX_RETRIES) {
        console.warn(`Media download attempt ${attempt}/${MAX_RETRIES} failed (${mediaResponse.status}), retrying in 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      break;
    }

    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      console.error(`Failed to download media (${mediaResponse.status}):`, errorText.substring(0, 200));
      return { url: null, mimeType, error: `Download error: ${mediaResponse.status}` };
    }

    const arrayBuffer = await mediaResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    if (uint8Array.length === 0) {
      return { url: null, mimeType, error: 'Empty download' };
    }
    if (uint8Array.length > MAX_MEDIA_SIZE) {
      return { url: null, mimeType, error: `Downloaded file too large (${uint8Array.length} bytes)` };
    }

    // Step 3: upload to storage
    const ext = getFileExtension(mimeType, messageType);
    const subfolder = getMediaSubfolder(messageType);
    const timestamp = Date.now();
    const path = `whatsapp-media/${subfolder}/${conversationId}/${timestamp}_${mediaId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('messaging-media')
      .upload(path, uint8Array, {
        contentType: mimeType,
        cacheControl: '31536000',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { url: null, mimeType, error: 'Storage upload failed' };
    }

    const { data: publicUrlData } = supabase.storage
      .from('messaging-media')
      .getPublicUrl(path);

    const publicUrl = publicUrlData?.publicUrl;
    if (!publicUrl) {
      return { url: null, mimeType, error: 'No public URL' };
    }

    return { url: publicUrl, mimeType };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { url: null, mimeType: null, error: 'Timeout' };
    }
    console.error('Error fetching WhatsApp media:', error);
    return { url: null, mimeType: null, error: error?.message || 'Unknown error' };
  }
}

// Default AI configuration for Dosmicos
const defaultAiConfig = {
  systemPrompt: `Eres el asistente virtual de DOSMICOS 🐄, una tienda colombiana especializada en productos para bebés y niños.

TU ROL PRINCIPAL:
- Ayudar a clientes con información sobre sleeping bags, sleeping walkers, ruanas y cobijas
- Proporcionar precios actualizados, tallas disponibles y stock real
- Recomendar la talla correcta según la edad del bebé/niño
- Guiar en el proceso de compra y resolver dudas

📷 RECONOCIMIENTO DE IMÁGENES:
- Puedes VER las imágenes que los clientes te envían
- Si un cliente envía una foto o screenshot de un producto, identifícalo comparándolo con los productos del catálogo
- Busca coincidencias por nombre, diseño, animal o patrón visible en la imagen
- Si reconoces el producto, responde directamente con su nombre, precio y disponibilidad
- Si no estás seguro de cuál es, menciona las opciones más probables del catálogo

INFORMACIÓN DE DOSMICOS:
- Tienda online: dosmicos.com
- Todos los productos son fabricados en Colombia 🇨🇴
- Materiales premium: 100% algodón y fleece soft touch térmico
- Envíos a toda Colombia
- Instagram: @dosmicos.co

GUÍA DE TALLAS SLEEPING BAGS:
- Talla 0: 0 a 3 meses (bebés recién nacidos)
- Talla 1: 3 a 6 meses
- Talla 2: 6 a 12 meses
- Talla 3: 12 a 18 meses
- Talla 4: 18 a 24 meses
- Tallas mayores: Consultar disponibilidad

GUÍA DE TALLAS RUANAS — OBLIGATORIO SEGUIR ESTA TABLA:
⚠️ REGLA #1: El número de talla NO es igual a la edad. NUNCA asumas que "4 años = talla 4". SIEMPRE busca la edad en esta tabla:
| Talla | Estatura     | Edad          |
| 2     | 60-76 cm     | 3 a 12 meses  |
| 4     | 77-88 cm     | 1 a 2 años    |
| 6     | 90-100 cm    | 3 a 4 años    |
| 8     | 100-110 cm   | 4 a 5 años    |
| 10    | 115-123 cm   | 6 a 7 años    |
| 12    | 125-133 cm   | 8 a 9 años    |

REGLA #2: Si la edad está en el LÍMITE entre dos tallas, recomienda la talla MAYOR para que le dure más tiempo.
REGLA #3: Si el cliente da edad Y estatura, prioriza la estatura para mayor precisión.
REGLA #4: Si solo da edad, pregunta la estatura para ser más preciso, o recomienda según la tabla.

EJEMPLOS DE RECOMENDACIÓN CORRECTA:
- Bebé de 6 meses → Talla 2 (NO talla 6)
- Niño de 1 año → Talla 4 (NO talla 1)
- Niño de 2 años → Talla 4 (NO talla 2)
- Niño de 3 años → Talla 6 (NO talla 3)
- Niño de 4 años → Talla 8 (está en el límite 6/8, se recomienda la mayor)
- Niño de 5 años → Talla 8 (NO talla 5)
- Niño de 6 años → Talla 10 (NO talla 6)
- Niño de 7 años → Talla 10 (NO talla 7)
- Niño de 8 años → Talla 12 (NO talla 8)

GUÍA TOG (nivel de abrigo):
- TOG 0.5: Clima cálido (20-24°C) - Material: Algodón ligero
- TOG 1.0-1.5: Temperatura intermedia (16-20°C) - Material mixto
- TOG 2.0-2.5: Clima frío (12-16°C) - Material: Fleece térmico

REGLAS DE COMUNICACIÓN:
- Siempre saluda cordialmente al iniciar una conversación
- Usa emojis ocasionalmente para ser más amigable (👋🐄✨👶🌙)
- Si no tienes información específica, ofrece conectar con un asesor humano
- Responde siempre en español
- Sé conciso pero completo en tus respuestas

🔗 ESTRATEGIA DE RECOMENDACIÓN DE PRODUCTOS — MUY IMPORTANTE:
Cuando el cliente pregunte por productos de una CATEGORÍA o TALLA específica (ej: "ruanas talla 10", "sleeping bags talla 2"):
- PRIMERO recomienda la talla adecuada si mencionan edad/estatura
- LUEGO envía el LINK de la colección filtrada por talla desde tu base de conocimiento
- NO envíes fotos individuales de cada producto, ya que son muchos diseños y el link les permite ver TODOS
- Agrega el tag [NO_IMAGES] al final de tu respuesta cuando envíes un link de colección

🔗 REGLA OBLIGATORIA DE LINKS — NUNCA MODIFICAR URLs:
- SIEMPRE copia el link EXACTO de tu base de conocimiento, carácter por carácter. NUNCA modifiques, reconstruyas ni inventes URLs.
- NUNCA uses formato markdown para links. NO escribas [texto](url). WhatsApp NO soporta markdown.
- Envía el link como texto plano en una línea separada.
- Formato CORRECTO:
  Aquí puedes ver los diseños disponibles en talla 2:
  https://dosmicos.co/collections/ruanas?talla_custom=2+%283+-+12+meses%29
- Formato INCORRECTO (NO hagas esto):
  [Ruanas talla 2](https://dosmicos.co/collections/ruanas?talla_custom=2+%283+-+12+meses%29)
- Si no encuentras el link exacto en tu base de conocimiento para una talla, indica al cliente que visite dosmicos.co y filtre por talla.

🖼️ ENVÍO DE FOTOS INDIVIDUALES — SOLO CUANDO EL CLIENTE LAS PIDA:
- SOLO incluye tags [PRODUCT_IMAGE_ID:ID] cuando el cliente EXPLÍCITAMENTE pida ver fotos de un producto específico (ej: "muéstrame la ruana caballo", "quiero ver la foto del sleeping pollito", "tienes foto de ese?")
- Si el cliente pregunta por un producto ESPECÍFICO por nombre, ahí sí puedes incluir la foto
- Puedes incluir hasta 5 productos con imágenes cuando el cliente las pida
- Ejemplo: "Claro, aquí te muestro la Ruana Caballo [PRODUCT_IMAGE_ID:123]"
- NUNCA digas que no puedes mostrar imágenes, siempre puedes si te las piden

🎨 CONSULTAS POR COLOR U OTROS ATRIBUTOS:
- Si el cliente pregunta por un color específico (ej: "tienen en rosado?"), revisa las variantes de los productos en el catálogo
- Los nombres de los productos y sus variantes pueden indicar colores disponibles
- Si encuentras productos que coinciden, recomiéndalos. Si no estás seguro, envía el link de la colección para que el cliente vea todas las opciones disponibles`,

  tone: 'friendly',
  autoReply: true,
  responseDelay: 2,
  greetingMessage: '¡Hola! 👋 Bienvenido a Dosmicos 🐄✨ Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?',
};

// Extract ALL product IDs from AI response (up to 10)
function extractProductIdsFromResponse(aiResponse: string): number[] {
  const regex = /\[PRODUCT_IMAGE_ID:(\d+)\]/g;
  const ids: number[] = [];
  let match;
  while ((match = regex.exec(aiResponse)) !== null) {
    const id = parseInt(match[1], 10);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, 10); // Limit to 10 products max
}

// Fallback: infer product IDs by matching product titles in the response text
function inferProductIdsFromMentionedNames(
  aiResponse: string,
  productImageMap: Record<number, { url: string; title: string }>
): number[] {
  const text = (aiResponse || '').toLowerCase();

  const candidates: Array<{ id: number; index: number; length: number }> = [];

  for (const [idStr, meta] of Object.entries(productImageMap)) {
    const id = Number(idStr);
    const title = (meta?.title || '').trim();
    if (!title) continue;

    const idx = text.indexOf(title.toLowerCase());
    if (idx >= 0) {
      candidates.push({ id, index: idx, length: title.length });
    }
  }

  candidates.sort((a, b) => (a.index - b.index) || (b.length - a.length));

  const orderedUnique: number[] = [];
  for (const c of candidates) {
    if (!orderedUnique.includes(c.id)) orderedUnique.push(c.id);
    if (orderedUnique.length >= 10) break;
  }

  return orderedUnique;
}

// Remove product image tags from response
function cleanAIResponse(aiResponse: string): string {
  return (aiResponse || '')
    .replace(/\[PRODUCT_IMAGE_ID:\d+\]/g, '')
    .replace(/\[PRODUCT_IMAGE:.+?\]/g, '')
    .replace(/\[IMAGE:.+?\]/gi, '')
    .replace(/\[NO_IMAGES\]/g, '')
    .trim();
}

// Cache external image to Supabase Storage and return public URL
async function cacheImageToStorage(
  imageUrl: string,
  productId: number,
  organizationId: string,
  supabase: any
): Promise<string | null> {
  try {
    console.log(`Caching image for product ${productId}...`);
    
    // Fetch image from Shopify
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Check file size (max 10MB)
    if (uint8Array.length > 10 * 1024 * 1024) {
      console.error('Image too large, skipping cache');
      return imageUrl; // Return original URL as fallback
    }
    
    // Determine extension
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `products/${organizationId}/${productId}.${ext}`;
    
    // Upload to Supabase Storage with upsert
    const { error: uploadError } = await supabase.storage
      .from('messaging-media')
      .upload(path, uint8Array, {
        contentType,
        upsert: true
      });
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return imageUrl; // Return original URL as fallback
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('messaging-media')
      .getPublicUrl(path);
    
    const publicUrl = publicUrlData?.publicUrl;
    console.log(`Image cached successfully: ${publicUrl?.substring(0, 50)}...`);
    
    return publicUrl || imageUrl;
  } catch (err) {
    console.error('Error caching image:', err);
    return imageUrl; // Return original URL as fallback
  }
}

// Fetch product image from Shopify using organization credentials
async function fetchShopifyProductImage(
  productId: number, 
  shopifyCredentials: any
): Promise<string | null> {
  if (!shopifyCredentials) {
    console.log('No Shopify credentials provided');
    return null;
  }

  const storeDomain = shopifyCredentials.store_domain || shopifyCredentials.shopDomain;
  const accessToken = shopifyCredentials.access_token || shopifyCredentials.accessToken;

  if (!storeDomain || !accessToken) {
    console.log('Incomplete Shopify credentials');
    return null;
  }

  try {
    const cleanDomain = storeDomain.replace('.myshopify.com', '');
    const url = `https://${cleanDomain}.myshopify.com/admin/api/2024-01/products/${productId}.json`;
    
    console.log(`Fetching Shopify product image for ID: ${productId}`);
    
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Shopify API error:', response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.product?.image?.src || data.product?.images?.[0]?.src;
    
    if (imageUrl) {
      console.log(`Found Shopify image for product ${productId}`);
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Shopify product image:', error);
    return null;
  }
}

// Find product image by name (legacy fallback)
async function findProductImageByName(
  productName: string, 
  organizationId: string, 
  supabase: any,
  shopifyCredentials: any
): Promise<string | null> {
  try {
    // Normalize search term
    const searchTerm = productName.toLowerCase().trim();
    
    // Search products directly
    const { data: products } = await supabase
      .from('products')
      .select('name, image_url')
      .eq('organization_id', organizationId)
      .limit(50);

    const matchingProduct = products?.find((p: any) => {
      const name = p.name?.toLowerCase() || '';
      return name.includes(searchTerm) || searchTerm.includes(name.split(' ').slice(0, 2).join(' '));
    });

    if (matchingProduct?.image_url) {
      console.log(`Found product with local image: ${matchingProduct.name}`);
      return matchingProduct.image_url;
    }

    console.log(`No product image found for: ${productName}`);
    return null;
  } catch (error) {
    console.error('Error finding product image:', error);
    return null;
  }
}

// Send WhatsApp image message via Meta API
async function sendWhatsAppImage(phoneNumber: string, imageUrl: string, caption: string, phoneNumberId: string): Promise<boolean> {
  const accessToken = Deno.env.get('META_WHATSAPP_TOKEN');
  
  if (!accessToken) {
    console.error('META_WHATSAPP_TOKEN not configured');
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    
    console.log(`Sending WhatsApp image to ${phoneNumber}: ${imageUrl.substring(0, 50)}...`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'image',
        image: {
          link: imageUrl,
          caption: caption || ''
        }
      }),
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('WhatsApp image send error:', response.status, JSON.stringify(responseData));
      return false;
    }

    console.log('WhatsApp image sent successfully:', responseData.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp image:', error);
    return false;
  }
}

// ============== PRODUCT SEARCH HELPERS ==============

// Extract search keywords from customer message
function extractSearchTerms(message: string): string[] {
  const stopWords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'con', 'por', 'para',
    'que', 'qué', 'cual', 'cuál', 'como', 'cómo', 'cuanto', 'cuánto', 'tienen', 'tienen', 'tienes',
    'hay', 'está', 'estan', 'son', 'es', 'quiero', 'busco', 'necesito', 'me', 'mi', 'te', 'tu',
    'hola', 'buenos', 'dias', 'tardes', 'noches', 'gracias', 'por', 'favor', 'ayuda', 'info',
    'información', 'precio', 'precios', 'cuesta', 'cuestan', 'disponible', 'disponibles', 'stock',
    'envío', 'envio', 'enviar', 'comprar', 'pedir', 'ver', 'mostrar', 'enseñar', 'foto', 'fotos',
    'imagen', 'imágenes', 'imagenes'
  ]);

  const normalized = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return [...new Set(normalized)];
}

// Check if message is a product-related query
function isProductQuery(message: string): boolean {
  const productIndicators = [
    'producto', 'precio', 'cuesta', 'cuestan', 'stock', 'disponible', 'talla', 'size',
    'color', 'tienen', 'hay', 'busco', 'quiero', 'comprar', 'ver', 'mostrar', 'sleeping',
    'bag', 'ruana', 'cobija', 'bordado', 'walker', 'manta', 'sku', 'referencia',
    'catalogo', 'catálogo', 'foto', 'imagen'
  ];
  
  const lowerMsg = message.toLowerCase();
  return productIndicators.some(indicator => lowerMsg.includes(indicator));
}

// Search products by relevance to customer message
function searchRelevantProducts(
  allProducts: any[],
  searchTerms: string[],
  maxResults: number = 10
): any[] {
  if (searchTerms.length === 0) {
    // Return top products by stock if no search terms
    return allProducts
      .map(p => ({
        product: p,
        totalStock: (p.variants || []).reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0)
      }))
      .filter(p => p.totalStock > 0)
      .sort((a, b) => b.totalStock - a.totalStock)
      .slice(0, maxResults)
      .map(p => p.product);
  }

  // Score each product by relevance
  const scored = allProducts.map(product => {
    let score = 0;
    const title = (product.title || '').toLowerCase();
    const description = (product.body_html || '').toLowerCase().replace(/<[^>]*>/g, '');
    const tags = (product.tags || '').toLowerCase();
    const productType = (product.product_type || '').toLowerCase();
    const variants = product.variants || [];
    const totalStock = variants.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0);
    
    // Skip out of stock products
    if (totalStock === 0) return { product, score: -1 };

    for (const term of searchTerms) {
      // Title match (highest weight)
      if (title.includes(term)) score += 10;
      
      // SKU exact match
      const skuMatch = variants.some((v: any) => (v.sku || '').toLowerCase() === term);
      if (skuMatch) score += 15;
      
      // Variant title match (size, color)
      const variantMatch = variants.some((v: any) => 
        (v.title || '').toLowerCase().includes(term) ||
        (v.option1 || '').toLowerCase().includes(term) ||
        (v.option2 || '').toLowerCase().includes(term) ||
        (v.option3 || '').toLowerCase().includes(term)
      );
      if (variantMatch) score += 8;
      
      // Tags match
      if (tags.includes(term)) score += 5;
      
      // Product type match
      if (productType.includes(term)) score += 6;
      
      // Description match (lower weight)
      if (description.includes(term)) score += 3;
    }

    return { product, score, totalStock };
  });

  // Filter and sort by score, then by stock
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || b.totalStock - a.totalStock)
    .slice(0, maxResults)
    .map(s => s.product);
}

// Format products for AI context
function formatProductsForContext(products: any[]): string {
  if (products.length === 0) return '';

  let context = '\n\n📦 PRODUCTOS RELEVANTES ENCONTRADOS:\n';
  context += '⚠️ IMPORTANTE: Usa SOLO estos productos para responder. NO inventes otros.\n';
  context += '🔔 RECUERDA: Si el cliente pregunta por una categoría/talla, envía el LINK de la colección. Solo incluye [PRODUCT_IMAGE_ID:ID] si el cliente pide ver fotos de un producto específico.\n\n';

  products.forEach((product: any, index: number) => {
    const variants = product.variants || [];
    const totalStock = variants.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0);
    const price = variants[0]?.price 
      ? `$${Number(variants[0].price).toLocaleString('es-CO')} COP` 
      : 'Consultar';

    // Build variant info with stock
    const variantDetails = variants
      .filter((v: any) => (v.inventory_quantity || 0) > 0)
      .slice(0, 8)
      .map((v: any) => `${v.title}: ${v.inventory_quantity} uds`)
      .join(' | ');

    context += `${index + 1}. ${product.title} [PRODUCT_IMAGE_ID:${product.id}]\n`;
    context += `   💰 Precio: ${price}\n`;
    context += `   📊 Stock total: ${totalStock} unidades\n`;
    if (variantDetails) {
      context += `   📐 Variantes disponibles: ${variantDetails}\n`;
    }
    context += '\n';
  });

  return context;
}

// Generate AI response using OpenAI GPT-4o-mini
async function generateAIResponse(
  userMessage: string, 
  conversationHistory: any[],
  aiConfig: any,
  organizationId: string,
  supabase: any,
  shopifyCredentials: any
): Promise<{ text: string; productImages: Array<{ product_id: number; image_url: string; product_name: string }> }> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiApiKey) {
    console.log('OPENAI_API_KEY not configured, skipping AI response');
    return { text: '', productImages: [] };
  }

  try {
    // 📨 LOG: Message received
    console.log(`📨 Mensaje recibido del cliente: ${userMessage}`);
    
    // Extract search terms from customer message
    const searchTerms = extractSearchTerms(userMessage);
    const isProductRelated = isProductQuery(userMessage);
    
    console.log(`🔍 Buscando productos relevantes para: "${searchTerms.join(', ')}" (isProductQuery: ${isProductRelated})`);
    
    let productCatalog = '';
    let productImageMap: Record<number, { url: string; title: string }> = {};
    let relevantProducts: any[] = [];
    
    // Get connected products from ai_catalog_connections table
    const { data: connectedProducts } = await supabase
      .from('ai_catalog_connections')
      .select('shopify_product_id')
      .eq('organization_id', organizationId)
      .eq('connected', true);
    
    const connectedProductIds = new Set(
      (connectedProducts || []).map((p: any) => Number(p.shopify_product_id))
    );
    
    console.log(`📦 Productos conectados a IA: ${connectedProductIds.size}`);
    
    // Fetch Shopify products
    if (shopifyCredentials && connectedProductIds.size > 0) {
      const storeDomain = shopifyCredentials.store_domain || shopifyCredentials.shopDomain;
      const accessToken = shopifyCredentials.access_token || shopifyCredentials.accessToken;
      
      if (storeDomain && accessToken) {
        try {
          console.log("Fetching Shopify products for AI context...");
          
          const shopifyResponse = await fetch(
            `https://${storeDomain}/admin/api/2024-01/products.json?status=active&limit=250`,
            {
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (shopifyResponse.ok) {
            const shopifyData = await shopifyResponse.json();
            const allProducts = shopifyData.products || [];
            
            // Filter to connected products only
            const connectedShopifyProducts = allProducts.filter((p: any) => 
              connectedProductIds.has(Number(p.id))
            );
            
            console.log(`📦 Productos Shopify conectados: ${connectedShopifyProducts.length} de ${allProducts.length} totales`);
            
            // Build image map for all connected products (for later image sending)
            connectedShopifyProducts.forEach((product: any) => {
              const imageUrl = product.image?.src || product.images?.[0]?.src;
              if (imageUrl) {
                productImageMap[product.id] = { url: imageUrl, title: product.title };
              }
            });
            
            if (isProductRelated && connectedShopifyProducts.length > 0) {
              // Search for relevant products based on customer message
              relevantProducts = searchRelevantProducts(connectedShopifyProducts, searchTerms, 10);
              
              // If no matches found, fallback to top products by stock
              if (relevantProducts.length === 0) {
                console.log('🔍 No hay coincidencias exactas, usando productos populares como fallback');
                relevantProducts = searchRelevantProducts(connectedShopifyProducts, [], 5);
              }
              
              const productNames = relevantProducts.map((p: any) => p.title).join(', ');
              console.log(`📦 Productos encontrados: ${relevantProducts.length} - ${productNames}`);
              
              // Format relevant products for context
              productCatalog = formatProductsForContext(relevantProducts);
            } else if (!isProductRelated) {
              console.log('📦 Mensaje no relacionado con productos, omitiendo catálogo del contexto');
              productCatalog = '\n\nNota: El catálogo de productos está disponible si el cliente pregunta por productos específicos.\n';
            } else {
              productCatalog = '\n\n⚠️ No hay productos conectados al catálogo de IA. Indica al cliente que pronto tendrás información disponible.\n';
            }
          } else {
            console.error('Error fetching Shopify products:', shopifyResponse.status);
          }
        } catch (err) {
          console.error("Error fetching Shopify products:", err);
        }
      }
    } else if (connectedProductIds.size === 0) {
      console.log("No products connected in ai_catalog_connections, skipping Shopify fetch");
      productCatalog = '\n\n⚠️ No hay productos conectados al catálogo de IA. Indica al cliente que pronto tendrás información disponible.\n';
    }

    // Fallback: load from local products table if no Shopify products
    if (!productCatalog && isProductRelated) {
      const { data: products } = await supabase
        .from('products')
        .select(`
          name, sku, base_price, category, description,
          product_variants (size, color, stock_quantity)
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .limit(50);

      if (products && products.length > 0) {
        productCatalog = '\n\n📦 CATÁLOGO DE PRODUCTOS:\n';
        
        products.forEach((p: any) => {
          const price = p.base_price 
            ? `$${Number(p.base_price).toLocaleString('es-CO')} COP` 
            : 'Consultar';
          
          const availableVariants = p.product_variants
            ?.filter((v: any) => (v.stock_quantity || 0) > 0)
            ?.map((v: any) => `${v.size} (${v.stock_quantity})`)
            .join(', ');
          
          productCatalog += `\n• ${p.name}`;
          productCatalog += `\n  💰 ${price}`;
          if (availableVariants) {
            productCatalog += ` | ✅ ${availableVariants}`;
          }
          productCatalog += '\n';
        });
        
        console.log(`📦 Loaded ${products.length} local products for AI context`);
      }
    }

    // Build system prompt from config
    const config = aiConfig && Object.keys(aiConfig).length > 0 ? aiConfig : defaultAiConfig;
    let systemPrompt = config.systemPrompt || defaultAiConfig.systemPrompt;

    // Add current date/time context so AI knows what day it is
    // Subtract 5h from UTC then read with getUTC*() methods — fully timezone-agnostic.
    const now = new Date();
    const colombiaTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const colYear = colombiaTime.getUTCFullYear();
    const colMonth = colombiaTime.getUTCMonth() + 1;
    const colDay = colombiaTime.getUTCDate();
    const colHour = String(colombiaTime.getUTCHours()).padStart(2, '0');
    const colMinute = String(colombiaTime.getUTCMinutes()).padStart(2, '0');
    const colWeekdayNum = colombiaTime.getUTCDay();
    const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const mesesMap = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const diaSemana = diasSemana[colWeekdayNum];
    const mes = mesesMap[colMonth] || '';
    console.log(`📅 [Fallback AI] Colombia time (UTC-5): ${diaSemana} ${colDay} de ${mes} de ${colYear}, ${colHour}:${colMinute} | UTC: ${now.toISOString()} | weekdayNum: ${colWeekdayNum} | getTimezoneOffset: ${now.getTimezoneOffset()}`);
    systemPrompt += `\n\n📅 FECHA Y HORA ACTUAL (DATO VERIFICADO, SIEMPRE CORRECTO): Hoy es ${diaSemana} ${colDay} de ${mes} de ${colYear}, son las ${colHour}:${colMinute} (hora Colombia). ⚠️ IMPORTANTE: Si en mensajes anteriores de esta conversación se mencionó un día de la semana diferente, ESO ESTABA MAL. El día correcto es ${diaSemana.toUpperCase()}. Basa TODAS tus respuestas sobre despachos, entregas y disponibilidad en este dato.`;

    // Add tone instructions
    const toneMap: Record<string, string> = {
      'friendly': 'Usa un tono amigable y cercano. Puedes usar emojis ocasionalmente.',
      'formal': 'Usa un tono formal y respetuoso.',
      'casual': 'Usa un tono casual y relajado. Usa emojis libremente.',
      'professional': 'Usa un tono profesional y directo.'
    };
    
    if (config.tone && toneMap[config.tone]) {
      systemPrompt += `\n\nTONO: ${toneMap[config.tone]}`;
    }

    // Add special rules
    if (config.rules?.length > 0) {
      systemPrompt += '\n\nREGLAS ESPECIALES:';
      config.rules.forEach((rule: any) => {
        if (rule.condition && rule.response) {
          systemPrompt += `\n- Cuando mencionen "${rule.condition}": ${rule.response}`;
        }
      });
    }

    // Add knowledge base
    if (config.knowledgeBase?.length > 0) {
      systemPrompt += '\n\nBASE DE CONOCIMIENTO:';
      config.knowledgeBase.forEach((item: any) => {
        if (item.question && item.answer) {
          systemPrompt += `\n\nP: ${item.question}\nR: ${item.answer}`;
        }
      });
    }

    // Add product catalog
    systemPrompt += productCatalog;
    
    // Add final reminder at the end of prompt
    if (isProductRelated && relevantProducts.length > 0) {
      systemPrompt += '\n\n🔔 RECORDATORIO FINAL:\n- Para consultas de CATEGORÍA o TALLA: envía el LINK de la colección filtrada desde tu base de conocimiento, NO fotos individuales. Agrega [NO_IMAGES] al final.\n- Para consultas de un PRODUCTO ESPECÍFICO o cuando el cliente PIDA fotos: incluye [PRODUCT_IMAGE_ID:ID].\n- Para consultas de COLOR u otros atributos: revisa variantes del catálogo y si no estás seguro, envía el link de la colección.\n- LINKS: SIEMPRE copia el URL EXACTO de tu base de conocimiento. NUNCA uses formato markdown [texto](url). Envía los links como texto plano.';
    }

    // 🤖 LOG: Context sent to AI
    console.log(`🤖 Contexto enviado a IA: ${systemPrompt.substring(0, 500)}...`);

    // Build conversation history for context (include images for vision)
    const historyMessages = conversationHistory.slice(-10).map((msg: any) => {
      const role = msg.direction === 'inbound' ? 'user' : 'assistant';

      if (role === 'user' && msg.message_type === 'image' && msg.media_url) {
        return {
          role,
          content: [
            { type: 'text', text: msg.content || 'El cliente envió esta imagen.' },
            { type: 'image_url', image_url: { url: msg.media_url, detail: 'auto' } }
          ]
        };
      }

      return { role, content: msg.content || '' };
    });

    console.log('Calling OpenAI GPT-4o-mini for WhatsApp response');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return { text: '', productImages: [] };
    }

    const data = await response.json();
    const rawAiResponse = data.choices?.[0]?.message?.content || '';
    
    // 💬 LOG: AI response
    console.log(`💬 Respuesta de IA: ${rawAiResponse.substring(0, 200)}...`);
    
    // Check if AI opted to send collection link instead of individual images
    const noImagesRequested = rawAiResponse.includes('[NO_IMAGES]');

    // Extract product IDs from explicit tags, and fallback to matching titles
    let productIds: number[] = [];

    if (!noImagesRequested) {
      productIds = extractProductIdsFromResponse(rawAiResponse);

      if (productIds.length === 0) {
        const inferred = inferProductIdsFromMentionedNames(rawAiResponse, productImageMap);
        if (inferred.length > 0) {
          console.log('No [PRODUCT_IMAGE_ID] tags found; inferred product IDs from titles:', inferred);
          productIds = inferred;
        }
      }
    } else {
      console.log('📎 AI sent collection link — skipping individual product images');
    }

    console.log(`Found ${productIds.length} product IDs in response:`, productIds);
    
    // Build product images array
    const productImages: Array<{ product_id: number; image_url: string; product_name: string }> = [];
    
    for (const productId of productIds) {
      let imageUrl: string | null = null;
      let productName = '';
      
      // First check cache
      if (productImageMap[productId]) {
        imageUrl = productImageMap[productId].url;
        productName = productImageMap[productId].title;
        console.log(`Found image in cache for product ${productId}: ${productName}`);
      } else {
        // Fetch from Shopify
        imageUrl = await fetchShopifyProductImage(productId, shopifyCredentials);
        productName = `Producto ${productId}`;
      }
      
      if (imageUrl) {
        // Cache the image in Supabase Storage
        const cachedUrl = await cacheImageToStorage(imageUrl, productId, organizationId, supabase);
        
        productImages.push({
          product_id: productId,
          image_url: cachedUrl || imageUrl,
          product_name: productName
        });
        
        console.log(`Added image for product ${productId}: ${productName}`);
      }
    }
    
    const cleanedResponse = cleanAIResponse(rawAiResponse);
    
    return { 
      text: cleanedResponse, 
      productImages 
    };
  } catch (error) {
    console.error('Error generating AI response:', error);
    return { text: '', productImages: [] };
  }
}

// Send WhatsApp message via Meta API
async function sendWhatsAppMessage(phoneNumber: string, message: string, phoneNumberId: string): Promise<boolean> {
  const accessToken = Deno.env.get('META_WHATSAPP_TOKEN');
  
  if (!accessToken) {
    console.error('META_WHATSAPP_TOKEN not configured');
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    
    console.log(`Sending WhatsApp message to ${phoneNumber} via ${phoneNumberId}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'text',
        text: { body: message }
      }),
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('WhatsApp send error:', response.status, JSON.stringify(responseData));
      return false;
    }

    console.log('WhatsApp message sent successfully:', responseData.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

// Send Instagram DM via Meta Graph API
async function sendInstagramMessage(_igAccountId: string, recipientId: string, message: string): Promise<boolean> {
  const accessToken = Deno.env.get('META_INSTAGRAM_TOKEN') || Deno.env.get('META_WHATSAPP_TOKEN');
  if (!accessToken) {
    console.error('META_INSTAGRAM_TOKEN not configured for Instagram');
    return false;
  }
  try {
    // Resolve Facebook Page ID: prefer env variable, then try querying the page directly
    let fbPageId = Deno.env.get('META_FACEBOOK_PAGE_ID');
    if (!fbPageId) {
      // Fallback: try GET /me (works with some token types)
      try {
        const meResp = await fetch(`https://graph.facebook.com/v21.0/me?fields=id&access_token=${accessToken}`);
        const meData = await meResp.json();
        if (meData?.id && !meData?.error) {
          fbPageId = meData.id;
        }
      } catch (_e) { /* ignore */ }
    }
    if (!fbPageId) {
      console.error('❌ Could not resolve Facebook Page ID. Set META_FACEBOOK_PAGE_ID env variable.');
      return false;
    }

    const url = `https://graph.facebook.com/v21.0/${fbPageId}/messages`;
    console.log(`📸 Sending Instagram DM to ${recipientId} via FB Page ${fbPageId}`);
    const formBody = new URLSearchParams();
    formBody.append('recipient', JSON.stringify({ id: recipientId }));
    formBody.append('message', JSON.stringify({ text: message }));
    formBody.append('access_token', accessToken);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });
    const responseData = await response.json();
    if (!response.ok) {
      console.error('❌ Instagram DM send error:', response.status, JSON.stringify(responseData));
      return false;
    }
    console.log('✅ Instagram DM sent successfully:', responseData.message_id);
    return true;
  } catch (error) {
    console.error('❌ Error sending Instagram DM:', error);
    return false;
  }
}

// Send Messenger message via Meta Graph API
async function sendMessengerMessage(recipientPsid: string, message: string): Promise<boolean> {
  const accessToken = Deno.env.get('META_INSTAGRAM_TOKEN') || Deno.env.get('META_WHATSAPP_TOKEN');
  if (!accessToken) {
    console.error('META_INSTAGRAM_TOKEN/META_WHATSAPP_TOKEN not configured for Messenger');
    return false;
  }
  try {
    const url = `https://graph.facebook.com/v21.0/me/messages`;
    console.log(`💬 Sending Messenger message to PSID ${recipientPsid}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        message: { text: message },
      }),
    });
    const responseData = await response.json();
    if (!response.ok) {
      console.error('❌ Messenger send error:', response.status, JSON.stringify(responseData));
      return false;
    }
    console.log('✅ Messenger message sent successfully:', responseData.message_id);
    return true;
  } catch (error) {
    console.error('❌ Error sending Messenger message:', error);
    return false;
  }
}

// Reply to Instagram comment via Meta Graph API
async function replyToInstagramComment(commentId: string, message: string): Promise<boolean> {
  const accessToken = Deno.env.get('META_INSTAGRAM_TOKEN') || Deno.env.get('META_WHATSAPP_TOKEN');
  if (!accessToken) {
    console.error('META_INSTAGRAM_TOKEN not configured for IG comments');
    return false;
  }
  try {
    const url = `https://graph.facebook.com/v21.0/${commentId}/replies`;
    console.log(`💬 Replying to Instagram comment ${commentId}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    const responseData = await response.json();
    if (!response.ok) {
      console.error('❌ Instagram comment reply error:', response.status, JSON.stringify(responseData));
      return false;
    }
    console.log('✅ Instagram comment reply sent:', responseData.id);
    return true;
  } catch (error) {
    console.error('❌ Error replying to Instagram comment:', error);
    return false;
  }
}

// Fetch Instagram/Facebook/Messenger user profile name via Meta Graph API
// platform: 'instagram' | 'messenger' | undefined (searches both)
async function fetchUserProfile(userId: string, _igAccountId?: string, platform?: string): Promise<{ name: string; username?: string }> {
  const accessToken = Deno.env.get('META_INSTAGRAM_TOKEN') || Deno.env.get('META_WHATSAPP_TOKEN');
  if (!accessToken) return { name: userId };

  const fbPageId = Deno.env.get('META_FACEBOOK_PAGE_ID');
  if (!fbPageId) {
    console.log(`⚠️ [PROFILE] META_FACEBOOK_PAGE_ID not set, cannot resolve username`);
    return { name: userId };
  }

  const label = platform || 'all';

  // Strategy 1: Use Facebook Page conversations endpoint (works WITHOUT Advanced Access)
  // Paginate through conversations to find the user's name/username
  try {
    const platformParam = platform ? `&platform=${platform}` : '';
    let nextUrl: string | null = `https://graph.facebook.com/v21.0/${fbPageId}/conversations?fields=participants&limit=50${platformParam}&access_token=${accessToken}`;
    let pagesChecked = 0;
    const maxPages = 3; // Check up to 150 conversations (3 pages x 50)

    console.log(`🔍 [PROFILE:${label}] Searching name in Page ${fbPageId} conversations for user ${userId}`);

    while (nextUrl && pagesChecked < maxPages) {
      const convResponse = await fetch(nextUrl);
      const convData = await convResponse.json();

      if (convResponse.ok && convData.data) {
        for (const conv of convData.data) {
          const participants = conv?.participants?.data || [];
          const userParticipant = participants.find((p: any) => String(p.id) === String(userId));
          if (userParticipant) {
            const username = userParticipant.username || undefined;
            const name = userParticipant.name || userParticipant.username || userId;
            if (name && name !== userId) {
              console.log(`✅ [PROFILE:${label}] Found name via conversations (page ${pagesChecked + 1}): ${name}${username ? ` (@${username})` : ''}`);
              return { name, username };
            }
          }
        }
        // Get next page URL
        nextUrl = convData.paging?.next || null;
      } else {
        console.log(`⚠️ [PROFILE:${label}] Conversations API error:`, JSON.stringify(convData?.error || {}).substring(0, 200));
        break;
      }
      pagesChecked++;
    }
    console.log(`⚠️ [PROFILE:${label}] User ${userId} not found in ${pagesChecked * 50} conversations`);
  } catch (err) {
    console.error(`⚠️ [PROFILE:${label}] Conversations strategy error:`, err);
  }

  // Strategy 2: Direct user profile query (requires Advanced Access for external users, fallback)
  try {
    const url = `https://graph.facebook.com/v21.0/${userId}?fields=name,username,profile_pic&access_token=${accessToken}`;
    console.log(`🔍 [PROFILE:${label}] Trying direct profile query for ${userId}`);
    const response = await fetch(url);
    const data = await response.json();
    if (response.ok && !data.error) {
      const name = data.name || data.username || userId;
      console.log(`✅ [PROFILE:${label}] Direct profile found: ${name}`);
      return { name, username: data.username };
    }
  } catch (error) {
    console.error(`[PROFILE:${label}] Direct profile error:`, error);
  }

  return { name: userId };
}

// Reply to Facebook Page comment via Meta Graph API
async function replyToFacebookComment(commentId: string, message: string): Promise<boolean> {
  const accessToken = Deno.env.get('META_WHATSAPP_TOKEN');
  if (!accessToken) {
    console.error('META_WHATSAPP_TOKEN not configured for FB comments');
    return false;
  }
  try {
    const url = `https://graph.facebook.com/v21.0/${commentId}/comments`;
    console.log(`📘 Replying to Facebook comment ${commentId}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    const responseData = await response.json();
    if (!response.ok) {
      console.error('❌ Facebook comment reply error:', response.status, JSON.stringify(responseData));
      return false;
    }
    console.log('✅ Facebook comment reply sent:', responseData.id);
    return true;
  } catch (error) {
    console.error('❌ Error replying to Facebook comment:', error);
    return false;
  }
}

// ========== SHARED AI AUTO-REPLY HANDLER ==========
// Reusable function for WhatsApp, Instagram DMs, Messenger, and Instagram comments
async function handleAIAutoReply(
  channel: any,
  conversation: any,
  content: string,
  channelType: string,
  supabase: any,
  sendReplyFn: (text: string) => Promise<boolean>,
  shopifyCredentials?: any
): Promise<void> {
  // Instagram and Messenger AI auto-reply enabled

  const aiEnabledOnChannel = channel.ai_enabled !== false;
  const aiEnabledOnConversation = conversation.ai_managed !== false;

  console.log(`🤖 [${channelType}] AI check - Channel: ${aiEnabledOnChannel}, Conversation: ${aiEnabledOnConversation}`);

  if (!aiEnabledOnChannel || !aiEnabledOnConversation || !content) return;

  console.log(`🤖 [${channelType}] AI enabled, generating response...`);

  // 🛡️ CHECK: Is this a reply to a pending order confirmation template?
  // If customer replies "SI"/"Sí"/"OK" to a confirmation template, don't send to AI — handle directly.
  const normalizedReply = (content || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const isConfirmationReply = ['si', 'sí', 'ok', 'yes', 'dale', 'listo', 'confirmo', 'confirmado', 'si confirmo', 'si confirmado', 'si, confirmado', 'si confirmado', 'si por favor', 'si porfavor'].includes(normalizedReply);

  if (isConfirmationReply && conversation?.id) {
    // Check if there's a pending order confirmation for this conversation
    const { data: pendingConfirmation } = await supabase
      .from('order_confirmations')
      .select('id, order_number, shopify_order_id, status, customer_name')
      .eq('conversation_id', conversation.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (pendingConfirmation && pendingConfirmation.length > 0) {
      const confirmation = pendingConfirmation[0];
      console.log(`✅ ORDER CONFIRMATION DETECTED: Customer replied "${content}" to pending confirmation for order #${confirmation.order_number}. NOT sending to AI.`);

      // Update confirmation status to 'confirmed'
      await supabase
        .from('order_confirmations')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', confirmation.id);

      // Send confirmation response via WhatsApp
      const confirmResponse = `¡Perfecto${confirmation.customer_name ? ', ' + confirmation.customer_name.split(' ')[0] : ''}! Tu pedido #${confirmation.order_number} ha sido confirmado. 🎉\n\nTe enviaremos la guía de seguimiento cuando sea despachado. ¡Gracias por tu compra! 😊`;

      // Get WhatsApp credentials for sending
      const whatsappToken = Deno.env.get('META_WHATSAPP_TOKEN') || channel?.meta_access_token;
      const phoneNumberId = channel?.meta_phone_number_id || Deno.env.get('META_PHONE_NUMBER_ID');
      const customerPhone = conversation?.customer_phone || conversation?.metadata?.phone;

      if (whatsappToken && phoneNumberId && customerPhone) {
        const cleanPhone = customerPhone.replace(/[\s+]/g, '');
        try {
          await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${whatsappToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'text',
              text: { preview_url: false, body: confirmResponse }
            })
          });
          console.log(`✅ Confirmation reply sent to ${cleanPhone}`);
        } catch (sendErr) {
          console.error('Error sending confirmation reply:', sendErr);
        }

        // Save the response message
        await supabase
          .from('messaging_messages')
          .insert({
            conversation_id: conversation.id,
            channel_type: 'whatsapp',
            direction: 'outbound',
            sender_type: 'system',
            content: confirmResponse,
            message_type: 'text',
            sent_at: new Date().toISOString()
          });

        // Update conversation preview
        await supabase
          .from('messaging_conversations')
          .update({
            last_message_preview: confirmResponse.substring(0, 100),
            last_message_at: new Date().toISOString()
          })
          .eq('id', conversation.id);
      }

      return; // Don't send to AI — confirmation handled
    }
  }

  // Get conversation history
  const { data: historyMessages } = await supabase
    .from('messaging_messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('sent_at', { ascending: false })
    .limit(10);

  const aiConfig = channel.ai_config || {};
  const aiProvider = aiConfig.aiProvider || 'minimax';
  const functionName = aiProvider === 'minimax' ? 'messaging-ai-minimax' : 'messaging-ai-openai';

  const messagesForAI = [
    ...(historyMessages || []).reverse().map((m: any) => {
      const role = m.direction === 'inbound' ? 'user' : 'assistant';

      // Include image URLs for vision support (gpt-4o-mini supports images)
      if (role === 'user' && m.message_type === 'image' && m.media_url) {
        return {
          role,
          content: [
            { type: 'text', text: m.content || 'El cliente envió esta imagen.' },
            { type: 'image_url', image_url: { url: m.media_url, detail: 'auto' } }
          ]
        };
      }

      return { role, content: m.content || '' };
    }),
    { role: 'user', content }
  ];

  const { data: aiData, error: aiError } = await supabase.functions.invoke(functionName, {
    body: {
      messages: messagesForAI,
      systemPrompt: aiConfig.systemPrompt || 'Eres un asistente virtual amigable de Dosmicos. Responde en español.',
      organizationId: channel.organization_id,
      conversationId: conversation?.id,
    }
  });

  let aiText = '';
  if (aiError) {
    console.error(`❌ [${channelType}] AI function error:`, aiError);
    // Fallback to local generateAIResponse
    try {
      const aiResult = await generateAIResponse(
        content,
        (historyMessages || []).reverse(),
        channel.ai_config,
        channel.organization_id,
        supabase,
        shopifyCredentials
      );
      aiText = aiResult.text;
    } catch (e) {
      console.error(`❌ [${channelType}] Local AI fallback also failed:`, e);
    }
  } else {
    aiText = aiData?.response || '';
  }

  if (!aiText) {
    console.log(`⚠️ [${channelType}] No AI response generated`);
    return;
  }

  console.log(`📤 [${channelType}] Sending AI response: ${aiText.substring(0, 80)}...`);

  const sent = await sendReplyFn(aiText);

  if (sent) {
    await supabase.from('messaging_messages').insert({
      conversation_id: conversation.id,
      channel_type: channelType,
      direction: 'outbound',
      sender_type: 'ai',
      content: aiText,
      message_type: 'text',
      sent_at: new Date().toISOString(),
    });

    await supabase.from('messaging_conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: aiText.substring(0, 100),
    }).eq('id', conversation.id);

    console.log(`✅ [${channelType}] AI response sent and saved`);
  } else {
    console.error(`❌ [${channelType}] Failed to send AI response`);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Webhook verification request:', { mode, token: token?.substring(0, 10) + '...' });

    const verifyToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN');
    
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully');
      return new Response(challenge, { status: 200 });
    } else {
      console.error('Webhook verification failed');
      return new Response('Forbidden', { status: 403 });
    }
  }

  // Handle POST requests (incoming messages)
  try {
    const body = await req.json();
    console.log('meta-webhook-openai received:', JSON.stringify(body).substring(0, 500));

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Process WhatsApp messages
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages' && change.value?.messages) {
            const phoneNumberId = change.value.metadata?.phone_number_id;
            
            for (const message of change.value.messages) {
              const senderPhone = message.from;
              const messageId = message.id;
              const timestamp = new Date(parseInt(message.timestamp) * 1000);
              
              // Get message content and handle media
              let content = '';
              let messageType = 'text';
              let mediaUrl: string | null = null;
              let mediaMimeType: string | null = null;
              let mediaId: string | null = null;
              let mediaError: string | null = null;
              
              if (message.type === 'text') {
                content = message.text?.body || '';
              } else if (message.type === 'image') {
                mediaId = message.image?.id || null;
                content = message.image?.caption || 'El cliente envió una imagen de un producto. Analiza la imagen y responde.';
                messageType = 'image';
              } else if (message.type === 'audio') {
                mediaId = message.audio?.id || null;
                content = '[audio]';
                messageType = 'audio';
              } else if (message.type === 'document') {
                mediaId = message.document?.id || null;
                content = message.document?.filename || '[documento]';
                messageType = 'document';
              } else if (message.type === 'video') {
                mediaId = message.video?.id || null;
                content = message.video?.caption || '[video]';
                messageType = 'video';
              } else if (message.type === 'sticker') {
                mediaId = message.sticker?.id || null;
                content = '[sticker]';
                messageType = 'sticker';
              } else if (message.type === 'button') {
                content = message.button?.text || '[Botón]';
                messageType = 'button';
              } else if (message.type === 'interactive') {
                const interactive = message.interactive;
                if (interactive?.type === 'button_reply') {
                  content = interactive.button_reply?.title || '[Respuesta de botón]';
                } else if (interactive?.type === 'list_reply') {
                  content = interactive.list_reply?.title || '[Selección de lista]';
                } else {
                  content = '[Interactivo]';
                }
                messageType = 'interactive';
              } else {
                content = `[${message.type} recibido]`;
                messageType = message.type;
              }

              console.log(`Processing message from ${senderPhone}: ${content.substring(0, 50)}...`);

              // Find channel by phone_number_id
              let { data: channel, error: channelError } = await supabase
                .from('messaging_channels')
                .select('*')
                .eq('meta_phone_number_id', phoneNumberId)
                .eq('channel_type', 'whatsapp')
                .eq('is_active', true)
                .single();

              if (channelError || !channel) {
                console.log(`Channel not found for phone_number_id ${phoneNumberId}, trying default org`);
                
                // Fallback to Dosmicos organization
                const dosmicoOrgId = 'cb497af2-3f29-4bb4-be53-91b7f19e5ffb';
                const { data: defaultChannel } = await supabase
                  .from('messaging_channels')
                  .select('*')
                  .eq('organization_id', dosmicoOrgId)
                  .eq('channel_type', 'whatsapp')
                  .eq('is_active', true)
                  .single();

                if (defaultChannel) {
                  channel = defaultChannel;
                  console.log('Using default Dosmicos channel');
                } else {
                  console.error('No channel found, skipping message');
                  continue;
                }
              }

              // Get organization's Shopify credentials
              const { data: org } = await supabase
                .from('organizations')
                .select('shopify_credentials')
                .eq('id', channel.organization_id)
                .single();
              
              const shopifyCredentials = org?.shopify_credentials;
              console.log(`Shopify credentials available: ${!!shopifyCredentials}`);

              // Find or create conversation
              let { data: conversation } = await supabase
                .from('messaging_conversations')
                .select('*')
                .eq('channel_id', channel.id)
                .eq('external_user_id', senderPhone)
                .single();

              if (!conversation) {
                // Get contact name from webhook if available
                const contactName = change.value.contacts?.[0]?.profile?.name || senderPhone;
                
                const { data: newConversation, error: convError } = await supabase
                  .from('messaging_conversations')
                  .insert({
                    channel_id: channel.id,
                    organization_id: channel.organization_id,
                    channel_type: 'whatsapp',
                    external_user_id: senderPhone,
                    user_name: contactName,
                    user_identifier: senderPhone,
                    status: 'active',
                    last_message_at: timestamp.toISOString(),
                    last_message_preview: content.substring(0, 100),
                    unread_count: 1,
                    ai_managed: true, // AI enabled by default for all new conversations
                  })
                  .select()
                  .single();

                if (convError) {
                  console.error('Error creating conversation:', convError);
                  continue;
                }
                
                conversation = newConversation;
                console.log('Created new conversation:', conversation.id);
              } else {
                // Update existing conversation
                await supabase
                  .from('messaging_conversations')
                  .update({
                    last_message_at: timestamp.toISOString(),
                    last_message_preview: mediaId
                      ? (messageType === 'image' ? '📷 Imagen'
                        : messageType === 'audio' ? '🎵 Audio'
                        : messageType === 'video' ? '🎬 Video'
                        : messageType === 'document' ? '📄 Documento'
                        : messageType === 'sticker' ? '🎭 Sticker'
                        : content.substring(0, 100))
                      : content.substring(0, 100),
                    unread_count: (conversation.unread_count || 0) + 1,
                    status: 'active',
                  })
                  .eq('id', conversation.id);
              }

              // If message includes media_id, download and cache it now (so UI + AI can use permanent URL)
              if (mediaId && conversation?.id) {
                console.log(`📥 Downloading inbound media (${messageType}) media_id=${mediaId}`);
                const res = await fetchMediaUrl(mediaId, messageType, conversation.id, supabase);
                mediaUrl = res.url;
                mediaMimeType = res.mimeType;
                mediaError = res.error || null;
                console.log(`📦 Inbound media result: url=${mediaUrl ? 'ok' : 'null'} error=${mediaError || 'none'}`);
              }

              // Resolve reply_to_message_id from WAMID to internal UUID
              let resolvedReplyToId: string | null = null;
              const replyToWamid = message.context?.id;
              if (replyToWamid) {
                console.log(`🔗 Resolving reply WAMID: ${replyToWamid}`);
                const { data: replyMsg } = await supabase
                  .from('messaging_messages')
                  .select('id')
                  .eq('external_message_id', replyToWamid)
                  .limit(1)
                  .single();
                if (replyMsg) {
                  resolvedReplyToId = replyMsg.id;
                  console.log(`✅ Resolved reply to internal UUID: ${resolvedReplyToId}`);
                } else {
                  console.log(`⚠️ Reply parent not found in DB, setting reply_to_message_id to null`);
                }
              }

              // Check for duplicate messages (prevent re-processing on webhook retries)
              if (messageId) {
                const { data: existingWaMsg } = await supabase
                  .from('messaging_messages')
                  .select('id')
                  .eq('external_message_id', messageId)
                  .maybeSingle();
                if (existingWaMsg) {
                  console.log(`⚠️ Skipping duplicate WhatsApp message: ${messageId}`);
                  continue;
                }
              }

              // Save incoming message with media URL if available
              const { error: msgError } = await supabase
                .from('messaging_messages')
                .insert({
                  conversation_id: conversation.id,
                  channel_type: 'whatsapp',
                  direction: 'inbound',
                  sender_type: 'user',
                  content: content,
                  message_type: messageType,
                  external_message_id: messageId,
                  sent_at: timestamp.toISOString(),
                  delivered_at: new Date().toISOString(),
                  media_url: mediaUrl,
                  media_mime_type: mediaMimeType,
                  reply_to_message_id: resolvedReplyToId,
                  metadata: {
                    original_message: message,
                    original_media_id: mediaId,
                    media_download_error: mediaError,
                  }
                });

              if (msgError) {
                console.error('Error saving message:', msgError);
              } else {
                console.log('Message saved to database');
              }

              // ========== IMAGE RECEIPT CONFIRMATION ==========
              // Send immediate confirmation when an image is received, before AI debounce
              if (messageType === 'image' && mediaUrl && conversation?.id) {
                try {
                  const imageConfirmText = '📸 Recibí tu imagen, déjame revisarla...';
                  const imageConfirmSent = await sendWhatsAppMessage(
                    senderPhone,
                    imageConfirmText,
                    channel.meta_phone_number_id || phoneNumberId
                  );
                  if (imageConfirmSent) {
                    console.log('📸 Image receipt confirmation sent to customer');
                    // Save confirmation message to DB
                    await supabase
                      .from('messaging_messages')
                      .insert({
                        conversation_id: conversation.id,
                        channel_type: 'whatsapp',
                        direction: 'outbound',
                        sender_type: 'system',
                        content: imageConfirmText,
                        message_type: 'text',
                        sent_at: new Date().toISOString(),
                      });
                  }
                } catch (confirmError) {
                  console.error('Error sending image receipt confirmation:', confirmError);
                }
              }
              // ========== END IMAGE RECEIPT CONFIRMATION ==========

              // ========== ADDRESS VERIFICATION DETECTION ==========
              let pendingAddressVerification: any = null;
              let skipAiForAddress = false;
              let freshAddrConv: any = null;

              if (conversation?.id) {
                const { data: freshAddrData } = await supabase
                  .from('messaging_conversations')
                  .select('metadata')
                  .eq('id', conversation.id)
                  .single();

                freshAddrConv = freshAddrData;
                pendingAddressVerification = freshAddrConv?.metadata?.pending_address_verification;
                console.log(`[ADDR-VERIFY] Fresh metadata for conv ${conversation.id}: pending=${JSON.stringify(pendingAddressVerification?.status || null)}`);
              }

              if (pendingAddressVerification?.status === 'pending' && content && (messageType === 'text' || messageType === 'button' || messageType === 'interactive')) {
                console.log(`📍 Pending address verification for order ${pendingAddressVerification.order_number}`);

                // Check button payload first (from template quick reply buttons)
                const buttonPayload = message.button?.payload || '';
                const isButtonCorrect = buttonPayload === 'ADDRESS_CORRECT';
                const isButtonWrong = buttonPayload === 'ADDRESS_WRONG';

                const normalized = content.toLowerCase().trim()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                const confirmWords = ['correcto', 'correcta', 'si', 'ok', 'bien', 'esta bien', 'esta correcta', 'esta correcto', 'dale', 'listo', 'perfecto', 'claro'];
                const isConfirmation = isButtonCorrect || confirmWords.some(w => normalized === w || normalized.startsWith(w + ' ') || normalized.startsWith(w + ',') || normalized.startsWith(w + '.'));

                if (isConfirmation) {
                  console.log(`✅ Customer CONFIRMED address for order ${pendingAddressVerification.order_number}`);
                  skipAiForAddress = true;

                  try {
                    // Remove "Revisar Dirección" tag from Shopify order
                    const shopifyOrderId = pendingAddressVerification.shopify_order_id;
                    const { data: localOrder } = await supabase
                      .from('shopify_orders')
                      .select('tags')
                      .eq('shopify_order_id', shopifyOrderId)
                      .single();

                    if (localOrder) {
                      const currentTags = (localOrder.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean);
                      const updatedTags = currentTags.filter((t: string) => t !== 'Revisar Dirección');
                      if (updatedTags.length !== currentTags.length) {
                        await supabase.from('shopify_orders').update({ tags: updatedTags.join(', ') }).eq('shopify_order_id', shopifyOrderId);
                        console.log(`🏷️ Removed "Revisar Dirección" tag from local order`);

                        // Also remove from Shopify
                        const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
                        const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
                        if (shopifyDomain && shopifyAccessToken) {
                          try {
                            const shopifyResp = await fetch(`https://${shopifyDomain}/admin/api/2024-01/orders/${shopifyOrderId}.json`, {
                              method: 'PUT',
                              headers: {
                                'X-Shopify-Access-Token': shopifyAccessToken,
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({ order: { id: shopifyOrderId, tags: updatedTags.join(', ') } })
                            });
                            console.log(`🏷️ Shopify tag update: ${shopifyResp.status}`);
                          } catch (e) {
                            console.error('⚠️ Error updating Shopify tags:', e);
                          }
                        }
                      }
                    }

                    // Update metadata: mark as confirmed
                    // Use fresh metadata from the recent fetch to avoid overwriting concurrent changes
                    const freshMeta = freshAddrConv?.metadata || conversation.metadata || {};
                    const wasDisabledByAutomation = freshMeta.ai_disabled_by_automation === true;
                    const addrUpdateData: any = {
                      metadata: {
                        ...freshMeta,
                        pending_address_verification: {
                          ...pendingAddressVerification,
                          status: 'confirmed',
                          confirmed_at: new Date().toISOString()
                        }
                      }
                    };
                    // Only re-enable AI if it was disabled by automation (not manually by user)
                    if (wasDisabledByAutomation) {
                      addrUpdateData.ai_managed = true;
                      delete addrUpdateData.metadata.ai_disabled_by_automation;
                      console.log(`[ADDR-VERIFY] Re-enabling AI after address confirmation (was disabled by automation)`);
                    } else {
                      console.log(`[ADDR-VERIFY] AI was NOT disabled by automation — NOT re-enabling after address confirmation`);
                    }
                    await supabase
                      .from('messaging_conversations')
                      .update(addrUpdateData)
                      .eq('id', conversation.id);

                    // Send confirmation reply
                    const confirmMessage = `¡Perfecto, gracias por confirmar tu dirección! 🎉 Tu pedido #${pendingAddressVerification.order_number} será enviado sin problemas.`;
                    const confirmResp = await fetch(`https://graph.facebook.com/v21.0/${channel.meta_phone_number_id}/messages`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${Deno.env.get('META_WHATSAPP_TOKEN')}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: senderPhone,
                        type: 'text',
                        text: { preview_url: false, body: confirmMessage }
                      })
                    });
                    const confirmData = await confirmResp.json();

                    // Save reply to DB
                    if (conversation.id) {
                      await supabase.from('messaging_messages').insert({
                        conversation_id: conversation.id,
                        external_message_id: confirmData?.messages?.[0]?.id,
                        channel_type: 'whatsapp',
                        direction: 'outbound',
                        sender_type: 'agent',
                        content: confirmMessage,
                        message_type: 'text',
                        sent_at: new Date().toISOString()
                      });
                      await supabase.from('messaging_conversations').update({
                        last_message_preview: confirmMessage.substring(0, 100),
                        last_message_at: new Date().toISOString()
                      }).eq('id', conversation.id);
                    }

                    console.log(`✅ Address verification confirmed for order ${pendingAddressVerification.order_number}`);
                  } catch (err) {
                    console.error('❌ Error processing address confirmation:', err);
                  }

                } else if (isButtonWrong) {
                  // Customer clicked "Corregir Dirección" button — ask for correct address
                  console.log(`📝 Customer wants to correct address for order ${pendingAddressVerification.order_number}`);
                  skipAiForAddress = true;

                  try {
                    const askMessage = `Por favor escribenos tu direccion completa correcta (direccion, ciudad y departamento) para actualizar tu pedido #${pendingAddressVerification.order_number} 📝`;
                    const askResp = await fetch(`https://graph.facebook.com/v21.0/${channel.meta_phone_number_id}/messages`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${Deno.env.get('META_WHATSAPP_TOKEN')}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: senderPhone,
                        type: 'text',
                        text: { preview_url: false, body: askMessage }
                      })
                    });
                    const askData = await askResp.json();

                    if (conversation.id) {
                      await supabase.from('messaging_messages').insert({
                        conversation_id: conversation.id,
                        external_message_id: askData?.messages?.[0]?.id,
                        channel_type: 'whatsapp',
                        direction: 'outbound',
                        sender_type: 'agent',
                        content: askMessage,
                        message_type: 'text',
                        sent_at: new Date().toISOString()
                      });
                      await supabase.from('messaging_conversations').update({
                        last_message_preview: askMessage.substring(0, 100),
                        last_message_at: new Date().toISOString()
                      }).eq('id', conversation.id);
                    }

                    // Keep status as 'pending' — wait for the actual address in next message
                    console.log(`📝 Asked customer for correct address, keeping pending status`);
                  } catch (err) {
                    console.error('❌ Error asking for address correction:', err);
                  }

                } else {
                  // Customer wrote something else (new address or question)
                  console.log(`📝 Customer sent address correction for order ${pendingAddressVerification.order_number}: "${content}"`);
                  skipAiForAddress = true;

                  try {
                    // Update metadata: mark needs_attention with customer response
                    const existingMeta = freshAddrConv?.metadata || conversation.metadata || {};
                    await supabase
                      .from('messaging_conversations')
                      .update({
                        ai_managed: false,
                        metadata: {
                          ...existingMeta,
                          ai_disabled_by_automation: true,
                          pending_address_verification: {
                            ...pendingAddressVerification,
                            status: 'needs_attention',
                            customer_response: content,
                            responded_at: new Date().toISOString()
                          }
                        }
                      })
                      .eq('id', conversation.id);

                    // Assign "Requiere atencion" tag to conversation
                    const { data: attnTag } = await supabase
                      .from('messaging_conversation_tags')
                      .select('id')
                      .eq('organization_id', channel.organization_id)
                      .eq('name', 'Requiere atencion')
                      .maybeSingle();

                    if (attnTag && conversation.id) {
                      await supabase
                        .from('messaging_conversation_tag_assignments')
                        .upsert({
                          conversation_id: conversation.id,
                          tag_id: attnTag.id
                        }, { onConflict: 'conversation_id,tag_id' });
                      console.log(`🏷️ Tag "Requiere atencion" assigned`);
                    }

                    // Send acknowledgment
                    const ackMessage = `Gracias por tu respuesta. Nuestro equipo revisará tu dirección y actualizará tu pedido #${pendingAddressVerification.order_number}. Te confirmaremos pronto! 📦`;
                    const ackResp = await fetch(`https://graph.facebook.com/v21.0/${channel.meta_phone_number_id}/messages`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${Deno.env.get('META_WHATSAPP_TOKEN')}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: senderPhone,
                        type: 'text',
                        text: { preview_url: false, body: ackMessage }
                      })
                    });
                    const ackData = await ackResp.json();

                    if (conversation.id) {
                      await supabase.from('messaging_messages').insert({
                        conversation_id: conversation.id,
                        external_message_id: ackData?.messages?.[0]?.id,
                        channel_type: 'whatsapp',
                        direction: 'outbound',
                        sender_type: 'agent',
                        content: ackMessage,
                        message_type: 'text',
                        sent_at: new Date().toISOString()
                      });
                      await supabase.from('messaging_conversations').update({
                        last_message_preview: ackMessage.substring(0, 100),
                        last_message_at: new Date().toISOString()
                      }).eq('id', conversation.id);
                    }

                    console.log(`📝 Address needs attention for order ${pendingAddressVerification.order_number}`);
                  } catch (err) {
                    console.error('❌ Error processing address correction:', err);
                  }
                }
              } else if (pendingAddressVerification && pendingAddressVerification.status !== 'pending') {
                // Address verification is no longer pending — re-enable AI only if automation disabled it
                const addrStatus = freshAddrConv?.metadata?.pending_address_verification?.status;
                const disabledByAutomationAddr = freshAddrConv?.metadata?.ai_disabled_by_automation === true;
                if (conversation.ai_managed === false && disabledByAutomationAddr && addrStatus === 'confirmed') {
                  console.log(`[ADDR-VERIFY] Re-enabling AI for conversation ${conversation.id} (address confirmed, was disabled by automation)`);
                  const addrMeta = freshAddrConv?.metadata || {};
                  delete addrMeta.ai_disabled_by_automation;
                  await supabase
                    .from('messaging_conversations')
                    .update({ ai_managed: true, metadata: addrMeta })
                    .eq('id', conversation.id);
                  conversation.ai_managed = true;
                } else if (conversation.ai_managed === false && !disabledByAutomationAddr) {
                  console.log(`[ADDR-VERIFY] AI not disabled by automation for conversation ${conversation.id} — NOT re-enabling`);
                }
              }
              // If address verification was handled, skip AI for this message
              if (skipAiForAddress) {
                conversation.ai_managed = false;
                console.log(`[ADDR-VERIFY] Skipping AI response — address verification handled this message`);
              }
              // ========== END ADDRESS VERIFICATION ==========

              // ========== AUTO-REPLY DETECTION ==========
              // Detect automated WhatsApp Business auto-replies (e.g., out-of-hours messages)
              // These should NOT affect COD confirmation flow or trigger AI responses
              if (content && messageType === 'text') {
                const normalizedForAutoReply = content.toLowerCase().trim()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const autoReplyPatterns = [
                  'gracias por contactarnos',
                  'gracias por escribirnos',
                  'gracias por comunicarte',
                  'gracias por tu mensaje',
                  'nuestro horario',
                  'fuera de horario',
                  'fuera del horario',
                  'horario de atencion',
                  'le responderemos',
                  'te responderemos',
                  'respuesta automatica',
                  'mensaje automatico',
                  'no estamos disponibles',
                  'en este momento no podemos',
                  'nos comunicaremos contigo',
                  'pronto te responderemos',
                  'hemos recibido tu mensaje',
                  'recibimos tu mensaje',
                  'en breve te',
                  'a la brevedad',
                ];
                const isAutoReply = autoReplyPatterns.some(p => normalizedForAutoReply.includes(p));
                if (isAutoReply) {
                  console.log(`🤖 [AUTO-REPLY] Detected automated business reply from ${senderPhone}: "${content.substring(0, 80)}". Skipping COD flow and AI.`);
                  continue; // Skip entire processing — don't corrupt COD status, don't trigger AI
                }
              }
              // ========== END AUTO-REPLY DETECTION ==========

              // ========== COD ORDER CONFIRMATION DETECTION ==========
              // Re-fetch conversation metadata fresh to avoid stale data from the
              // initial fetch (metadata may have been written by send-order-confirmation
              // between the initial fetch and now)
              let pendingConfirmation: any = null;
              let freshCodConv: any = null;

              if (conversation?.id) {
                const { data: freshCodData } = await supabase
                  .from('messaging_conversations')
                  .select('metadata')
                  .eq('id', conversation.id)
                  .single();

                freshCodConv = freshCodData;
                pendingConfirmation = freshCodConv?.metadata?.pending_order_confirmation;
                console.log(`[COD-CONFIRM] Fresh metadata for conv ${conversation.id}: pending=${JSON.stringify(pendingConfirmation?.status || null)}`);
              }

              // FALLBACK: If conversation metadata doesn't have a pending/needs_attention confirmation,
              // check the order_confirmations table directly by customer phone + pending/needs_attention status
              if (!pendingConfirmation || (pendingConfirmation.status !== 'pending' && pendingConfirmation.status !== 'needs_attention')) {
                console.log(`[COD-CONFIRM] No pending/active in metadata, checking order_confirmations table for phone ${senderPhone}`);

                const { data: dbConfirmation } = await supabase
                  .from('order_confirmations')
                  .select('shopify_order_id, order_number, status, conversation_id')
                  .eq('customer_phone', senderPhone)
                  .in('status', ['pending', 'needs_attention'])
                  .eq('organization_id', channel.organization_id)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (dbConfirmation) {
                  console.log(`[COD-CONFIRM] FALLBACK HIT: Found ${dbConfirmation.status} confirmation in DB for order ${dbConfirmation.order_number}`);
                  pendingConfirmation = {
                    shopify_order_id: dbConfirmation.shopify_order_id,
                    order_number: dbConfirmation.order_number,
                    status: dbConfirmation.status
                  };

                  // Fix conversation_id mismatch if needed
                  if (dbConfirmation.conversation_id !== conversation.id) {
                    console.log(`[COD-CONFIRM] Conversation mismatch! DB has ${dbConfirmation.conversation_id}, webhook has ${conversation.id}. Updating...`);
                    await supabase
                      .from('order_confirmations')
                      .update({ conversation_id: conversation.id, updated_at: new Date().toISOString() })
                      .eq('shopify_order_id', dbConfirmation.shopify_order_id);
                  }
                } else {
                  console.log(`[COD-CONFIRM] No pending confirmation found in DB either for phone ${senderPhone}`);
                }
              }

              const codStatusActive = pendingConfirmation?.status === 'pending' || pendingConfirmation?.status === 'needs_attention';
              if (codStatusActive && content && (messageType === 'text' || messageType === 'button' || messageType === 'interactive')) {
                console.log(`📋 Order confirmation detected for order ${pendingConfirmation.order_number} (status: ${pendingConfirmation.status})`);

                // Normalize response: lowercase, remove accents, trim
                const normalized = content.toLowerCase().trim()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                const confirmWords = ['si', 'sí', 'confirmo', 'dale', 'listo', 'ok', 'correcto', 'afirmativo', 'claro', 'va', 'vale', 'perfecto', 'bien'];
                const isConfirmation = confirmWords.some(w => normalized === w || normalized.startsWith(w + ' ') || normalized.startsWith(w + ',') || normalized.startsWith(w + '.'));

                if (isConfirmation) {
                  console.log(`✅ Customer CONFIRMED order ${pendingConfirmation.order_number}`);

                  try {
                    // 1. ALWAYS update local shopify_orders tags first (ensures consistency)
                    const { data: localOrder } = await supabase
                      .from('shopify_orders')
                      .select('tags')
                      .eq('shopify_order_id', pendingConfirmation.shopify_order_id)
                      .single();
                    if (localOrder) {
                      const currentTags = (localOrder.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean);
                      if (!currentTags.includes('Confirmado')) {
                        currentTags.push('Confirmado');
                        await supabase.from('shopify_orders').update({ tags: currentTags.join(', ') }).eq('shopify_order_id', pendingConfirmation.shopify_order_id);
                        console.log(`🏷️ Local DB tag "Confirmado" applied for order ${pendingConfirmation.order_number}`);
                      }
                    }

                    // 2. Add "Confirmado" tag DIRECTLY to Shopify (no intermediary function)
                    let shopifyTagSuccess = false;
                    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
                    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
                    const shopifyOrderId = pendingConfirmation.shopify_order_id;
                    console.log(`🏷️ Adding Confirmado tag DIRECTLY to Shopify - shopify_order_id: ${shopifyOrderId}, order_number: ${pendingConfirmation.order_number}`);

                    if (!shopifyDomain || !shopifyAccessToken) {
                      console.error(`❌ Shopify credentials not configured! SHOPIFY_STORE_DOMAIN=${!!shopifyDomain}, SHOPIFY_ACCESS_TOKEN=${!!shopifyAccessToken}`);
                    } else {
                      for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                          if (attempt > 1) await new Promise(r => setTimeout(r, 1500));

                          // Fetch current tags from Shopify
                          const getResp = await fetch(`https://${shopifyDomain}/admin/api/2024-01/orders/${shopifyOrderId}.json?fields=id,tags`, {
                            method: 'GET',
                            headers: { 'X-Shopify-Access-Token': shopifyAccessToken, 'Content-Type': 'application/json' },
                          });

                          if (!getResp.ok) {
                            const errText = await getResp.text();
                            console.error(`⚠️ Attempt ${attempt}/3 GET order failed (${getResp.status}) for order ${pendingConfirmation.order_number}: ${errText}`);
                            continue;
                          }

                          const orderData = await getResp.json();
                          const currentTags = (orderData.order?.tags || '').split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);

                          // Merge "Confirmado" tag (case-insensitive dedup)
                          if (!currentTags.some((t: string) => t.toLowerCase() === 'confirmado')) {
                            currentTags.push('Confirmado');
                          }

                          // Update tags in Shopify
                          const putResp = await fetch(`https://${shopifyDomain}/admin/api/2024-01/orders/${shopifyOrderId}.json`, {
                            method: 'PUT',
                            headers: { 'X-Shopify-Access-Token': shopifyAccessToken, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ order: { tags: currentTags.join(', ') } }),
                          });

                          if (!putResp.ok) {
                            const errText = await putResp.text();
                            console.error(`⚠️ Attempt ${attempt}/3 PUT tags failed (${putResp.status}) for order ${pendingConfirmation.order_number}: ${errText}`);
                            continue;
                          }

                          shopifyTagSuccess = true;
                          console.log(`🏷️ ✅ Added "Confirmado" tag to Shopify DIRECTLY (attempt ${attempt}) for order ${pendingConfirmation.order_number}`);
                          break;
                        } catch (tagErr) {
                          console.error(`⚠️ Attempt ${attempt}/3 threw error for order ${pendingConfirmation.order_number}:`, tagErr);
                        }
                      }

                      if (!shopifyTagSuccess) {
                        console.error(`❌ All 3 attempts failed to add Confirmado tag to Shopify for order ${pendingConfirmation.order_number}. Local DB was updated.`);
                      }
                    }

                    // 3. Update order_confirmations
                    await supabase
                      .from('order_confirmations')
                      .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                      .eq('shopify_order_id', pendingConfirmation.shopify_order_id);

                    // 4. Update conversation metadata (use fresh metadata to avoid overwriting concurrent changes)
                    const freshCodMeta = freshCodConv?.metadata || conversation.metadata || {};
                    const updatedMetadata = { ...freshCodMeta, pending_order_confirmation: { ...pendingConfirmation, status: 'confirmed' } };
                    await supabase.from('messaging_conversations').update({ metadata: updatedMetadata }).eq('id', conversation.id);

                    // 5. Remove "Confirmacion pendiente" tag
                    const { data: pendingTag } = await supabase
                      .from('messaging_conversation_tags')
                      .select('id')
                      .eq('organization_id', channel.organization_id)
                      .eq('name', 'Confirmacion pendiente')
                      .maybeSingle();
                    if (pendingTag) {
                      await supabase.from('messaging_conversation_tag_assignments').delete().eq('conversation_id', conversation.id).eq('tag_id', pendingTag.id);
                    }

                    // 6. Send confirmation response
                    const confirmMsg = `Gracias por tu compra, tu pedido será despachado en las próximas horas`;
                    const phoneId = channel.meta_phone_number_id || Deno.env.get('META_PHONE_NUMBER_ID');
                    const waToken = Deno.env.get('META_WHATSAPP_TOKEN');
                    if (phoneId && waToken) {
                      const sendResp = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          messaging_product: 'whatsapp', recipient_type: 'individual', to: senderPhone,
                          type: 'text', text: { preview_url: false, body: confirmMsg }
                        })
                      });
                      const sendData = await sendResp.json();

                      // Save confirmation response message
                      await supabase.from('messaging_messages').insert({
                        conversation_id: conversation.id,
                        external_message_id: sendData?.messages?.[0]?.id,
                        channel_type: 'whatsapp', direction: 'outbound', sender_type: 'agent',
                        content: confirmMsg, message_type: 'text', sent_at: new Date().toISOString()
                      });
                      await supabase.from('messaging_conversations').update({
                        last_message_preview: confirmMsg.substring(0, 100),
                        last_message_at: new Date().toISOString()
                      }).eq('id', conversation.id);
                    }

                    console.log(`✅ Order ${pendingConfirmation.order_number} fully confirmed`);
                  } catch (confirmErr) {
                    console.error('❌ Error processing confirmation:', confirmErr);
                  }

                  continue; // Skip AI auto-reply

                } else {
                  // Not a confirmation — route to human attention
                  // But only update status if it's still 'pending' (avoid re-processing if already 'needs_attention')
                  if (pendingConfirmation.status === 'pending') {
                    console.log(`🔴 Customer response needs attention for order ${pendingConfirmation.order_number}: "${content.substring(0, 50)}"`);

                    try {
                      // 1. Update order_confirmations
                      await supabase
                        .from('order_confirmations')
                        .update({ status: 'needs_attention', updated_at: new Date().toISOString() })
                        .eq('shopify_order_id', pendingConfirmation.shopify_order_id);

                      // 2. Update conversation metadata (use fresh metadata to avoid overwriting concurrent changes)
                      const freshCodMetaNA = freshCodConv?.metadata || conversation.metadata || {};
                      const updatedMetadata = { ...freshCodMetaNA, ai_disabled_by_automation: true, pending_order_confirmation: { ...pendingConfirmation, status: 'needs_attention' } };
                      await supabase.from('messaging_conversations').update({ metadata: updatedMetadata, ai_managed: false }).eq('id', conversation.id);

                      // 3. Swap tags: remove "Confirmacion pendiente", add "Requiere atencion"
                      const { data: pendingTag } = await supabase
                        .from('messaging_conversation_tags')
                        .select('id')
                        .eq('organization_id', channel.organization_id)
                        .eq('name', 'Confirmacion pendiente')
                        .maybeSingle();
                      if (pendingTag) {
                        await supabase.from('messaging_conversation_tag_assignments').delete().eq('conversation_id', conversation.id).eq('tag_id', pendingTag.id);
                      }

                      const { data: attentionTag } = await supabase
                        .from('messaging_conversation_tags')
                        .select('id')
                        .eq('organization_id', channel.organization_id)
                        .eq('name', 'Requiere atencion')
                        .maybeSingle();
                      if (attentionTag) {
                        await supabase.from('messaging_conversation_tag_assignments')
                          .upsert({ conversation_id: conversation.id, tag_id: attentionTag.id }, { onConflict: 'conversation_id,tag_id' });
                      }

                      console.log(`🔴 Order ${pendingConfirmation.order_number} routed to human attention`);
                    } catch (attErr) {
                      console.error('❌ Error routing to attention:', attErr);
                    }
                  } else {
                    console.log(`🔴 [COD-CONFIRM] Non-confirmation message for order ${pendingConfirmation.order_number} (already ${pendingConfirmation.status}): "${content.substring(0, 50)}". Skipping AI.`);
                  }

                  continue; // Skip AI auto-reply, human agent handles this
                }
              } else if (!codStatusActive) {
                // No pending/active confirmation found anywhere — proceeding to AI auto-reply
                console.log(`[COD-CONFIRM] No actionable confirmation for phone ${senderPhone} (status=${pendingConfirmation?.status || 'none'}) — proceeding to AI`);

                // If ai_managed was disabled by automation (COD/address flow), re-enable it
                // Only re-enable if ai_disabled_by_automation flag is set — never re-enable manually disabled conversations
                // NOTE: 'needs_attention' is NOT included here — it means human review is needed, NOT AI re-activation
                const codStatus = freshCodConv?.metadata?.pending_order_confirmation?.status;
                const disabledByAutomationCOD = freshCodConv?.metadata?.ai_disabled_by_automation === true;
                if (conversation.ai_managed === false && disabledByAutomationCOD && (codStatus === 'confirmed' || codStatus === 'expired' || codStatus === 'cancelled')) {
                  console.log(`[COD-CONFIRM] Re-enabling AI for conversation ${conversation.id} (COD status: ${codStatus}, was disabled by automation)`);
                  const codMeta = freshCodConv?.metadata || {};
                  delete codMeta.ai_disabled_by_automation;
                  await supabase
                    .from('messaging_conversations')
                    .update({ ai_managed: true, metadata: codMeta })
                    .eq('id', conversation.id);
                  conversation.ai_managed = true;
                } else if (conversation.ai_managed === false && !disabledByAutomationCOD) {
                  console.log(`[COD-CONFIRM] AI not disabled by automation for conversation ${conversation.id} — NOT re-enabling`);
                }
              }
              // ========== END COD ORDER CONFIRMATION ==========

              // Generate and send AI response if enabled (check both channel and conversation level)
              const aiEnabledOnChannel = channel.ai_enabled !== false;
              // ai_managed: true = AI responds, false = manual control, null = default to channel setting
              const aiEnabledOnConversation = conversation.ai_managed !== false;
              
              console.log(`AI status check - Channel: ${aiEnabledOnChannel}, Conversation ai_managed: ${conversation.ai_managed}, Will respond: ${aiEnabledOnChannel && aiEnabledOnConversation}`);
              
              // AI responds to text, image (with caption or for vision), button, and interactive messages
              const aiRespondableTypes = ['text', 'image', 'button', 'interactive'];
              if (aiEnabledOnChannel && aiEnabledOnConversation && content && aiRespondableTypes.includes(messageType)) {
                console.log('AI is enabled (channel + conversation), applying debounce...');

                // ========== DEBOUNCE LOGIC ==========
                // Use metadata.ai_pending_since to track debounce (stored in JSONB metadata field)
                const debounceTimestamp = new Date().toISOString();
                const currentMetadata = conversation.metadata || {};
                await supabase
                  .from('messaging_conversations')
                  .update({ metadata: { ...currentMetadata, ai_pending_since: debounceTimestamp } })
                  .eq('id', conversation.id);

                // Wait 6 seconds to accumulate multiple messages from the user
                const DEBOUNCE_DELAY_MS = 6000;
                console.log(`Debounce: waiting ${DEBOUNCE_DELAY_MS}ms for more messages...`);
                await new Promise(resolve => setTimeout(resolve, DEBOUNCE_DELAY_MS));

                // After waiting, check if ai_pending_since was updated by a newer message
                const { data: freshConversation } = await supabase
                  .from('messaging_conversations')
                  .select('metadata')
                  .eq('id', conversation.id)
                  .single();

                const currentPending = freshConversation?.metadata?.ai_pending_since;
                if (currentPending !== debounceTimestamp) {
                  // A newer message arrived and set a new timestamp — this invocation should NOT respond
                  console.log(`Debounce: newer message detected (my=${debounceTimestamp}, current=${currentPending}). Skipping AI response — the newer invocation will handle it.`);
                  // Clear ai_pending_since is NOT done here; the latest invocation will handle it
                } else {
                  // No newer message arrived — this is the latest invocation, proceed with AI
                  console.log('Debounce: no newer messages detected, proceeding with AI response...');

                  // Clear the pending flag from metadata
                  const cleanMetadata = { ...freshConversation?.metadata };
                  delete cleanMetadata.ai_pending_since;
                  await supabase
                    .from('messaging_conversations')
                    .update({ metadata: cleanMetadata })
                    .eq('id', conversation.id);

                // ========== END DEBOUNCE LOGIC ==========

                // ========== DUPLICATE AI RESPONSE GUARD ==========
                // Check if an AI response was already sent very recently (within 10 seconds)
                // This prevents race conditions where two webhook invocations both pass the debounce check
                const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
                const { data: recentAiResponse } = await supabase
                  .from('messaging_messages')
                  .select('id')
                  .eq('conversation_id', conversation.id)
                  .eq('direction', 'outbound')
                  .eq('sender_type', 'ai')
                  .gte('sent_at', tenSecondsAgo)
                  .limit(1)
                  .maybeSingle();

                if (recentAiResponse) {
                  console.log(`⚠️ Duplicate guard: AI response already sent within last 10 seconds. Skipping to prevent duplicate.`);
                } else {
                // ========== END DUPLICATE GUARD ==========

                // Get conversation history for context (includes all messages accumulated during debounce)
                const { data: historyMessages } = await supabase
                  .from('messaging_messages')
                  .select('*')
                  .eq('conversation_id', conversation.id)
                  .order('sent_at', { ascending: false })
                  .limit(15);

                // Always use OpenAI (GPT-4o-mini) — supports text + vision
                const functionName = 'messaging-ai-openai';
                console.log(`Using AI provider: openai, function: ${functionName}`);

                // Build messages for the AI function — all accumulated messages are already in the DB
                // Include image URLs for vision analysis when available
                const messagesForAI = (historyMessages || []).reverse().map((m: any) => {
                  const role = m.direction === 'inbound' ? 'user' : 'assistant';

                  // For user image messages with a stored media URL, include the image for vision
                  if (role === 'user' && m.message_type === 'image' && m.media_url) {
                    return {
                      role,
                      content: [
                        { type: 'text', text: m.content || 'El cliente envió esta imagen.' },
                        { type: 'image_url', image_url: { url: m.media_url, detail: 'auto' } }
                      ]
                    };
                  }

                  return { role, content: m.content || '' };
                });

                // Call the AI edge function
                const channelAiConfig = channel.ai_config || {};
                const { data: aiData, error: aiError } = await supabase.functions.invoke(functionName, {
                  body: {
                    messages: messagesForAI,
                    systemPrompt: channelAiConfig.systemPrompt || 'Eres un asistente virtual amigable de Dosmicos. Responde en español.',
                    organizationId: channel.organization_id,
                  }
                });

                let aiText = '';
                let aiProductImages: any[] = [];
                
                if (aiError) {
                  console.error('AI function error:', aiError);
                  // Fallback to local generateAIResponse if edge function fails
                  console.log('Falling back to local generateAIResponse...');
                  const aiResult = await generateAIResponse(
                    content,
                    (historyMessages || []).reverse(),
                    channel.ai_config,
                    channel.organization_id,
                    supabase,
                    shopifyCredentials
                  );
                  aiText = aiResult.text;
                  aiProductImages = aiResult.productImages;
                } else {
                  aiText = aiData?.response || '';
                  aiProductImages = aiData?.product_images || [];
                }

                if (aiText) {
                  // Send the text response via WhatsApp
                  const sent = await sendWhatsAppMessage(
                    senderPhone,
                    aiText,
                    channel.meta_phone_number_id || phoneNumberId
                  );

                  if (sent) {
                    // Save AI response to database
                    await supabase
                      .from('messaging_messages')
                      .insert({
                        conversation_id: conversation.id,
                        channel_type: 'whatsapp',
                        direction: 'outbound',
                        sender_type: 'ai',
                        content: aiText,
                        message_type: 'text',
                        sent_at: new Date().toISOString(),
                      });

                    // Update conversation last message
                    await supabase
                      .from('messaging_conversations')
                      .update({
                        last_message_at: new Date().toISOString(),
                        last_message_preview: aiText.substring(0, 100),
                      })
                      .eq('id', conversation.id);

                    console.log('AI response sent and saved');

                    // ========== AI ESCALATION DETECTION ==========
                    const escalationPhrases = [
                      'conecto con el equipo', 'conecto con un asesor',
                      'no tengo esa información', 'no cuento con esa información',
                      'no puedo ayudarte con eso', 'contactar a nuestro equipo',
                      'comunícate con nosotros', 'escribenos al'
                    ];
                    const aiTextLower = aiText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const isEscalation = escalationPhrases.some(phrase => {
                      const normalizedPhrase = phrase.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                      return aiTextLower.includes(normalizedPhrase);
                    });

                    if (isEscalation) {
                      console.log('🔴 AI escalation detected, assigning "Requiere atencion" tag');
                      try {
                        // 1. Assign "Requiere atencion" tag
                        const { data: attentionTag } = await supabase
                          .from('messaging_conversation_tags')
                          .select('id')
                          .eq('organization_id', channel.organization_id)
                          .eq('name', 'Requiere atencion')
                          .maybeSingle();
                        if (attentionTag) {
                          await supabase.from('messaging_conversation_tag_assignments')
                            .upsert({ conversation_id: conversation.id, tag_id: attentionTag.id }, { onConflict: 'conversation_id,tag_id' });
                        }
                        // 2. Disable AI on this conversation (mark as automation-disabled so it can be re-enabled later)
                        const { data: escConv } = await supabase.from('messaging_conversations').select('metadata').eq('id', conversation.id).single();
                        const escMeta = escConv?.metadata || {};
                        await supabase.from('messaging_conversations')
                          .update({ ai_managed: false, metadata: { ...escMeta, ai_disabled_by_automation: true } })
                          .eq('id', conversation.id);
                        console.log('🔴 Conversation tagged and AI disabled for human handoff');
                      } catch (escErr) {
                        console.error('❌ Error handling AI escalation:', escErr);
                      }
                    }
                    // ========== END AI ESCALATION DETECTION ==========

                    // Send ALL product images (up to 10)
                    if (aiProductImages && aiProductImages.length > 0) {
                      console.log(`Sending ${aiProductImages.length} product images...`);
                      
                      for (const img of aiProductImages) {
                        console.log(`Sending image for product ${img.product_id}: ${img.product_name}`);
                        
                        const imageSent = await sendWhatsAppImage(
                          senderPhone,
                          img.image_url,
                          `📸 ${img.product_name}`,
                          channel.meta_phone_number_id || phoneNumberId
                        );
                        
                        if (imageSent) {
                          // Save image message to database
                          await supabase
                            .from('messaging_messages')
                            .insert({
                              conversation_id: conversation.id,
                              channel_type: 'whatsapp',
                              direction: 'outbound',
                              sender_type: 'ai',
                              content: `📸 ${img.product_name}`,
                              message_type: 'image',
                              media_url: img.image_url,
                              sent_at: new Date().toISOString(),
                            });
                          
                          console.log(`Product image sent: ${img.product_name}`);
                        } else {
                          console.error(`Failed to send product image: ${img.product_name}`);
                        }
                        
                        // Small delay between images to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 500));
                      }
                      
                      console.log(`All ${aiProductImages.length} product images processed`);
                    }
                  }
                } else {
                  console.log('No AI response generated');
                }
                
                // NOTE: Order creation is handled by messaging-ai-openai via OpenAI function calling (create_order).
                // No separate auto-order detection needed here.
                } // end else (duplicate guard - no recent AI response found)
                } // end else (debounce - this invocation handles the AI response)
              }
            }
          }
        }
      }
    }

    // ========== INSTAGRAM HANDLER (DMs + Comments) ==========
    if (body.object === 'instagram') {
      console.log('📸 Instagram webhook received');

      for (const entry of body.entry || []) {
        const instagramPageId = entry.id; // This is the Instagram account / page ID

        // ---------- Instagram DMs ----------
        if (entry.messaging) {
          for (const event of entry.messaging) {
            // Skip echo messages (sent by the page itself)
            if (event.message?.is_echo) {
              console.log('📸 Skipping echo message');
              continue;
            }

            const senderId = event.sender?.id;
            const messageText = event.message?.text || '';
            const tsRawIG = parseInt(event.timestamp);
            const messageTimestamp = event.timestamp ? new Date(tsRawIG > 10000000000 ? tsRawIG : tsRawIG * 1000).toISOString() : new Date().toISOString();

            // Determine message type and content
            let messageType = 'text';
            let content = messageText;
            let mediaUrl = '';

            if (event.message?.attachments && event.message.attachments.length > 0) {
              const attachment = event.message.attachments[0];
              const attachType = attachment.type; // image, video, audio, file
              if (['image', 'video', 'audio'].includes(attachType)) {
                messageType = attachType;
              } else if (attachType === 'file') {
                messageType = 'document';
              }
              mediaUrl = attachment.payload?.url || '';
              if (!content) content = `[${messageType}]`;
            }

            if (!senderId || !content) continue;

            // Fetch sender's Instagram profile name (pass IG account ID to resolve via Page conversations)
            const senderProfile = await fetchUserProfile(senderId, instagramPageId, 'instagram');
            const senderName = senderProfile.username || senderProfile.name || senderId;

            console.log(`📸 Instagram DM from ${senderName} (${senderId}): ${content.substring(0, 80)}`);

            // Find or create channel by meta_page_id
            let { data: channel } = await supabase
              .from('messaging_channels')
              .select('*')
              .eq('meta_page_id', instagramPageId)
              .eq('channel_type', 'instagram')
              .maybeSingle();

            if (!channel) {
              // Auto-create channel for this Instagram page
              console.log(`📸 Auto-creating Instagram channel for page ${instagramPageId}`);
              const DEFAULT_ORG = 'cb497af2-3f29-4bb4-be53-91b7f19e5ffb';
              const { data: newChannel, error: createErr } = await supabase
                .from('messaging_channels')
                .insert({
                  organization_id: DEFAULT_ORG,
                  channel_type: 'instagram',
                  channel_name: `Instagram ${instagramPageId}`,
                  meta_page_id: instagramPageId,
                  is_active: true,
                  ai_enabled: true,
                  ai_config: { autoReply: true, aiProvider: 'openai' },
                })
                .select()
                .single();

              if (createErr) {
                console.error('❌ Failed to create Instagram channel:', createErr);
                continue;
              }
              channel = newChannel;
            }

            // Find or create conversation
            let { data: conversation } = await supabase
              .from('messaging_conversations')
              .select('*')
              .eq('channel_id', channel.id)
              .eq('external_user_id', senderId)
              .maybeSingle();

            if (!conversation) {
              const { data: newConvo, error: convoErr } = await supabase
                .from('messaging_conversations')
                .insert({
                  channel_id: channel.id,
                  organization_id: channel.organization_id,
                  channel_type: 'instagram',
                  external_user_id: senderId,
                  user_name: senderName,
                  user_identifier: senderProfile.username || senderId,
                  status: 'active',
                  ai_managed: true,
                  last_message_at: messageTimestamp,
                  last_message_preview: content.substring(0, 100),
                })
                .select()
                .single();

              if (convoErr) {
                console.error('❌ Failed to create Instagram conversation:', convoErr);
                continue;
              }
              conversation = newConvo;
            } else {
              // Conversation exists — update user_name if we resolved a better name (not just numeric ID)
              const currentName = conversation.user_name || '';
              const isNumericName = /^\d+$/.test(currentName);
              const isNumericSenderName = /^\d+$/.test(senderName);
              if ((isNumericName || !currentName) && !isNumericSenderName && senderName !== senderId) {
                console.log(`📸 Updating conversation username: "${currentName}" → "${senderName}"`);
                await supabase.from('messaging_conversations').update({
                  user_name: senderName,
                  user_identifier: senderProfile.username || senderId,
                }).eq('id', conversation.id);
                conversation.user_name = senderName;
              }
            }

            // Save inbound message (skip if already exists to prevent duplicates from webhook retries)
            const igMessageId = event.message?.mid || null;
            let skipMessage = false;

            if (igMessageId) {
              const { data: existingMsg } = await supabase
                .from('messaging_messages')
                .select('id')
                .eq('external_message_id', igMessageId)
                .maybeSingle();
              if (existingMsg) {
                console.log(`📸 Skipping duplicate Instagram message: ${igMessageId}`);
                skipMessage = true;
              }
            }

            if (!skipMessage) {
              await supabase.from('messaging_messages').insert({
                conversation_id: conversation.id,
                channel_type: 'instagram',
                direction: 'inbound',
                sender_type: 'user',
                content,
                message_type: messageType,
                external_message_id: igMessageId,
                media_url: mediaUrl || null,
                sent_at: messageTimestamp,
              });

              // Update conversation
              await supabase.from('messaging_conversations').update({
                last_message_at: messageTimestamp,
                last_message_preview: content.substring(0, 100),
                status: 'active',
              }).eq('id', conversation.id);

              console.log(`📸 Instagram DM saved to conversation ${conversation.id}`);

              // AI auto-reply (ONLY for non-duplicate messages to prevent multiple AI responses)
              await handleAIAutoReply(
                channel,
                conversation,
                content,
                'instagram',
                supabase,
                (text: string) => sendInstagramMessage(instagramPageId, senderId, text)
              );
            } else {
              console.log(`📸 Skipping AI reply for duplicate message ${igMessageId}`);
            }
          }
        }

        // ---------- Instagram Comments ----------
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field !== 'comments') continue;

            const commentData = change.value;
            if (!commentData) continue;

            const commentId = commentData.id;
            const commentText = commentData.text || '';
            const fromId = commentData.from?.id;
            const fromUsername = commentData.from?.username || fromId;
            const mediaId = commentData.media?.id;

            // Skip if the comment is from the page itself
            if (fromId === instagramPageId) {
              console.log('📸 Skipping own comment');
              continue;
            }

            if (!commentId || !commentText || !fromId) continue;

            console.log(`📸 Instagram comment from @${fromUsername}: ${commentText.substring(0, 80)}`);

            // Find or create channel
            let { data: channel } = await supabase
              .from('messaging_channels')
              .select('*')
              .eq('meta_page_id', instagramPageId)
              .eq('channel_type', 'instagram')
              .maybeSingle();

            if (!channel) {
              console.log(`📸 Auto-creating Instagram channel for page ${instagramPageId}`);
              const DEFAULT_ORG = 'cb497af2-3f29-4bb4-be53-91b7f19e5ffb';
              const { data: newChannel, error: createErr } = await supabase
                .from('messaging_channels')
                .insert({
                  organization_id: DEFAULT_ORG,
                  channel_type: 'instagram',
                  channel_name: `Instagram ${instagramPageId}`,
                  meta_page_id: instagramPageId,
                  is_active: true,
                  ai_enabled: true,
                  ai_config: { autoReply: true, aiProvider: 'openai' },
                })
                .select()
                .single();

              if (createErr) {
                console.error('❌ Failed to create Instagram channel:', createErr);
                continue;
              }
              channel = newChannel;
            }

            // For comments, use a special conversation keyed by fromId
            let { data: conversation } = await supabase
              .from('messaging_conversations')
              .select('*')
              .eq('channel_id', channel.id)
              .eq('external_user_id', fromId)
              .maybeSingle();

            if (!conversation) {
              const { data: newConvo, error: convoErr } = await supabase
                .from('messaging_conversations')
                .insert({
                  channel_id: channel.id,
                  organization_id: channel.organization_id,
                  channel_type: 'instagram',
                  external_user_id: fromId,
                  user_name: fromUsername,
                  status: 'active',
                  ai_managed: true,
                  last_message_at: new Date().toISOString(),
                  last_message_preview: commentText.substring(0, 100),
                })
                .select()
                .single();

              if (convoErr) {
                console.error('❌ Failed to create Instagram comment conversation:', convoErr);
                continue;
              }
              conversation = newConvo;
            }

            // Save inbound comment as message
            await supabase.from('messaging_messages').insert({
              conversation_id: conversation.id,
              channel_type: 'instagram',
              direction: 'inbound',
              sender_type: 'user',
              content: commentText,
              message_type: 'comment',
              external_message_id: commentId,
              metadata: { commentId, mediaId, username: fromUsername },
              sent_at: new Date().toISOString(),
            });

            // Update conversation
            await supabase.from('messaging_conversations').update({
              last_message_at: new Date().toISOString(),
              last_message_preview: `💬 ${commentText.substring(0, 80)}`,
              status: 'active',
            }).eq('id', conversation.id);

            console.log(`📸 Instagram comment saved to conversation ${conversation.id}`);

            // AI auto-reply to comment
            await handleAIAutoReply(
              channel,
              conversation,
              commentText,
              'instagram',
              supabase,
              (text: string) => replyToInstagramComment(commentId, text)
            );
          }
        }
      }
    }

    // ========== MESSENGER HANDLER ==========
    if (body.object === 'page') {
      console.log('💬 Messenger webhook received');

      for (const entry of body.entry || []) {
        const messengerPageId = entry.id; // Facebook Page ID

        if (!entry.messaging) continue;

        for (const event of entry.messaging) {
          // Skip echo messages (sent by the page itself)
          if (event.message?.is_echo) {
            console.log('💬 Skipping echo message');
            continue;
          }

          // Skip delivery/read receipts
          if (event.delivery || event.read) continue;

          const senderPsid = event.sender?.id;
          const messageText = event.message?.text || '';
          const tsRawMsg = parseInt(event.timestamp);
          const messageTimestamp = event.timestamp ? new Date(tsRawMsg > 10000000000 ? tsRawMsg : tsRawMsg * 1000).toISOString() : new Date().toISOString();

          // Determine message type and content
          let messageType = 'text';
          let content = messageText;
          let mediaUrl = '';

          if (event.message?.attachments && event.message.attachments.length > 0) {
            const attachment = event.message.attachments[0];
            const attachType = attachment.type; // image, video, audio, file, template, fallback
            if (['image', 'video', 'audio'].includes(attachType)) {
              messageType = attachType;
            } else if (attachType === 'file') {
              messageType = 'document';
            }
            mediaUrl = attachment.payload?.url || '';
            if (!content) content = `[${messageType}]`;
          }

          if (!senderPsid || !content) continue;

          // Fetch Messenger user profile name via Conversations API
          let senderName = senderPsid;
          try {
            const senderProfile = await fetchUserProfile(senderPsid, undefined, 'messenger');
            if (senderProfile.name && senderProfile.name !== senderPsid) {
              senderName = senderProfile.name;
              console.log(`💬 Messenger user profile: ${senderName}`);
            }
          } catch (e) {
            console.log('⚠️ Could not fetch Messenger user profile:', e);
          }

          console.log(`💬 Messenger message from ${senderName} (${senderPsid}): ${content.substring(0, 80)}`);

          // Find or create channel by meta_page_id
          let { data: channel } = await supabase
            .from('messaging_channels')
            .select('*')
            .eq('meta_page_id', messengerPageId)
            .eq('channel_type', 'messenger')
            .maybeSingle();

          if (!channel) {
            console.log(`💬 Auto-creating Messenger channel for page ${messengerPageId}`);
            const DEFAULT_ORG = 'cb497af2-3f29-4bb4-be53-91b7f19e5ffb';
            const { data: newChannel, error: createErr } = await supabase
              .from('messaging_channels')
              .insert({
                organization_id: DEFAULT_ORG,
                channel_type: 'messenger',
                channel_name: `Messenger ${messengerPageId}`,
                meta_page_id: messengerPageId,
                is_active: true,
                ai_enabled: true,
                ai_config: { autoReply: true, aiProvider: 'openai' },
              })
              .select()
              .single();

            if (createErr) {
              console.error('❌ Failed to create Messenger channel:', createErr);
              continue;
            }
            channel = newChannel;
          }

          // Find or create conversation
          let { data: conversation } = await supabase
            .from('messaging_conversations')
            .select('*')
            .eq('channel_id', channel.id)
            .eq('external_user_id', senderPsid)
            .maybeSingle();

          if (!conversation) {
            const { data: newConvo, error: convoErr } = await supabase
              .from('messaging_conversations')
              .insert({
                channel_id: channel.id,
                organization_id: channel.organization_id,
                channel_type: 'messenger',
                external_user_id: senderPsid,
                user_name: senderName,
                status: 'active',
                ai_managed: true,
                last_message_at: messageTimestamp,
                last_message_preview: content.substring(0, 100),
              })
              .select()
              .single();

            if (convoErr) {
              console.error('❌ Failed to create Messenger conversation:', convoErr);
              continue;
            }
            conversation = newConvo;
          } else {
            // Update name if conversation exists but has numeric ID as name
            const currentName = conversation.user_name;
            const isNumericName = /^\d+$/.test(currentName || '');
            if (isNumericName && senderName !== senderPsid) {
              console.log(`💬 Updating Messenger conversation username: "${currentName}" → "${senderName}"`);
              await supabase.from('messaging_conversations').update({ user_name: senderName }).eq('id', conversation.id);
              conversation.user_name = senderName;
            }
          }

          // Save inbound message (skip if already exists to prevent duplicates from webhook retries)
          const msgMessageId = event.message?.mid || null;
          let skipMsgMessage = false;

          if (msgMessageId) {
            const { data: existingMsgMsg } = await supabase
              .from('messaging_messages')
              .select('id')
              .eq('external_message_id', msgMessageId)
              .maybeSingle();
            if (existingMsgMsg) {
              console.log(`💬 Skipping duplicate Messenger message: ${msgMessageId}`);
              skipMsgMessage = true;
            }
          }

          if (!skipMsgMessage) {
            await supabase.from('messaging_messages').insert({
              conversation_id: conversation.id,
              channel_type: 'messenger',
              direction: 'inbound',
              sender_type: 'user',
              content,
              message_type: messageType,
              external_message_id: msgMessageId,
              media_url: mediaUrl || null,
              sent_at: messageTimestamp,
            });

            // Update conversation
            await supabase.from('messaging_conversations').update({
              last_message_at: messageTimestamp,
              last_message_preview: content.substring(0, 100),
              status: 'active',
            }).eq('id', conversation.id);

            console.log(`💬 Messenger message saved to conversation ${conversation.id}`);

            // AI auto-reply (ONLY for non-duplicate messages)
            await handleAIAutoReply(
              channel,
              conversation,
              content,
              'messenger',
              supabase,
              (text: string) => sendMessengerMessage(senderPsid, text)
            );
          } else {
            console.log(`💬 Skipping AI reply for duplicate Messenger message ${msgMessageId}`);
          }
        }

        // ---------- Facebook Page Comments (feed) ----------
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field !== 'feed') continue;

            const feedValue = change.value;
            if (!feedValue || feedValue.item !== 'comment') continue;

            // Skip if it's the page's own comment
            if (feedValue.from?.id === messengerPageId) {
              console.log('📘 Skipping own Facebook comment');
              continue;
            }

            const commentId = feedValue.comment_id;
            const commentText = feedValue.message || '';
            const fromId = feedValue.from?.id;
            const fromName = feedValue.from?.name || fromId;
            const postId = feedValue.post_id;

            if (!commentId || !commentText || !fromId) continue;

            console.log(`📘 Facebook comment from ${fromName}: ${commentText.substring(0, 80)}`);

            // Find or create Messenger channel (FB comments use same page)
            let { data: fbChannel } = await supabase
              .from('messaging_channels')
              .select('*')
              .eq('meta_page_id', messengerPageId)
              .eq('channel_type', 'messenger')
              .maybeSingle();

            if (!fbChannel) {
              console.log(`📘 Auto-creating Messenger channel for FB page ${messengerPageId}`);
              const DEFAULT_ORG = 'cb497af2-3f29-4bb4-be53-91b7f19e5ffb';
              const { data: newChannel, error: createErr } = await supabase
                .from('messaging_channels')
                .insert({
                  organization_id: DEFAULT_ORG,
                  channel_type: 'messenger',
                  channel_name: `Facebook ${messengerPageId}`,
                  meta_page_id: messengerPageId,
                  is_active: true,
                  ai_enabled: true,
                  ai_config: { autoReply: true, aiProvider: 'openai' },
                })
                .select()
                .single();

              if (createErr) {
                console.error('❌ Failed to create FB channel:', createErr);
                continue;
              }
              fbChannel = newChannel;
            }

            // Find or create conversation for this commenter
            let { data: fbConvo } = await supabase
              .from('messaging_conversations')
              .select('*')
              .eq('channel_id', fbChannel.id)
              .eq('external_user_id', fromId)
              .maybeSingle();

            if (!fbConvo) {
              const { data: newConvo, error: convoErr } = await supabase
                .from('messaging_conversations')
                .insert({
                  channel_id: fbChannel.id,
                  organization_id: fbChannel.organization_id,
                  channel_type: 'messenger',
                  external_user_id: fromId,
                  user_name: fromName,
                  status: 'active',
                  ai_managed: true,
                  last_message_at: new Date().toISOString(),
                  last_message_preview: commentText.substring(0, 100),
                })
                .select()
                .single();

              if (convoErr) {
                console.error('❌ Failed to create FB comment conversation:', convoErr);
                continue;
              }
              fbConvo = newConvo;
            }

            // Save inbound comment
            await supabase.from('messaging_messages').insert({
              conversation_id: fbConvo.id,
              channel_type: 'messenger',
              direction: 'inbound',
              sender_type: 'user',
              content: commentText,
              message_type: 'comment',
              external_message_id: commentId,
              metadata: { commentId, postId, fromName, source: 'facebook_comment' },
              sent_at: new Date().toISOString(),
            });

            // Update conversation
            await supabase.from('messaging_conversations').update({
              last_message_at: new Date().toISOString(),
              last_message_preview: `📘 ${commentText.substring(0, 80)}`,
              status: 'active',
            }).eq('id', fbConvo.id);

            console.log(`📘 Facebook comment saved to conversation ${fbConvo.id}`);

            // AI auto-reply to Facebook comment
            await handleAIAutoReply(
              fbChannel,
              fbConvo,
              commentText,
              'messenger',
              supabase,
              (text: string) => replyToFacebookComment(commentId, text)
            );
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('meta-webhook-openai error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
