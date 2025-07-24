import { supabase } from '@/integrations/supabase/client';

export const resyncDeliveryStatus = async (deliveryId: string) => {
  try {
    console.log(`🔄 Recalculando estado de sincronización para entrega ${deliveryId}...`);
    
    // Trigger the recalculation by calling our database function
    const { data, error } = await supabase.rpc('fix_delivery_sync_status_inconsistencies');
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Estado de sincronización recalculado:', data);
    return data;
  } catch (error) {
    console.error('❌ Error recalculando estado de sincronización:', error);
    throw error;
  }
};

export const resyncAllDeliveriesStatus = async () => {
  try {
    console.log('🔄 Recalculando estado de sincronización para todas las entregas...');
    
    const { data, error } = await supabase.rpc('fix_delivery_sync_status_inconsistencies');
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Estado de sincronización recalculado para todas las entregas:', data);
    return data;
  } catch (error) {
    console.error('❌ Error recalculando estado de sincronización:', error);
    throw error;
  }
};