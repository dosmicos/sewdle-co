// Script manual para sincronizar la variante SKU 45968383148267 de DEL-0014
// Ejecutar en la consola del navegador

const syncSpecificVariant = async () => {
  console.log('🔄 Iniciando sincronización manual de SKU 45968383148267...');
  
  try {
    // Datos de la variante específica
    const syncData = {
      deliveryId: 'f0d6f413-1064-49a4-b912-623a7e5a4526',
      approvedItems: [{
        variantId: '79fcf6f7-bef7-443e-9ad8-5203fbea47ac',
        skuVariant: '45968383148267',
        quantityApproved: 6
      }]
    };

    console.log('📤 Enviando datos a Shopify:', syncData);

    // Llamar a la función de sincronización
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
        .eq('id', 'd47517be-befb-4567-a978-70e073ca2f10');

      if (updateError) {
        throw updateError;
      }

      console.log('✅ ¡Variante sincronizada exitosamente!');
      console.log(`✅ SKU ${syncData.approvedItems[0].skuVariant} sincronizado con ${syncData.approvedItems[0].quantityApproved} unidades`);
    } else {
      throw new Error(data.error || 'Error desconocido en la sincronización');
    }

  } catch (error) {
    console.error('❌ Error en sincronización:', error);
  }
};

// Ejecutar la función
syncSpecificVariant();