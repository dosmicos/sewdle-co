
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OrderDeliveryStats {
  total_ordered: number;
  total_delivered: number;
  total_approved: number;
  total_defective: number;
  total_pending: number;
  completion_percentage: number;
}

interface DeliveryBreakdown {
  delivery_id: string;
  tracking_number: string;
  delivery_date: string;
  delivery_status: string;
  workshop_name: string;
  items_delivered: number;
  items_approved: number;
  items_defective: number;
  delivery_notes: string;
}

interface VariantBreakdown {
  product_name: string;
  variant_size: string;
  variant_color: string;
  sku_variant: string;
  total_ordered: number;
  total_approved: number;
  total_pending: number;
  completion_percentage: number;
}

export const useOrderDeliveryStats = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getOrderStats = async (orderId: string): Promise<OrderDeliveryStats | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_order_delivery_stats', { order_id_param: orderId });

      if (error) {
        console.error('Error fetching order stats:', error);
        throw error;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('Error getting order stats:', error);
      toast({
        title: "Error al cargar estadísticas",
        description: "No se pudieron cargar las estadísticas de la orden.",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getOrderDeliveriesBreakdown = async (orderId: string): Promise<DeliveryBreakdown[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_order_deliveries_breakdown', { order_id_param: orderId });

      if (error) {
        console.error('Error fetching deliveries breakdown:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error getting deliveries breakdown:', error);
      toast({
        title: "Error al cargar entregas",
        description: "No se pudieron cargar las entregas de la orden.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getOrderVariantsBreakdown = async (orderId: string): Promise<VariantBreakdown[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_order_variants_breakdown', { order_id_param: orderId });

      if (error) {
        console.error('Error fetching variants breakdown:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error getting variants breakdown:', error);
      toast({
        title: "Error al cargar variantes",
        description: "No se pudieron cargar las variantes de la orden.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    getOrderStats,
    getOrderDeliveriesBreakdown,
    getOrderVariantsBreakdown,
    loading
  };
};
