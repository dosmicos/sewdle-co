import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DuplicationEntry {
  id: string;
  sales_quantity: number;
  orders_count: number;
  created_at: string;
}

interface Duplication {
  variant_id: string;
  sku_variant: string;
  product_name: string;
  duplicate_count: number;
  total_sales: number;
  total_orders: number;
  entries: DuplicationEntry[];
}

interface InvestigationResult {
  success: boolean;
  date: string;
  total_metrics: number;
  duplications: Duplication[];
  investigation_summary: {
    total_duplicated_variants: number;
    total_duplicate_entries: number;
    affected_sales: number;
  };
}

export const useSyncDuplicationFixer = () => {
  const [loading, setLoading] = useState(false);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const { toast } = useToast();

  const investigate = async (date: string) => {
    setLoading(true);
    try {
      console.log(`🔍 Investigando duplicaciones para ${date}...`);

      const { data, error } = await supabase.functions.invoke('fix-sync-duplications', {
        body: { action: 'investigate', date }
      });

      if (error) throw error;

      setInvestigation(data);

      if (data.duplications.length > 0) {
        toast({
          title: "🚨 Duplicaciones encontradas",
          description: `Se encontraron ${data.duplications.length} variantes con duplicaciones en ${date}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "✅ Sin duplicaciones",
          description: `No se encontraron duplicaciones en ${date}`,
        });
      }

      return data;

    } catch (error) {
      console.error('Error investigando duplicaciones:', error);
      toast({
        title: "Error de investigación",
        description: error instanceof Error ? error.message : "No se pudo investigar las duplicaciones",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const cleanDuplications = async (date: string, specificSku?: string) => {
    setLoading(true);
    try {
      console.log(`🧹 Limpiando duplicaciones para ${date}${specificSku ? ` - SKU: ${specificSku}` : ''}...`);

      const { data, error } = await supabase.functions.invoke('fix-sync-duplications', {
        body: { action: 'clean', date, specificSku }
      });

      if (error) throw error;

      toast({
        title: "✅ Limpieza completada",
        description: `Se eliminaron ${data.deleted_entries} entradas duplicadas`,
      });

      // Re-investigar después de limpiar
      await investigate(date);

      return data;

    } catch (error) {
      console.error('Error limpiando duplicaciones:', error);
      toast({
        title: "Error de limpieza",
        description: error instanceof Error ? error.message : "No se pudo limpiar las duplicaciones",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const validateCleanup = async (date: string) => {
    setLoading(true);
    try {
      console.log(`✅ Validando limpieza para ${date}...`);

      const { data, error } = await supabase.functions.invoke('fix-sync-duplications', {
        body: { action: 'validate', date }
      });

      if (error) throw error;

      if (data.is_clean) {
        toast({
          title: "✅ Validación exitosa",
          description: "No quedan duplicaciones en la fecha seleccionada",
        });
      } else {
        toast({
          title: "⚠️ Duplicaciones pendientes",
          description: `Aún quedan ${data.duplicates_remaining} duplicaciones`,
          variant: "destructive",
        });
      }

      return data;

    } catch (error) {
      console.error('Error validando limpieza:', error);
      toast({
        title: "Error de validación",
        description: error instanceof Error ? error.message : "No se pudo validar la limpieza",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearInvestigation = () => {
    setInvestigation(null);
  };

  return {
    investigate,
    cleanDuplications,
    validateCleanup,
    clearInvestigation,
    investigation,
    loading
  };
};