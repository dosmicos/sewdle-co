import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ConsolidationResult {
  success: boolean;
  variants_consolidated?: number;
  consolidation_details?: any;
  error?: string;
}

export const useVariantConsolidation = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const consolidateDuplicates = async (): Promise<ConsolidationResult | null> => {
    setLoading(true);
    try {
      console.log('Iniciando consolidación de variantes duplicadas');

      const { data, error } = await supabase.functions.invoke('consolidate-duplicate-variants');

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Error en la consolidación de variantes');
      }

      // Mostrar mensaje según el resultado
      if (data.variants_consolidated > 0) {
        toast({
          title: "🎉 Consolidación completada",
          description: `Se consolidaron ${data.variants_consolidated} variantes duplicadas exitosamente.`,
        });
      } else {
        toast({
          title: "✅ Sin duplicados",
          description: "No se encontraron variantes duplicadas para consolidar.",
        });
      }

      return data as ConsolidationResult;

    } catch (error) {
      console.error('Error consolidando variantes:', error);
      toast({
        title: "Error en consolidación",
        description: error instanceof Error ? error.message : "No se pudieron consolidar las variantes duplicadas",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const checkForDuplicates = async () => {
    try {
      const { data, error } = await supabase.rpc('consolidate_duplicate_variants');
      
      if (error) throw error;
      
      // Safe type checking for consolidation details
      if (data && typeof data === 'object' && 'consolidation_details' in data) {
        const details = data.consolidation_details as any;
        return details?.consolidations || [];
      }
      
      return [];
    } catch (error) {
      console.error('Error verificando duplicados:', error);
      return [];
    }
  };

  return {
    consolidateDuplicates,
    checkForDuplicates,
    loading
  };
};