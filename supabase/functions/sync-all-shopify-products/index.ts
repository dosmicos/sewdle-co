import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

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
  imageUrl: string | null
  variants: ShopifyVariantData[]
}

// ─── Fetch all products from one Shopify store ────────────────────────────────
async function fetchShopifyProducts(shopifyDomain: string, shopifyToken: string): Promise<ShopifyProductData[]> {
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
              featuredImage { url }
              images(first: 1) { edges { node { url } } }
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    inventoryQuantity
                    selectedOptions { name value }
                  }
                }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `

    const cleanDomain = shopifyDomain.replace('https://', '').replace(/\/$/, '').replace('.myshopify.com', '')
    const response = await fetch(`https://${cleanDomain}.myshopify.com/admin/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyToken,
      },
      body: JSON.stringify({ query, variables: { first: 50, after: cursor } })
    })

    const data = await response.json()
    if (data.errors) throw new Error(`Shopify API error: ${data.errors[0].message}`)

    for (const edge of data.data.products.edges) {
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
        imageUrl: node.featuredImage?.url || node.images?.edges?.[0]?.node?.url || null,
        variants,
      })
    }

    hasNextPage = data.data.products.pageInfo.hasNextPage
    cursor = data.data.products.pageInfo.endCursor
  }

  return allProducts
}

