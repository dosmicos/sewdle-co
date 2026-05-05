import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { organization_id } = await req.json().catch(() => ({}))

    console.log('🖼️ Starting Shopify image sync (images only)...')

    const rawShopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!rawShopifyDomain || !shopifyToken) {
      throw new Error('Shopify credentials not configured')
    }

    const shopifyDomain = rawShopifyDomain.includes('.myshopify.com')
      ? rawShopifyDomain.replace('.myshopify.com', '')
      : rawShopifyDomain

    // 1. Fetch all Shopify products with images and variant SKUs via GraphQL
    const skuToImage = new Map<string, string>()
    const productNameToImage = new Map<string, string>()
    let cursor: string | null = null
    let hasNextPage = true
    let shopifyProductCount = 0

    while (hasNextPage) {
      const query = `
        query getProducts($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            edges {
              node {
                title
                featuredImage { url }
                images(first: 1) { edges { node { url } } }
                variants(first: 100) {
                  edges {
                    node {
                      sku
                      image { url }
                    }
                  }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `

      const response = await fetch(`https://${shopifyDomain}.myshopify.com/admin/api/2024-07/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyToken,
        },
        body: JSON.stringify({ query, variables: { first: 100, after: cursor } })
      })

      const data = await response.json()
      if (data.errors) throw new Error(`Shopify API error: ${data.errors[0].message}`)

      const edges = data.data.products.edges
      for (const edge of edges) {
        const node = edge.node
        const productImage = node.featuredImage?.url || node.images?.edges?.[0]?.node?.url || null
        shopifyProductCount++

        if (!productImage) continue

        // Map product name → image
        productNameToImage.set(node.title.toLowerCase().trim(), productImage)

        // Map each variant SKU → image (prefer variant-specific image, fallback to product image)
        for (const ve of node.variants.edges) {
          const sku = ve.node.sku?.trim()
          if (sku) {
            const variantImage = ve.node.image?.url || productImage
            skuToImage.set(sku, variantImage)
          }
        }
      }

      hasNextPage = data.data.products.pageInfo.hasNextPage
      cursor = data.data.products.pageInfo.endCursor
    }

    console.log(`📦 Fetched ${shopifyProductCount} Shopify products, ${skuToImage.size} SKU→image mappings`)

    // 2. Update products table — find products without images (null OR empty string) and match by name
    let productsFixed = 0

    // Fetch ALL products and filter in JS (covers both null and empty string)
    const { data: allProducts, error: prodErr } = await supabase
      .from('products')
      .select('id, name, image_url')

    if (prodErr) {
      console.error('Error fetching products:', prodErr)
    } else if (allProducts) {
      // Filter products that have no image (null, empty string, or undefined)
      const productsWithoutImages = allProducts.filter(p => !p.image_url || p.image_url.trim() === '')
      console.log(`🖼️ Found ${productsWithoutImages.length} products without images (out of ${allProducts.length} total)`)

      const updates: { id: string; image_url: string }[] = []
      for (const product of productsWithoutImages) {
        const imageUrl = productNameToImage.get(product.name.toLowerCase().trim())
        if (imageUrl) {
          updates.push({ id: product.id, image_url: imageUrl })
        }
      }

      console.log(`🖼️ ${updates.length} products can be matched by name to Shopify images`)

      // Log unmatched products for debugging
      const unmatched = productsWithoutImages.filter(p => !productNameToImage.has(p.name.toLowerCase().trim()))
      if (unmatched.length > 0) {
        console.log(`⚠️ ${unmatched.length} products could not be matched. First 10:`)
        for (const p of unmatched.slice(0, 10)) {
          console.log(`  - "${p.name}"`)
        }
      }

      // Batch update
      for (let i = 0; i < updates.length; i += 50) {
        const batch = updates.slice(i, i + 50)
        const results = await Promise.all(
          batch.map(u => supabase.from('products').update({ image_url: u.image_url }).eq('id', u.id))
        )
        for (const r of results) {
          if (!r.error) productsFixed++
        }
      }
      console.log(`✅ Fixed ${productsFixed}/${updates.length} product images`)
    }

    // 3. Update shopify_order_line_items — find items without images and match by SKU
    let lineItemsFixed = 0
    // Fetch both null and empty string image_url items
    const { data: nullImageItems, error: lineErr } = await supabase
      .from('shopify_order_line_items')
      .select('id, sku, image_url')
      .not('sku', 'is', null)
      .or('image_url.is.null,image_url.eq.')
      .limit(5000)

    if (lineErr) {
      console.error('Error fetching line items:', lineErr)
    } else if (nullImageItems && nullImageItems.length > 0) {
      console.log(`🖼️ Found ${nullImageItems.length} line items without images`)

      const updates: { id: string; image_url: string }[] = []
      for (const item of nullImageItems) {
        const imageUrl = item.sku ? skuToImage.get(item.sku) : null
        if (imageUrl) {
          updates.push({ id: item.id, image_url: imageUrl })
        }
      }

      console.log(`🖼️ ${updates.length} line items can be fixed`)

      for (let i = 0; i < updates.length; i += 50) {
        const batch = updates.slice(i, i + 50)
        const results = await Promise.all(
          batch.map(u => supabase.from('shopify_order_line_items').update({ image_url: u.image_url }).eq('id', u.id))
        )
        for (const r of results) {
          if (!r.error) lineItemsFixed++
        }
      }
      console.log(`✅ Fixed ${lineItemsFixed} line item images`)
    }

    const summary = {
      shopify_products: shopifyProductCount,
      sku_image_mappings: skuToImage.size,
      products_fixed: productsFixed,
      line_items_fixed: lineItemsFixed,
    }

    console.log('📊 Image sync complete:', JSON.stringify(summary))

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in sync-shopify-images:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
