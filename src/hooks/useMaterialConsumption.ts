
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
        p_order_id: orderId,
        p_consumptions: consumptionData
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

  const getMaterialAvailability = async (materialId: string, workshopId?: string) => {
    try {
      if (workshopId) {
        // Usar la nueva función centralizada para obtener el stock exacto
        const { data: stockInfo, error: stockError } = await supabase
          .rpc('get_workshop_material_stock', {
            material_id_param: materialId,
            workshop_id_param: workshopId
          });

        if (stockError) throw stockError;

        // También obtener información básica del material
        const { data: materialData, error: materialError } = await supabase
          .from('materials')
          .select('min_stock_alert, name, unit, sku')
          .eq('id', materialId)
          .single();

        if (materialError) throw materialError;

        const stockRecord = stockInfo?.[0];
        const available = stockRecord?.available_stock || 0;

        return {
          ...materialData,
          available,
          total_delivered: stockRecord?.total_delivered || 0,
          total_consumed: stockRecord?.total_consumed || 0,
          isLowStock: available <= (materialData.min_stock_alert || 0)
        };
      } else {
        // Fallback al stock global si no se especifica taller
        const { data, error } = await supabase
          .from('materials')
          .select('current_stock, min_stock_alert, name, unit, sku')
          .eq('id', materialId)
          .single();

        if (error) throw error;

        return {
          ...data,
          available: data.current_stock || 0,
          isLowStock: (data.current_stock || 0) <= (data.min_stock_alert || 0)
        };
      }
    } catch (error) {
      console.error('Error getting material availability:', error);
      return null;
    }
  };

  const validateMaterialConsumption = async (materialId: string, workshopId: string, quantity: number) => {
    try {
      const availability = await getMaterialAvailability(materialId, workshopId);
      if (!availability) return { isValid: false, error: 'No se pudo verificar el stock' };
      
      const isValid = availability.available >= quantity;
      return {
        isValid,
        available: availability.available,
        error: isValid ? null : `Stock insuficiente. Disponible: ${availability.available}, Requerido: ${quantity}`
      };
    } catch (error) {
      console.error('Error validating material consumption:', error);
      return { isValid: false, error: 'Error al validar el stock' };
    }
  };

  return {
    loading,
    consumeOrderMaterials,
    getMaterialAvailability,
    validateMaterialConsumption
  };
};
