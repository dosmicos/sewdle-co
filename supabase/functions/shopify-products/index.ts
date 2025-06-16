
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { storeDomain, accessToken, searchTerm } = await req.json()

    if (!storeDomain || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Store domain and access token are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Limpiar el dominio para asegurar formato correcto
    const cleanDomain = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    let apiUrl = `https://${cleanDomain}/admin/api/2023-10/products.json?status=active,draft&limit=250`
    
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
      throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`)
    }

    const data = await response.json()
    console.log('Shopify API Response:', data)

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
        error: 'Failed to fetch products from Shopify',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
