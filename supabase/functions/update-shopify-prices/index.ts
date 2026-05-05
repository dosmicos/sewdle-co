import { corsHeaders } from '../_shared/cors.ts'

const PRICE_UPDATES: { name: string; price: number; compareAtPrice: number }[] = [
  { name: "Ruana Siberiano Dosmicos", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Perrito Azul", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Unicornio", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Pony", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana de Pollito", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Venado Dosmicos", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Osito", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana de Perrito Beagle", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana de Vaca", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana de Koala", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Capibara", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Venado Dosmicos Camel", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana de Mico", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana de Leoncito", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana de Super Gatica Pink", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana de Zorro", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Caballo", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Oveja", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Porky", price: 82900, compareAtPrice: 96900 },
  { name: "Chaqueta Teddy Bear", price: 114000, compareAtPrice: 128900 },
  { name: "Sleeping Walker Star con Mangas TOG 2.5", price: 118900, compareAtPrice: 138000 },
  { name: "Ruana Border Collie", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Hipopótamo", price: 82900, compareAtPrice: 96900 },
  { name: "Sleeping para Bebé Poppy TOG 2.5", price: 99900, compareAtPrice: 109000 },
  { name: "Sleeping Walker Poppy TOG 2.5", price: 106900, compareAtPrice: 118000 },
  { name: "Ruana de Oso Andino", price: 82900, compareAtPrice: 96900 },
  { name: "Sleeping Walker Estrellas TOG 2.5", price: 106900, compareAtPrice: 118900 },
  { name: "Sleeping para Bebé Osito Camel TOG 2.5", price: 114900, compareAtPrice: 134900 },
  { name: "Ruana Mapache", price: 82900, compareAtPrice: 96900 },
  { name: "Parka Impermeable Marinero", price: 124900, compareAtPrice: 138900 },
  { name: "Sleeping para Bebé Osito Beige TOG 2.5", price: 114900, compareAtPrice: 134900 },
  { name: "Sleeping Walker Poppy con Mangas TOG 2.5", price: 118000, compareAtPrice: 138000 },
  { name: "Ruana Pantera", price: 82900, compareAtPrice: 96900 },
  { name: "Sleeping Walker Dinosaurios TOG 2.5", price: 105000, compareAtPrice: 118900 },
  { name: "Ruana de Vaca Café", price: 82900, compareAtPrice: 96900 },
  { name: "Sleeping para Bebé Estrellas TOG 2.5", price: 99900, compareAtPrice: 109000 },
  { name: "Ruana Tiburón", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Leona Adulto", price: 112900, compareAtPrice: 122900 },
  { name: "Sleeping para Bebé Pingüino TOG 2.0", price: 114900, compareAtPrice: 134900 },
  { name: "Chaqueta Unicornio", price: 114000, compareAtPrice: 128900 },
  { name: "Ruana Chimu", price: 82900, compareAtPrice: 96900 },
  { name: "Sleeping Walker Estrellas Gris TOG 2.5", price: 105000, compareAtPrice: 118900 },
  { name: "Sleeping para Bebé Venado TOG 2.5", price: 114900, compareAtPrice: 134900 },
  { name: "Ruana Labubu", price: 79900, compareAtPrice: 96900 },
  { name: "Sleeping Bag Dinosaurios TOG 2.5", price: 98000, compareAtPrice: 109000 },
  { name: "Sleeping para Bebé Blue Sky TOG 2.5", price: 98000, compareAtPrice: 109000 },
  { name: "Camiseta Dosmicos Clean Tee", price: 16900, compareAtPrice: 29900 },
  { name: "Ruana Venado Aurora", price: 82900, compareAtPrice: 94900 },
  { name: "Sleeping Walker Estrellas Azul con Mangas TOG 2.5", price: 118000, compareAtPrice: 138000 },
  { name: "Ruana Reno Rudolph", price: 76900, compareAtPrice: 96900 },
  { name: "Ruana Suricata", price: 82900, compareAtPrice: 96900 },
  { name: "Sleeping Walker Blue Sky con Mangas TOG 2.5", price: 108000, compareAtPrice: 118000 },
  { name: "Sleeping para Bebé Zorro TOG 2.5", price: 114900, compareAtPrice: 134900 },
  { name: "Chaqueta Osito Bebé", price: 79900, compareAtPrice: 89900 },
  { name: "Ruana de Vaca Adulto", price: 112900, compareAtPrice: 122900 },
  { name: "Sleeping para Bebé Perritos TOG 0.5", price: 86000, compareAtPrice: 98700 },
  { name: "Sleeping Walker Dinosaurios con Mangas TOG 2.5", price: 118000, compareAtPrice: 138000 },
  { name: "Ruana Kuromi", price: 78900, compareAtPrice: 96900 },
  { name: "Ruana Grinch", price: 78900, compareAtPrice: 96900 },
  { name: "Sleeping Bag Wild Dreams TOG 2.0", price: 92900, compareAtPrice: 98700 },
  { name: "Ruana Hombre lobo", price: 76900, compareAtPrice: 96900 },
  { name: "Sleeping Walker Osito TOG 2.5", price: 118900, compareAtPrice: 138900 },
  { name: "Sleeping Walker Rocket con Mangas TOG 2.0", price: 108900, compareAtPrice: 128000 },
  { name: "Ruana Dino Azul", price: 82900, compareAtPrice: 96900 },
  { name: "Sleeping Walker Caballito de Madera TOG 2.0", price: 108900, compareAtPrice: 118900 },
  { name: "Sleeping Walker Tigres TOG 0.5", price: 108900, compareAtPrice: 118000 },
  { name: "Sleeping Walker Jurassic TOG 0.5", price: 108900, compareAtPrice: 118000 },
  { name: "Chaqueta Dino Rex", price: 108900, compareAtPrice: 128900 },
  { name: "Sleeping para Bebé Estrellas Azul TOG 2.5", price: 96900, compareAtPrice: 109000 },
  { name: "Sleeping Walker Rocket TOG 2.0", price: 96900, compareAtPrice: 118900 },
  { name: "Ruana Dino Rosa", price: 82900, compareAtPrice: 96900 },
  { name: "Sleeping Bag Soft Friends TOG 2.0", price: 90900, compareAtPrice: 98700 },
  { name: "Sleeping Walker Ovejita con Mangas TOG 2.0", price: 108000, compareAtPrice: 128000 },
  { name: "Ruana Foca", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana Reno Rudolph Café", price: 82900, compareAtPrice: 84900 },
  { name: "Ruana Castor", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana de Capibara Adulto", price: 82900, compareAtPrice: 122900 },
  { name: "Ruana Conejito", price: 82900, compareAtPrice: 96900 },
  { name: "Ruana de Mapache Adulto", price: 82900, compareAtPrice: 122900 },
  { name: "Sleeping para Bebé Conejo TOG 2.5", price: 114900, compareAtPrice: 134900 },
  { name: "Chaqueta Bebé Mapache", price: 79900, compareAtPrice: 89900 },
  { name: "Chaqueta Bebé Osito Camel", price: 79900, compareAtPrice: 89900 },
  { name: "Ruana Rinoceronte", price: 82900, compareAtPrice: 96900 },
  { name: "Chaqueta Bebé Vaca", price: 79900, compareAtPrice: 89900 },
  { name: "Sleeping para Bebé Renos TOG 0.5", price: 76900, compareAtPrice: 98700 },
  { name: "Sleeping para Bebé Galletas TOG 0.5", price: 76900, compareAtPrice: 98700 },
  { name: "Jean Vintage Blue", price: 66900, compareAtPrice: 98000 },
  { name: "Jeans Blue Perlas", price: 66900, compareAtPrice: 98000 },
  { name: "Ruana de Osito Rosa", price: 82900, compareAtPrice: 96900 },
  { name: "Sleeping Walker Dino Wild TOG 2.0", price: 108900, compareAtPrice: 118900 },
  { name: "Sleeping Bag Ovejita TOG 2.0", price: 88900, compareAtPrice: 98700 },
  { name: "Sleeping Walker Renos TOG 0.5", price: 108000, compareAtPrice: 118000 },
  { name: "Combo Mamá e Hijo - Ruana Mapache", price: 179900, compareAtPrice: 199000 },
  { name: "Combo Padre e Hijo - Ruana Capibara", price: 179900, compareAtPrice: 199000 },
  { name: "Combo Mamá e Hijo - Ruana Leona", price: 179900, compareAtPrice: 199000 },
  { name: "Combo Mamá e Hijo - Ruana Vaca", price: 179900, compareAtPrice: 199000 },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { batch = 0 } = await req.json().catch(() => ({ batch: 0 }))

    const rawShopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!rawShopifyDomain || !shopifyToken) {
      throw new Error('Shopify credentials not configured')
    }

    const shopifyDomain = rawShopifyDomain.includes('.myshopify.com')
      ? rawShopifyDomain.replace('.myshopify.com', '')
      : rawShopifyDomain

    const graphqlUrl = `https://${shopifyDomain}.myshopify.com/admin/api/2024-07/graphql.json`
    const restBase = `https://${shopifyDomain}.myshopify.com/admin/api/2024-07`

    // Process 20 products per batch
    const BATCH_SIZE = 20
    const start = batch * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, PRICE_UPDATES.length)
    const batchProducts = PRICE_UPDATES.slice(start, end)

    if (batchProducts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No more products to update', batch }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🚀 Batch ${batch}: updating products ${start + 1} to ${end} of ${PRICE_UPDATES.length}`)

    const results: { name: string; status: string; variantsUpdated?: number; error?: string }[] = []

    for (const product of batchProducts) {
      try {
        // Find product by title
        const searchRes = await fetch(graphqlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': shopifyToken,
          },
          body: JSON.stringify({
            query: `query { products(first: 1, query: "title:\\"${product.name}\\"") { edges { node { id title variants(first: 100) { edges { node { id } } } } } } }`,
          }),
        })

        const searchData = await searchRes.json()
        const shopifyProduct = searchData.data?.products?.edges?.[0]?.node

        if (!shopifyProduct || shopifyProduct.title !== product.name) {
          results.push({ name: product.name, status: 'NOT_FOUND' })
          continue
        }

        // Update each variant via REST API
        const variants = shopifyProduct.variants.edges
        let updatedCount = 0

        for (const { node: variant } of variants) {
          const variantId = variant.id.split('/').pop()

          const restRes = await fetch(`${restBase}/variants/${variantId}.json`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': shopifyToken,
            },
            body: JSON.stringify({
              variant: {
                id: parseInt(variantId),
                price: `${product.price}.00`,
                compare_at_price: `${product.compareAtPrice}.00`,
              },
            }),
          })

          const restData = await restRes.json()
          if (restData.variant) {
            updatedCount++
          } else {
            console.error(`Error variant ${variantId}:`, JSON.stringify(restData))
          }
        }

        results.push({ name: product.name, status: 'UPDATED', variantsUpdated: updatedCount })
        console.log(`✅ ${product.name}: ${updatedCount} variants`)
      } catch (err) {
        results.push({ name: product.name, status: 'ERROR', error: err.message })
      }
    }

    const updated = results.filter(r => r.status === 'UPDATED')
    const totalVariants = updated.reduce((sum, r) => sum + (r.variantsUpdated || 0), 0)

    return new Response(
      JSON.stringify({
        success: true,
        batch,
        range: `${start + 1}-${end} of ${PRICE_UPDATES.length}`,
        next_batch: end < PRICE_UPDATES.length ? batch + 1 : null,
        products_updated: updated.length,
        total_variants_updated: totalVariants,
        not_found: results.filter(r => r.status === 'NOT_FOUND').map(r => r.name),
        errors: results.filter(r => r.status === 'ERROR').map(r => ({ name: r.name, error: r.error })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
