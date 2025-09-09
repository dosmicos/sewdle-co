
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

  const assignShopifySkus = async (): Promise<SkuAssignmentResult | null> => {
    if (loading) return null;
    
    setLoading(true);
    setProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('assign-shopify-skus-simple', {
        body: {}
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: "Asignación Completada",
          description: data.message,
          duration: 5000,
        });
        return data;
      } else {
        toast({
          title: "Error en asignación", 
          description: data?.error || "Error desconocido",
          variant: "destructive",
        });
        return null;
      }
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
      setProcessing(false);
    }
  };

  return {
    assignShopifySkus,
    loading,
    processing,
    setProcessing,
  };
};
