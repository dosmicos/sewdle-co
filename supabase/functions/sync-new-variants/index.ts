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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { variants_to_sync } = await req.json()

    if (!variants_to_sync || variants_to_sync.length === 0) {
      throw new Error('No variants provided for synchronization')
    }

    console.log(`🔄 Starting sync of ${variants_to_sync.length} variants...`)

    const results = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: []
    }

    for (const shopifyVariant of variants_to_sync) {
      try {
        console.log(`🔄 Processing variant: ${shopifyVariant.sku}`)

        // Check if we have an existing product with similar name
        const productName = shopifyVariant.title.split(' - ')[0]
        
        const { data: existingProducts, error: searchError } = await supabase
          .from('products')
          .select('id, name, sku')
          .ilike('name', `%${productName}%`)
          .eq('status', 'active')
          .limit(5)

        if (searchError) {
          console.error(`❌ Error searching for product: ${searchError.message}`)
          results.errors++
          results.details.push({
            sku: shopifyVariant.sku,
            status: 'error',
            message: `Error searching for product: ${searchError.message}`
          })
          continue
        }

        let targetProductId = null

        // If we found potential matches, use the first one
        if (existingProducts && existingProducts.length > 0) {
          targetProductId = existingProducts[0].id
          console.log(`✅ Found existing product: ${existingProducts[0].name}`)
        } else {
          // Create new product
          console.log(`📦 Creating new product: ${productName}`)
          
          const { data: newProduct, error: createProductError } = await supabase
            .from('products')
            .insert([{
              name: productName,
              sku: `SHOP-${shopifyVariant.product_id}`,
              description: `Imported from Shopify - ${productName}`,
              base_price: parseFloat(shopifyVariant.price),
              status: 'active',
              category: 'Imported'
            }])
            .select()
            .single()

          if (createProductError) {
            console.error(`❌ Error creating product: ${createProductError.message}`)
            results.errors++
            results.details.push({
              sku: shopifyVariant.sku,
              status: 'error',
              message: `Error creating product: ${createProductError.message}`
            })
            continue
          }

          targetProductId = newProduct.id
        }

        // Check if variant already exists
        const { data: existingVariant, error: variantCheckError } = await supabase
          .from('product_variants')
          .select('id')
          .eq('sku_variant', shopifyVariant.sku)
          .single()

        if (variantCheckError && variantCheckError.code !== 'PGRST116') {
          console.error(`❌ Error checking variant: ${variantCheckError.message}`)
          results.errors++
          results.details.push({
            sku: shopifyVariant.sku,
            status: 'error',
            message: `Error checking variant: ${variantCheckError.message}`
          })
          continue
        }

        if (existingVariant) {
          console.log(`⏭️ Variant ${shopifyVariant.sku} already exists, skipping`)
          results.skipped++
          results.details.push({
            sku: shopifyVariant.sku,
            status: 'skipped',
            message: 'Variant already exists'
          })
          continue
        }

        // Create the new variant
        const variantData = {
          product_id: targetProductId,
          sku_variant: shopifyVariant.sku,
          size: shopifyVariant.option1 || null,
          color: shopifyVariant.option2 || null,
          additional_price: 0,
          stock_quantity: shopifyVariant.inventory_quantity || 0
        }

        const { data: newVariant, error: createVariantError } = await supabase
          .from('product_variants')
          .insert([variantData])
          .select()
          .single()

        if (createVariantError) {
          console.error(`❌ Error creating variant: ${createVariantError.message}`)
          results.errors++
          results.details.push({
            sku: shopifyVariant.sku,
            status: 'error',
            message: `Error creating variant: ${createVariantError.message}`
          })
          continue
        }

        console.log(`✅ Successfully created variant: ${shopifyVariant.sku}`)
        results.success++
        results.details.push({
          sku: shopifyVariant.sku,
          status: 'success',
          message: 'Variant created successfully',
          variant_id: newVariant.id
        })

      } catch (error) {
        console.error(`❌ Error processing variant ${shopifyVariant.sku}:`, error)
        results.errors++
        results.details.push({
          sku: shopifyVariant.sku,
          status: 'error',
          message: error.message
        })
      }
    }

    console.log(`✅ Sync completed:`)
    console.log(`   - Success: ${results.success}`)
    console.log(`   - Errors: ${results.errors}`)
    console.log(`   - Skipped: ${results.skipped}`)

    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in sync-new-variants:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})