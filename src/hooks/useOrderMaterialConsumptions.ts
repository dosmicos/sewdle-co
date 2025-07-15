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

      return data || [];
    },
    enabled: !!orderId,
  });
};