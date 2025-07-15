import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useOrderMaterialConsumptions = (orderId: string) => {
  return useQuery({
    queryKey: ['order-material-consumptions', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_deliveries')
        .select(`
          id,
          quantity_consumed,
          delivery_date,
          notes,
          created_at,
          materials (
            id,
            name,
            sku,
            unit,
            category,
            color
          )
        `)
        .eq('order_id', orderId)
        .gt('quantity_consumed', 0)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching material consumptions:', error);
        throw error;
      }

      // Group consumptions by material and sum quantities
      const groupedConsumptions = (data || []).reduce((acc: any[], consumption: any) => {
        const materialId = consumption.materials?.id;
        if (!materialId) return acc;

        const existingIndex = acc.findIndex(item => item.materials?.id === materialId);
        
        if (existingIndex >= 0) {
          // Add to existing material
          acc[existingIndex].quantity_consumed += consumption.quantity_consumed;
          // Keep the most recent delivery date
          if (new Date(consumption.delivery_date) > new Date(acc[existingIndex].delivery_date)) {
            acc[existingIndex].delivery_date = consumption.delivery_date;
            acc[existingIndex].created_at = consumption.created_at;
          }
          // Combine notes if they exist and are different
          if (consumption.notes && !acc[existingIndex].notes?.includes(consumption.notes)) {
            acc[existingIndex].notes = acc[existingIndex].notes 
              ? `${acc[existingIndex].notes}; ${consumption.notes}`
              : consumption.notes;
          }
        } else {
          // Add new material
          acc.push({...consumption});
        }
        
        return acc;
      }, []);

      return groupedConsumptions;
    },
    enabled: !!orderId,
  });
};