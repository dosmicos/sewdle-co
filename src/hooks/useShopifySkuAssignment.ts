
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SkuAssignmentResult {
  success: boolean;
  summary: {
    totalProducts: number;
    totalVariants: number;
    updatedVariants: number;
    errorVariants: number;
    skippedVariants: number;
  };
  details: any[];
  message: string;
}

export const useShopifySkuAssignment = () => {
  const [loading, setLoading] = useState(false);
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

      toast({
        title: "SKUs asignados en Shopify",
        description: `${data.summary.updatedVariants} variantes actualizadas con nuevos SKUs`,
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
    loading
  };
};
