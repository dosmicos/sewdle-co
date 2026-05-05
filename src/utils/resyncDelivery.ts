import { supabase } from '@/integrations/supabase/client';

export const resyncDeliveryDEL0022 = async () => {
  try {
    // Obtener los datos actualizados de la entrega con los SKUs correctos
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
      .eq('tracking_number', 'DEL-0022')
      .single();

    if (deliveryError) {
      throw deliveryError;
    }

    // Preparar los datos para sincronización con los SKUs actualizados
    const approvedItems = deliveryData.delivery_items
      .filter((item: any) => item.quantity_approved > 0)
      .map((item: any) => ({
        variantId: item.order_items.product_variants.id,
        skuVariant: item.order_items.product_variants.sku_variant,
        quantityApproved: item.quantity_approved
      }));

    console.log('Attempting to resync DEL-0022 with updated SKUs:', approvedItems);

    // Invocar la función de sincronización
    const { data, error } = await supabase.functions.invoke('sync-inventory-shopify', {
      body: {
        deliveryId: deliveryData.id,
        approvedItems
      }
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error resyncing DEL-0022:', error);
    throw error;
  }
};