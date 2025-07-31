import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

interface ShopifyVariant {
  id: string
  product_id: string
  title: string
  sku: string
  price: string
  inventory_quantity: number
  option1?: string
  option2?: string
  option3?: string
}

interface VariantComparison {
  shopify_sku: string
  product_title: string
  variant_title: string
  shopify_price: number
  shopify_stock: number
  exists_in_sewdle: boolean
  sewdle_product_id?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { searchTerm = '' } = await req.json()

    console.log('🔍 Starting variant detection process...')

    // Get Shopify store credentials
    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!shopifyDomain || !shopifyToken) {
      throw new Error('Shopify credentials not configured')
    }

    // Fetch all Shopify products with variants
    console.log('📦 Fetching Shopify products...')
    
    let allShopifyVariants: ShopifyVariant[] = []
    let cursor = null
    let hasNextPage = true

    while (hasNextPage) {
      const query = `
        query getProducts($first: Int!, $after: String, $query: String) {
          products(first: $first, after: $after, query: $query) {
            edges {
              node {
                id
                title
                status
                variants(first: 100) {
                  edges {
                    node {
                      id
                      title
                      sku
                      price
                      inventoryQuantity
                      selectedOptions {
                        name
                        value
                      }
                    }
                  }
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `

      const response = await fetch(`https://${shopifyDomain}.myshopify.com/admin/api/2024-07/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyToken,
        },
        body: JSON.stringify({
          query,
          variables: {
            first: 50,
            after: cursor,
            query: searchTerm ? `title:*${searchTerm}*` : undefined
          }
        })
      })

      const data = await response.json()
      
      if (data.errors) {
        console.error('❌ Shopify API errors:', data.errors)
        throw new Error(`Shopify API error: ${data.errors[0].message}`)
      }

      const products = data.data.products.edges

      // Process variants from this batch
      for (const productEdge of products) {
        const product = productEdge.node
        
        for (const variantEdge of product.variants.edges) {
          const variant = variantEdge.node
          
          if (variant.sku) {
            const selectedOptions = variant.selectedOptions || []
            
            allShopifyVariants.push({
              id: variant.id.replace('gid://shopify/ProductVariant/', ''),
              product_id: product.id.replace('gid://shopify/Product/', ''),
              title: `${product.title} - ${variant.title}`,
              sku: variant.sku,
              price: variant.price,
              inventory_quantity: variant.inventoryQuantity || 0,
              option1: selectedOptions[0]?.value,
              option2: selectedOptions[1]?.value,
              option3: selectedOptions[2]?.value
            })
          }
        }
      }

      hasNextPage = data.data.products.pageInfo.hasNextPage
      cursor = data.data.products.pageInfo.endCursor
    }

    console.log(`📦 Found ${allShopifyVariants.length} Shopify variants`)

    // Get all existing Sewdle product variants
    console.log('🗃️ Fetching Sewdle variants...')
    
    const { data: sewdleVariants, error: sewdleError } = await supabase
      .from('product_variants')
      .select(`
        id,
        sku_variant,
        product_id,
        size,
        color,
        stock_quantity,
        additional_price,
        products!inner(
          id,
          name,
          base_price
        )
      `)

    if (sewdleError) {
      console.error('❌ Error fetching Sewdle variants:', sewdleError)
      throw sewdleError
    }

    console.log(`🗃️ Found ${sewdleVariants.length} Sewdle variants`)

    // Create a map of Sewdle SKUs for quick lookup
    const sewdleSkuMap = new Map()
    sewdleVariants.forEach(variant => {
      sewdleSkuMap.set(variant.sku_variant, {
        id: variant.id,
        product_id: variant.product_id,
        product_name: variant.products.name
      })
    })

    // Compare variants and find new ones
    const comparisons: VariantComparison[] = []
    const newVariants: ShopifyVariant[] = []

    for (const shopifyVariant of allShopifyVariants) {
      const existsInSewdle = sewdleSkuMap.has(shopifyVariant.sku)
      const sewdleData = sewdleSkuMap.get(shopifyVariant.sku)

      comparisons.push({
        shopify_sku: shopifyVariant.sku,
        product_title: shopifyVariant.title.split(' - ')[0],
        variant_title: shopifyVariant.title,
        shopify_price: parseFloat(shopifyVariant.price),
        shopify_stock: shopifyVariant.inventory_quantity,
        exists_in_sewdle: existsInSewdle,
        sewdle_product_id: sewdleData?.product_id
      })

      if (!existsInSewdle) {
        newVariants.push(shopifyVariant)
      }
    }

    const newVariantsCount = newVariants.length
    const existingVariantsCount = comparisons.length - newVariantsCount

    console.log(`✅ Analysis complete:`)
    console.log(`   - Total Shopify variants: ${allShopifyVariants.length}`)
    console.log(`   - Existing in Sewdle: ${existingVariantsCount}`)
    console.log(`   - New variants found: ${newVariantsCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_shopify_variants: allShopifyVariants.length,
          existing_in_sewdle: existingVariantsCount,
          new_variants_count: newVariantsCount,
          sync_needed: newVariantsCount > 0
        },
        comparisons,
        new_variants: newVariants
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in detect-new-variants:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})