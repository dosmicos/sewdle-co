
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticResult {
  shopify_data: {
    orders_count: number;
    total_units: number;
    unique_products: number;
    orders: any[];
  };
  local_data: {
    metrics_count: number;
    total_units: number;
    unique_variants: number;
    date_range: string;
  };
  discrepancies: {
    unit_difference: number;
    missing_orders: number;
    duplicate_entries: number;
  };
}

interface DiagnosticSummary {
  date: string;
  shopify_units: number;
  local_units: number;
  difference: number;
  accuracy_percentage: number;
}

export const useShopifyDiagnosis = () => {
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const { toast } = useToast();

  const runDiagnosis = async (date: string = '2025-07-23') => {
    setLoading(true);
    try {
      console.log(`🔍 Ejecutando diagnóstico para ${date}...`);

      const { data, error } = await supabase.functions.invoke('diagnose-shopify-sync', {
        body: { date }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Error en el diagnóstico');
      }

      setDiagnostic(data.diagnostic);
      setSummary(data.summary);

      const { difference, shopify_units, local_units } = data.summary;
      
      if (difference === 0) {
        toast({
          title: "✅ Sincronización correcta",
          description: `Los datos están sincronizados correctamente: ${shopify_units} unidades`,
        });
      } else {
        toast({
          title: "⚠️ Discrepancia encontrada",
          description: `Shopify: ${shopify_units} unidades vs Local: ${local_units} unidades (diferencia: ${difference})`,
          variant: "destructive",
        });
      }

      return data;

    } catch (error) {
      console.error('Error en diagnóstico:', error);
      toast({
        title: "Error de diagnóstico",
        description: error instanceof Error ? error.message : "No se pudo ejecutar el diagnóstico",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearDiagnosis = () => {
    setDiagnostic(null);
    setSummary(null);
  };

  return {
    runDiagnosis,
    clearDiagnosis,
    diagnostic,
    summary,
    loading
  };
};
