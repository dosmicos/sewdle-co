
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Obtener credenciales desde los secretos de Supabase
    const storeDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!storeDomain || !accessToken) {
      console.error('Missing Shopify credentials in environment variables')
      return new Response(
        JSON.stringify({ 
          error: 'Credenciales de Shopify no configuradas. Por favor contacta al administrador.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { searchTerm } = await req.json().catch(() => ({ searchTerm: '' }))

    // Limpiar el dominio para asegurar formato correcto
    const cleanDomain = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    
    // Obtener todos los productos activos y borrador
    let apiUrl = `https://${cleanDomain}/admin/api/2023-10/products.json?status=active,draft&limit=250&published_status=any`

    console.log('Fetching from Shopify API:', apiUrl)

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Shopify API Error: ${response.status} - ${response.statusText}`, errorText)
      throw new Error(`Error de Shopify: ${response.status} - ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`Successfully fetched ${data.products?.length || 0} products from Shopify`)

    // Procesar los productos
    if (data.products && data.products.length > 0) {
      for (const product of data.products) {
        for (const variant of product.variants || []) {
          // Usar la cantidad de inventario básica disponible en la variante
          variant.stock_quantity = variant.inventory_quantity || 0
        }
      }

      // Si hay término de búsqueda, filtrar en el backend también
      if (searchTerm && searchTerm.trim()) {
        const searchTermLower = searchTerm.toLowerCase()
        data.products = data.products.filter((product: any) => 
          product.title.toLowerCase().includes(searchTermLower) ||
          (product.body_html && product.body_html.toLowerCase().includes(searchTermLower)) ||
          (product.product_type && product.product_type.toLowerCase().includes(searchTermLower)) ||
          (product.tags && product.tags.toLowerCase().includes(searchTermLower)) ||
          product.variants.some((variant: any) => 
            (variant.sku && variant.sku.toLowerCase().includes(searchTermLower)) ||
            (variant.title && variant.title.toLowerCase().includes(searchTermLower))
          )
        )
        console.log(`Filtered to ${data.products.length} products matching "${searchTerm}"`)
      }
    }

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in shopify-products function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Error al conectar con Shopify',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
