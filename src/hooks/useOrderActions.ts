
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

      // Eliminar archivos de la orden
      const { error: filesError } = await supabase
        .from('order_files')
        .delete()
        .eq('order_id', orderId);

      if (filesError) {
        console.error('Error deleting order files:', filesError);
      }

      // Eliminar insumos de la orden
      const { error: suppliesError } = await supabase
        .from('order_supplies')
        .delete()
        .eq('order_id', orderId);

      if (suppliesError) {
        console.error('Error deleting order supplies:', suppliesError);
      }

      // Eliminar items de la orden
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (itemsError) {
        console.error('Error deleting order items:', itemsError);
      }

      // Eliminar asignaciones de taller
      const { error: assignmentsError } = await supabase
        .from('workshop_assignments')
        .delete()
        .eq('order_id', orderId);

      if (assignmentsError) {
        console.error('Error deleting workshop assignments:', assignmentsError);
      }

      // Finalmente eliminar la orden
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
        description: "Hubo un problema al eliminar la orden de producción.",
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

  return {
    deleteOrder,
    updateOrder,
    loading
  };
};
