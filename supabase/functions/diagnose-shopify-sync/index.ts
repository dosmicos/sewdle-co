
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Obtener credenciales de Shopify
    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!shopifyDomain || !shopifyToken) {
      throw new Error('Credenciales de Shopify no configuradas')
    }

    console.log('Iniciando diagnóstico de sincronización Shopify')

    // Obtener todos los productos locales con sus variantes
    const { data: localProducts, error: localError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        product_variants (
          id,
          sku_variant,
          size,
          color
        )
      `)

    if (localError) {
      throw new Error(`Error obteniendo productos locales: ${localError.message}`)
    }

    console.log(`Productos locales encontrados: ${localProducts.length}`)

    // Obtener todos los productos de Shopify
    const shopifyProducts = []
    let hasNextPage = true
    let pageInfo = null

    while (hasNextPage) {
      const url = new URL(`https://${shopifyDomain}/admin/api/2023-10/products.json`)
      url.searchParams.set('limit', '250')
      if (pageInfo) url.searchParams.set('page_info', pageInfo)

      const response = await fetch(url.toString(), {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Error obteniendo productos de Shopify: ${response.status}`)
      }

      const data = await response.json()
      shopifyProducts.push(...data.products)

      // Verificar si hay más páginas
      const linkHeader = response.headers.get('Link')
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
        pageInfo = match ? match[1] : null
      } else {
        hasNextPage = false
      }
    }

    console.log(`Productos de Shopify encontrados: ${shopifyProducts.length}`)

    // Crear mapas de SKUs de Shopify
    const shopifySkuMap = new Map()
    const shopifyProductMap = new Map()

    shopifyProducts.forEach(product => {
      shopifyProductMap.set(product.id, product)
      product.variants.forEach(variant => {
        if (variant.sku) {
          shopifySkuMap.set(variant.sku, {
            productId: product.id,
            productTitle: product.title,
            variantId: variant.id,
            variantTitle: variant.title,
            inventory: variant.inventory_quantity
          })
        }
      })
    })

    // Análisis de productos locales
    const analysis = {
      localProducts: localProducts.length,
      shopifyProducts: shopifyProducts.length,
      matchedSkus: [],
      unmatchedSkus: [],
      duplicateSkus: [],
      emptySkus: [],
      formatIssues: []
    }

    // Verificar cada producto local
    localProducts.forEach(product => {
      if (!product.sku) {
        analysis.emptySkus.push({
          productId: product.id,
          productName: product.name,
          issue: 'SKU principal vacío'
        })
        return
      }

      // Verificar SKU principal
      if (shopifySkuMap.has(product.sku)) {
        analysis.matchedSkus.push({
          localSku: product.sku,
          productName: product.name,
          shopifyData: shopifySkuMap.get(product.sku)
        })
      } else {
        analysis.unmatchedSkus.push({
          localSku: product.sku,
          productName: product.name,
          type: 'product'
        })
      }

      // Verificar variantes
      if (product.product_variants) {
        product.product_variants.forEach(variant => {
          if (!variant.sku_variant) {
            analysis.emptySkus.push({
              productId: product.id,
              productName: product.name,
              variantId: variant.id,
              issue: `SKU variante vacío (${variant.size || 'Sin talla'} - ${variant.color || 'Sin color'})`
            })
            return
          }

          if (shopifySkuMap.has(variant.sku_variant)) {
            analysis.matchedSkus.push({
              localSku: variant.sku_variant,
              productName: product.name,
              variantInfo: `${variant.size || ''} - ${variant.color || ''}`,
              shopifyData: shopifySkuMap.get(variant.sku_variant)
            })
          } else {
            analysis.unmatchedSkus.push({
              localSku: variant.sku_variant,
              productName: product.name,
              variantInfo: `${variant.size || ''} - ${variant.color || ''}`,
              type: 'variant'
            })
          }
        })
      }
    })

    // Detectar patrones de SKU
    const localSkus = []
    localProducts.forEach(product => {
      if (product.sku) localSkus.push(product.sku)
      if (product.product_variants) {
        product.product_variants.forEach(variant => {
          if (variant.sku_variant) localSkus.push(variant.sku_variant)
        })
      }
    })

    const shopifySkus = Array.from(shopifySkuMap.keys())

    // Análisis de patrones
    const patterns = {
      localPatterns: analyzeSkuPatterns(localSkus),
      shopifyPatterns: analyzeSkuPatterns(shopifySkus),
      suggestions: []
    }

    // Generar sugerencias
    if (analysis.unmatchedSkus.length > 0) {
      patterns.suggestions.push({
        type: 'missing_products',
        message: `${analysis.unmatchedSkus.length} SKUs locales no encontrados en Shopify`,
        action: 'Verificar si estos productos existen en Shopify con SKUs diferentes'
      })
    }

    if (analysis.emptySkus.length > 0) {
      patterns.suggestions.push({
        type: 'empty_skus',
        message: `${analysis.emptySkus.length} productos/variantes sin SKU`,
        action: 'Asignar SKUs a estos productos antes de sincronizar'
      })
    }

    const result = {
      success: true,
      analysis,
      patterns,
      summary: {
        totalLocalProducts: localProducts.length,
        totalShopifyProducts: shopifyProducts.length,
        matchedSkus: analysis.matchedSkus.length,
        unmatchedSkus: analysis.unmatchedSkus.length,
        emptySkus: analysis.emptySkus.length,
        matchRate: localSkus.length > 0 ? (analysis.matchedSkus.length / localSkus.length * 100).toFixed(2) : 0
      }
    }

    console.log('Diagnóstico completado:', result.summary)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error en diagnóstico:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function analyzeSkuPatterns(skus) {
  const patterns = {
    prefixes: {},
    lengths: {},
    formats: {},
    examples: skus.slice(0, 10)
  }

  skus.forEach(sku => {
    // Analizar prefijos (primeros 3-4 caracteres)
    const prefix = sku.substring(0, Math.min(4, sku.length))
    patterns.prefixes[prefix] = (patterns.prefixes[prefix] || 0) + 1

    // Analizar longitudes
    const length = sku.length
    patterns.lengths[length] = (patterns.lengths[length] || 0) + 1

    // Analizar formatos (letras, números, guiones)
    let format = sku.replace(/[A-Za-z]/g, 'A').replace(/[0-9]/g, '9').replace(/[^A9-]/g, 'X')
    patterns.formats[format] = (patterns.formats[format] || 0) + 1
  })

  return patterns
}
