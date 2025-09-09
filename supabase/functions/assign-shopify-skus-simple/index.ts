import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Params {
  // No parameters needed - process all variants
}

// Simple, fast SKU assignment:
// - Detects artificial SKUs (empty, SHOPIFY-, ID-, long numerics, numeric-V#)
// - Updates Shopify variant.sku to the variant.id
// - No DB dependencies, no user auth required
// - Returns a resume cursor (page_info) when more remains
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: Params = await req.json().catch(() => ({}))
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

    const isArtificialSku = (sku: string | null | undefined) => {
      if (!sku || sku.trim() === '') return true
      const patterns = [
        /^SHOPIFY-/i,
        /^ID-/i,
        /^\d{13,20}$/,
        /^\d{13,20}-V\d+$/,
        /^[A-Z0-9]{10,}-\d+$/,
      ]
      return patterns.some((p) => p.test(sku))
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
      url.searchParams.set('status', 'active,draft')
      if (nextCursor) url.searchParams.set('page_info', nextCursor)

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
          if (!isArtificialSku(variant.sku)) continue

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
          } else {
            errorVariants++
          }
          // Small pacing to be gentle with Shopify API
          await new Promise((r) => setTimeout(r, 200))
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
      ? `✅ Proceso completado: Se asignaron ${updatedVariants} SKUs automáticamente. Errores: ${errorVariants}. Total de productos revisados: ${productsScanned}.`
      : `✅ Proceso completado: No se encontraron variantes con SKU artificial. Total de productos revisados: ${productsScanned}.`

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
