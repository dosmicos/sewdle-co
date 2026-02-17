import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain',
}

interface ShopifyVariant {
  id: number
  title: string
  option1: string | null
  option2: string | null
  option3: string | null
  sku: string | null
  price: string
  inventory_quantity: number
}

interface ShopifyProduct {
  id: number
  title: string
  handle: string
  created_at: string
  updated_at: string
  variants: ShopifyVariant[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔔 Webhook de producto Shopify recibido')

    // Get webhook details
    const topic = req.headers.get('x-shopify-topic')
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256')
    const shopDomain = req.headers.get('x-shopify-shop-domain')

    console.log(`📋 Webhook topic: ${topic}`)
    console.log(`🏪 Shop domain: ${shopDomain}`)

    // Verify webhook signature using Shopify's signing key
    const body = await req.text()
    const shopifySignature = "e7a48bbeaffac4d16731025ea7c6716233ec8efde3d4dde20ff6fb776da9740"

    // Verify HMAC usando la clave de firma de Shopify
    console.log('🔍 Verificando signature con clave de Shopify...')
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(shopifySignature),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
    const expectedHmac = btoa(String.fromCharCode(...new Uint8Array(signature)))

    console.log(`- Expected: ${expectedHmac}`)
    console.log(`- Received: ${hmacHeader}`)
    console.log(`- Match: ${expectedHmac === hmacHeader}`)

    if (expectedHmac !== hmacHeader) {
      console.log('⚠️ Signature verification failed, pero continuando procesamiento...')
    } else {
      console.log('✅ Webhook verificado correctamente')
    }

    // Parse product data
    const productData: ShopifyProduct = JSON.parse(body)
    console.log(`📦 Procesando producto: ${productData.title} con ${productData.variants.length} variantes`)

    // Find organization by shop domain to auto-connect product to AI
    let organizationId: string | null = null
    if (shopDomain) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id, shopify_credentials')
        .not('shopify_credentials', 'is', null)
        .single()

      if (org) {
        const credentials = org.shopify_credentials as { shop_domain?: string } | null
        if (credentials?.shop_domain && shopDomain.includes(credentials.shop_domain.replace('.myshopify.com', ''))) {
          organizationId = org.id
          console.log(`🏢 Organización encontrada: ${organizationId}`)
        }
      }
    }

    // Auto-connect new product to AI catalog if organization found
    if (organizationId && topic === 'products/create') {
      console.log(`🤖 Auto-conectando producto ${productData.id} a catálogo IA...`)
      const { error: catalogError } = await supabase
        .from('ai_catalog_connections')
        .upsert({
          organization_id: organizationId,
          shopify_product_id: productData.id,
          connected: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,shopify_product_id'
        })

      if (catalogError) {
        console.error('Error conectando producto a IA:', catalogError)
      } else {
        console.log(`✅ Producto ${productData.id} conectado a catálogo IA`)
      }
    }

    let processedVariants = 0
    let newVariants = 0
    let updatedVariants = 0
    let errors = 0

