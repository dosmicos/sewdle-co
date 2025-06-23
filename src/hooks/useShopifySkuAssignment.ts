
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SkuAssignmentResult {
  success: boolean;
  message: string;
  status?: string;
  note?: string;
  summary?: {
    totalProducts: number;
    totalVariants: number;
    updatedVariants: number;
    errorVariants: number;
    skippedVariants: number;
  };
  details?: any[];
}

export const useShopifySkuAssignment = () => {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const assignShopifySkus = async (): Promise<SkuAssignmentResult | null> => {
    setLoading(true);
    try {
      console.log('Iniciando asignación de SKUs en Shopify...');

      const { data, error } = await supabase.functions.invoke('assign-shopify-skus');

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Error en la asignación de SKUs');
      }

      // Si el proceso está en background
      if (data.status === 'processing') {
        setProcessing(true);
        toast({
          title: "Procesamiento iniciado",
          description: "La asignación de SKUs está ejecutándose en segundo plano. Solo se procesarán productos activos/borrador.",
        });

        // Simular progreso y ocultar el estado de procesamiento después de un tiempo
        setTimeout(() => {
          setProcessing(false);
          toast({
            title: "Proceso en marcha",
            description: "El proceso continúa ejecutándose. Puedes revisar tu tienda Shopify para ver el progreso.",
          });
        }, 10000);

        return data as SkuAssignmentResult;
      }

      // Si hay resultados inmediatos (caso poco probable con la nueva implementación)
      toast({
        title: "SKUs asignados en Shopify",
        description: data.message || "Proceso completado exitosamente",
      });

      return data as SkuAssignmentResult;

    } catch (error) {
      console.error('Error asignando SKUs:', error);
      toast({
        title: "Error en asignación de SKUs",
        description: error instanceof Error ? error.message : "No se pudieron asignar los SKUs en Shopify",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    assignShopifySkus,
    loading,
    processing
  };
};
