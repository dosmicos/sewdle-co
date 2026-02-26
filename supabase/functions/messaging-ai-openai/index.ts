import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

// Remove product image tags from response
function cleanAIResponse(aiResponse: string): string {
  return aiResponse.replace(/\[PRODUCT_IMAGE_ID:\d+\]/g, '').trim();
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, messages, systemPrompt, organizationId } = body;
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    // Handle test-connection action - just verify API key exists without making calls
    if (action === 'test-connection') {
      console.log("messaging-ai-openai: Testing connection for org:", organizationId);
      
      if (!OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({ connected: false, error: "OPENAI_API_KEY is not configured" }), 
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Optionally verify the API key is valid by making a simple models list request
      try {
        const modelsResponse = await fetch("https://api.openai.com/v1/models", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
        });
        
        if (modelsResponse.ok) {
          return new Response(
            JSON.stringify({ connected: true, success: true }), 
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const errorText = await modelsResponse.text();
          console.error("OpenAI API key validation failed:", modelsResponse.status, errorText);
          return new Response(
            JSON.stringify({ connected: false, error: "API Key inválida" }), 
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (fetchError) {
        console.error("Error validating OpenAI API key:", fetchError);
        return new Response(
          JSON.stringify({ connected: false, error: "Error al validar API Key" }), 
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("messaging-ai-openai: Processing request for org:", organizationId);
    console.log("messaging-ai-openai: Messages received:", messages?.length || 0);
    console.log("messaging-ai-openai: User message:", messages?.[messages?.length - 1]?.content || 'none');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Load AI config (knowledge base, rules, etc.) from messaging_channels
    let knowledgeContext = '';
    let rulesContext = '';
    let savedSystemPrompt = '';
    let toneConfig = '';

    if (organizationId) {
      try {
        const { data: channel, error: channelError } = await supabase
          .from('messaging_channels')
          .select('ai_config')
          .eq('organization_id', organizationId)
          .eq('channel_type', 'whatsapp')
          .order('is_active', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (channelError) {
          console.error("Error loading channel config:", channelError);
        } else if (channel?.ai_config) {
          const aiConfig = channel.ai_config as any;
          
          // Get saved system prompt
          if (aiConfig.systemPrompt) {
            savedSystemPrompt = aiConfig.systemPrompt;
            console.log("Loaded saved system prompt");
          }

          // Get tone
          if (aiConfig.tone) {
            const toneMap: Record<string, string> = {
              'friendly': 'Usa un tono amigable y cercano. Puedes usar emojis ocasionalmente.',
              'formal': 'Usa un tono formal y respetuoso.',
              'casual': 'Usa un tono casual y relajado. Usa emojis libremente.',
              'professional': 'Usa un tono profesional y directo.'
            };
            toneConfig = toneMap[aiConfig.tone] || '';
            console.log("Loaded tone:", aiConfig.tone);
          }

          // Get rules
          if (aiConfig.rules?.length > 0) {
            rulesContext = '\n\n📋 REGLAS ESPECIALES:\n';
            aiConfig.rules.forEach((rule: any) => {
              if (rule.condition && rule.response) {
                rulesContext += `- Cuando el usuario mencione "${rule.condition}": ${rule.response}\n`;
              }
            });
            console.log(`Loaded ${aiConfig.rules.length} rules`);
          }

          // Get knowledge base
          if (aiConfig.knowledgeBase?.length > 0) {
            knowledgeContext = '\n\n📚 CONOCIMIENTO DE LA EMPRESA:\nUSA ESTA INFORMACIÓN para responder a las preguntas de los clientes:\n';
            aiConfig.knowledgeBase.forEach((item: any) => {
              if (item.category === 'product') {
                // Product knowledge
                const name = item.productName || item.title || '';
                if (name && item.content) {
                  knowledgeContext += `\n📦 Producto: ${name}`;
                  if (item.recommendWhen) {
                    knowledgeContext += `\n   Recomendar cuando: ${item.recommendWhen}`;
                  }
                  knowledgeContext += `\n   Detalles: ${item.content}\n`;
                }
              } else if (item.title && item.content) {
                // General knowledge (new format)
                knowledgeContext += `\n📋 ${item.title}:\n   ${item.content}\n`;
              } else if (item.question && item.answer) {
                // Legacy Q&A format
                knowledgeContext += `\nP: ${item.question}\nR: ${item.answer}\n`;
              }
            });
            console.log(`Loaded ${aiConfig.knowledgeBase.length} knowledge items`);
          }
        }
      } catch (err) {
        console.error("Error loading AI config:", err);
      }
    }

    // Load products with Shopify inventory if organizationId is provided
    let productCatalog = '';
    let shopifyCredentials: any = null;
    let productImageMap: Record<number, { url: string; title: string }> = {}; // Map Shopify ID -> image URL + title
    
    if (organizationId) {
      try {
        // First, get connected product IDs from ai_catalog_connections
        const { data: connections } = await supabase
          .from('ai_catalog_connections')
          .select('shopify_product_id')
          .eq('organization_id', organizationId)
          .eq('connected', true);

        const connectedProductIds = new Set(connections?.map(c => c.shopify_product_id) || []);
        console.log(`Found ${connectedProductIds.size} connected products for AI`);

        // Get organization's Shopify credentials
        const { data: org } = await supabase
          .from('organizations')
          .select('shopify_credentials')
          .eq('id', organizationId)
          .single();

        shopifyCredentials = org?.shopify_credentials;

        interface ShopifyVariant {
          id: number;
          sku: string;
          title: string;
          price: string;
          inventory_quantity: number;
        }

        interface ShopifyProduct {
          id: number;
          title: string;
          body_html?: string;
          product_type?: string;
          variants: ShopifyVariant[];
          image?: { src: string };
          images?: { src: string }[];
        }
        
        // Fetch real-time inventory from Shopify if credentials exist
        if (shopifyCredentials) {
          const creds = shopifyCredentials as any;
          const shopifyDomain = creds.store_domain || creds.shopDomain;
          const accessToken = creds.access_token || creds.accessToken;
          
          if (shopifyDomain && accessToken) {
            try {
              console.log("Fetching Shopify products with inventory...");
              
              // Fetch products with inventory from Shopify
              const shopifyResponse = await fetch(
                `https://${shopifyDomain}/admin/api/2024-01/products.json?status=active&limit=250`,
                {
                  headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json',
                  },
                }
              );
              
              if (shopifyResponse.ok) {
                const shopifyData = await shopifyResponse.json();
                const shopifyProducts: ShopifyProduct[] = shopifyData.products || [];
                
                // Filter to only connected products
                const connectedProducts = shopifyProducts.filter(
                  p => connectedProductIds.size === 0 || connectedProductIds.has(p.id)
                );
                
                if (connectedProducts.length > 0) {
                  productCatalog = '\n\n📦 CATÁLOGO DE PRODUCTOS DISPONIBLES:\n';
                  productCatalog += 'IMPORTANTE: Solo ofrece productos que tengan stock disponible (Stock > 0). Si un producto no tiene stock, indica que está agotado.\n\n';
                  productCatalog += '⚠️ REGLA OBLIGATORIA DE IMÁGENES - DEBES SEGUIR ESTO SIEMPRE:\n';
                  productCatalog += 'CADA VEZ que menciones un producto por su nombre, DEBES agregar el tag [PRODUCT_IMAGE_ID:ID] inmediatamente después.\n';
                  productCatalog += 'Esto es OBLIGATORIO, no opcional. Los clientes esperan ver fotos de los productos.\n\n';
                  productCatalog += 'Formato correcto (SIEMPRE usa este formato):\n';
                  productCatalog += '"1. Ruana Caballo [PRODUCT_IMAGE_ID:8842923606251] - Precio: $94.900 COP"\n';
                  productCatalog += '"2. Ruana Capibara [PRODUCT_IMAGE_ID:8842934517995] - Precio: $94.900 COP"\n\n';
                  productCatalog += 'Formato INCORRECTO (NO hagas esto):\n';
                  productCatalog += '"1. Ruana Caballo - Precio: $94.900 COP" (falta el tag de imagen)\n\n';
                  productCatalog += 'Puedes incluir hasta 10 productos con imágenes en una sola respuesta.\n\n';
                  
                  connectedProducts.forEach((product) => {
                    const variants = product.variants || [];
                    const totalStock = variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0);
                    
                    // Store image URL and title in map
                    const imageUrl = product.image?.src || product.images?.[0]?.src;
                    if (imageUrl) {
                      productImageMap[product.id] = { url: imageUrl, title: product.title };
                    }
                    
                    // Skip products with no stock
                    if (totalStock === 0) {
                      productCatalog += `• ${product.title} (ID:${product.id}): ❌ AGOTADO (no ofrecer)\n`;
                      return;
                    }
                    
                    const price = variants[0]?.price 
                      ? `$${Number(variants[0].price).toLocaleString('es-CO')} COP` 
                      : 'Consultar';
                    
                    const variantInfo = variants
                      .map(v => {
                        const stock = v.inventory_quantity || 0;
                        const stockStatus = stock > 0 ? `✅ ${stock}` : '❌';
                        return `${v.title} (variantId:${v.id}): ${stockStatus}`;
                      })
                      .join(' | ');
                    
                    // Clean HTML from description
                    const cleanDescription = product.body_html 
                      ? product.body_html.replace(/<[^>]*>/g, '').substring(0, 100) 
                      : '';
                    
                    productCatalog += `\n• ${product.title} (ID:${product.id})`;
                    productCatalog += `\n  Precio: ${price}`;
                    productCatalog += `\n  Variantes: ${variantInfo}`;
                    if (product.product_type) {
                      productCatalog += `\n  Categoría: ${product.product_type}`;
                    }
                    if (cleanDescription) {
                      productCatalog += `\n  ${cleanDescription}`;
                    }
                    productCatalog += '\n';
                  });
                  
                  console.log(`Loaded ${connectedProducts.length} connected products with real-time Shopify inventory`);
                  console.log(`Product image map has ${Object.keys(productImageMap).length} entries`);
                }
              } else {
                console.error("Shopify API error:", shopifyResponse.status);
              }
            } catch (shopifyErr) {
              console.error("Error fetching Shopify products:", shopifyErr);
            }
          }
        }

        // Fallback to local products if no Shopify data
        if (!productCatalog) {
          const { data: products, error: productsError } = await supabase
            .from('products')
            .select(`
              name, 
              sku, 
              base_price, 
              category,
              description,
              product_variants (id, size, color, stock_quantity, sku_variant)
            `)
            .eq('organization_id', organizationId)
            .eq('status', 'active')
            .limit(50);

          if (!productsError && products && products.length > 0) {
            productCatalog = '\n\n📦 CATÁLOGO DE PRODUCTOS DISPONIBLES:\n';
            productCatalog += 'IMPORTANTE: Solo ofrece productos que tengan stock disponible.\n';
            
            products.forEach((p: any) => {
              const price = p.base_price 
                ? `$${Number(p.base_price).toLocaleString('es-CO')} COP` 
                : 'Precio: Consultar';
              
              const variants = p.product_variants
                ?.map((v: any) => {
                  const size = v.size || '';
                  const color = v.color || '';
                  const stock = v.stock_quantity || 0;
                  const stockStatus = stock > 0 ? `✅ ${stock} unidades` : '❌ Agotado';
                  return `${size}${color ? ` ${color}` : ''}: ${stockStatus}`;
                })
                .join(' | ') || 'Sin variantes';
              
              productCatalog += `\n• ${p.name}`;
              productCatalog += `\n  Precio: ${price}`;
              productCatalog += `\n  Disponibilidad: ${variants}`;
              productCatalog += '\n';
            });
            
            console.log(`Loaded ${products.length} local products for context`);
          }
        }
      } catch (err) {
        console.error("Error loading products:", err);
      }
    }

    // Build the full system prompt with all context
    // Priority: saved prompt > provided prompt > default
    const basePrompt = savedSystemPrompt || systemPrompt || "Eres un asistente virtual amigable. Responde siempre en español.";
    
    let fullSystemPrompt = basePrompt;
    
    // Add MANDATORY image instruction at the beginning - very emphatic
    fullSystemPrompt += '\n\n⚠️ REGLA CRÍTICA - SIEMPRE INCLUIR IMÁGENES:\nCada vez que menciones CUALQUIER producto por su nombre, DEBES agregar inmediatamente después el tag [PRODUCT_IMAGE_ID:ID_DEL_PRODUCTO].\nEsto es OBLIGATORIO para TODOS los productos que menciones, sin excepción.\nEjemplo correcto: "La Ruana Caballo [PRODUCT_IMAGE_ID:123] tiene un precio de $94.900 COP"\nSi no incluyes los tags, los clientes NO podrán ver las fotos de los productos.';
    
    if (toneConfig) {
      fullSystemPrompt += `\n\n${toneConfig}`;
    }
    
    fullSystemPrompt += knowledgeContext;
    fullSystemPrompt += rulesContext;
    fullSystemPrompt += productCatalog;
    
    // Add shipping policy (critical for correct order creation)
    fullSystemPrompt += `\n\n📦 POLÍTICA DE ENVÍOS DOSMICOS — DEBES calcular y agregar el costo de envío a CADA pedido:

ENVÍO GRATIS desde $150.000 en casi todo Colombia (excepto zonas remotas).

BOGOTÁ:
- Estándar: $3.000 (1-3 días hábiles) → GRATIS si pedido ≥ $150.000
- Express: $14.000 (12 horas) → NO aplica envío gratis, NO pago contra entrega, solo pago anticipado

MEDELLÍN Y RESTO DE ANTIOQUIA: $5.000 → GRATIS desde $150.000

ZONA 1 — $5.000 / GRATIS desde $150.000:
Atlántico, Bolívar, Boyacá, Caldas, Cauca, Cesar, Córdoba, Cundinamarca, Guaviare, Huila, Magdalena, Meta, Nariño, Norte de Santander, Putumayo, Quindío, Risaralda, Santander, Sucre, Tolima, Valle del Cauca

ZONA 2 — $6.000 / GRATIS desde $150.000:
Arauca, Caquetá, Casanare

ZONA 3 — $10.000 (SIN envío gratis):
La Guajira

ZONA 4 — $22.000 (SIN envío gratis):
Amazonas, Vaupés, Vichada

ZONA 5 — $30.000 (SIN envío gratis):
Guainía, Archipiélago de San Andrés, Providencia y Santa Catalina

REGLAS OBLIGATORIAS PARA CREAR PEDIDOS:
1. SIEMPRE preguntar la ciudad y departamento ANTES de crear el pedido
2. Calcular el costo de envío según la zona del departamento
3. Si el total de productos ≥ $150.000 Y la zona aplica envío gratis → shippingCost = 0
4. SIEMPRE informar al cliente el desglose (productos + envío = total) ANTES de crear el pedido
5. Express Bogotá: NO acepta pago contra entrega, debe pagar anticipadamente
6. Pasar el campo shippingCost con el valor correcto al llamar create_order
7. Si el cliente NO especifica express, asumir envío estándar`;

    // Add size/talla validation rules
    fullSystemPrompt += `\n\n👕 REGLA DE TALLAS — OBLIGATORIO ANTES DE CREAR PEDIDO:
1. NUNCA crear un pedido sin confirmar la talla/variante con el cliente
2. Si el producto tiene variantes/tallas (aparecen en el catálogo como "Talla X (variantId:123)"), SIEMPRE preguntar cuál quiere ANTES de crear el pedido
3. Si el cliente dice solo la edad del bebé/niño, recomienda la talla apropiada y CONFIRMA con el cliente antes de proceder
4. Usa el variantId correcto del catálogo al llamar create_order — el variantId es el número que aparece entre paréntesis junto a cada talla
5. Si el cliente no menciona talla y el producto tiene múltiples tallas, PREGUNTA antes de continuar
6. Si el producto solo tiene una variante (ej: "Default Title"), puedes usar esa directamente sin preguntar
7. FLUJO CORRECTO: Recopilar datos del cliente → Preguntar talla → Confirmar pedido → Crear pedido con variantId correcto`;

    // Add data collection rules for orders (cedula + no IDs)
    fullSystemPrompt += `\n\n🆔 REGLA DE DATOS PARA PEDIDOS — OBLIGATORIO:
- NUNCA pidas al cliente el ID del producto ni el variantId, ellos NO conocen estos datos técnicos
- TÚ debes identificar el productId y variantId del catálogo usando el NOMBRE del producto que el cliente menciona
- Ejemplo: si dice "quiero la ruana del caballo talla M", busca "Ruana Caballo" en el catálogo, usa su ID y el variantId de Talla M
- SIEMPRE pide la cédula de ciudadanía del cliente antes de crear el pedido

📝 DATOS OBLIGATORIOS que debes recopilar antes de crear un pedido:
1. Nombre completo
2. Cédula de ciudadanía
3. Correo electrónico
4. Teléfono
5. Dirección completa
6. Ciudad y departamento
7. Producto y talla confirmados (TÚ resuelves los IDs internamente del catálogo, NUNCA se los pidas al cliente)`;

    // Add order status lookup instructions
    fullSystemPrompt += `\n\n📋 CONSULTA DE ESTADO DE PEDIDOS:
- Si el cliente pregunta por el estado de su pedido, envío o compra, usa la función lookup_order_status
- PRIMERO pide al cliente su número de pedido O el correo electrónico con el que hizo la compra
- Si el cliente no proporciona ninguno de los dos, PREGUNTA antes de buscar
- Muestra toda la información relevante: estado de pago, estado de envío, y tracking si existe
- Si hay número de seguimiento, compártelo junto con la transportadora
- Sé empático y claro al comunicar el estado del pedido`;

    // Add final reminder at the end of prompt (recency effect - models pay more attention to end)
    fullSystemPrompt += '\n\n🔔 RECORDATORIO FINAL:\n- NO olvides incluir [PRODUCT_IMAGE_ID:ID] después de CADA nombre de producto que menciones.\n- NUNCA crear un pedido sin preguntar la talla si el producto tiene múltiples variantes/tallas.\n- SIEMPRE pasar el variantId correcto del catálogo al crear el pedido.\n- NUNCA pidas IDs de producto al cliente. Resuelve productId y variantId del catálogo internamente.\n- SIEMPRE pide la cédula de ciudadanía antes de crear el pedido.\n- Si preguntan por un pedido, usa lookup_order_status con el número de pedido o correo.';

    console.log("Full system prompt length:", fullSystemPrompt.length);
    console.log("Calling OpenAI GPT-4o-mini with", messages?.length || 0, "messages");

    // Function definitions for order creation and payment
    const functions = [
      {
        name: "create_order",
        description: "Crea un pedido en Shopify cuando el cliente proporciona todos los datos necesarios para la compra",
        parameters: {
          type: "object",
          properties: {
            customerName: { type: "string", description: "Nombre completo del cliente" },
            cedula: { type: "string", description: "Número de cédula de ciudadanía del cliente" },
            email: { type: "string", description: "Correo electrónico del cliente" },
            phone: { type: "string", description: "Número de teléfono del cliente" },
            address: { type: "string", description: "Dirección de envío completa" },
            city: { type: "string", description: "Ciudad de envío" },
            department: { type: "string", description: "Departamento de envío" },
            neighborhood: { type: "string", description: "Barrio (opcional)" },
            productId: { type: "number", description: "ID numérico del producto en Shopify. NO pedir al cliente. Obtener del catálogo usando el nombre del producto que el cliente menciona." },
            variantId: { type: "number", description: "ID numérico del variante/talla en Shopify. NO pedir al cliente. Obtener del catálogo usando la talla que el cliente elige." },
            quantity: { type: "number", description: "Cantidad (default 1)" },
            notes: { type: "string", description: "Notas adicionales (opcional)" },
            shippingCost: { type: "number", description: "Costo de envío en COP calculado según la política de envíos. Si aplica envío gratis (pedido ≥$150.000 en zonas elegibles), pasar 0." }
          },
          required: ["customerName", "cedula", "email", "phone", "address", "city", "department", "productId", "variantId", "shippingCost"]
        }
      },
      {
        name: "create_payment_link",
        description: "Crea un link de pago con Bold después de que se haya creado un pedido. Usa esta función SOLO después de haber creado el pedido.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Monto total del pedido en pesos colombianos (COP)" },
            description: { type: "string", description: "Descripción del pago (ej: Pedido #123 - Dosmicos)" },
            customerEmail: { type: "string", description: "Correo electrónico del cliente" },
            orderId: { type: "number", description: "ID del pedido en Shopify (opcional)" }
          },
          required: ["amount", "description", "customerEmail"]
        }
      },
      {
        name: "lookup_order_status",
        description: "Busca el estado de un pedido existente por número de pedido o correo electrónico del cliente. Devuelve estado de pago, envío y tracking si existe.",
        parameters: {
          type: "object",
          properties: {
            orderNumber: { type: "string", description: "Número de pedido (ej: 1234 o #1234)" },
            email: { type: "string", description: "Correo electrónico del cliente para buscar su pedido más reciente" }
          }
        }
      }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...(messages || []),
        ],
        functions: functions,
        function_call: "auto",
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes de OpenAI excedido. Intenta en unos segundos." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "API key de OpenAI inválida." }), 
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Error en el servicio de OpenAI" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // Check if AI wants to call a function
    const functionCall = data.choices?.[0]?.message?.function_call;
    
    if (functionCall) {
      console.log("AI wants to call function:", functionCall.name);
      
      if (functionCall.name === "create_order") {
        try {
          const orderArgs = JSON.parse(functionCall.arguments);
          console.log("Creating order with args:", orderArgs);
          
          // Call the create-shopify-order function
          const { data: orderResult, error: orderError } = await supabase.functions.invoke('create-shopify-order', {
            body: {
              orderData: {
                customerName: orderArgs.customerName,
                cedula: orderArgs.cedula || '',
                email: orderArgs.email,
                phone: orderArgs.phone,
                address: orderArgs.address,
                city: orderArgs.city,
                department: orderArgs.department,
                neighborhood: orderArgs.neighborhood || '',
                productId: orderArgs.productId,
                variantId: orderArgs.variantId || undefined,
                quantity: orderArgs.quantity || 1,
                notes: orderArgs.notes || '',
                shippingCost: orderArgs.shippingCost || 0
              },
              organizationId: organizationId
            }
          });
          
          if (orderError) {
            console.error("Order creation error:", orderError);
            return new Response(
              JSON.stringify({ 
                response: "Lo siento, hubo un error al crear tu pedido. Por favor intenta de nuevo o contáctanos directamente.",
                order_created: false,
                error: orderError.message
              }), 
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          console.log("Order created successfully:", orderResult);
          
          // Auto-create payment link after order creation
          console.log("Auto-creating payment link...");
          
          const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('create-bold-payment-link', {
            body: {
              amount: Math.round(Number(orderResult.totalPrice)),
              description: `Pedido #${orderResult.orderNumber} - Dosmicos`,
              customerEmail: orderArgs.email || orderArgs.customerName,
              orderId: orderResult.orderId,
              organizationId: organizationId
            }
          });
          
          let paymentLinkText = "";
          let paymentUrl = "";
          
          if (paymentError) {
            console.error("Payment link error:", paymentError);
            paymentLinkText = "\n\n⚠️ El link de pago no pudo ser generado automáticamente. Por favor contacta al soporte.";
          } else {
            console.log("Payment link created:", paymentResult);
            paymentUrl = paymentResult.paymentUrl;
            paymentLinkText = `\n\n💳 **TU LINK DE PAGO:**\n${paymentUrl}\n\nHaz clic para pagar con tarjeta, PSE, Nequi, Daviplata y más métodos de pago.`;
          }
          
          const responseText = `¡Perfecto! Tu pedido ha sido creado exitosamente! 🎉\n\n` +
            `📋 Número de pedido: #${orderResult.orderNumber}\n` +
            `💰 Total: $${Number(orderResult.totalPrice).toLocaleString('es-CO')} COP\n\n` +
            paymentLinkText;
          
          return new Response(
            JSON.stringify({ 
              response: responseText,
              order_created: true,
              orderId: orderResult.orderId,
              orderNumber: orderResult.orderNumber,
              paymentUrl: paymentUrl
            }), 
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
          
        } catch (err) {
          console.error("Error parsing function call:", err);
        }
      }
      
      // Handle create_payment_link function
      if (functionCall.name === "create_payment_link") {
        try {
          const paymentArgs = JSON.parse(functionCall.arguments);
          console.log("Creating payment link with args:", paymentArgs);
          
          // Call the create-bold-payment-link function
          const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('create-bold-payment-link', {
            body: {
              amount: paymentArgs.amount,
              description: paymentArgs.description,
              customerEmail: paymentArgs.customerEmail,
              orderId: paymentArgs.orderId,
              organizationId: organizationId
            }
          });
          
          if (paymentError) {
            console.error("Payment link error:", paymentError);
            return new Response(
              JSON.stringify({ 
                response: "Lo siento, hubo un error al crear el link de pago. Por favor intenta de nuevo.",
                payment_link_created: false,
                error: paymentError.message
              }), 
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          console.log("Payment link created:", paymentResult);
          
          const responseText = `¡Tu link de pago está listo! 💳\n\n` +
            `Monto: $${Number(paymentArgs.amount).toLocaleString('es-CO')} COP\n\n` +
            `Haz clic en el siguiente enlace para pagar:\n${paymentResult.paymentUrl}\n\n` +
            `🎯 El link de pago incluye todos los métodos de pago: Tarjeta de crédito, PSE, Nequi, Daviplata, y más.\n\n` +
            `Una vez realizado el pago, recibirás la confirmación automáticamente.`;
          
          return new Response(
            JSON.stringify({ 
              response: responseText,
              payment_link_created: true,
              paymentUrl: paymentResult.paymentUrl,
              paymentLinkId: paymentResult.paymentLinkId
            }), 
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
          
        } catch (err) {
          console.error("Error parsing payment function call:", err);
        }
      }

      // Handle order status lookup
      if (functionCall.name === "lookup_order_status") {
        try {
          const lookupArgs = JSON.parse(functionCall.arguments);
          console.log("Looking up order status with args:", lookupArgs);

          if (!lookupArgs.orderNumber && !lookupArgs.email) {
            return new Response(
              JSON.stringify({
                response: "Para consultar el estado de tu pedido necesito tu número de pedido o el correo electrónico con el que realizaste la compra. ¿Podrías proporcionarme alguno de los dos?"
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          let orderData: any = null;

          // Step A: Search in local shopify_orders table first
          if (lookupArgs.orderNumber) {
            const normalized = lookupArgs.orderNumber.replace('#', '').trim();
            console.log(`🔍 Searching order by number: ${normalized}`);

            const { data: orders } = await supabase
              .from('shopify_orders')
              .select('shopify_order_id, order_number, financial_status, fulfillment_status, total_price, created_at_shopify, customer_email, customer_first_name, customer_last_name, shipping_address, order_status_url')
              .eq('organization_id', organizationId)
              .or(`order_number.eq.${normalized},order_number.eq.#${normalized}`)
              .limit(1);

            if (orders && orders.length > 0) {
              orderData = orders[0];
              console.log(`✅ Found order in local DB: #${orderData.order_number}`);
            }
          } else if (lookupArgs.email) {
            console.log(`🔍 Searching order by email: ${lookupArgs.email}`);

            const { data: orders } = await supabase
              .from('shopify_orders')
              .select('shopify_order_id, order_number, financial_status, fulfillment_status, total_price, created_at_shopify, customer_email, customer_first_name, customer_last_name, shipping_address, order_status_url')
              .eq('organization_id', organizationId)
              .eq('customer_email', lookupArgs.email.toLowerCase().trim())
              .order('created_at_shopify', { ascending: false })
              .limit(1);

            if (orders && orders.length > 0) {
              orderData = orders[0];
              console.log(`✅ Found order in local DB by email: #${orderData.order_number}`);
            }
          }

          // Step B: Fallback to Shopify API if not found locally
          if (!orderData && shopifyCredentials) {
            const creds = shopifyCredentials as any;
            const shopifyDomain = creds.store_domain || creds.shopDomain;
            const shopifyToken = creds.access_token || creds.accessToken;

            if (shopifyDomain && shopifyToken) {
              try {
                let shopifyUrl = '';
                if (lookupArgs.orderNumber) {
                  const normalized = lookupArgs.orderNumber.replace('#', '').trim();
                  shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/orders.json?name=%23${normalized}&status=any&limit=1`;
                } else if (lookupArgs.email) {
                  shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/orders.json?email=${encodeURIComponent(lookupArgs.email.trim())}&status=any&limit=1`;
                }

                console.log(`🔍 Fallback: Searching Shopify API: ${shopifyUrl}`);
                const shopifyResp = await fetch(shopifyUrl, {
                  headers: {
                    'X-Shopify-Access-Token': shopifyToken,
                    'Content-Type': 'application/json',
                  },
                });

                if (shopifyResp.ok) {
                  const shopifyData = await shopifyResp.json();
                  const shopifyOrders = shopifyData.orders || [];
                  if (shopifyOrders.length > 0) {
                    const o = shopifyOrders[0];
                    orderData = {
                      shopify_order_id: o.id,
                      order_number: o.order_number || o.name,
                      financial_status: o.financial_status,
                      fulfillment_status: o.fulfillment_status,
                      total_price: o.total_price,
                      created_at_shopify: o.created_at,
                      customer_email: o.email,
                      customer_first_name: o.customer?.first_name || '',
                      customer_last_name: o.customer?.last_name || '',
                      shipping_address: o.shipping_address,
                      order_status_url: o.order_status_url,
                      // Extract fulfillment tracking from Shopify directly
                      fulfillments: o.fulfillments || [],
                    };
                    console.log(`✅ Found order via Shopify API: #${orderData.order_number}`);
                  }
                } else {
                  console.error(`❌ Shopify API error: ${shopifyResp.status}`);
                }
              } catch (shopifyErr) {
                console.error("Error fetching from Shopify API:", shopifyErr);
              }
            }
          }

          // Step C: If still no order found
          if (!orderData) {
            const searchTerm = lookupArgs.orderNumber ? `número #${lookupArgs.orderNumber}` : `correo ${lookupArgs.email}`;
            return new Response(
              JSON.stringify({
                response: `No encontré ningún pedido con ${searchTerm}. ¿Podrías verificar el dato e intentar de nuevo? También puedes probar con tu ${lookupArgs.orderNumber ? 'correo electrónico' : 'número de pedido'}.`
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Step D: Search for tracking info in shipping_labels
          let trackingInfo: any = null;
          const { data: label } = await supabase
            .from('shipping_labels')
            .select('tracking_number, carrier, status')
            .eq('shopify_order_id', orderData.shopify_order_id)
            .eq('organization_id', organizationId)
            .maybeSingle();

          if (label?.tracking_number) {
            trackingInfo = { ...label };

            // Step E: Get live tracking from Envia
            try {
              console.log(`📍 Getting live tracking for ${label.tracking_number}...`);
              const { data: trackResult, error: trackError } = await supabase.functions.invoke('envia-track', {
                body: {
                  tracking_number: label.tracking_number,
                  carrier: label.carrier
                }
              });

              if (!trackError && trackResult?.success) {
                trackingInfo.live_status = trackResult.status;
                trackingInfo.last_event = trackResult.events?.[trackResult.events.length - 1]?.description || null;
                trackingInfo.estimated_delivery = trackResult.estimated_delivery || null;
                console.log(`✅ Live tracking: ${trackResult.status}`);
              }
            } catch (trackErr) {
              console.error("Error getting live tracking:", trackErr);
            }
          }

          // Also check Shopify fulfillment tracking (from API fallback)
          if (!trackingInfo && orderData.fulfillments?.length > 0) {
            const fulfillment = orderData.fulfillments[orderData.fulfillments.length - 1];
            if (fulfillment.tracking_number) {
              trackingInfo = {
                tracking_number: fulfillment.tracking_number,
                carrier: fulfillment.tracking_company || 'Transportadora',
                status: fulfillment.status || 'in_transit',
                tracking_url: fulfillment.tracking_url || null,
              };
            }
          }

          // Step F: Build formatted response
          const orderNum = String(orderData.order_number).replace('#', '');
          const financialMap: Record<string, string> = {
            'paid': '✅ Pagado',
            'pending': '⏳ Pendiente de pago',
            'partially_paid': '⚠️ Parcialmente pagado',
            'refunded': '↩️ Reembolsado',
            'voided': '❌ Anulado',
            'authorized': '🔄 Autorizado (pendiente de captura)',
          };
          const fulfillmentMap: Record<string, string> = {
            'fulfilled': '📦 Enviado',
            'partial': '📦 Parcialmente enviado',
            'unfulfilled': '🏭 En preparación',
            'null': '🏭 En preparación',
          };

          const paymentStatus = financialMap[orderData.financial_status] || `Estado: ${orderData.financial_status || 'desconocido'}`;
          const fulfillmentStatus = fulfillmentMap[orderData.fulfillment_status || 'null'] || fulfillmentMap['null'];
          const total = orderData.total_price ? `$${Number(orderData.total_price).toLocaleString('es-CO')} COP` : 'N/A';

          let responseText = `📦 *Pedido #${orderNum}*\n\n`;
          responseText += `💰 Pago: ${paymentStatus}\n`;
          responseText += `🚚 Envío: ${fulfillmentStatus}\n`;
          responseText += `💵 Total: ${total}\n`;

          if (trackingInfo) {
            const trackingStatusMap: Record<string, string> = {
              'delivered': '✅ Entregado',
              'in_transit': '🚚 En tránsito',
              'created': '📋 Guía creada',
              'returned': '↩️ Devuelto',
              'exception': '⚠️ Novedad',
              'pending': '⏳ Pendiente de recolección',
              'cancelled': '❌ Cancelado',
            };
            const liveStatus = trackingInfo.live_status || trackingInfo.status;
            const statusText = trackingStatusMap[liveStatus] || `Estado: ${liveStatus}`;

            responseText += `\n📍 *Tracking:*\n`;
            responseText += `- Guía: ${trackingInfo.tracking_number}\n`;
            responseText += `- Transportadora: ${trackingInfo.carrier}\n`;
            responseText += `- Estado: ${statusText}\n`;

            if (trackingInfo.last_event) {
              responseText += `- Último evento: ${trackingInfo.last_event}\n`;
            }
            if (trackingInfo.estimated_delivery) {
              responseText += `- Entrega estimada: ${trackingInfo.estimated_delivery}\n`;
            }
            if (trackingInfo.tracking_url) {
              responseText += `\n🔗 Rastrea tu envío aquí: ${trackingInfo.tracking_url}\n`;
            }
          } else if (orderData.fulfillment_status !== 'fulfilled') {
            responseText += `\n📌 Tu pedido aún no ha sido despachado. Te notificaremos cuando sea enviado con el número de seguimiento.`;
          }

          if (orderData.order_status_url) {
            responseText += `\n\n🔗 Ver detalles completos: ${orderData.order_status_url}`;
          }

          console.log(`✅ Order status response built for #${orderNum}`);

          return new Response(
            JSON.stringify({
              response: responseText,
              order_lookup: true,
              orderNumber: orderNum,
              financialStatus: orderData.financial_status,
              fulfillmentStatus: orderData.fulfillment_status
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );

        } catch (err) {
          console.error("Error in lookup_order_status:", err);
          return new Response(
            JSON.stringify({
              response: "Lo siento, hubo un error al consultar el estado de tu pedido. Por favor intenta de nuevo en unos momentos."
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const rawAiResponse = data.choices?.[0]?.message?.content || "";
    
    console.log("OpenAI raw response:", rawAiResponse.substring(0, 200) + "...");

    // Extract ALL product IDs and clean response
    const productIds = extractProductIdsFromResponse(rawAiResponse);
    const cleanedResponse = cleanAIResponse(rawAiResponse);
    
    console.log(`Found ${productIds.length} product IDs in response:`, productIds);
    
    // Build product images array
    const productImages: Array<{ product_id: number; image_url: string; product_name: string }> = [];
    
    for (const productId of productIds) {
      let imageUrl: string | null = null;
      let productName = '';
      
      // First check our cached map
      if (productImageMap[productId]) {
        imageUrl = productImageMap[productId].url;
        productName = productImageMap[productId].title;
        console.log(`Found image in cache for product ${productId}: ${productName}`);
      } else if (shopifyCredentials) {
        // Fetch from Shopify if not in cache
        imageUrl = await fetchShopifyProductImage(productId, shopifyCredentials);
        productName = `Producto ${productId}`;
      }
      
      if (imageUrl) {
        // Cache the image in Supabase Storage for reliable delivery
        const cachedUrl = await cacheImageToStorage(imageUrl, productId, organizationId, supabase);
        
        productImages.push({
          product_id: productId,
          image_url: cachedUrl || imageUrl,
          product_name: productName
        });
        
        console.log(`Added image for product ${productId}: ${productName}`);
      } else {
        console.log(`No image found for product ${productId}`);
      }
    }
    
    console.log(`Returning ${productImages.length} product images`);

    return new Response(
      JSON.stringify({ 
        response: cleanedResponse,
        product_images: productImages,
        // Keep legacy fields for backwards compatibility
        product_image_url: productImages[0]?.image_url || null,
        product_id: productIds[0] || null
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("messaging-ai-openai error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
