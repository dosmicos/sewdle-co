import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { deliveryId, failedSkusOnly } = await req.json()

    if (!deliveryId) {
      return new Response(
        JSON.stringify({ error: 'deliveryId es requerido' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Iniciando re-sincronización para delivery: ${deliveryId}`)

    // Obtener los datos de la entrega con los SKUs correctos
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('deliveries')
      .select(`
        id,
        tracking_number,
        delivery_items (
          id,
          quantity_approved,
          order_item_id,
          order_items (
            product_variant_id,
            product_variants (
              id,
              sku_variant
            )
          )
        )
      `)
      .eq('id', deliveryId)
      .single()

    if (deliveryError) {
      console.error('Error obteniendo datos de entrega:', deliveryError)
      return new Response(
        JSON.stringify({ error: 'No se pudo obtener la entrega' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Preparar los datos para sincronización
    let approvedItems = deliveryData.delivery_items
      .filter((item: any) => item.quantity_approved > 0)
      .map((item: any) => ({
        variantId: item.order_items.product_variants.id,
        skuVariant: item.order_items.product_variants.sku_variant,
        quantityApproved: item.quantity_approved
      }))

    // Si solo queremos re-sincronizar SKUs que fallaron
    if (failedSkusOnly && failedSkusOnly.length > 0) {
      approvedItems = approvedItems.filter((item: any) => 
        failedSkusOnly.includes(item.skuVariant)
      )
      console.log(`Filtrando solo SKUs fallidos: ${failedSkusOnly.join(', ')}`)
    }

    if (approvedItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No hay items para sincronizar',
          summary: { successful: 0, failed: 0 }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Re-sincronizando ${approvedItems.length} items:`, approvedItems)

    // Invocar la función de sincronización original
    const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-inventory-shopify', {
      body: {
        deliveryId: deliveryData.id,
        approvedItems,
        isResync: true // Flag para indicar que es una re-sincronización
      }
    })

    if (syncError) {
      console.error('Error en sincronización:', syncError)
      return new Response(
        JSON.stringify({ 
          error: 'Error en la sincronización',
          details: syncError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Re-sincronización completada:', syncResult)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Re-sincronización completada para ${deliveryData.tracking_number}`,
        summary: syncResult.summary,
        deliveryId: deliveryId,
        trackingNumber: deliveryData.tracking_number
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error en re-sincronización:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})