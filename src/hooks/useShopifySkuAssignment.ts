
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SkuAssignmentResult {
  success: boolean;
  message: string;
  status?: string;
  processId?: string;
  note?: string;
  summary?: {
    totalProducts: number;
    totalVariants: number;
    processedVariants: number;
    updatedVariants: number;
    errorVariants: number;
    skippedVariants: number;
  };
  details?: any[];
  nextCursor?: string;
}

export const useShopifySkuAssignment = () => {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const assignShopifySkus = async (options?: {
    processId?: string;
    resumeFromCursor?: string;
    maxVariants?: number;
  }): Promise<SkuAssignmentResult | null> => {
    setLoading(true);
    try {
      console.log('Iniciando asignación de SKUs con opciones:', options);

      const { data, error } = await supabase.functions.invoke('assign-shopify-skus-simple', {
        body: options || { maxVariants: 100 }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Error en la asignación de SKUs');
      }

      // Mostrar mensaje según el estado
      if (data.status === 'completed') {
        toast({
          title: "🎉 Proceso completado",
          description: data.message,
        });
      } else if (data.status === 'paused') {
        setProcessing(true);
        toast({
          title: "📊 Lote procesado",
          description: `${data.message} Haz clic en "Continuar" para procesar más.`,
        });
      } else {
        toast({
          title: "⚡ Procesando",
          description: data.message,
        });
      }

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

  const resumeProcess = async (processId: string, cursor?: string) => {
    return await assignShopifySkus({
      processId,
      resumeFromCursor: cursor,
      maxVariants: 100
    });
  };

  return {
    assignShopifySkus,
    resumeProcess,
    loading,
    processing,
    setProcessing
  };
};
