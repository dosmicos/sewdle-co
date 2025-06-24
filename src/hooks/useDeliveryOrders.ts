import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/hooks/useUserContext';

export const useDeliveryOrders = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isAdmin, currentUser } = useUserContext();

  const fetchAvailableOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
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
        .order('due_date', { ascending: true, nullsFirst: false });

      // Si el usuario es taller (no admin), filtrar solo órdenes de su taller
      if (!isAdmin && currentUser?.workshopId) {
        query = query.eq('workshop_assignments.workshop_id', currentUser.workshopId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Filtrar solo órdenes que tengan items y estén asignadas a talleres
      const ordersWithItems = data?.filter(order => 
        order.order_items && 
        order.order_items.length > 0 &&
        order.workshop_assignments &&
        order.workshop_assignments.length > 0
      ) || [];

      // Si el usuario no es admin, aplicar filtro adicional por si el filtro en la consulta no funcionó
      if (!isAdmin && currentUser?.workshopId) {
        return ordersWithItems.filter(order => 
          order.workshop_assignments.some(assignment => 
            assignment.workshop_id === currentUser.workshopId
          )
        );
      }

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

  const getOrderStats = async (orderId: string) => {
    setLoading(true);
    try {
      // Usar la función corregida que usa los campos estructurados
      const { data, error } = await supabase
        .rpc('get_order_delivery_stats_v2', { order_id_param: orderId });

      if (error) {
        throw error;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('Error fetching order stats:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getOrderDeliveriesBreakdown = async (orderId: string) => {
    setLoading(true);
    try {
      // Esta función ya fue actualizada para usar los nuevos campos estructurados
      const { data, error } = await supabase
        .rpc('get_order_deliveries_breakdown', { order_id_param: orderId });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching deliveries breakdown:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    fetchAvailableOrders,
    fetchOrderItems,
    getOrderDeliveries,
    getOrderStats,
    getOrderDeliveriesBreakdown,
    loading
  };
};