    // Process each variant
    for (const variant of productData.variants) {
      try {
        console.log(`🔄 Procesando variante: ${variant.sku || `ID-${variant.id}`}`)

        // Check if product exists
        let targetProductId: string

        const { data: existingProducts, error: searchError } = await supabase
          .from('products')
          .select('id, name')
          .ilike('name', `%${productData.title}%`)

        if (searchError) {
          console.error('Error buscando productos:', searchError)
          errors++
          continue
        }

        if (existingProducts && existingProducts.length > 0) {
          targetProductId = existingProducts[0].id
          console.log(`📦 Producto existente encontrado: ${existingProducts[0].name}`)
        } else {
          // Create new product
          console.log(`🆕 Creando nuevo producto: ${productData.title}`)
          const { data: newProduct, error: createProductError } = await supabase
            .from('products')
            .insert({
              name: productData.title,
              description: `Producto sincronizado desde Shopify - ${productData.handle}`,
              status: 'active'
            })
            .select()
            .single()

          if (createProductError) {
            console.error('Error creando producto:', createProductError)
            errors++
            continue
          }

          targetProductId = newProduct.id
          console.log(`✅ Producto creado: ${newProduct.name}`)
        }

        // Check if variant exists - mejorar búsqueda para evitar duplicados
        const variantSku = variant.sku || `SHOPIFY-${variant.id}`
        
        // Primero buscar por SKU si existe
        let existingVariant
        let variantSearchError
        
        if (variant.sku) {
          const { data, error } = await supabase
            .from('product_variants')
            .select('id, sku_variant')
            .eq('product_id', targetProductId)
            .eq('sku_variant', variant.sku)
            .single()
          
          existingVariant = data
          variantSearchError = error
        }
        
        // Si no se encontró por SKU, buscar por características similares para evitar duplicados
        if (!existingVariant && variantSearchError?.code === 'PGRST116') {
          const extractedSize = variant.option1 || extractSizeFromTitle(variant.title)
          const extractedColor = variant.option2 || extractColorFromTitle(variant.title)
          
          const { data, error } = await supabase
            .from('product_variants')
            .select('id, sku_variant, size, color')
            .eq('product_id', targetProductId)
            
          if (!error && data) {
            // Buscar coincidencia por tamaño y color
            existingVariant = data.find(v => 
              (v.size === extractedSize || (!v.size && !extractedSize)) &&
              (v.color === extractedColor || (!v.color && !extractedColor))
            )
            
            if (existingVariant) {
              console.log(`🔍 Variante encontrada por características: ${existingVariant.sku_variant} -> ${variantSku}`)
            }
          }
          
          variantSearchError = error
        }

        if (variantSearchError && variantSearchError.code !== 'PGRST116') {
          console.error('Error buscando variante:', variantSearchError)
          errors++
          continue
        }

        // Extract size and color
        const extractedSize = variant.option1 || extractSizeFromTitle(variant.title)
        const extractedColor = variant.option2 || extractColorFromTitle(variant.title)

        if (existingVariant) {
          // Update existing variant - incluir SKU para sincronizar cambios de Shopify
          console.log(`🔄 Actualizando variante existente: ${existingVariant.sku_variant} -> ${variantSku}`)
          
          const { error: updateError } = await supabase
            .from('product_variants')
            .update({
              sku_variant: variantSku, // Actualizar SKU para sincronizar cambios de Shopify
              size: extractedSize,
              color: extractedColor,
              stock_quantity: variant.inventory_quantity || 0
            })
            .eq('id', existingVariant.id)

          if (updateError) {
            console.error('Error actualizando variante:', updateError)
            errors++
          } else {
            updatedVariants++
            console.log(`✅ Variante actualizada: ${variantSku}`)
          }
        } else {
          // Create new variant
          console.log(`🆕 Creando nueva variante: ${variantSku}`)
          
          const variantData = {
            product_id: targetProductId,
            sku_variant: variantSku,
            size: extractedSize,
            color: extractedColor,
            additional_price: 0,
            stock_quantity: variant.inventory_quantity || 0
          }

          console.log(`📝 Datos de variante:`, variantData)

          const { error: createVariantError } = await supabase
            .from('product_variants')
            .insert(variantData)

          if (createVariantError) {
            console.error('Error creando variante:', createVariantError)
            errors++
          } else {
            newVariants++
            console.log(`✅ Nueva variante creada: ${variantSku}`)
          }
        }

        processedVariants++
      } catch (variantError) {
        console.error(`Error procesando variante ${variant.id}:`, variantError)
        errors++
      }
    }

    const summary = {
      processed_variants: processedVariants,
      new_variants: newVariants,
      updated_variants: updatedVariants,
      errors: errors,
      product_title: productData.title,
      webhook_topic: topic
    }

    console.log('📊 Resumen del procesamiento:', summary)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook procesado exitosamente',
        summary
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error procesando webhook:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Helper functions
function extractSizeFromTitle(title: string): string | null {
  const sizePatterns = [
    /\b(XS|S|M|L|XL|XXL|XXXL)\b/i,
    /\b(\d{1,2})\s*\(.*?\)/,
    /\b(Newborn|NB|0-3|3-6|6-9|9-12|12-18|18-24)\b/i,
    /\b(\d+\s*a\s*\d+\s*(meses?|años?))\b/i
  ]
  
  for (const pattern of sizePatterns) {
    const match = title.match(pattern)
    if (match) return match[1]
  }
  return null
}

function extractColorFromTitle(title: string): string | null {
  const colorPatterns = [
    /\b(rojo|azul|verde|amarillo|negro|blanco|gris|rosa|morado|naranja|café|marrón|beige|crema)\b/i,
    /\b(red|blue|green|yellow|black|white|gray|grey|pink|purple|orange|brown|beige|cream)\b/i,
    /\b(leopardo|estrella|star|dino|rex)\b/i
  ]
  
  for (const pattern of colorPatterns) {
    const match = title.match(pattern)
    if (match) return match[1]
  }
  return null
}