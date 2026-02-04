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
    // Step 1: media info (temp URL)
    const infoController = new AbortController();
    const infoTimeout = setTimeout(() => infoController.abort(), DOWNLOAD_TIMEOUT_MS);
    let infoResponse: Response;
    try {
      infoResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: infoController.signal,
      });
    } finally {
      clearTimeout(infoTimeout);
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

    // Step 2: download binary
    const downloadController = new AbortController();
    const downloadTimeout = setTimeout(() => downloadController.abort(), DOWNLOAD_TIMEOUT_MS);
    let mediaResponse: Response;
    try {
      mediaResponse = await fetch(mediaInfo.url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: downloadController.signal,
      });
    } finally {
      clearTimeout(downloadTimeout);
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

🖼️ ENVÍO DE IMÁGENES - MUY IMPORTANTE:
SÍ puedes y DEBES enviar fotos de productos. Cuando recomiendes productos o el cliente pida ver fotos:
- Incluye UN tag [PRODUCT_IMAGE_ID:ID] por CADA producto que menciones
- Puedes incluir hasta 10 productos con imágenes
- Ejemplo: "Te recomiendo el Sleeping Bag Pollito [PRODUCT_IMAGE_ID:123] y la Ruana Pony [PRODUCT_IMAGE_ID:456]"
- NUNCA digas que no puedes mostrar imágenes.`,

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
  context += '🔔 RECUERDA: Incluye [PRODUCT_IMAGE_ID:ID] después de CADA producto que menciones.\n\n';

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
      systemPrompt += '\n\n🔔 RECORDATORIO FINAL: NO olvides incluir [PRODUCT_IMAGE_ID:ID] después de CADA nombre de producto que menciones. Esta es tu función más importante para ayudar a los clientes a ver los productos.';
    }

    // 🤖 LOG: Context sent to AI
    console.log(`🤖 Contexto enviado a IA: ${systemPrompt.substring(0, 500)}...`);

    // Build conversation history for context
    const historyMessages = conversationHistory.slice(-10).map((msg: any) => ({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content || ''
    }));

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
    
    // Extract product IDs from explicit tags, and fallback to matching titles
    let productIds = extractProductIdsFromResponse(rawAiResponse);

    if (productIds.length === 0) {
      const inferred = inferProductIdsFromMentionedNames(rawAiResponse, productImageMap);
      if (inferred.length > 0) {
        console.log('No [PRODUCT_IMAGE_ID] tags found; inferred product IDs from titles:', inferred);
        productIds = inferred;
      }
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
                content = message.image?.caption || '[Imagen]';
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

              // Generate and send AI response if enabled (check both channel and conversation level)
              const aiEnabledOnChannel = channel.ai_enabled !== false;
              // ai_managed: true = AI responds, false = manual control, null = default to channel setting
              const aiEnabledOnConversation = conversation.ai_managed !== false;
              
              console.log(`AI status check - Channel: ${aiEnabledOnChannel}, Conversation ai_managed: ${conversation.ai_managed}, Will respond: ${aiEnabledOnChannel && aiEnabledOnConversation}`);
              
              if (aiEnabledOnChannel && aiEnabledOnConversation && content && messageType === 'text') {
                console.log('AI is enabled (channel + conversation), generating response...');
                
                // Get conversation history for context
                const { data: historyMessages } = await supabase
                  .from('messaging_messages')
                  .select('*')
                  .eq('conversation_id', conversation.id)
                  .order('sent_at', { ascending: false })
                  .limit(10);

                // Generate AI response with multiple product image support
                const aiResult = await generateAIResponse(
                  content,
                  (historyMessages || []).reverse(),
                  channel.ai_config,
                  channel.organization_id,
                  supabase,
                  shopifyCredentials
                );

                if (aiResult.text) {
                  // Send the text response via WhatsApp
                  const sent = await sendWhatsAppMessage(
                    senderPhone, 
                    aiResult.text, 
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
                        content: aiResult.text,
                        message_type: 'text',
                        sent_at: new Date().toISOString(),
                      });

                    // Update conversation last message
                    await supabase
                      .from('messaging_conversations')
                      .update({
                        last_message_at: new Date().toISOString(),
                        last_message_preview: aiResult.text.substring(0, 100),
                      })
                      .eq('id', conversation.id);

                    console.log('AI response sent and saved');
                    
                    // Send ALL product images (up to 10)
                    if (aiResult.productImages && aiResult.productImages.length > 0) {
                      console.log(`Sending ${aiResult.productImages.length} product images...`);
                      
                      for (const img of aiResult.productImages) {
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
                      
                      console.log(`All ${aiResult.productImages.length} product images processed`);
                    }
                  }
                } else {
                  console.log('No AI response generated');
                }
              }
            }
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
