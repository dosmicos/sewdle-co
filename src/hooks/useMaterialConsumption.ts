
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MaterialConsumption {
  material_id: string;
  quantity: number;
}

export const useMaterialConsumption = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const consumeOrderMaterials = async (orderId: string, consumptions: MaterialConsumption[]) => {
    setLoading(true);
    try {
      console.log('Consuming materials for order:', orderId, consumptions);

      // Convert to JSON-compatible format for the database function
      const consumptionData = consumptions.map(item => ({
        material_id: item.material_id,
        quantity: item.quantity
      }));

      const { error } = await supabase.rpc('consume_order_materials', {
        order_id_param: orderId,
        consumption_data: consumptionData
      });

      if (error) {
        console.error('Error consuming materials:', error);
        throw error;
      }

      toast({
        title: "Materiales consumidos exitosamente",
        description: `Se actualizó el stock de ${consumptions.length} materiales.`,
      });

      return true;
    } catch (error: any) {
      console.error('Error consuming materials:', error);
      
      let errorMessage = "No se pudieron consumir los materiales";
      
      if (error.message?.includes('Stock insuficiente')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      toast({
        title: "Error al consumir materiales",
        description: errorMessage,
        variant: "destructive",
      });
      
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getMaterialAvailability = async (materialId: string) => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('current_stock, min_stock_alert, name, unit')
        .eq('id', materialId)
        .single();

      if (error) throw error;

      return {
        ...data,
        available: data.current_stock || 0,
        isLowStock: (data.current_stock || 0) <= (data.min_stock_alert || 0)
      };
    } catch (error) {
      console.error('Error getting material availability:', error);
      return null;
    }
  };

  return {
    loading,
    consumeOrderMaterials,
    getMaterialAvailability
  };
};
