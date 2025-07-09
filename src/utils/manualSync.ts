// Utilidad para sincronización manual de variantes específicas
import { supabase } from '@/integrations/supabase/client';

export const syncSpecificVariant = async (
  deliveryId: string,
  deliveryItemId: string,
  variantId: string,
  skuVariant: string,
  quantityApproved: number
) => {
  console.log(`🔄 Iniciando sincronización manual de SKU ${skuVariant}...`);
  
  try {
    // Datos para sincronización
    const syncData = {
      deliveryId,
      approvedItems: [{
        variantId,
        skuVariant,
        quantityApproved
      }]
    };

    console.log('📤 Enviando datos a Shopify:', syncData);

    // Llamar a la función de sincronización existente
    const { data, error } = await supabase.functions.invoke('sync-inventory-shopify', {
      body: syncData
    });

    if (error) {
      throw error;
    }

    console.log('📥 Respuesta de Shopify:', data);

    if (data.success) {
      console.log('✅ Sincronización exitosa, marcando delivery_item como sincronizado...');
      
      // Marcar el delivery_item como sincronizado
      const { error: updateError } = await supabase
        .from('delivery_items')
        .update({
          synced_to_shopify: true,
          last_sync_attempt: new Date().toISOString()
        })
        .eq('id', deliveryItemId);

      if (updateError) {
        throw updateError;
      }

      console.log(`✅ SKU ${skuVariant} sincronizado exitosamente con ${quantityApproved} unidades`);
      return { success: true, message: `SKU ${skuVariant} sincronizado exitosamente` };
    } else {
      throw new Error(data.error || 'Error desconocido en la sincronización');
    }

  } catch (error) {
    console.error('❌ Error en sincronización:', error);
    return { success: false, error: error.message };
  }
};

// Función específica para DEL-0014 SKU 45968383148267
export const syncDEL0014_SKU45968383148267 = async () => {
  return await syncSpecificVariant(
    'f0d6f413-1064-49a4-b912-623a7e5a4526', // deliveryId
    'd47517be-befb-4567-a978-70e073ca2f10', // deliveryItemId
    '79fcf6f7-bef7-443e-9ad8-5203fbea47ac', // variantId
    '45968383148267', // skuVariant
    6 // quantityApproved
  );
};