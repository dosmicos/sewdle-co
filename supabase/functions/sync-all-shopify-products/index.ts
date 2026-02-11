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

    console.log('🚀 Starting full Shopify → Sewdle product sync...')

    const rawShopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!rawShopifyDomain || !shopifyToken) {
      throw new Error('Shopify credentials not configured')
    }

    const shopifyDomain = rawShopifyDomain.includes('.myshopify.com')
      ? rawShopifyDomain.replace('.myshopify.com', '')
      : rawShopifyDomain

    // 1. Fetch ALL Shopify products via GraphQL with pagination
    console.log('📦 Fetching all Shopify products via GraphQL...')
    
    interface ShopifyVariantData {
      id: string
      title: string
      sku: string
      price: string
      inventoryQuantity: number
      option1: string | null
      option2: string | null
      option3: string | null
    }

    interface ShopifyProductData {
      title: string
      status: string
      productType: string
      variants: ShopifyVariantData[]
    }

    const allProducts: ShopifyProductData[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const query = `
        query getProducts($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            edges {
              node {
                id
                title
                status
                productType
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
          variables: { first: 50, after: cursor }
        })
      })

      const data = await response.json()

      if (data.errors) {
        console.error('❌ Shopify GraphQL errors:', data.errors)
        throw new Error(`Shopify API error: ${data.errors[0].message}`)
      }

      const edges = data.data.products.edges
      for (const edge of edges) {
        const node = edge.node
        const variants: ShopifyVariantData[] = node.variants.edges.map((ve: any) => {
          const v = ve.node
          const opts = v.selectedOptions || []
          return {
            id: v.id.replace('gid://shopify/ProductVariant/', ''),
            title: v.title,
            sku: v.sku || '',
            price: v.price,
            inventoryQuantity: v.inventoryQuantity || 0,
            option1: opts[0]?.value || null,
            option2: opts[1]?.value || null,
            option3: opts[2]?.value || null,
          }
        })

        allProducts.push({
          title: node.title,
          status: node.status,
          productType: node.productType || '',
          variants,
        })
      }

      hasNextPage = data.data.products.pageInfo.hasNextPage
      cursor = data.data.products.pageInfo.endCursor
    }

    const totalShopifyVariants = allProducts.reduce((sum, p) => sum + p.variants.length, 0)
    console.log(`📦 Fetched ${allProducts.length} products with ${totalShopifyVariants} variants from Shopify`)

    // 2. Fetch all existing Sewdle products and variants
    const { data: sewdleProducts, error: prodErr } = await supabase
      .from('products')
      .select('id, name, sku, base_price, category, status')

    if (prodErr) throw prodErr

    const { data: sewdleVariants, error: varErr } = await supabase
      .from('product_variants')
      .select('id, product_id, sku_variant, size, color, stock_quantity, additional_price')

    if (varErr) throw varErr

    // Build lookup maps
    const productByName = new Map<string, any>()
    for (const p of sewdleProducts || []) {
      productByName.set(p.name.toLowerCase().trim(), p)
    }

    const variantBySku = new Map<string, any>()
    for (const v of sewdleVariants || []) {
      if (v.sku_variant) {
        variantBySku.set(v.sku_variant, v)
      }
    }

    // 3. Process each Shopify product
    let productsCreated = 0
    let variantsCreated = 0
    let variantsUpdated = 0
    let variantsSkipped = 0
    let errors = 0
    const errorDetails: string[] = []

    for (const shopProduct of allProducts) {
      try {
        // Find or create the product in Sewdle
        let sewdleProduct = productByName.get(shopProduct.title.toLowerCase().trim())

        if (!sewdleProduct) {
          // Create the product
          const firstVariant = shopProduct.variants[0]
          const newProduct = {
            name: shopProduct.title,
            sku: `SHOP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            base_price: firstVariant ? parseFloat(firstVariant.price) : 0,
            category: shopProduct.productType || 'Shopify',
            status: shopProduct.status === 'ACTIVE' ? 'active' : 'draft',
            ...(organization_id ? { organization_id } : {}),
          }

          const { data: created, error: createErr } = await supabase
            .from('products')
            .insert(newProduct)
            .select('id, name')
            .single()

          if (createErr) {
            console.error(`❌ Error creating product "${shopProduct.title}":`, createErr)
            errors++
            errorDetails.push(`Create product "${shopProduct.title}": ${createErr.message}`)
            continue
          }

          sewdleProduct = created
          productByName.set(shopProduct.title.toLowerCase().trim(), created)
          productsCreated++
          console.log(`✅ Created product: ${shopProduct.title}`)
        }

        // Process each variant
        for (const variant of shopProduct.variants) {
          try {
            // Skip variants without SKU — can't match them
            if (!variant.sku || variant.sku.trim() === '') {
              variantsSkipped++
              continue
            }

            const existingVariant = variantBySku.get(variant.sku)

            if (existingVariant) {
              // Update stock and price if changed
              const shopifyStock = variant.inventoryQuantity
              const shopifyPrice = parseFloat(variant.price)
              const currentStock = existingVariant.stock_quantity || 0
              const currentPrice = existingVariant.additional_price || 0

              if (currentStock !== shopifyStock || currentPrice !== shopifyPrice) {
                const { error: updateErr } = await supabase
                  .from('product_variants')
                  .update({
                    stock_quantity: shopifyStock,
                    additional_price: shopifyPrice,
                  })
                  .eq('id', existingVariant.id)

                if (updateErr) {
                  errors++
                  errorDetails.push(`Update variant ${variant.sku}: ${updateErr.message}`)
                } else {
                  variantsUpdated++
                }
              } else {
                variantsSkipped++
              }
            } else {
              // Create new variant
              const size = variant.option1 || null
              const color = variant.option2 || null

              const { error: insertErr } = await supabase
                .from('product_variants')
                .insert({
                  product_id: sewdleProduct.id,
                  sku_variant: variant.sku,
                  size,
                  color,
                  stock_quantity: variant.inventoryQuantity,
                  additional_price: parseFloat(variant.price),
                  ...(organization_id ? { organization_id } : {}),
                })

              if (insertErr) {
                errors++
                errorDetails.push(`Insert variant ${variant.sku}: ${insertErr.message}`)
              } else {
                variantsCreated++
                variantBySku.set(variant.sku, { sku_variant: variant.sku })
              }
            }
          } catch (variantError) {
            errors++
            errorDetails.push(`Variant ${variant.sku}: ${variantError.message}`)
          }
        }
      } catch (productError) {
        errors++
        errorDetails.push(`Product "${shopProduct.title}": ${productError.message}`)
      }
    }

    const summary = {
      shopify_products: allProducts.length,
      shopify_variants: totalShopifyVariants,
      products_created: productsCreated,
      variants_created: variantsCreated,
      variants_updated: variantsUpdated,
      variants_skipped: variantsSkipped,
      errors,
      error_details: errorDetails.slice(0, 20), // Limit error details
    }

    console.log('📊 Sync complete:', JSON.stringify(summary, null, 2))

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in sync-all-shopify-products:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
