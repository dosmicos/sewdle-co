
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

    console.log('Iniciando diagnóstico MEJORADO de sincronización Shopify')

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

    // Obtener todos los productos de Shopify con información completa
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

    // Crear mapas mejorados de SKUs de Shopify
    const shopifySkuMap = new Map()
    const shopifyProductMap = new Map()
    const shopifyProductsByTitle = new Map()
    const shopifySkusByProductId = new Map()

    shopifyProducts.forEach(product => {
      shopifyProductMap.set(product.id, product)
      shopifyProductsByTitle.set(product.title.toLowerCase(), product)
      
      const productSkus = []
      product.variants.forEach(variant => {
        if (variant.sku) {
          shopifySkuMap.set(variant.sku, {
            productId: product.id,
            productTitle: product.title,
            variantId: variant.id,
            variantTitle: variant.title,
            inventory: variant.inventory_quantity
          })
          productSkus.push(variant.sku)
        }
      })
      shopifySkusByProductId.set(product.id, productSkus)
    })

    // Análisis mejorado de productos locales
    const analysis = {
      localProducts: localProducts.length,
      shopifyProducts: shopifyProducts.length,
      matchedSkus: [],
      unmatchedSkus: [],
      duplicateSkus: [],
      emptySkus: [],
      formatIssues: [],
      titleMatches: [], // NUEVO: productos que coinciden por título pero no por SKU
      potentialMatches: [] // NUEVO: posibles coincidencias por similitud
    }

    // Detectar SKUs artificiales y mapear con productos originales de Shopify
    localProducts.forEach(product => {
      if (!product.sku) {
        analysis.emptySkus.push({
          productId: product.id,
          productName: product.name,
          issue: 'SKU principal vacío'
        })
        return
      }

      // NUEVO: Verificar si es un SKU artificial (contiene guiones y timestamp)
      const isArtificialSku = product.sku.includes('-') && product.sku.split('-').length > 2
      
      // Verificar SKU principal exacto
      if (shopifySkuMap.has(product.sku)) {
        analysis.matchedSkus.push({
          localSku: product.sku,
          productName: product.name,
          shopifyData: shopifySkuMap.get(product.sku),
          matchType: 'exact'
        })
      } else {
        // NUEVO: Si no hay coincidencia exacta, buscar por título de producto
        const shopifyProductByTitle = shopifyProductsByTitle.get(product.name.toLowerCase())
        
        if (shopifyProductByTitle && shopifyProductByTitle.variants?.length > 0) {
          analysis.titleMatches.push({
            localSku: product.sku,
            productName: product.name,
            isArtificial: isArtificialSku,
            shopifyProduct: {
              id: shopifyProductByTitle.id,
              title: shopifyProductByTitle.title,
              originalSku: shopifyProductByTitle.variants[0].sku || null
            },
            suggestedAction: isArtificialSku ? 'Reemplazar SKU artificial con SKU original de Shopify' : 'Verificar diferencia de SKUs'
          })
        } else {
          analysis.unmatchedSkus.push({
            localSku: product.sku,
            productName: product.name,
            type: 'product',
            isArtificial: isArtificialSku
          })
        }
      }

      // Verificar variantes con lógica mejorada
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

          const isArtificialVariantSku = variant.sku_variant.includes('-') && variant.sku_variant.split('-').length > 2

          if (shopifySkuMap.has(variant.sku_variant)) {
            analysis.matchedSkus.push({
              localSku: variant.sku_variant,
              productName: product.name,
              variantInfo: `${variant.size || ''} - ${variant.color || ''}`,
              shopifyData: shopifySkuMap.get(variant.sku_variant),
              matchType: 'exact'
            })
          } else {
            analysis.unmatchedSkus.push({
              localSku: variant.sku_variant,
              productName: product.name,
              variantInfo: `${variant.size || ''} - ${variant.color || ''}`,
              type: 'variant',
              isArtificial: isArtificialVariantSku
            })
          }
        })
      }
    })

    // Generar patrones mejorados
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

    const patterns = {
      localPatterns: analyzeSkuPatterns(localSkus),
      shopifyPatterns: analyzeSkuPatterns(shopifySkus),
      suggestions: []
    }

    // Generar sugerencias mejoradas
    if (analysis.titleMatches.length > 0) {
      patterns.suggestions.push({
        type: 'title_matches',
        message: `${analysis.titleMatches.length} productos coinciden por nombre pero tienen SKUs diferentes`,
        action: 'Usar la herramienta de corrección de SKUs para actualizar con SKUs originales de Shopify',
        priority: 'high'
      })
    }

    if (analysis.unmatchedSkus.filter(item => item.isArtificial).length > 0) {
      patterns.suggestions.push({
        type: 'artificial_skus',
        message: `${analysis.unmatchedSkus.filter(item => item.isArtificial).length} SKUs artificiales detectados`,
        action: 'Ejecutar corrección automática de SKUs para usar los originales de Shopify',
        priority: 'high'
      })
    }

    if (analysis.unmatchedSkus.length > 0) {
      patterns.suggestions.push({
        type: 'missing_products',
        message: `${analysis.unmatchedSkus.length} SKUs locales no encontrados en Shopify`,
        action: 'Verificar si estos productos existen en Shopify con SKUs diferentes o crear los productos faltantes',
        priority: 'medium'
      })
    }

    if (analysis.emptySkus.length > 0) {
      patterns.suggestions.push({
        type: 'empty_skus',
        message: `${analysis.emptySkus.length} productos/variantes sin SKU`,
        action: 'Asignar SKUs a estos productos antes de sincronizar',
        priority: 'medium'
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
        titleMatches: analysis.titleMatches.length,
        artificialSkus: analysis.unmatchedSkus.filter(item => item.isArtificial).length + analysis.titleMatches.filter(item => item.isArtificial).length,
        matchRate: localSkus.length > 0 ? (analysis.matchedSkus.length / localSkus.length * 100).toFixed(2) : 0
      }
    }

    console.log('Diagnóstico MEJORADO completado:', result.summary)

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
    examples: skus.slice(0, 10),
    artificialCount: 0
  }

  skus.forEach(sku => {
    // Detectar SKUs artificiales
    if (sku.includes('-') && sku.split('-').length > 2) {
      patterns.artificialCount++
    }

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
