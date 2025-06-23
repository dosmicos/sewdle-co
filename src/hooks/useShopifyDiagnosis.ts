
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DiagnosisResult {
  success: boolean;
  analysis: {
    localProducts: number;
    shopifyProducts: number;
    matchedSkus: any[];
    unmatchedSkus: any[];
    duplicateSkus: any[];
    emptySkus: any[];
    formatIssues: any[];
  };
  patterns: {
    localPatterns: any;
    shopifyPatterns: any;
    suggestions: any[];
  };
  summary: {
    totalLocalProducts: number;
    totalShopifyProducts: number;
    matchedSkus: number;
    unmatchedSkus: number;
    emptySkus: number;
    matchRate: string;
  };
}

export const useShopifyDiagnosis = () => {
  const [loading, setLoading] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const { toast } = useToast();

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      console.log('Ejecutando diagnóstico de Shopify...');

      const { data, error } = await supabase.functions.invoke('diagnose-shopify-sync');

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Error en el diagnóstico');
      }

      setDiagnosisResult(data);

      toast({
        title: "Diagnóstico completado",
        description: `${data.summary.matchedSkus} SKUs coinciden de ${data.summary.totalLocalProducts} productos locales`,
      });

      return data;

    } catch (error) {
      console.error('Error en diagnóstico:', error);
      toast({
        title: "Error en diagnóstico",
        description: error instanceof Error ? error.message : "No se pudo ejecutar el diagnóstico",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    runDiagnosis,
    diagnosisResult,
    loading
  };
};
