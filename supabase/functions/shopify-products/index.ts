
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
      const errorText = await response.text()
      console.error(`Shopify API Error: ${response.status} - ${response.statusText}`, errorText)
      throw new Error(`Error de Shopify: ${response.status} - ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`Successfully fetched ${data.products?.length || 0} products from Shopify`)

    // Para cada producto, obtener información de inventario
    if (data.products && data.products.length > 0) {
      for (const product of data.products) {
        for (const variant of product.variants || []) {
          if (variant.inventory_item_id) {
            try {
              // Obtener información del inventario para cada variante
              const inventoryUrl = `https://${cleanDomain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${variant.inventory_item_id}`
              
              const inventoryResponse = await fetch(inventoryUrl, {
                method: 'GET',
                headers: {
                  'X-Shopify-Access-Token': accessToken,
                  'Content-Type': 'application/json'
                }
              })

              if (inventoryResponse.ok) {
                const inventoryData = await inventoryResponse.json()
                
                // Calcular el stock total disponible para esta variante
                const totalAvailable = inventoryData.inventory_levels?.reduce((total: number, level: any) => {
                  return total + (level.available || 0)
                }, 0) || 0

                // Agregar el stock disponible a la variante
                variant.stock_quantity = totalAvailable
              } else {
                console.log(`Failed to fetch inventory for variant ${variant.id}`)
                variant.stock_quantity = 0
              }
            } catch (inventoryError) {
              console.error(`Error fetching inventory for variant ${variant.id}:`, inventoryError)
              variant.stock_quantity = 0
            }
          } else {
            variant.stock_quantity = 0
          }
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
