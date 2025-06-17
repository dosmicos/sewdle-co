
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useDeliveryOrders = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAvailableOrders = async () => {
    setLoading(true);
    try {
      // Obtener órdenes que estén asignadas o en progreso y tengan items
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product_variants (
              *,
              products (*)
            )
          ),
          workshop_assignments (
            *,
            workshops (
              name
            )
          )
        `)
        .in('status', ['assigned', 'in_progress'])
        .order('due_date', { ascending: true, nullsLast: true });

      if (error) {
        throw error;
      }

      // Filtrar solo órdenes que tengan items
      const ordersWithItems = data?.filter(order => 
        order.order_items && order.order_items.length > 0
      ) || [];

      return ordersWithItems;
    } catch (error) {
      console.error('Error fetching available orders:', error);
      toast({
        title: "Error al cargar órdenes",
        description: "No se pudieron cargar las órdenes disponibles para entrega.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          product_variants (
            *,
            products (*)
          )
        `)
        .eq('order_id', orderId);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching order items:', error);
      toast({
        title: "Error al cargar items",
        description: "No se pudieron cargar los items de la orden.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getOrderDeliveries = async (orderId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          delivery_items (
            *,
            order_items (
              *,
              product_variants (
                *,
                products (*)
              )
            )
          ),
          workshops (
            name
          )
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching order deliveries:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    fetchAvailableOrders,
    fetchOrderItems,
    getOrderDeliveries,
    loading
  };
};
