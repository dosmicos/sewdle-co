
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
    
    // Solo obtener productos activos y borrador (draft)
    let apiUrl = `https://${cleanDomain}/admin/api/2023-10/products.json?status=active,draft&limit=250&published_status=any`
    
    // Agregar filtro de búsqueda si hay término de búsqueda
    if (searchTerm && searchTerm.trim()) {
      apiUrl += `&title=${encodeURIComponent(searchTerm)}`
    }

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

    // Simplificar el manejo de inventario - solo usar la cantidad de inventario básica
    if (data.products && data.products.length > 0) {
      for (const product of data.products) {
        for (const variant of product.variants || []) {
          // Usar la cantidad de inventario básica disponible en la variante
          variant.stock_quantity = variant.inventory_quantity || 0
        }
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
