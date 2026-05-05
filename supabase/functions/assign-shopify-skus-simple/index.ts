import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Params {
  mode?: 'empty-only' | 'artificial'; // 'empty-only' (default) or 'artificial'
}

// Intelligent SKU assignment system:
// - Mode 'empty-only': Only fills completely empty SKUs (safe, fast)
// - Mode 'artificial': Also replaces SHOPIFY- and ID- prefixed SKUs
// - Updates Shopify variant.sku to the variant.id
// - No DB dependencies, no user auth required
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: Params = await req.json().catch(() => ({}))
    const mode = body.mode || 'empty-only' // Default to safe mode
    
    console.log(`🚀 Starting SKU assignment in mode: ${mode}`)
    
    // Process all variants without limits
    let pageCursor: string | null = null

    const rawShopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!rawShopifyDomain || !shopifyToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan credenciales de Shopify' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const shopifyDomain = rawShopifyDomain.includes('.myshopify.com')
      ? rawShopifyDomain.replace('.myshopify.com', '')
      : rawShopifyDomain

    const needsSkuAssignment = (sku: string | null | undefined, mode: string) => {
      // Always handle empty SKUs
      if (!sku || sku.trim() === '') return true
      
      // In artificial mode, also handle SHOPIFY- and ID- prefixes
      if (mode === 'artificial') {
        const artificialPatterns = [
          /^SHOPIFY-/i,
          /^ID-/i,
        ]
        return artificialPatterns.some((p) => p.test(sku))
      }
      
      // In empty-only mode, only handle truly empty SKUs
      return false
    }

    const makeShopifyRequest = async (url: string, options: RequestInit, retries = 3): Promise<Response> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        const res = await fetch(url, options)
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After')
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
        if (res.ok) return res
        if (attempt === retries) return res
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }
      return new Response(null, { status: 500 })
    }

    let processedVariants = 0
    let updatedVariants = 0
    let errorVariants = 0
    let productsScanned = 0
    let nextCursor: string | null = pageCursor
    let hasNext = true

    // Process ALL products without limits
    while (hasNext) {
      const url = new URL(`https://${shopifyDomain}.myshopify.com/admin/api/2023-10/products.json`)
      url.searchParams.set('limit', '50')
      
      // Only set status filter on first request, not during pagination
      if (nextCursor) {
        url.searchParams.set('page_info', nextCursor)
      } else {
        url.searchParams.set('status', 'active,draft')
      }

      const listRes = await makeShopifyRequest(url.toString(), {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
      })
      if (!listRes.ok) {
        const text = await listRes.text()
        throw new Error(`Shopify list error: ${listRes.status} - ${text}`)
      }
      const data = await listRes.json()
      const products = data.products || []
      productsScanned += products.length

      for (const product of products) {
        for (const variant of product.variants || []) {
          if (!needsSkuAssignment(variant.sku, mode)) continue

          processedVariants++
          const newSku = String(variant.id)
          const updateUrl = `https://${shopifyDomain}.myshopify.com/admin/api/2023-10/variants/${variant.id}.json`
          const updateRes = await makeShopifyRequest(updateUrl, {
            method: 'PUT',
            headers: {
              'X-Shopify-Access-Token': shopifyToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ variant: { id: variant.id, sku: newSku } }),
          })

          if (updateRes.ok) {
            updatedVariants++
            console.log(`✅ Updated variant ${variant.id}: ${variant.sku} -> ${newSku}`)
          } else {
            errorVariants++
            console.log(`❌ Failed to update variant ${variant.id}: ${updateRes.status}`)
          }
          // Only add delay if we hit rate limit, otherwise process quickly
        }
      }

      const linkHeader = listRes.headers.get('Link')
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
        nextCursor = match ? match[1] : null
      } else {
        hasNext = false
        nextCursor = null
      }
    }

    const message = updatedVariants > 0
      ? `✅ Proceso completado en modo ${mode}: Se asignaron ${updatedVariants} SKUs automáticamente. Errores: ${errorVariants}. Total de productos revisados: ${productsScanned}.`
      : `✅ Proceso completado en modo ${mode}: No se encontraron variantes que necesiten SKUs. Total de productos revisados: ${productsScanned}.`

    return new Response(
      JSON.stringify({
        success: true,
        status: 'completed',
        summary: {
          processedVariants,
          updatedVariants,
          errorVariants,
          productsScanned,
        },
        message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('assign-shopify-skus-simple error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
