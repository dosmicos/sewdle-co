

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useOrderActions = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const deleteOrder = async (orderId: string) => {
    setLoading(true);
    try {
      console.log('Deleting order:', orderId);

      // CORRECCIÓN: Eliminar en el orden correcto para evitar errores de FK
      
      // 1. Primero obtener los IDs de deliveries asociadas a esta orden
      const { data: deliveries, error: deliveriesQueryError } = await supabase
        .from('deliveries')
        .select('id')
        .eq('order_id', orderId);

      if (deliveriesQueryError) {
        console.error('Error fetching deliveries:', deliveriesQueryError);
      }

      // 2. Si hay deliveries, eliminar sus delivery_items
      if (deliveries && deliveries.length > 0) {
        const deliveryIds = deliveries.map(d => d.id);
        
        const { error: deliveryItemsError } = await supabase
          .from('delivery_items')
          .delete()
          .in('delivery_id', deliveryIds);

        if (deliveryItemsError) {
          console.error('Error deleting delivery items:', deliveryItemsError);
        }
      }

      // 3. Eliminar deliveries (depende de orders)
      const { error: deliveriesError } = await supabase
        .from('deliveries')
        .delete()
        .eq('order_id', orderId);

      if (deliveriesError) {
        console.error('Error deleting deliveries:', deliveriesError);
      }

      // 4. Eliminar entregas de materiales (depende de orders)
      const { error: materialDeliveriesError } = await supabase
        .from('material_deliveries')
        .delete()
        .eq('order_id', orderId);

      if (materialDeliveriesError) {
        console.error('Error deleting material deliveries:', materialDeliveriesError);
      }

      // 5. Eliminar archivos de la orden
      const { error: filesError } = await supabase
        .from('order_files')
        .delete()
        .eq('order_id', orderId);

      if (filesError) {
        console.error('Error deleting order files:', filesError);
      }

      // 6. Eliminar insumos de la orden
      const { error: suppliesError } = await supabase
        .from('order_supplies')
        .delete()
        .eq('order_id', orderId);

      if (suppliesError) {
        console.error('Error deleting order supplies:', suppliesError);
      }

      // 7. Eliminar items de la orden
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (itemsError) {
        console.error('Error deleting order items:', itemsError);
      }

      // 8. Eliminar asignaciones de taller
      const { error: assignmentsError } = await supabase
        .from('workshop_assignments')
        .delete()
        .eq('order_id', orderId);

      if (assignmentsError) {
        console.error('Error deleting workshop assignments:', assignmentsError);
      }

      // 9. Finalmente eliminar la orden
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (orderError) {
        console.error('Error deleting order:', orderError);
        throw orderError;
      }

      toast({
        title: "Orden eliminada",
        description: "La orden de producción ha sido eliminada exitosamente.",
      });

      return true;
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Error al eliminar la orden",
        description: "Hubo un problema al eliminar la orden de producción. Verifique que no tenga entregas asociadas.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateOrder = async (orderId: string, updates: any) => {
    setLoading(true);
    try {
      console.log('Updating order:', orderId, updates);

      const { error } = await supabase
        .from('orders')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order:', error);
        throw error;
      }

      toast({
        title: "Orden actualizada",
        description: "La orden de producción ha sido actualizada exitosamente.",
      });

      return true;
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Error al actualizar la orden",
        description: "Hubo un problema al actualizar la orden de producción.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateOrderItemQuantities = async (orderId: string, updatedItems: { id: string; quantity: number; total_price: number }[]) => {
    setLoading(true);
    try {
      console.log('Updating order item quantities:', orderId, updatedItems);

      // Actualizar cada item individualmente
      for (const item of updatedItems) {
        const { error: itemError } = await supabase
          .from('order_items')
          .update({
            quantity: item.quantity,
            total_price: item.total_price,
          })
          .eq('id', item.id);

        if (itemError) {
          console.error('Error updating order item:', itemError);
          throw itemError;
        }
      }

      // Calcular y actualizar el total de la orden
      const newTotalAmount = updatedItems.reduce((total, item) => total + item.total_price, 0);
      
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          total_amount: newTotalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderError) {
        console.error('Error updating order total:', orderError);
        throw orderError;
      }

      toast({
        title: "Cantidades actualizadas",
        description: "Las cantidades de producción han sido actualizadas exitosamente.",
      });

      return true;
    } catch (error) {
      console.error('Error updating order item quantities:', error);
      toast({
        title: "Error al actualizar cantidades",
        description: "Hubo un problema al actualizar las cantidades de producción.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    deleteOrder,
    updateOrder,
    updateOrderItemQuantities,
    loading
  };
};