// ─── Sync products for one store ──────────────────────────────────────────────
async function syncStoreProducts(
  storeId: string,
  organizationId: string,
  shopifyDomain: string,
  shopifyToken: string,
): Promise<{
  shopify_products: number
  shopify_variants: number
  products_created: number
  images_updated: number
  variants_created: number
  variants_updated: number
  variants_skipped: number
  errors: number
  error_details: string[]
}> {
  console.log(`🏪 Syncing store ${storeId} (${shopifyDomain})...`)

  const allProducts = await fetchShopifyProducts(shopifyDomain, shopifyToken)
  const totalShopifyVariants = allProducts.reduce((sum, p) => sum + p.variants.length, 0)
  console.log(`📦 Fetched ${allProducts.length} products, ${totalShopifyVariants} variants`)

  // Fetch existing Sewdle products scoped to this store
  const { data: sewdleProducts, error: prodErr } = await supabase
    .from('products')
    .select('id, name, sku, base_price, category, status, image_url, store_id')
    .eq('organization_id', organizationId)
    .or(`store_id.eq.${storeId},store_id.is.null`)

  if (prodErr) throw prodErr

  const { data: sewdleVariants, error: varErr } = await supabase
    .from('product_variants')
    .select('id, product_id, sku_variant, size, color, stock_quantity, additional_price')

  if (varErr) throw varErr

  // Build lookup maps scoped to this store (prefer store-scoped products)
  const productByName = new Map<string, any>()
  // First pass: store-specific products
  for (const p of (sewdleProducts || []).filter((p: any) => p.store_id === storeId)) {
    productByName.set(p.name.toLowerCase().trim(), p)
  }
  // Second pass: unscoped products (backfilled Colombia, fallback)
  for (const p of (sewdleProducts || []).filter((p: any) => !p.store_id)) {
    if (!productByName.has(p.name.toLowerCase().trim())) {
      productByName.set(p.name.toLowerCase().trim(), p)
    }
  }

  const variantBySku = new Map<string, any>()
  for (const v of sewdleVariants || []) {
    if (v.sku_variant) variantBySku.set(v.sku_variant, v)
  }

  let productsCreated = 0
  let imagesUpdated = 0
  let variantsCreated = 0
  let variantsUpdated = 0
  let variantsSkipped = 0
  let errors = 0
  const errorDetails: string[] = []
  const pendingImageUpdates: { id: string; image_url: string }[] = []

  for (const shopProduct of allProducts) {
    try {
      let sewdleProduct = productByName.get(shopProduct.title.toLowerCase().trim())

      if (!sewdleProduct) {
        const firstVariant = shopProduct.variants[0]
        const { data: created, error: createErr } = await supabase
          .from('products')
          .insert({
            name: shopProduct.title,
            sku: `SHOP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            base_price: firstVariant ? parseFloat(firstVariant.price) : 0,
            category: shopProduct.productType || 'Shopify',
            status: shopProduct.status === 'ACTIVE' ? 'active' : 'inactive',
            organization_id: organizationId,
            store_id: storeId,
            ...(shopProduct.imageUrl ? { image_url: shopProduct.imageUrl } : {}),
          })
          .select('id, name')
          .single()

        if (createErr) {
          errors++
          errorDetails.push(`Create product "${shopProduct.title}": ${createErr.message}`)
          continue
        }

        sewdleProduct = created
        productByName.set(shopProduct.title.toLowerCase().trim(), created)
        productsCreated++
        console.log(`✅ Created product: ${shopProduct.title}`)
      } else {
        // Update store_id if not set
        if (!sewdleProduct.store_id) {
          await supabase.from('products').update({ store_id: storeId }).eq('id', sewdleProduct.id)
        }
        if (shopProduct.imageUrl && sewdleProduct.image_url !== shopProduct.imageUrl) {
          pendingImageUpdates.push({ id: sewdleProduct.id, image_url: shopProduct.imageUrl })
        }
      }

      for (const variant of shopProduct.variants) {
        try {
          const variantSku = variant.sku?.trim() ? variant.sku : `SHOPIFY-${variant.id}`
          const existingVariant = variantBySku.get(variantSku)

          if (existingVariant) {
            const shopifyStock = variant.inventoryQuantity
            const shopifyPrice = parseFloat(variant.price)
            if (existingVariant.stock_quantity !== shopifyStock || existingVariant.additional_price !== shopifyPrice) {
              const { error: updateErr } = await supabase
                .from('product_variants')
                .update({ stock_quantity: shopifyStock, additional_price: shopifyPrice })
                .eq('id', existingVariant.id)
              if (updateErr) { errors++; errorDetails.push(`Update variant ${variantSku}: ${updateErr.message}`) }
              else variantsUpdated++
            } else {
              variantsSkipped++
            }
          } else {
            const { error: insertErr } = await supabase
              .from('product_variants')
              .insert({
                product_id: sewdleProduct.id,
                sku_variant: variantSku,
                size: variant.option1 || null,
                color: variant.option2 || null,
                stock_quantity: variant.inventoryQuantity,
                additional_price: parseFloat(variant.price),
              })
            if (insertErr) { errors++; errorDetails.push(`Insert variant ${variantSku}: ${insertErr.message}`) }
            else { variantsCreated++; variantBySku.set(variantSku, { sku_variant: variantSku }) }
          }
        } catch (e: any) {
          errors++
          errorDetails.push(`Variant ${variant.sku}: ${e.message}`)
        }
      }
    } catch (e: any) {
      errors++
      errorDetails.push(`Product "${shopProduct.title}": ${e.message}`)
    }
  }

  // Batch image updates
  if (pendingImageUpdates.length > 0) {
    for (let i = 0; i < pendingImageUpdates.length; i += 20) {
      const batch = pendingImageUpdates.slice(i, i + 20)
      const results = await Promise.all(
        batch.map(u => supabase.from('products').update({ image_url: u.image_url }).eq('id', u.id))
      )
      for (const r of results) {
        if (r.error) { errors++; errorDetails.push(`Image update: ${r.error.message}`) }
        else imagesUpdated++
      }
    }
  }

  // Fix line item images
  try {
    const skuToImage = new Map<string, string>()
    for (const p of allProducts) {
      if (!p.imageUrl) continue
      for (const v of p.variants) {
        if (v.sku?.trim()) skuToImage.set(v.sku, p.imageUrl)
      }
    }

    const { data: nullImageItems } = await supabase
      .from('shopify_order_line_items')
      .select('id, sku')
      .is('image_url', null)
      .not('sku', 'is', null)
      .limit(2000)

    if (nullImageItems?.length) {
      const updates = nullImageItems
        .filter((item: any) => item.sku && skuToImage.has(item.sku))
        .map((item: any) => ({ id: item.id, image_url: skuToImage.get(item.sku)! }))

      for (let i = 0; i < updates.length; i += 50) {
        await Promise.all(
          updates.slice(i, i + 50).map((u: any) =>
            supabase.from('shopify_order_line_items').update({ image_url: u.image_url }).eq('id', u.id)
          )
        )
      }
    }
  } catch (_) { /* non-fatal */ }

  return {
    shopify_products: allProducts.length,
    shopify_variants: totalShopifyVariants,
    products_created: productsCreated,
    images_updated: imagesUpdated,
    variants_created: variantsCreated,
    variants_updated: variantsUpdated,
    variants_skipped: variantsSkipped,
    errors,
    error_details: errorDetails.slice(0, 20),
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { organization_id } = await req.json().catch(() => ({}))
    console.log('🚀 Starting full Shopify → Sewdle product sync...')

    // Read store credentials from DB
    let storesQuery = supabase
      .from('stores')
      .select('id, organization_id, shopify_store_url, shopify_credentials')
      .eq('is_active', true)

    if (organization_id) {
      storesQuery = storesQuery.eq('organization_id', organization_id)
    }

    const { data: stores, error: storesErr } = await storesQuery
    if (storesErr) throw storesErr

    // Determine which stores to sync
    const storesToSync: Array<{ id: string; organizationId: string; shopifyDomain: string; shopifyToken: string }> = []

    for (const store of stores || []) {
      const domain = store.shopify_store_url
      const token = store.shopify_credentials?.access_token
      if (domain && token) {
        storesToSync.push({
          id: store.id,
          organizationId: store.organization_id,
          shopifyDomain: domain,
          shopifyToken: token,
        })
      }
    }

    // Fallback: ENV vars for single-store legacy setup
    if (storesToSync.length === 0) {
      const rawDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
      const token = Deno.env.get('SHOPIFY_ACCESS_TOKEN')
      if (!rawDomain || !token) throw new Error('No stores configured and no ENV vars set')

      // Find the store row that matches this domain
      const { data: envStore } = await supabase
        .from('stores')
        .select('id, organization_id')
        .like('shopify_store_url', `%${rawDomain.replace('.myshopify.com', '')}%`)
        .single()

      if (envStore) {
        storesToSync.push({ id: envStore.id, organizationId: envStore.organization_id, shopifyDomain: rawDomain, shopifyToken: token })
      } else {
        throw new Error('Shopify credentials not configured in stores table')
      }
    }

    console.log(`📡 Syncing ${storesToSync.length} store(s)...`)

    // Aggregate results across all stores
    const totals = {
      shopify_products: 0, shopify_variants: 0,
      products_created: 0, images_updated: 0,
      variants_created: 0, variants_updated: 0, variants_skipped: 0,
      errors: 0, error_details: [] as string[],
    }

    for (const store of storesToSync) {
      const result = await syncStoreProducts(store.id, store.organizationId, store.shopifyDomain, store.shopifyToken)
      totals.shopify_products += result.shopify_products
      totals.shopify_variants += result.shopify_variants
      totals.products_created += result.products_created
      totals.images_updated += result.images_updated
      totals.variants_created += result.variants_created
      totals.variants_updated += result.variants_updated
      totals.variants_skipped += result.variants_skipped
      totals.errors += result.errors
      totals.error_details.push(...result.error_details)
    }

    console.log('📊 Sync complete:', JSON.stringify(totals, null, 2))
    return new Response(
      JSON.stringify({ success: true, summary: totals }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Error in sync-all-shopify-products:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
