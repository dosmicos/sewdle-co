import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResyncRequest {
  deliveryId: string;
  specificSkus?: string[]; // Si se especifica, solo resintoniza estos SKUs
  retryAll?: boolean; // Si es true, reintenta todos los items, no solo los fallidos
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { deliveryId, specificSkus, retryAll } = await req.json() as ResyncRequest;

    if (!deliveryId) {
      return new Response(
        JSON.stringify({ success: false, error: 'deliveryId es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Resintonizando entrega ${deliveryId}`, { specificSkus, retryAll });

    // Obtener datos de la entrega
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('deliveries')
      .select(`
        id,
        tracking_number,
        synced_to_shopify,
        sync_error_message,
        delivery_items (
          id,
          quantity_approved,
          quantity_defective,
          synced_to_shopify,
          sync_error_message,
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
      .single();

    if (deliveryError) {
      console.error('Error obteniendo datos de entrega:', deliveryError);
      return new Response(
        JSON.stringify({ success: false, error: `Error obteniendo entrega: ${deliveryError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filtrar items para resintonizar
    let itemsToResync = deliveryData.delivery_items;

    if (specificSkus && specificSkus.length > 0) {
      // Solo resintonizar SKUs específicos
      itemsToResync = itemsToResync.filter((item: any) => 
        specificSkus.includes(item.order_items.product_variants.sku_variant)
      );
    } else if (!retryAll) {
      // Solo resintonizar items que fallaron (por defecto)
      itemsToResync = itemsToResync.filter((item: any) => 
        !item.synced_to_shopify || item.sync_error_message
      );
    }

    if (itemsToResync.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No hay items para resintonizar',
          tracking_number: deliveryData.tracking_number
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar datos para la sincronización
    const approvedItems = itemsToResync
      .filter((item: any) => item.quantity_approved > 0)
      .map((item: any) => ({
        variantId: item.order_items.product_variants.id,
        skuVariant: item.order_items.product_variants.sku_variant,
        quantityApproved: item.quantity_approved
      }));

    if (approvedItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No hay items aprobados para sincronizar',
          tracking_number: deliveryData.tracking_number
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Resincronizando ${approvedItems.length} items aprobados para ${deliveryData.tracking_number}`);

    // Resetear el estado de sincronización de los items que vamos a reintentar
    const itemIdsToReset = itemsToResync.map((item: any) => item.id);
    await supabase
      .from('delivery_items')
      .update({
        synced_to_shopify: false,
        sync_error_message: null,
        sync_attempt_count: 0
      })
      .in('id', itemIdsToReset);

    // Invocar la función de sincronización con Shopify
    const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-inventory-shopify', {
      body: {
        deliveryId: deliveryData.id,
        approvedItems,
        isResync: true
      }
    });

    if (syncError) {
      console.error('Error en resincronización:', syncError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Error en sincronización: ${syncError.message}`,
          tracking_number: deliveryData.tracking_number
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Resultado de resincronización:', syncResult);

    // Registrar la resincronización en logs
    await supabase
      .from('inventory_sync_logs')
      .insert({
        delivery_id: deliveryData.id,
        sync_results: {
          resync: true,
          original_error_items: itemsToResync.length,
          attempted_items: approvedItems.length,
          specific_skus: specificSkus,
          retry_all: retryAll,
          sync_result: syncResult
        },
        success_count: syncResult?.summary?.successful || 0,
        error_count: syncResult?.summary?.failed || 0
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Resincronización completada para ${deliveryData.tracking_number}`,
        tracking_number: deliveryData.tracking_number,
        attempted_items: approvedItems.length,
        sync_result: syncResult
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en resync-delivery:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});